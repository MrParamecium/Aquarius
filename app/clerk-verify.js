/*
 * Clerk session-JWT verification (no Clerk SDK, Node built-ins only).
 *
 * Verifies the short-lived (60s) Clerk session JWTs the frontend sends as
 * `Authorization: Bearer <token>` (cross-origin Vercel -> Render topology,
 * see .trellis/tasks/07-05-user-db-auth-sessions/research/clerk-instance-facts.md).
 *
 * Mechanics:
 *   - JWKS fetched from the Clerk instance (CLERK_JWKS_URL), cached ~1h.
 *   - RS256 signature check via crypto.createPublicKey({format:'jwk'}) +
 *     crypto.verify. Any other alg (none/HS256/...) is rejected outright.
 *   - Claims: iss must equal CLERK_ISSUER; exp/nbf with +-5s clock skew;
 *     azp is CONDITIONAL - if present it must be in CLERK_AUTHORIZED_PARTIES
 *     (fail closed), if absent the check passes (Clerk omits azp in some
 *     cross-origin setups and its docs say to skip the check when missing).
 *   - Unknown-kid handling is throttled: at most one JWKS refetch per 5
 *     minutes triggered by unseen kids, with a bounded negative cache in
 *     between, so an attacker spraying random kids cannot force a Clerk
 *     fetch per request.
 *   - Fail-closed: any fetch/parse/verify failure returns null (the caller
 *     treats null as "no verified identity"); previously cached keys keep
 *     serving across fetch failures.
 */
'use strict';

const http = require('http');
const https = require('https');
const crypto = require('crypto');

const JWKS_TTL_MS = 60 * 60 * 1000;           // normal refresh cadence
const KID_REFETCH_MIN_INTERVAL_MS = 5 * 60 * 1000; // unknown-kid refetch throttle
const FETCH_FAILURE_BACKOFF_MS = 60 * 1000;   // don't hammer Clerk when it's down
const UNKNOWN_KID_CACHE_MAX = 1000;           // bound the negative cache
const CLOCK_SKEW_SEC = 5;

/**
 * @param {{ jwksUrl?: string, issuer?: string, authorizedParties?: string[] }} [opts]
 *   Optional overrides; defaults come from CLERK_JWKS_URL / CLERK_ISSUER /
 *   CLERK_AUTHORIZED_PARTIES env vars, falling back to the dev-instance
 *   values so opportunistic verification works before PR-C sets env vars.
 */
module.exports = function createClerkVerify(opts = {}) {
    const JWKS_URL = opts.jwksUrl
        || process.env.CLERK_JWKS_URL
        || 'https://driven-troll-28.clerk.accounts.dev/.well-known/jwks.json';
    const ISSUER = opts.issuer
        || process.env.CLERK_ISSUER
        || 'https://driven-troll-28.clerk.accounts.dev';
    const AUTHORIZED_PARTIES = Array.isArray(opts.authorizedParties)
        ? opts.authorizedParties
        : String(process.env.CLERK_AUTHORIZED_PARTIES
            || 'https://aquarius-seven.vercel.app,http://localhost:9000,http://127.0.0.1:9000')
            .split(',').map(s => s.trim()).filter(Boolean);

    let keys = new Map();          // kid -> crypto KeyObject
    let jwksFetchedAt = 0;
    let nextFetchNotBefore = 0;    // failure backoff gate
    let lastKidRefetchAt = 0;
    let inflightFetch = null;
    const unknownKids = new Set();

    function fetchJwksRaw() {
        return new Promise((resolve, reject) => {
            // http allowed so the self-contained test harness can serve a local JWKS
            const mod = JWKS_URL.startsWith('http://') ? http : https;
            const req = mod.get(JWKS_URL, (resp) => {
                if (resp.statusCode !== 200) {
                    resp.resume();
                    reject(new Error(`JWKS status ${resp.statusCode}`));
                    return;
                }
                const chunks = [];
                resp.on('data', c => chunks.push(c));
                resp.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            });
            req.on('error', reject);
            req.setTimeout(10000, () => req.destroy(new Error('JWKS fetch timeout')));
        });
    }

    function refreshJwks() {
        if (inflightFetch) return inflightFetch;
        if (Date.now() < nextFetchNotBefore) return Promise.resolve();
        inflightFetch = (async () => {
            try {
                const parsed = JSON.parse(await fetchJwksRaw());
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

    return { verifyClerkToken };
};
