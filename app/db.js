/*
 * Postgres (Neon free tier) storage backend for user-memory.js.
 *
 * Mirrors the file-based store's behavior method-for-method: same JSONB
 * document shapes as the JSON files, same return types/values for every
 * method. `ws-bridge.js` picks this backend over the file backend when
 * DATABASE_URL is set; the two are meant to be interchangeable behind
 * user-memory.js's factory.
 *
 * Hardening baked into every method (design.md §3, review m4/M6):
 *   - parameterized ($1-style) queries only, never string interpolation
 *   - uid gate: must match /^[A-Za-z0-9_-]{1,64}$/ and must NOT start with
 *     "guest_" — guest data must never land in this database (D3)
 *   - a ~64KB cap on the JSONB payload written to user_memory.data and
 *     chat_sessions.messages, to stop one hostile account from bloating the
 *     free-tier DB
 *   - every method except init() swallows its own errors and returns the
 *     same "not found / no-op" value the file store would return, so a
 *     transient DB hiccup never throws into a request handler
 */
'use strict';

/**
 * @param {{
 *   databaseUrl: string,
 *   normalizeQuizProfile: (quiz?: object) => object,
 * }} deps
 */
module.exports = function createPgStore(deps) {
    const databaseUrl = deps && deps.databaseUrl;
    const normalizeQuizProfile = deps && deps.normalizeQuizProfile;
    if (typeof databaseUrl !== 'string' || !databaseUrl || typeof normalizeQuizProfile !== 'function') {
        throw new Error('db: missing required deps {databaseUrl, normalizeQuizProfile}');
    }

    // Required lazily so merely loading this module (e.g. via `node --check`,
    // or when DATABASE_URL is unset and the file store is used instead) never
    // pulls in the `pg` package.
    const { Pool } = require('pg');

    // TLS is controlled entirely by the connection string's sslmode param,
    // not by an explicit `ssl` option here — Neon connection strings ship
    // `sslmode=require`; local/test Postgres URLs may use `sslmode=disable`.
    const pool = new Pool({ connectionString: databaseUrl, max: 3 });

    // Neon's free tier autosuspends the compute and can kill idle pooled
    // connections out from under us; without this handler, that error surfaces
    // as an unhandled 'error' event on the Pool and crashes the whole process.
    pool.on('error', (err) => {
        console.warn('[db] idle client error:', err.message);
    });

    const DDL_STATEMENTS = [
        `CREATE TABLE IF NOT EXISTS users (
            uid        TEXT PRIMARY KEY,
            email      TEXT, name TEXT, image_url TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS user_memory (
            uid        TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
            data       JSONB NOT NULL DEFAULT '{}',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS chat_sessions (
            id         UUID  PRIMARY KEY,
            uid        TEXT  NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
            meta       JSONB NOT NULL,
            messages   JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS chat_sessions_uid_updated ON chat_sessions (uid, updated_at DESC)`,
        `CREATE TABLE IF NOT EXISTS feedback_items (
            id         TEXT  PRIMARY KEY,
            data       JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL
        )`
    ];

    const JSONB_CAP_BYTES = 64 * 1024;
    let guestWriteWarned = false;

    function warnGuestWriteRefused() {
        if (guestWriteWarned) return;
        guestWriteWarned = true;
        console.warn('[db] refusing to write guest_* uid to Postgres (guest data stays client-side, D3)');
    }

    // uid gate (design §3 / review m4): must be a well-formed uid AND must not
    // be a guest uid. Reads/deletes call this with no options and fail
    // silently; writes pass warnOnGuestWrite so a guest write attempt logs
    // once per process instead of spamming.
    function checkUidGate(uid, { warnOnGuestWrite = false } = {}) {
        if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(uid)) return false;
        if (uid.startsWith('guest_')) {
            if (warnOnGuestWrite) warnGuestWriteRefused();
            return false;
        }
        return true;
    }

    function isValidSessionId(id) {
        return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(id || ''));
    }

    function exceedsSizeCap(value) {
        try {
            return Buffer.byteLength(JSON.stringify(value), 'utf8') > JSONB_CAP_BYTES;
        } catch (_) {
            return true; // unmeasurable input is refused rather than risked
        }
    }

    // FK-dependent writes (user_memory, chat_sessions) fail with a foreign-key
    // violation unless a users row already exists — clerk-verify only ever
    // hands us {uid, sid}, so this upsert must run first (review M1).
    async function ensureUserRow(uid) {
        await pool.query('INSERT INTO users (uid) VALUES ($1) ON CONFLICT (uid) DO NOTHING', [uid]);
    }

    async function init() {
        // Intentionally the only method allowed to throw: if DATABASE_URL is
        // set but unreachable, the bridge must crash loudly at startup rather
        // than silently falling back to the ephemeral file store (same
        // fail-fast philosophy as the materials-dir resolution).
        await pool.query('SELECT 1');
        for (const stmt of DDL_STATEMENTS) {
            await pool.query(stmt);
        }
        console.log('[db] Postgres store active');
    }

    async function readUserMemory(uid) {
        if (!checkUidGate(uid)) return null;
        try {
            const result = await pool.query('SELECT data FROM user_memory WHERE uid = $1', [uid]);
            if (!result.rows.length) return null;
            const doc = result.rows[0].data;
            if (doc && doc.quiz) doc.quiz = normalizeQuizProfile(doc.quiz);
            return doc;
        } catch (e) {
            console.warn('[db] readUserMemory failed:', e.message);
            return null;
        }
    }

    async function writeUserMemory(uid, data) {
        if (!checkUidGate(uid, { warnOnGuestWrite: true })) return undefined;
        if (exceedsSizeCap(data)) {
            console.warn('[db] writeUserMemory refused: document exceeds 64KB cap for uid', uid);
            return undefined;
        }
        try {
            await ensureUserRow(uid);
            // node-postgres serializes plain JS objects to JSON automatically for
            // jsonb params, but it serializes JS ARRAYS as Postgres array literals
            // instead — so every jsonb param here is JSON.stringify'd explicitly
            // for consistency and to avoid that array pitfall.
            await pool.query(
                'INSERT INTO user_memory (uid, data, updated_at) VALUES ($1, $2, now()) ON CONFLICT (uid) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
                [uid, JSON.stringify(data)]
            );
        } catch (e) {
            console.warn('[db] writeUserMemory failed:', e.message);
        }
        return undefined;
    }

    async function listSessionsForUid(uid) {
        if (!checkUidGate(uid)) return [];
        try {
            const result = await pool.query(
                'SELECT id, meta, created_at, updated_at, jsonb_array_length(messages) AS message_count FROM chat_sessions WHERE uid = $1 ORDER BY updated_at DESC',
                [uid]
            );
            return result.rows.map((row) => {
                const meta = row.meta || {};
                return {
                    id: row.id,
                    title: meta.customTitle || meta.title || 'Untitled',
                    origin: meta.origin || 'main',
                    sectionId: meta.sectionId || '',
                    sectionTitle: meta.sectionTitle || '',
                    starred: !!meta.starred,
                    createdAt: row.created_at.toISOString(),
                    updatedAt: row.updated_at.toISOString(),
                    messageCount: Number(row.message_count) || 0
                };
            });
        } catch (e) {
            console.warn('[db] listSessionsForUid failed:', e.message);
            return [];
        }
    }

    async function readSessionFile(uid, id) {
        if (!checkUidGate(uid) || !isValidSessionId(id)) return null;
        try {
            const result = await pool.query(
                'SELECT id, uid, meta, messages, created_at, updated_at FROM chat_sessions WHERE uid = $1 AND id = $2',
                [uid, id]
            );
            if (!result.rows.length) return null;
            const row = result.rows[0];
            const meta = row.meta || {};
            return {
                id: row.id,
                uid: row.uid,
                origin: meta.origin || 'main',
                title: meta.title || '',
                customTitle: meta.customTitle || '',
                starred: !!meta.starred,
                sectionId: meta.sectionId || '',
                sectionTitle: meta.sectionTitle || '',
                createdAt: row.created_at.toISOString(),
                updatedAt: row.updated_at.toISOString(),
                messages: Array.isArray(row.messages) ? row.messages : []
            };
        } catch (e) {
            console.warn('[db] readSessionFile failed:', e.message);
            return null;
        }
    }

    async function writeSessionFile(uid, session) {
        const id = session && session.id;
        if (!checkUidGate(uid, { warnOnGuestWrite: true }) || !isValidSessionId(id)) return false;
        const messages = Array.isArray(session.messages) ? session.messages : [];
        if (exceedsSizeCap(messages)) {
            console.warn('[db] writeSessionFile refused: messages exceed 64KB cap for session', id);
            return false;
        }
        const meta = {
            origin: session.origin || 'main',
            title: session.title || '',
            customTitle: session.customTitle || '',
            starred: !!session.starred,
            sectionId: session.sectionId || '',
            sectionTitle: session.sectionTitle || ''
        };
        try {
            await ensureUserRow(uid);
            // Ownership guard: the WHERE clause on the DO UPDATE means one uid
            // can never overwrite another uid's session id via this upsert.
            const result = await pool.query(
                `INSERT INTO chat_sessions (id, uid, meta, messages, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE SET meta = EXCLUDED.meta, messages = EXCLUDED.messages, updated_at = EXCLUDED.updated_at
                 WHERE chat_sessions.uid = EXCLUDED.uid`,
                [id, uid, JSON.stringify(meta), JSON.stringify(messages), session.createdAt, session.updatedAt]
            );
            return result.rowCount > 0;
        } catch (e) {
            console.warn('[db] writeSessionFile failed:', e.message);
            return false;
        }
    }

    async function deleteSessionForUid(uid, id) {
        if (!checkUidGate(uid) || !isValidSessionId(id)) return false;
        try {
            const result = await pool.query('DELETE FROM chat_sessions WHERE uid = $1 AND id = $2', [uid, id]);
            return result.rowCount > 0;
        } catch (e) {
            console.warn('[db] deleteSessionForUid failed:', e.message);
            return false;
        }
    }

    async function readFeedbackBoard() {
        try {
            const result = await pool.query('SELECT data FROM feedback_items ORDER BY created_at DESC');
            return { items: result.rows.map((row) => row.data) };
        } catch (e) {
            console.warn('[db] readFeedbackBoard failed:', e.message);
            return { items: [] };
        }
    }

    async function writeFeedbackBoard(board) {
        const items = Array.isArray(board && board.items) ? board.items : [];
        let client;
        try {
            client = await pool.connect();
        } catch (e) {
            console.warn('[db] writeFeedbackBoard failed:', e.message);
            return undefined;
        }
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM feedback_items');
            for (const item of items) {
                if (!item || !item.id) continue;
                await client.query(
                    'INSERT INTO feedback_items (id, data, created_at) VALUES ($1, $2, $3)',
                    [item.id, JSON.stringify(item), item.createdAt || new Date().toISOString()]
                );
            }
            await client.query('COMMIT');
        } catch (e) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            console.warn('[db] writeFeedbackBoard failed:', e.message);
        } finally {
            client.release();
        }
        return undefined;
    }

    return {
        init,
        readUserMemory,
        writeUserMemory,
        listSessionsForUid,
        readSessionFile,
        writeSessionFile,
        deleteSessionForUid,
        readFeedbackBoard,
        writeFeedbackBoard,
    };
};
