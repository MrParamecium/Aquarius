/*
 * User teaching instructions + persisted chat sessions.
 *
 * Two interchangeable storage backends expose the same six primitives:
 *   readUserMemory / writeUserMemory
 *   listSessionsForUid / readSessionFile
 *   writeSessionFile / deleteSessionForUid
 *
 * File mode stores JSON under USERS_DIR. When DATABASE_URL is set, app/db.js
 * stores the same document shapes in Neon Postgres. Guest data never reaches
 * this module; it stays in browser session storage.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * @param {{ usersDir: string, databaseUrl?: string, store?: object }} deps
 */
module.exports = function createUserMemory(deps) {
    const USERS_DIR = deps && deps.usersDir;
    const DATABASE_URL = (deps && deps.databaseUrl) || '';
    const injectedStore = deps && deps.store;
    if (typeof USERS_DIR !== 'string' || !USERS_DIR) {
        throw new Error('user-memory: missing required dep {usersDir}');
    }

    const usingPg = Boolean(DATABASE_URL) && !injectedStore;
    const SESSIONS_DIR = path.join(USERS_DIR, 'sessions');
    if (!usingPg) {
        fs.mkdirSync(USERS_DIR, { recursive: true });
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }

    function sanitizeUid(uid) {
        return String(uid || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    }

    function isValidSessionId(id) {
        return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(id || ''));
    }

    function getUserMemoryPath(uid) {
        const safe = sanitizeUid(uid);
        return safe ? path.join(USERS_DIR, `${safe}.json`) : null;
    }

    function getSessionsDirForUid(uid) {
        const safe = sanitizeUid(uid);
        return safe ? path.join(SESSIONS_DIR, safe) : null;
    }

    function getSessionPath(uid, id) {
        const dir = getSessionsDirForUid(uid);
        return dir && isValidSessionId(id) ? path.join(dir, `${id}.json`) : null;
    }

    function fileReadUserMemory(uid) {
        const file = getUserMemoryPath(uid);
        if (!file) return null;
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (_) {
            return null;
        }
    }

    function fileWriteUserMemory(uid, data) {
        const file = getUserMemoryPath(uid);
        if (!file) return false;
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
        return true;
    }

    function fileReadSessionFile(uid, id) {
        const file = getSessionPath(uid, id);
        if (!file) return null;
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (error) {
            if (error && error.code === 'ENOENT') return null;
            throw error;
        }
    }

    function fileWriteSessionFile(uid, session) {
        const file = getSessionPath(uid, session && session.id);
        if (!file) return false;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
        try {
            fs.writeFileSync(temporary, JSON.stringify(session, null, 2), 'utf8');
            fs.renameSync(temporary, file);
            return true;
        } catch (error) {
            try { fs.unlinkSync(temporary); } catch (_) {}
            throw error;
        }
    }

    function sessionMetaOf(session) {
        return {
            id: session.id,
            title: session.customTitle || session.title || 'Untitled',
            origin: session.origin || 'main',
            sectionId: session.sectionId || '',
            sectionTitle: session.sectionTitle || '',
            starred: Boolean(session.starred),
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
        };
    }

    function fileListSessionsForUid(uid) {
        const directory = getSessionsDirForUid(uid);
        if (!directory || !fs.existsSync(directory)) return [];
        const sessions = [];
        for (const filename of fs.readdirSync(directory)) {
            if (!filename.endsWith('.json')) continue;
            sessions.push(sessionMetaOf(JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'))));
        }
        sessions.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
        return sessions;
    }

    function fileDeleteSessionForUid(uid, id) {
        const file = getSessionPath(uid, id);
        if (!file || !fs.existsSync(file)) return false;
        try {
            fs.unlinkSync(file);
            return true;
        } catch (error) {
            if (error && error.code === 'ENOENT') return false;
            throw error;
        }
    }

    const fileStore = {
        readUserMemory: fileReadUserMemory,
        writeUserMemory: fileWriteUserMemory,
        listSessionsForUid: fileListSessionsForUid,
        readSessionFile: fileReadSessionFile,
        writeSessionFile: fileWriteSessionFile,
        deleteSessionForUid: fileDeleteSessionForUid,
    };
    const store = injectedStore || (usingPg
        ? require('./db')({ databaseUrl: DATABASE_URL, isValidSessionId })
        : fileStore);

    async function init() {
        if (usingPg || injectedStore) {
            if (typeof store.init !== 'function') throw new Error('user-memory: injected store is missing init()');
            await store.init();
        } else {
            console.log(`[user-memory] file store active at ${USERS_DIR}`);
        }
    }

    async function persistSessionTurn(uid, sessionId, {
        userText,
        aiText,
        origin,
        sectionId,
        sectionTitle,
    } = {}) {
        const safe = sanitizeUid(uid);
        const requestedId = sessionId ? String(sessionId) : null;
        if (!safe) return { status: 'write_failed', sessionId: requestedId, error: 'invalid_uid' };
        if (requestedId && !isValidSessionId(requestedId)) {
            return { status: 'not_found', sessionId: requestedId };
        }

        try {
            const now = new Date().toISOString();
            const userMessage = { role: 'user', content: String(userText || ''), ts: now };
            const assistantMessage = { role: 'assistant', content: String(aiText || ''), ts: now };
            let session = requestedId ? await store.readSessionFile(uid, requestedId) : null;
            if (requestedId && !session) return { status: 'not_found', sessionId: requestedId };

            if (session) {
                session.messages = Array.isArray(session.messages) ? session.messages : [];
                session.messages.push(userMessage, assistantMessage);
                session.updatedAt = now;
                if (origin) session.origin = origin;
                if (sectionId) session.sectionId = sectionId;
                if (sectionTitle) session.sectionTitle = sectionTitle;
                const written = await store.writeSessionFile(uid, session);
                return written
                    ? { status: 'appended', sessionId: session.id }
                    : { status: 'write_failed', sessionId: session.id, error: 'write_refused' };
            }

            const id = crypto.randomUUID();
            session = {
                id,
                uid: safe,
                origin: origin || 'main',
                title: String(userText || 'New chat').slice(0, 80),
                customTitle: '',
                starred: false,
                sectionId: sectionId || '',
                sectionTitle: sectionTitle || 'General Q&A',
                createdAt: now,
                updatedAt: now,
                messages: [userMessage, assistantMessage],
            };
            const written = await store.writeSessionFile(uid, session);
            return written
                ? { status: 'created', sessionId: id }
                : { status: 'write_failed', sessionId: null, error: 'write_refused' };
        } catch (error) {
            return {
                status: 'write_failed',
                sessionId: requestedId,
                error: error && error.message ? error.message : String(error),
            };
        }
    }

    async function updateSessionMetadata(uid, sessionId, patch = {}) {
        const requestedId = String(sessionId || '');
        if (!sanitizeUid(uid) || !isValidSessionId(requestedId)) {
            return { status: 'not_found', sessionId: requestedId };
        }
        try {
            const session = await store.readSessionFile(uid, requestedId);
            if (!session) return { status: 'not_found', sessionId: requestedId };
            if (Object.prototype.hasOwnProperty.call(patch, 'customTitle')) session.customTitle = patch.customTitle;
            if (Object.prototype.hasOwnProperty.call(patch, 'starred')) session.starred = patch.starred;
            session.updatedAt = new Date().toISOString();
            const written = await store.writeSessionFile(uid, session);
            return written
                ? { status: 'updated', session: sessionMetaOf(session) }
                : { status: 'write_failed', sessionId: requestedId, error: 'write_refused' };
        } catch (error) {
            return {
                status: 'write_failed',
                sessionId: requestedId,
                error: error && error.message ? error.message : String(error),
            };
        }
    }

    function buildTeachingInstructionsPrompt(memory) {
        const instructions = memory && typeof memory.teachingInstructions === 'string'
            ? memory.teachingInstructions.trim()
            : '';
        if (!instructions) return '';
        return `\n\n[User Teaching Instructions]\n${instructions}`;
    }

    return {
        init,
        ...store,
        persistSessionTurn,
        updateSessionMetadata,
        buildTeachingInstructionsPrompt,
    };
};
