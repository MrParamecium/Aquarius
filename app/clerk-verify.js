/*
 * Clerk session-JWT verification (no Clerk SDK, Node built-ins only).
 *
 * Verifies the short-lived (60s) Clerk session JWTs the frontend sends as
 * `Authorization: Bearer <token>` (cross-origin Vercel -> Render topology,
 * see .trellis/tasks/07-05-user-db-auth-sessions/research/clerk-instance-facts.md).
 *
 * Configuration is fully dependency-injected by ws-bridge.js (the module
 * that owns env loading) — this module reads no env vars and holds no
 * default URLs, so there is exactly one source of truth for the Clerk
 * config and the allowed-origin list.
 *
 * Mechanics:
 *   - JWKS fetched via the injected httpRequestJson helper, cached ~1h.
 *   - RS256 signature check via crypto.createPublicKey({format:'jwk'}) +
 *     crypto.verify. Any other alg (none/HS256/...) is rejected outright.
 *   - Claims: iss must equal the injected issuer; exp/nbf with +-5s clock
 *     skew; azp is CONDITIONAL - if present it MUST be in authorizedParties
 *     (fail closed), if absent the check passes (Clerk omits azp in some
 *     cross-origin setups and its docs say to skip the check when missing).
 *   - Unknown-kid handling is throttled: at most one JWKS refetch per 5
 *     minutes triggered by unseen kids, with a bounded negative cache in
 *     between, so an attacker spraying random kids cannot force a Clerk
 *     fetch per request.
 *   - Fail-closed: any fetch/parse/verify failure returns null (the caller
 *     treats null as "no verified identity"); previously cached keys keep
 *     serving across fetch failures.
 *   - warmUp() eagerly fetches the JWKS once so a misconfigured jwksUrl
 *     shows up in boot logs instead of as unexplained runtime 401s.
 */
'use strict';

const crypto = require('crypto');

const JWKS_TTL_MS = 60 * 60 * 1000;           // normal refresh cadence
const KID_REFETCH_MIN_INTERVAL_MS = 5 * 60 * 1000; // unknown-kid refetch throttle
const FETCH_FAILURE_BACKOFF_MS = 60 * 1000;   // don't hammer Clerk when it's down
const UNKNOWN_KID_CACHE_MAX = 1000;           // bound the negative cache
const CLOCK_SKEW_SEC = 5;
const JWKS_FETCH_TIMEOUT_MS = 10000;

/**
 * @param {{
 *   httpRequestJson: (url: string, options?: object, body?: string|null, timeoutMs?: number) => Promise<any>,
 *   jwksUrl: string,
 *   issuer: string,
 *   authorizedParties: string[],
 * }} deps — all required; ws-bridge.js supplies env-derived values.
 */
module.exports = function createClerkVerify(deps) {
    const httpRequestJson = deps && deps.httpRequestJson;
    const JWKS_URL = deps && deps.jwksUrl;
    const ISSUER = deps && deps.issuer;
    const AUTHORIZED_PARTIES = deps && deps.authorizedParties;
    if (typeof httpRequestJson !== 'function' || typeof JWKS_URL !== 'string' || !JWKS_URL
        || typeof ISSUER !== 'string' || !ISSUER || !Array.isArray(AUTHORIZED_PARTIES)) {
        throw new Error('clerk-verify: missing required deps {httpRequestJson, jwksUrl, issuer, authorizedParties}');
    }

    let keys = new Map();          // kid -> crypto KeyObject
    let jwksFetchedAt = 0;
    let nextFetchNotBefore = 0;    // failure backoff gate
    let lastKidRefetchAt = 0;
    let inflightFetch = null;
    const unknownKids = new Set();

    function refreshJwks() {
        if (inflightFetch) return inflightFetch;
        if (Date.now() < nextFetchNotBefore) return Promise.resolve();
        inflightFetch = (async () => {
            try {
                const parsed = await httpRequestJson(JWKS_URL, {}, null, JWKS_FETCH_TIMEOUT_MS);
                const list = Array.isArray(parsed && parsed.keys) ? parsed.keys : [];
                const next = new Map();
                for (const jwk of list) {
                    if (!jwk || jwk.kty !== 'RSA' || !jwk.kid) continue;
                    try {
                        next.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }));
                    } catch (e) {
                        console.warn('[clerk-verify] skipping unusable JWK:', e.message);
                    }
                }
                if (next.size) {
                    keys = next; // wholesale replace: rotated-out kids drop
                    jwksFetchedAt = Date.now();
                    nextFetchNotBefore = 0;
                    unknownKids.clear();
                } else {
                    throw new Error('JWKS contained no usable RSA keys');
                }
            } catch (err) {
                console.warn('[clerk-verify] JWKS fetch failed:', err.message);
                nextFetchNotBefore = Date.now() + FETCH_FAILURE_BACKOFF_MS;
                // cached keys (if any) keep serving; unknown kids stay 401
            } finally {
                inflightFetch = null;
            }
        })();
        return inflightFetch;
    }

    async function getKey(kid) {
        if (!kid || typeof kid !== 'string') return null;
        if (!keys.size || Date.now() - jwksFetchedAt >= JWKS_TTL_MS) await refreshJwks();
        if (keys.has(kid)) return keys.get(kid);
        if (unknownKids.has(kid)) return null;
        if (Date.now() - lastKidRefetchAt >= KID_REFETCH_MIN_INTERVAL_MS) {
            lastKidRefetchAt = Date.now();
            await refreshJwks();
            if (keys.has(kid)) return keys.get(kid);
        }
        if (unknownKids.size < UNKNOWN_KID_CACHE_MAX) unknownKids.add(kid);
        return null;
    }

    /**
     * Verify a Clerk session JWT. Returns { uid, sid } on success, null on
     * ANY failure (malformed, bad signature, wrong claims, JWKS unavailable).
     */
    async function verifyClerkToken(token) {
        try {
            const parts = String(token || '').split('.');
            if (parts.length !== 3) return null;
            const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
            if (!header || header.alg !== 'RS256') return null; // reject none/HS256/...
            const key = await getKey(header.kid);
            if (!key) return null;
            const sigOk = crypto.verify(
                'RSA-SHA256',
                Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8'),
                key,
                Buffer.from(parts[2], 'base64url')
            );
            if (!sigOk) return null;
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            if (!payload || typeof payload !== 'object') return null;
            const now = Math.floor(Date.now() / 1000);
            if (payload.iss !== ISSUER) return null;
            if (typeof payload.exp !== 'number' || payload.exp <= now - CLOCK_SKEW_SEC) return null;
            if (typeof payload.nbf === 'number' && payload.nbf > now + CLOCK_SKEW_SEC) return null;
            if (payload.azp !== undefined && payload.azp !== null && payload.azp !== '') {
                if (!AUTHORIZED_PARTIES.includes(payload.azp)) return null;
            }
            if (!payload.sub || typeof payload.sub !== 'string') return null;
            return { uid: payload.sub, sid: typeof payload.sid === 'string' ? payload.sid : null };
        } catch (_) {
            return null;
        }
    }

    // Eager JWKS fetch for startup: a typo'd jwksUrl becomes a loud boot-log
    // line instead of every request 401ing with healthy-looking logs. Never
    // throws and never blocks — verification stays lazy/fail-closed either way.
    function warmUp() {
        refreshJwks().then(() => {
            if (keys.size) {
                console.log(`[clerk-verify] JWKS warm-up ok (${keys.size} key(s) from ${JWKS_URL})`);
            } else {
                console.warn(`[clerk-verify] JWKS warm-up got no keys from ${JWKS_URL} — all tokens will 401 until it becomes reachable`);
            }
        });
    }

    return { verifyClerkToken, warmUp };
};
