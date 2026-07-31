#!/usr/bin/env node
/*
 * Hermetic auth-guard regression test (Stage A of the 07-05
 * user-db-auth-sessions task; case list in the task's design.md §8).
 *
 * Self-contained: generates an RSA keypair in-process, serves a local JWKS
 * over plain http, and spawns the bridge TWICE —
 *   pass 1: TUTOR_REQUIRE_AUTH=1 (enforcement ON)  — 401 side asserted exactly
 *   pass 2: flag unset            (enforcement OFF) — legacy compat + C3
 *
 * No Clerk network, no OpenRouter spend, no real user data:
 *   - CLERK_JWKS_URL/ISSUER/AUTHORIZED_PARTIES point at the local test issuer.
 *   - OPENROUTER_API_KEY is set to an invalid placeholder so app/.env's real
 *     key is NOT loaded (the env loader skips already-set vars); LLM routes
 *     then fail per-call without billing. Positive cases on LLM-spending
 *     routes therefore assert "NOT 401" (the guard let the request through),
 *     never an end-to-end 200 (review M9).
 *   - TUTOR_USERS_DIR points the file store at a temp dir (wiped afterwards).
 *
 * Run: node tools/test-auth-guard.js
 */
'use strict';

const http = require('http');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRIDGE = path.join(REPO_ROOT, 'app', 'ws-bridge.js');

const TEST_ISSUER = 'https://test-issuer.local';
const TEST_PARTY = 'https://test-party.example';
const KID = 'test-kid-1';

// Section fixtures. CACHED_* rely on committed lesson-cache content;
// UNCACHED_OVERVIEW_SECTION must be a PARENT section (no -N suffix) whose
// parent_prelude cache does NOT exist but whose OCR pages contain a
// substantive prelude, so an unauthenticated overview request would enter
// the generation branch and must get 401. Re-pick by probing parents with
// `mode:'overview'` tokenless under TUTOR_REQUIRE_AUTH=1 if content changes.
const CACHED_LESSON_SECTION = { sectionId: '1.5', sectionTitle: '1.5 System Classifications' };
const UNCACHED_OVERVIEW_CANDIDATES = ['4.2', '4.1', '5.1', '6.1', '7.1', '2.2'];

// ── tiny assert framework ────────────────────────────────────────────────
let failures = 0;
let passes = 0;
function check(name, cond, detail) {
    if (cond) { passes++; console.log(`  ok   ${name}`); }
    else { failures++; console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── RSA keypair + local JWKS server ──────────────────────────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const { publicKey: strangerPublicKey, privateKey: strangerPrivateKey } =
    crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
void strangerPublicKey; // only the private half is used (wrong-sig tokens)

function b64url(buf) {
    return Buffer.from(buf).toString('base64url');
}

function mintToken(claimOverrides = {}, opts = {}) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: opts.alg || 'RS256', typ: 'JWT' };
    if (opts.kid !== null) header.kid = opts.kid || KID;
    const payload = Object.assign({
        iss: TEST_ISSUER,
        sub: 'user_test_a',
        sid: 'sess_test_1',
        iat: now,
        // The invalid-key LLM probes can each wait tens of seconds. Keep the
        // default test token alive for the full two-pass suite; expiry behavior
        // is covered separately with an explicit expired-token override.
        exp: now + 10 * 60,
        nbf: now - 5,
        azp: TEST_PARTY,
    }, claimOverrides);
    for (const k of Object.keys(payload)) {
        if (payload[k] === undefined) delete payload[k];
    }
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    if (opts.alg === 'none') return `${signingInput}.`;
    const key = opts.signWith === 'stranger' ? strangerPrivateKey : privateKey;
    const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput, 'utf8'), key);
    return `${signingInput}.${b64url(sig)}`;
}

function startJwksServer() {
    const jwk = publicKey.export({ format: 'jwk' });
    const body = JSON.stringify({ keys: [Object.assign({ kid: KID, use: 'sig', alg: 'RS256' }, jwk)] });
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(body);
        });
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

// ── bridge process management ────────────────────────────────────────────
function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

async function spawnBridge(extraEnv) {
    const port = await getFreePort();
    const usersDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-guard-users-'));
    const env = Object.assign({}, process.env, {
        PORT: String(port),
        TUTOR_USERS_DIR: usersDir,
        // Block app/.env's real key (loader skips already-set vars): invalid
        // placeholder -> per-call failure, zero spend.
        OPENROUTER_API_KEY: 'sk-or-test-invalid-no-spend',
        OPENAI_API_KEY: 'sk-test-invalid-no-spend',
        TUTOR_PYTHON_BIN: process.env.TUTOR_PYTHON_BIN || '/usr/bin/python3',
    }, extraEnv);
    delete env.DATABASE_URL; // hermetic: file store only
    if (!('TUTOR_REQUIRE_AUTH' in extraEnv)) delete env.TUTOR_REQUIRE_AUTH;

    const child = spawn(process.execPath, [BRIDGE], { env, cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = '';
    child.stdout.on('data', d => { logs += d; });
    child.stderr.on('data', d => { logs += d; });

    const base = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`bridge exited early (code ${child.exitCode}):\n${logs.slice(-2000)}`);
        }
        try {
            const r = await httpJson('GET', `${base}/health`);
            if (r.status === 200) return { child, base, usersDir, getLogs: () => logs };
        } catch (_) { /* not up yet */ }
        await new Promise(r => setTimeout(r, 250));
    }
    child.kill('SIGKILL');
    throw new Error(`bridge did not become healthy in 60s:\n${logs.slice(-2000)}`);
}

function stopBridge(bridge) {
    try { bridge.child.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(bridge.usersDir, { recursive: true, force: true }); } catch (_) {}
}

// ── HTTP helper ──────────────────────────────────────────────────────────
// Global fetch, same convention as the other bridge-spawning tools
// (tools/smoke.js, tools/test-lesson-open-no-hang.js). Resolves for ANY
// status code (assertions inspect .status); rejects only on connection
// errors/timeouts.
async function httpJson(method, urlStr, { token, body } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(urlStr, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(90000),
    });
    const raw = await res.text();
    let json = null;
    try { json = JSON.parse(raw); } catch (_) {}
    return { status: res.status, json, raw };
}

// ── pass 1: enforcement ON ───────────────────────────────────────────────
async function runPass1(jwksUrl) {
    console.log('\n── pass 1: TUTOR_REQUIRE_AUTH=1 ──');
    const bridge = await spawnBridge({
        TUTOR_REQUIRE_AUTH: '1',
        CLERK_JWKS_URL: jwksUrl,
        CLERK_ISSUER: TEST_ISSUER,
        CLERK_AUTHORIZED_PARTIES: TEST_PARTY,
    });
    const { base } = bridge;
    try {
        const valid = mintToken();

        // token validation matrix on a uid-scoped route
        let r = await httpJson('GET', `${base}/api/memory?uid=spoof_target`);
        check('memory GET tokenless -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('GET', `${base}/api/memory`, { token: valid });
        check('memory GET valid token -> 200', r.status === 200, `got ${r.status}`);
        r = await httpJson('GET', `${base}/api/memory`, { token: mintToken({ exp: Math.floor(Date.now() / 1000) - 120 }) });
        check('memory GET expired token -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('GET', `${base}/api/memory`, { token: mintToken({ azp: 'https://evil.example' }) });
        check('memory GET wrong-azp -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('GET', `${base}/api/memory`, { token: mintToken({ azp: undefined }) });
        check('memory GET NO-azp token accepted (M2)', r.status === 200, `got ${r.status}`);
        r = await httpJson('GET', `${base}/api/memory`, { token: mintToken({}, { signWith: 'stranger' }) });
        check('memory GET wrong-sig -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('GET', `${base}/api/memory`, { token: mintToken({}, { alg: 'none' }) });
        check('memory GET alg=none -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('GET', `${base}/api/memory`, { token: mintToken({ iss: 'https://other-issuer.local' }) });
        check('memory GET wrong-iss -> 401', r.status === 401, `got ${r.status}`);

        // sessions routes
        r = await httpJson('GET', `${base}/api/sessions?uid=spoof_target`);
        check('sessions list tokenless -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('GET', `${base}/api/sessions`, { token: valid });
        check('sessions list valid token -> 200 []', r.status === 200 && Array.isArray(r.json && r.json.sessions), `got ${r.status} ${r.raw.slice(0, 120)}`);
        const ghost = 'a1b2c3d4-1111-4222-8333-abcdefabcdef';
        r = await httpJson('GET', `${base}/api/sessions/${ghost}`, { token: valid });
        check('session GET valid token, unknown id -> 404', r.status === 404, `got ${r.status}`);
        r = await httpJson('DELETE', `${base}/api/sessions/${ghost}`, { token: valid });
        check('session DELETE valid token, unknown id -> 404', r.status === 404, `got ${r.status}`);
        r = await httpJson('DELETE', `${base}/api/sessions/${ghost}`);
        check('session DELETE tokenless -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('PATCH', `${base}/api/sessions/${ghost}`, { token: valid, body: { starred: true } });
        check('session PATCH valid token, unknown id -> 404', r.status === 404, `got ${r.status}`);
        r = await httpJson('PATCH', `${base}/api/sessions/${ghost}`, { body: { starred: true } });
        check('session PATCH tokenless -> 401', r.status === 401, `got ${r.status}`);

        const seededId = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
        const seededDir = path.join(bridge.usersDir, 'sessions', 'user_test_a');
        fs.mkdirSync(seededDir, { recursive: true });
        fs.writeFileSync(path.join(seededDir, `${seededId}.json`), JSON.stringify({
            id: seededId,
            uid: 'user_test_a',
            origin: 'learn',
            title: 'Seeded session',
            customTitle: '',
            starred: false,
            sectionId: '4.2-1',
            sectionTitle: 'Time Shifting',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [
                { role: 'user', content: 'How does time shifting work?', ts: new Date().toISOString() },
                { role: 'assistant', content: 'It moves the signal along the time axis.', ts: new Date().toISOString() }
            ]
        }), 'utf8');
        r = await httpJson('GET', `${base}/api/sessions`, { token: valid });
        check('sessions list returns token-owned server session', r.status === 200 && r.json.sessions.some(session => session.id === seededId), `got ${r.status}`);
        r = await httpJson('GET', `${base}/api/sessions/${seededId}`, { token: mintToken({ sub: 'user_other' }) });
        check('session GET cross-user -> 404', r.status === 404, `got ${r.status}`);
        r = await httpJson('PATCH', `${base}/api/sessions/${seededId}`, { token: valid, body: { customTitle: 'Renamed', starred: true } });
        check('session PATCH updates strict metadata', r.status === 200 && r.json.session.title === 'Renamed' && r.json.session.starred === true, `got ${r.status} ${r.raw.slice(0, 160)}`);
        r = await httpJson('PATCH', `${base}/api/sessions/${seededId}`, { token: valid, body: { title: 'unsupported' } });
        check('session PATCH rejects unsupported fields', r.status === 400, `got ${r.status}`);
        r = await httpJson('DELETE', `${base}/api/sessions/${seededId}`, { token: valid });
        check('session DELETE removes token-owned session', r.status === 200, `got ${r.status}`);
        r = await httpJson('GET', `${base}/api/sessions/${seededId}`, { token: valid });
        check('deleted session is no longer readable', r.status === 404, `got ${r.status}`);

        // uid-spoof immunity via the hermetic uid-scoped path (C2/AC4)
        r = await httpJson('POST', `${base}/api/memory`, {
            token: valid,
            body: { uid: 'user_victim', teachingInstructions: '  先讲直觉，再推导公式。  ' },
        });
        check('memory POST spoofed body.uid -> lands under token sub', r.status === 200 && r.json && r.json.memory && r.json.memory.uid === 'user_test_a', `got ${r.status} uid=${r.json && r.json.memory && r.json.memory.uid}`);
        r = await httpJson('GET', `${base}/api/memory`, { token: valid });
        check('memory GET token sub sees trimmed teaching instructions', r.status === 200 && r.json && r.json.teachingInstructions === '先讲直觉，再推导公式。', `got ${r.status} ${r.raw.slice(0, 160)}`);
        r = await httpJson('GET', `${base}/api/memory`, { token: mintToken({ sub: 'user_victim' }) });
        check('memory GET victim sub sees NOTHING', r.status === 200 && r.json && r.json.teachingInstructions === '', `got ${r.status} ${r.raw.slice(0, 160)}`);

        r = await httpJson('POST', `${base}/api/memory`, { token: valid, body: { teachingInstructions: ['not a string'] } });
        check('memory POST rejects non-string teachingInstructions', r.status === 400, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/memory`, { token: valid, body: { teachingInstructions: 'x'.repeat(1001) } });
        check('memory POST rejects teachingInstructions over 1000 chars', r.status === 400, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/memory`, { token: valid, body: { teachingInstructions: 'keep', preferenceProfile: { markdown: 'legacy' } } });
        check('memory POST rejects deleted legacy fields', r.status === 400, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/memory`, { token: valid, body: { teachingInstructions: '' } });
        check('memory POST clears teaching instructions', r.status === 200 && r.json && r.json.memory && r.json.memory.teachingInstructions === '', `got ${r.status}`);

        // Deleted routes stay deleted regardless of authentication state.
        r = await httpJson('POST', `${base}/api/memory/rebuild`, { body: { uid: 'spoof_target', sessions: [] } });
        check('memory/rebuild tokenless -> 404', r.status === 404, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/memory/rebuild`, { token: valid, body: { sessions: [] } });
        check('memory/rebuild valid token -> 404', r.status === 404, `got ${r.status}`);

        // LLM-spending routes: tokenless -> 401 before validation. A valid
        // token reaches validation (400), proving auth passed without making
        // this hermetic test depend on an external model request.
        r = await httpJson('POST', `${base}/api/ask`, { body: { prompt: 'What is a phasor?', uid: 'user_victim' } });
        check('ask tokenless -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/ask`, { token: valid, body: {} });
        check('ask valid token reaches validation -> 400', r.status === 400, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/ask-guidance`, { body: { prompt: 'What is a phasor?' } });
        check('ask-guidance tokenless -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/ask-guidance`, { token: valid, body: { prompt: 'What is a phasor?', unsupported: true } });
        check('ask-guidance valid token passes auth and rejects unknown field', r.status === 400 && r.json && r.json.stage === 'validation', `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/intent`, { body: { prompt: 'hi' } });
        check('intent tokenless -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/intent`, { token: valid, body: {} });
        check('intent valid token reaches validation -> 400', r.status === 400, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/preference/draft`, { body: { instruction: 'shorter answers' } });
        check('preference/draft tokenless -> 404', r.status === 404, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/preference/draft`, { token: valid, body: { instruction: 'shorter answers' } });
        check('preference/draft valid token -> 404', r.status === 404, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/pregen/section`, { body: { sectionId: CACHED_LESSON_SECTION.sectionId } });
        check('pregen tokenless -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/pregen/section`, { token: valid, body: { sectionId: CACHED_LESSON_SECTION.sectionId, inspectContextOnly: true } });
        check('pregen valid token (inspect-only) -> not 401', r.status !== 401, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/tutor`, { body: { prompt: 'hello' } });
        check('tutor (legacy) tokenless -> 401', r.status === 401, `got ${r.status}`);

        // /api/section mode gate (C1): unauthenticated = cache-only
        r = await httpJson('POST', `${base}/api/section`, { body: { sectionId: CACHED_LESSON_SECTION.sectionId, mode: 'intro' } });
        check('section intro tokenless -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/section`, { body: { sectionId: CACHED_LESSON_SECTION.sectionId } });
        check('section MISSING mode (defaults intro) tokenless -> 401', r.status === 401, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/section`, { body: { sectionId: CACHED_LESSON_SECTION.sectionId, sectionTitle: CACHED_LESSON_SECTION.sectionTitle, mode: 'lesson' } });
        check('section lesson tokenless -> 200 (pure cache read)', r.status === 200, `got ${r.status}`);
        r = await httpJson('POST', `${base}/api/section`, { body: { sectionId: CACHED_LESSON_SECTION.sectionId, sectionTitle: CACHED_LESSON_SECTION.sectionTitle, mode: 'overview' } });
        check('section overview CACHED tokenless -> 200 with lesson', r.status === 200 && r.json && typeof r.json.lesson === 'string' && r.json.lesson.length > 0, `got ${r.status} lesson-len=${r.json && r.json.lesson ? r.json.lesson.length : 'n/a'}`);

        // overview generation gate: find a parent whose prelude WOULD generate
        let found = null;
        for (const candidate of UNCACHED_OVERVIEW_CANDIDATES) {
            r = await httpJson('POST', `${base}/api/section`, { body: { sectionId: candidate, sectionTitle: candidate, mode: 'overview' } });
            if (r.status === 401) { found = candidate; break; }
        }
        check('section overview UNCACHED tokenless -> 401 before generation', Boolean(found), `no candidate 401'd among ${UNCACHED_OVERVIEW_CANDIDATES.join(', ')}`);
        if (found) console.log(`       (generation-gate candidate: ${found})`);

        // health stays public
        r = await httpJson('GET', `${base}/health`);
        check('health -> 200', r.status === 200, `got ${r.status}`);
    } finally {
        stopBridge(bridge);
    }
}

// ── pass 2: enforcement OFF (compat + opportunistic verification) ────────
async function runPass2(jwksUrl) {
    console.log('\n── pass 2: enforcement OFF ──');
    const bridge = await spawnBridge({
        CLERK_JWKS_URL: jwksUrl,
        CLERK_ISSUER: TEST_ISSUER,
        CLERK_AUTHORIZED_PARTIES: TEST_PARTY,
    });
    const { base } = bridge;
    try {
        // legacy tokenless uid-param flow still works end to end
        let r = await httpJson('POST', `${base}/api/memory`, { body: { uid: 'legacy_user_1', teachingInstructions: 'Use one example.' } });
        check('memory POST tokenless uid-param -> 200 (compat)', r.status === 200 && r.json && r.json.memory && r.json.memory.uid === 'legacy_user_1', `got ${r.status}`);
        r = await httpJson('GET', `${base}/api/memory?uid=legacy_user_1`);
        check('memory GET tokenless uid-param -> 200 (compat)', r.status === 200 && r.json && r.json.teachingInstructions === 'Use one example.', `got ${r.status} ${r.raw.slice(0, 120)}`);
        r = await httpJson('GET', `${base}/api/sessions?uid=legacy_user_1`);
        check('sessions GET tokenless uid-param -> 200 (compat)', r.status === 200, `got ${r.status}`);
        r = await httpJson('GET', `${base}/api/memory`);
        check('memory GET no uid at all -> 400 (legacy)', r.status === 400, `got ${r.status}`);

        // C3: a presented valid token WINS over the client-supplied uid
        const tokenB = mintToken({ sub: 'user_test_b' });
        r = await httpJson('POST', `${base}/api/memory`, { token: tokenB, body: { uid: 'legacy_user_1', teachingInstructions: 'Show every step.' } });
        check('memory POST token + spoofed uid -> token sub wins (C3)', r.status === 200 && r.json && r.json.memory && r.json.memory.uid === 'user_test_b', `got ${r.status} uid=${r.json && r.json.memory && r.json.memory.uid}`);
        r = await httpJson('GET', `${base}/api/memory?uid=legacy_user_1`);
        check('legacy uid NOT polluted by token write (C3)', r.status === 200 && r.json && r.json.teachingInstructions === 'Use one example.', `got ${r.status} ${r.raw.slice(0, 120)}`);

        // an INVALID token with enforcement off is not rejected: falls back
        r = await httpJson('GET', `${base}/api/memory?uid=legacy_user_1`, { token: mintToken({}, { signWith: 'stranger' }) });
        check('invalid token, enforcement off -> not rejected (fallback)', r.status === 200, `got ${r.status}`);

        // With enforcement off, a generation path reaches ordinary request
        // validation without requiring a token or calling an external model.
        r = await httpJson('POST', `${base}/api/section`, { body: { mode: 'intro' } });
        check('section intro tokenless, enforcement off -> validation 400', r.status === 400, `got ${r.status}`);
    } finally {
        stopBridge(bridge);
    }
}

// ── main ─────────────────────────────────────────────────────────────────
(async () => {
    const jwksServer = await startJwksServer();
    const jwksUrl = `http://127.0.0.1:${jwksServer.address().port}/jwks`;
    console.log(`[test-auth-guard] local JWKS at ${jwksUrl}`);
    try {
        await runPass1(jwksUrl);
        await runPass2(jwksUrl);
    } catch (err) {
        failures++;
        console.error('FATAL:', err.message);
    } finally {
        jwksServer.close();
    }
    console.log(`\n[test-auth-guard] ${passes} passed, ${failures} failed`);
    process.exit(failures ? 1 : 0);
})();
