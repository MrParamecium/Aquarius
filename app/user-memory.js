/*
 * User memory + feedback + sessions IO (extracted from ws-bridge.js in
 * Phase 1 #5; dual storage backend added in the 07-05 user-db task).
 *
 * TWO interchangeable storage backends behind one 8-primitive store
 * interface (readUserMemory / writeUserMemory / listSessionsForUid /
 * readSessionFile / writeSessionFile / deleteSessionForUid /
 * readFeedbackBoard / writeFeedbackBoard):
 *
 *   file store (default, deps.databaseUrl unset) — on-disk JSON under USERS_DIR:
 *     USERS_DIR/<uid>.json            → user memory (quiz profile, concepts, style signals)
 *     USERS_DIR/feedback-board.json   → shared feedback board (threaded replies)
 *     USERS_DIR/sessions/<uid>/<id>.json → per-uid persisted chat sessions
 *
 *   pg store (deps.databaseUrl set) — Neon Postgres via app/db.js, JSONB
 *     documents mirroring the exact file shapes. Durable across redeploys.
 *
 * The PUBLIC surface is async in both modes (the pg store forces it; the
 * file store just resolves immediately). Callers must await every exported
 * function except the pure helpers (buildUserProfilePrompt,
 * deriveMemoryFromSessions, publicFeedbackItem, cleanFeedbackText).
 *
 * Call init() once at startup: in pg mode it bootstraps the schema and
 * FAILS FAST if the database is unreachable (never silently falls back to
 * ephemeral files); in file mode it just logs the active backend.
 *
 * Factory pattern follows Phase 1 #4 (ragflow-client.js) — bridge injects
 * its utilities so this module doesn't pull from a not-yet-extracted shared
 * utils module.
 *
 * The factory is NOT side-effect-free in file mode: it mkdirSyncs USERS_DIR
 * and SESSIONS_DIR on call. Call it once at bridge startup, not per-request.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * @param {{
 *   compactWhitespace: (value: any) => string,
 *   normalizeQuizProfile: (quiz?: object) => object,
 *   callOpenRouterChat: (opts: object) => Promise<string>,
 *   usersDir: string,
 *   databaseUrl?: string,
 * }} deps
 */
module.exports = function createUserMemory(deps) {
    const compactWhitespace = deps && deps.compactWhitespace;
    const normalizeQuizProfile = deps && deps.normalizeQuizProfile;
    const callOpenRouterChat = deps && deps.callOpenRouterChat;
    const USERS_DIR = deps && deps.usersDir;
    const DATABASE_URL = (deps && deps.databaseUrl) || '';
    if (typeof compactWhitespace !== 'function' || typeof normalizeQuizProfile !== 'function' || typeof callOpenRouterChat !== 'function' || typeof USERS_DIR !== 'string' || !USERS_DIR) {
        throw new Error('user-memory: missing required deps {compactWhitespace, normalizeQuizProfile, callOpenRouterChat, usersDir}');
    }

    const usingPg = Boolean(DATABASE_URL);
    if (!usingPg) {
        try { if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true }); } catch (_) {}
    }
    const FEEDBACK_BOARD_PATH = path.join(USERS_DIR, 'feedback-board.json');
    const SESSIONS_DIR = path.join(USERS_DIR, 'sessions');
    if (!usingPg) {
        try { if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true }); } catch (_) {}
    }

    function sanitizeUid(uid) {
        return String(uid || '').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
    }

    function getUserMemoryPath(uid) {
        const safe = sanitizeUid(uid);
        if (!safe) return null;
        return path.join(USERS_DIR, `${safe}.json`);
    }

    function fileReadUserMemory(uid) {
        const p = getUserMemoryPath(uid);
        if (!p) return null;
        try {
            const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
            if (parsed && parsed.quiz) parsed.quiz = normalizeQuizProfile(parsed.quiz);
            return parsed;
        } catch (_) {
            return null;
        }
    }

    function fileWriteUserMemory(uid, data) {
        const p = getUserMemoryPath(uid);
        if (!p) return;
        fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    }

    // ── Chat sessions (multi-session, Phase 1) ───────────────────────────────
    // Per-uid persisted conversations, one JSON file per session. File-based
    // behind this thin interface so the storage layer can be swapped for a
    // database later (see docs/multi-session.md). The host filesystem is
    // ephemeral, so this is not durable across redeploys yet — that's the
    // documented Phase-1 tradeoff.

    function getSessionsDirForUid(uid) {
        const safe = sanitizeUid(uid);
        return safe ? path.join(SESSIONS_DIR, safe) : null;
    }
    function isValidSessionId(id) {
        return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(id || ''));
    }
    function getSessionPath(uid, id) {
        const dir = getSessionsDirForUid(uid);
        if (!dir || !isValidSessionId(id)) return null; // UUID-only guards path traversal
        return path.join(dir, `${id}.json`);
    }
    function fileReadSessionFile(uid, id) {
        const p = getSessionPath(uid, id);
        if (!p) return null;
        try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
    }
    // Store primitive `writeSessionFile` — file impl keeps the atomic
    // tmp-write + rename behavior of the pre-split writeSessionFileAtomic.
    function fileWriteSessionFile(uid, session) {
        const p = getSessionPath(uid, session && session.id);
        if (!p) return false;
        try {
            fs.mkdirSync(path.dirname(p), { recursive: true });
            const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
            fs.writeFileSync(tmp, JSON.stringify(session, null, 2), 'utf8');
            fs.renameSync(tmp, p); // atomic replace: a concurrent reader never sees a half-written file
            return true;
        } catch (e) {
            console.warn('[sessions] write failed:', e.message);
            return false;
        }
    }
    function sessionMetaOf(s) {
        return {
            id: s.id,
            title: s.customTitle || s.title || 'Untitled',
            origin: s.origin || 'main',
            sectionId: s.sectionId || '',
            sectionTitle: s.sectionTitle || '',
            starred: !!s.starred,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            messageCount: Array.isArray(s.messages) ? s.messages.length : 0
        };
    }
    function fileListSessionsForUid(uid) {
        const dir = getSessionsDirForUid(uid);
        if (!dir || !fs.existsSync(dir)) return [];
        const out = [];
        for (const f of fs.readdirSync(dir)) {
            if (!f.endsWith('.json')) continue;
            try { out.push(sessionMetaOf(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))); } catch (_) {}
        }
        out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
        return out;
    }
    function fileDeleteSessionForUid(uid, id) {
        const p = getSessionPath(uid, id);
        if (!p || !fs.existsSync(p)) return false;
        try { fs.unlinkSync(p); return true; } catch (_) { return false; }
    }
    // Persist one Q&A turn. No sessionId (or unknown) -> create a new session
    // and return its id; existing id -> append the turn. Resolves to the
    // session id (or null). Async since the store may be Postgres-backed.
    async function persistSessionTurn(uid, sessionId, { userText, aiText, origin, sectionId, sectionTitle } = {}) {
        const safe = sanitizeUid(uid);
        if (!safe) return null;
        const now = new Date().toISOString();
        const userMsg = { role: 'user', content: String(userText || ''), ts: now };
        const aiMsg = { role: 'assistant', content: String(aiText || ''), ts: now };
        let session = sessionId ? await store.readSessionFile(uid, sessionId) : null;
        if (session) {
            session.messages = Array.isArray(session.messages) ? session.messages : [];
            session.messages.push(userMsg, aiMsg);
            session.updatedAt = now;
            if (origin) session.origin = origin;
            if (sectionId) session.sectionId = sectionId;
            if (sectionTitle) session.sectionTitle = sectionTitle;
            return (await store.writeSessionFile(uid, session)) ? session.id : null;
        }
        const id = crypto.randomUUID();
        session = {
            id, uid: safe, origin: origin || 'main',
            title: String(userText || 'New chat').slice(0, 80),
            customTitle: '', starred: false,
            sectionId: sectionId || '', sectionTitle: sectionTitle || 'General Q&A',
            createdAt: now, updatedAt: now,
            messages: [userMsg, aiMsg]
        };
        return (await store.writeSessionFile(uid, session)) ? id : null;
    }

    function cleanFeedbackText(value, maxLen = 1200) {
        return compactWhitespace(String(value || '').replace(/\r/g, '\n')).slice(0, maxLen);
    }

    function fileReadFeedbackBoard() {
        try {
            const parsed = JSON.parse(fs.readFileSync(FEEDBACK_BOARD_PATH, 'utf8'));
            const items = Array.isArray(parsed.items) ? parsed.items : [];
            return { items };
        } catch (_) {
            return { items: [] };
        }
    }

    function fileWriteFeedbackBoard(board) {
        const items = Array.isArray(board && board.items) ? board.items : [];
        fs.writeFileSync(FEEDBACK_BOARD_PATH, JSON.stringify({ items }, null, 2), 'utf8');
    }

    // ── Store selection ──────────────────────────────────────────────────────
    // 8-primitive store interface; both impls return identical shapes and are
    // spread directly into the module's exports (the file impl is sync
    // internally — callers await everything, which resolves plain values
    // just the same).
    const fileStore = {
        readUserMemory: fileReadUserMemory,
        writeUserMemory: fileWriteUserMemory,
        listSessionsForUid: fileListSessionsForUid,
        readSessionFile: fileReadSessionFile,
        writeSessionFile: fileWriteSessionFile,
        deleteSessionForUid: fileDeleteSessionForUid,
        readFeedbackBoard: fileReadFeedbackBoard,
        writeFeedbackBoard: fileWriteFeedbackBoard,
    };
    const store = usingPg
        ? require('./db')({ databaseUrl: DATABASE_URL, normalizeQuizProfile, isValidSessionId })
        : fileStore;

    // Startup hook: pg mode bootstraps schema and fails fast on an
    // unreachable database (deliberate — mirrors the materials-dir fail-fast;
    // never silently fall back to ephemeral files when durability was asked
    // for). File mode just announces itself.
    async function init() {
        if (usingPg) {
            await store.init();
        } else {
            console.log(`[user-memory] file store active at ${USERS_DIR}`);
        }
    }

    function publicFeedbackItem(item) {
        return {
            id: item.id,
            title: item.title,
            body: item.body,
            author: item.author,
            createdAt: item.createdAt,
            replies: Array.isArray(item.replies) ? item.replies.map(reply => ({
                id: reply.id,
                body: reply.body,
                author: reply.author,
                createdAt: reply.createdAt,
                replyTo: reply.replyTo || null,
                replyToAuthor: reply.replyToAuthor || '',
                replyToBody: reply.replyToBody || ''
            })) : []
        };
    }

    function deriveMemoryFromSessions(uid, sessions, existing = {}) {
        const next = {
            uid,
            createdAt: existing.createdAt || new Date().toISOString(),
            quiz: existing.quiz || {},
            knownConcepts: [],
            weakConcepts: [],
            inferredStyle: [],
            sessionSummaries: []
        };

        const knownSet = new Set();
        const weakSet = new Set();
        const styleSet = new Set(Array.isArray(existing.inferredStyle) ? existing.inferredStyle : []);
        const summarySet = new Set();

        (Array.isArray(sessions) ? sessions : []).forEach(session => {
            if (!session || !Array.isArray(session.history)) return;
            const sectionTitle = compactWhitespace(session.sectionTitle || session.sectionId || '');
            const historyText = session.history
                .map(msg => compactWhitespace(msg && msg.content ? msg.content : ''))
                .filter(Boolean)
                .join(' \n ')
                .toLowerCase();

            if (sectionTitle) {
                summarySet.add(`${new Date(session.timestamp || Date.now()).toISOString().slice(0,10)}: Studied section "${sectionTitle}".`);
            }

            if (/step by step|step-by-step/.test(historyText)) styleSet.add('step_by_step');
            if (/example/.test(historyText)) styleSet.add('example_first');
            if (/draw|diagram|visual|plot|graph/.test(historyText)) styleSet.add('visual');
            if (/principle|intuition|why /.test(historyText)) styleSet.add('principle_first');

            if (/magnitude/.test(historyText)) weakSet.add('magnitude calculation');
            if (/polar/.test(historyText)) weakSet.add('polar form conversion');
            if (/real and imaginary|imaginary part|real part/.test(historyText)) weakSet.add('real and imaginary parts');
            if (/complex plane|a\+jb|a \+ jb|a\+bi|a \+ bi/.test(historyText)) knownSet.add('complex number representation');
        });

        next.knownConcepts = [...knownSet].slice(-30);
        next.weakConcepts = [...weakSet].filter(c => !knownSet.has(c)).slice(-20);
        next.inferredStyle = [...styleSet];
        next.sessionSummaries = [...summarySet].slice(-30);
        next.lastUpdated = new Date().toISOString();
        return next;
    }

    /**
     * Build a concise prompt injection string from user memory.
     * This gets prepended to system prompts for lesson/ask calls.
     */
    function buildUserProfilePrompt(memory) {
        if (!memory) return '';
        const lines = [];
        const quiz = normalizeQuizProfile(memory.quiz || {});

        const TRACK_MAP = {
            cram: [
                'TRACK = CRAM.',
                'This lesson must feel like a fast exam sprint, not a full lecture.',
                'Open with: what gets tested, what to memorize, and what pattern to recognize.',
                'Cut historical/background explanation unless it directly improves score on likely exam questions.',
                'Prefer shortest-solution patterns, parameter-reading tricks, and common traps.',
                'Keep derivations minimal; if a derivation is not needed for solving standard problems, compress it hard.'
            ].join(' '),
            standard: [
                'TRACK = STANDARD.',
                'This lesson should be the default balanced teaching version.',
                'Structure each major idea as: concept -> one representative example -> quick check / exam note.',
                'Explain enough to understand, but do not over-teach edge cases.',
                'Keep the pace moderate and the structure clean.'
            ].join(' '),
            top_score: [
                'TRACK = TOP SCORE.',
                'This lesson should aim for strong exam performance and clearer high-score differentiation.',
                'Highlight tricky variants, easy-to-miss distinctions, and what separates a safe answer from a high-scoring one.',
                'Keep the explanation efficient, but add sharper precision around common traps and better answer framing.',
                'Do not bloat the lesson; make it feel smarter, not just longer.'
            ].join(' ')
        };
        const TRACK_RULES = {
            cram: [
                'STRICT DIFFERENTIATION RULES FOR CRAM:',
                '- The first page must foreground exam payoff and high-frequency question types.',
                '- Prefer fewer knowledge-point pages and tighter summaries.',
                '- Include explicit exam traps / fastest recognition rules.',
                '- Avoid long intuition-building analogies unless they directly help answer exam questions faster.'
            ].join('\n'),
            standard: [
                'STRICT DIFFERENTIATION RULES FOR STANDARD:',
                '- Maintain the normal overview -> concept pages -> recap -> quiz flow.',
                '- Include one representative worked example for the main idea.',
                '- Keep explanation and exam utility balanced.',
                '- This is the baseline version; neither rushed nor overly remedial.'
            ].join('\n'),
            top_score: [
                'STRICT DIFFERENTIATION RULES FOR TOP SCORE:',
                '- Surface high-yield distinctions, harder variants, and where strong students separate themselves.',
                '- Explicitly call out easy point-loss traps and how to avoid them.',
                '- Add at least one deeper exam-facing insight beyond the baseline explanation.',
                '- Keep the tone high-precision and exam-smart, not bloated or textbook-like.'
            ].join('\n')
        };
        const MATH_MAP = {
            all_solid: 'Math background: strong. You may use calculus, ODEs, and complex numbers normally.',
            calculus_ok: 'Math background: mixed. Re-explain ODEs or complex-number steps briefly before relying on them.',
            math_weak: 'Math background: weak. Prefer intuition first, lighter algebra, and explicit intermediate steps.'
        };
        const TIMELINE_MAP = {
            this_week: 'Time pressure: very high. Compress aggressively and prioritize exam payoff first.',
            two_weeks: 'Time pressure: moderate. Stay exam-oriented, but still leave room for one layer of explanation.',
            one_month: 'Time pressure: moderate-low. Balance exam readiness with cleaner understanding.',
            early_stage: 'Time pressure: low. Build foundations well before compressing for exam speed.'
        };
        const PREFERENCE_MAP = {
            exam_first: 'Lesson opening preference: begin with the most important tested ideas and exam relevance.',
            example_first: 'Lesson opening preference: start with a concrete example before abstraction when possible.',
            step_by_step: 'Lesson opening preference: break the setup and steps down clearly before moving fast.'
        };
        const PRIORITY_MAP = {
            understand_concepts: 'Current priority: help the student truly understand the core concept before optimizing speed.',
            solve_faster: 'Current priority: improve solving speed and pattern recognition.',
            avoid_careless: 'Current priority: reduce careless mistakes, notation slips, sign errors, and easy point loss.',
            harder_problems: 'Current priority: prepare for harder variants and higher-difficulty exam questions.',
            connect_topics: 'Current priority: connect this topic to nearby ideas so the course feels less fragmented.',
            exam_confidence: 'Current priority: improve exam confidence, answer framing, and readiness under test conditions.'
        };

        if (TRACK_MAP[quiz.track]) lines.push(TRACK_MAP[quiz.track]);
        if (TRACK_RULES[quiz.track]) lines.push(TRACK_RULES[quiz.track]);
        lines.push([
            'VISUAL POLICY = DEFAULT ON.',
            'Visualization is not optional decoration in this product.',
            'If a concept is easier to see than to read, plan a visual block for it.',
            'Prefer a textbook figure first when the book already has a high-value explanatory diagram.',
            'If the concept is definition-first and fully legible in symbolic form, prefer LaTeX over any fetched reference image.',
            'For identity matrix / unit matrix style content, do not force an external image when a clean LaTeX matrix communicates the idea better.',
            'When the textbook figure is missing, too dense, or not enough to make the idea intuitive, add a gptimage2-generated teaching visual.',
            'Prefer openai/gpt-5.4-image-2 for planes, waveforms, signal transforms, comparisons, system sketches, parameter changes, and other STEM diagrams.',
            'Use clean lecture-note style visuals: pure white background, one knowledge point only, one clear reading path, restrained low-saturation color accents, and colored teaching boxes only when they sharpen understanding.',
            'Use visuals to make the lesson feel clearer and more direct, not just prettier.'
        ].join(' '));
        if (MATH_MAP[quiz.math]) lines.push(MATH_MAP[quiz.math]);
        if (TIMELINE_MAP[quiz.timeline]) lines.push(TIMELINE_MAP[quiz.timeline]);

        const prefs = Array.isArray(quiz.preference) ? quiz.preference : (quiz.preference ? [quiz.preference] : []);
        const allPrefs = [...new Set([...prefs, ...(Array.isArray(memory.inferredStyle) ? memory.inferredStyle : [])])];
        allPrefs.forEach(s => { if (PREFERENCE_MAP[s]) lines.push(PREFERENCE_MAP[s]); });

        const priorities = Array.isArray(quiz.priority) ? quiz.priority : (quiz.priority ? [quiz.priority] : []);
        priorities.forEach(p => { if (PRIORITY_MAP[p]) lines.push(PRIORITY_MAP[p]); });

        if (Array.isArray(memory.knownConcepts) && memory.knownConcepts.length) {
            lines.push(`Already mastered: ${memory.knownConcepts.join(', ')}. Do not over-explain these.`);
        }
        if (Array.isArray(memory.weakConcepts) && memory.weakConcepts.length) {
            lines.push(`Weak areas: ${memory.weakConcepts.join(', ')}. Spend extra time on these.`);
        }
        if (Array.isArray(memory.sessionSummaries) && memory.sessionSummaries.length) {
            const recent = memory.sessionSummaries.slice(-3);
            lines.push(`Recent sessions:\n${recent.map(s => `- ${s}`).join('\n')}`);
        }
        if (memory.preferenceProfile && typeof memory.preferenceProfile.markdown === 'string' && memory.preferenceProfile.markdown.trim()) {
            lines.push(`Saved editable preference profile:\n${memory.preferenceProfile.markdown.trim()}`);
        }

        if (!lines.length) return '';
        return `\n\n[Student Profile]\n${lines.join('\n\n')}`;
    }

    /**
     * Fire-and-forget: analyse one Q&A turn and update user memory.
     * Detects: weak/known concepts, inferred style signals.
     */
    async function updateUserMemoryFromQA(uid, question, answer, sectionId) {
        const prompt = [
            'You are analysing a student\'s question and the tutor\'s answer to update the student\'s learning profile.',
            '',
            `Section: ${sectionId || 'unknown'}`,
            `Student question: ${question}`,
            `Tutor answer (first 600 chars): ${String(answer).slice(0, 600)}`,
            '',
            'Output ONLY valid JSON (no markdown, no explanation):',
            '{',
            '  "weakConcepts": [],      // concepts the student seems confused about (max 3, short labels)',
            '  "knownConcepts": [],     // concepts student clearly already understands (max 3)',
            '  "inferredStyle": [],     // inferred learning style signals: one or more of ["example_first","visual","step_by_step","principle_first"] — empty if no clear signal',
            '  "note": ""               // one-line observation about this student (optional, empty string if nothing notable)',
            '}',
            '',
            'Rules:',
            '- weakConcepts: add ONLY if the question shows clear confusion (e.g. "I don\'t understand", "why does", asking same thing again)',
            '- knownConcepts: add ONLY if student explicitly says they know it or question shows mastery',
            '- inferredStyle: add ONLY if question wording strongly implies a style (e.g. "can you draw" → visual, "step by step" → step_by_step)',
            '- Keep all arrays empty [] if no strong signal. Never guess.'
        ].join('\n');

        const raw = await callOpenRouterChat({
            model: 'anthropic/claude-haiku-4.5',
            timeoutMs: 15000,
            temperature: 0.1,
            maxTokens: 200,
            messages: [{ role: 'user', content: prompt }]
        });

        let update;
        try {
            const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
            if (s === -1 || e === -1) return;
            update = JSON.parse(raw.slice(s, e + 1));
        } catch (_) { return; }

        const mem = (await store.readUserMemory(uid)) || { uid };

        // Merge weakConcepts (cap at 20)
        if (Array.isArray(update.weakConcepts) && update.weakConcepts.length) {
            const existing = new Set(mem.weakConcepts || []);
            update.weakConcepts.forEach(c => existing.add(c));
            mem.weakConcepts = [...existing].slice(-20);
        }
        // Merge knownConcepts (cap at 30) — also remove from weak
        if (Array.isArray(update.knownConcepts) && update.knownConcepts.length) {
            const known = new Set(mem.knownConcepts || []);
            update.knownConcepts.forEach(c => {
                known.add(c);
                // graduate from weak to known
                if (Array.isArray(mem.weakConcepts)) {
                    mem.weakConcepts = mem.weakConcepts.filter(w => w !== c);
                }
            });
            mem.knownConcepts = [...known].slice(-30);
        }
        // Merge inferredStyle (deduplicated)
        if (Array.isArray(update.inferredStyle) && update.inferredStyle.length) {
            const styleSet = new Set(mem.inferredStyle || []);
            update.inferredStyle.forEach(s => styleSet.add(s));
            mem.inferredStyle = [...styleSet];
        }
        // Append note to sessionSummaries
        if (update.note && update.note.trim()) {
            if (!Array.isArray(mem.sessionSummaries)) mem.sessionSummaries = [];
            mem.sessionSummaries.push(`[${sectionId}] ${update.note.trim()}`);
            mem.sessionSummaries = mem.sessionSummaries.slice(-20);
        }

        mem.lastUpdated = new Date().toISOString();
        await store.writeUserMemory(uid, mem);
        console.log(`[MemoryUpdate] uid=${uid} weak=${JSON.stringify(mem.weakConcepts?.slice(-3))} known=${JSON.stringify(mem.knownConcepts?.slice(-3))}`);
    }

    return {
        init,
        ...store, // the 8 primitives, whichever backend is active
        persistSessionTurn,
        buildUserProfilePrompt,
        updateUserMemoryFromQA,
        deriveMemoryFromSessions,
        publicFeedbackItem,
        cleanFeedbackText,
    };
};
