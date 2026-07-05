# Design — User accounts: DB migration + login sessions

Decisions D1–D7 and all research anchors live in `prd.md` / `research/`. This doc
is the technical design only.

## 1. Architecture & boundaries

```
Browser (Vercel or localhost)
  ├─ clerk-auth.js        + getAuthToken() → fresh Clerk JWT per request (D1a)
  ├─ api-client.js  NEW   apiFetch(): attaches Authorization header, drops uid params
  ├─ app.js               nine show*View() fns each call recordLastLocation()
  │                       (no central dispatcher — §4/M7); boot restores it
  │                       (D2); intro gated on auth state
  └─ guests: sessionStorage-only memory, public endpoints only (D3/D4)
        │  Authorization: Bearer <60s Clerk session JWT>
        ▼
ws-bridge.js (Render / localhost)
  ├─ clerk-verify.js NEW  JWKS cache + RS256 verify (built-in crypto, no SDK)
  │                       validates iss/exp/nbf/azp → { uid: payload.sub, sid }
  ├─ requireAuth guard    on uid-scoped + LLM-spending routes (D4),
  │                       enforcement gated by TUTOR_REQUIRE_AUTH env
  └─ user-memory.js       same factory surface, now async; TWO storage backends:
        ├─ file store (existing code, unchanged) — when DATABASE_URL unset
        └─ pg store  NEW (app/db.js)            — when DATABASE_URL set
                │
                ▼
        Neon Postgres (free tier, JSONB documents, D5)
```

Touched modules: `app/user-memory.js` (storage split), `app/ws-bridge.js`
(await-ing callsites, guards, CORS), new `app/db.js` + `app/clerk-verify.js` +
`app/api-client.js`, `app/clerk-auth.js` (getAuthToken, boot navigation),
`app/app.js` (last-location, intro gating, quiz/guest paths),
`app/preference-profile.js`, `app/recent-conversations.js` (apiFetch swap).
Everything else — lesson cache, materials, pregen content pipeline — untouched.

## 2. Backend identity: clerk-verify.js

- JWKS from `https://driven-troll-28.clerk.accounts.dev/.well-known/jwks.json`
  (env `CLERK_JWKS_URL`), fetched with built-in `https`, cached in memory ~1h.
  Unknown-`kid` handling is hardened (review m3): refetch at most once per
  5 minutes globally, and negative-cache unseen kids in between — an attacker
  spraying random kids must not be able to force a Clerk fetch per request.
  JWKS fetch failure → `verify` returns `null` (fail-closed 401) while any
  previously cached keys keep serving.
- Verify RS256 via `crypto.createPublicKey({ key: jwk, format: 'jwk' })` +
  `crypto.verify('RSA-SHA256', signingInput, key, signature)`.
- Claims (per `research/clerk-instance-facts.md §3`): `iss` === env
  `CLERK_ISSUER` (`https://driven-troll-28.clerk.accounts.dev`); `exp`/`nbf`
  with ±5s clock skew; `azp` **conditional** (review M2): if the claim is
  present it MUST be in env `CLERK_AUTHORIZED_PARTIES`
  (`https://aquarius-seven.vercel.app,http://localhost:9000,http://127.0.0.1:9000`)
  — fail closed on mismatch; if the claim is absent, the check passes. Clerk's
  manual-verification docs explicitly say to skip azp when it doesn't exist,
  and azp is known to be omitted in cross-origin setups exactly like this one —
  an unconditional check would brick sign-in at the PR-C flip.
- Returns `{ uid, sid }` or `null`. **Whenever a token is presented, uid =
  `payload.sub` and client-supplied uid params/bodies are ignored — in every
  route class** (R2). The one deliberate exception: tokenless requests with
  enforcement OFF keep legacy uid-param behavior (the C3 compat mode below) —
  so "ignored everywhere" holds exactly when a token exists, and enforcement
  ON makes tokens mandatory wherever uid matters.

### Enforcement & route classes

`TUTOR_REQUIRE_AUTH=1` (Render prod; unset locally so dev + all test harnesses
run untouched).

**Class-independent uid rule (review C2):** any route that reads or writes
per-uid data derives uid from the verified token (`payload.sub`) whenever a
token is present — client-supplied uid params/body fields are never trusted in
ANY class. The table below only decides whether a *missing* token is fatal.
Concretely this covers `/api/ask`, which is LLM-spending but also reads the
user's memory (`ws-bridge.js:4804-4805`) and persists their session turn
(~5035): both must key off the token sub, or an authenticated user can
read/poison any other user's data via `body.uid`.

With enforcement ON:

| Class | Routes | Rule |
|---|---|---|
| uid-scoped | `/api/memory` GET/POST, `/api/memory/rebuild`, `/api/sessions`, `/api/sessions/{id}` GET/DELETE | valid token required; uid from token |
| LLM-spending | `/api/ask`, `/api/intent`, `/api/preference/draft`, `/api/pregen/section`, `/api/tutor` (legacy), `/api/section` generation paths (mode gate below) | valid token required (D4); 401 before any OpenRouter call |
| public | `/api/section` cache reads (mode gate below), `/api/feedback` GET+POST, `/api/feedback/{id}/replies` POST, `/api/crop`, `/api/favicon`, `/health`, all static | unchanged (feedback POST + replies stay anonymous-by-design; cost no LLM) |

Table notes: `/api/preference/draft` moved from uid-scoped to LLM-spending
(review M5 — its handler calls OpenRouter unconditionally and reads no per-uid
server data today). `/api/tutor` is a scope addition beyond the D4 interview
list (review I5) — gated because it can spend; flagged in prd D4. `/api/favicon`
(outbound favicon proxy, `ws-bridge.js:5215-5280`) listed for completeness.

**`/api/section` mode gate (review C1):** `mode` defaults to `'intro'` when
absent (`ws-bridge.js:4442`) — the guard must treat a missing mode as intro.
Unauthenticated requests get **cache-only** behavior: `mode='lesson'` unchanged
(already a pure cache read); `mode='overview'` serves the cached prelude but
returns 401 instead of entering the `preGenerateSectionLesson` branch on cache
miss/format-repair (4507-4515); `mode='intro'` → 401 always (it calls
OpenRouter unconditionally, 4482-4483). This keeps guests browsing everything
cached (D4/AC6: "cached-lesson reads only") while gating every spend path.
Frontend Stage B handles the guest 401 (skip intro / "sign in" affordance).

**Enforcement OFF ≠ guards inert (review C3):** with the flag unset, guards
still verify opportunistically — when a valid `Authorization` header is
present, uid comes from the token (token-uid wins over any client-supplied
uid); only tokenless requests keep the legacy uid-param behavior, and nothing
is rejected. This keeps local dev/tests untouched (they send no tokens), and
it is what makes the PR-B→PR-C deploy window safe: the new frontend sends
tokens and no uid fields, so its writes still land correctly before the flip
(§6/§7). Enforcement ON then only changes "missing token" from tolerated to
401.

### CORS

Replace wildcard (`ws-bridge.js:151-154`): reflect `Origin` when in the same
allowlist as `CLERK_AUTHORIZED_PARTIES`, add `Authorization` to
`Access-Control-Allow-Headers`, and send `Vary: Origin` on every reflected
response (review M10 — caches must not serve one origin's CORS headers to
another). Static/GET public assets keep `*`.

Structural note (review M10): `setCORSHeaders()` currently runs before the
pathname is parsed (`ws-bridge.js:4298-4308`), so "reflect for API, `*` for
static" cannot be a local edit to that function — the CORS decision must move
after route dispatch (or be re-applied per route class). Plan A7 accordingly.

## 3. Data layer

### Schema (DDL, bootstrap via `CREATE TABLE IF NOT EXISTS` at startup — 4 tables, no migration tool)

```sql
CREATE TABLE IF NOT EXISTS users (
  uid        TEXT PRIMARY KEY,               -- Clerk sub
  email      TEXT, name TEXT, image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_memory (
  uid        TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}',    -- quiz, preferenceProfile, concepts, style, summaries
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         UUID  PRIMARY KEY,
  uid        TEXT  NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  meta       JSONB NOT NULL,                 -- origin/title/customTitle/starred/sectionId/sectionTitle
  messages   JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_sessions_uid_updated ON chat_sessions (uid, updated_at DESC);
CREATE TABLE IF NOT EXISTS feedback_items (
  id         TEXT  PRIMARY KEY,
  data       JSONB NOT NULL,                 -- title/body/author/replies[]
  created_at TIMESTAMPTZ NOT NULL
);
```

JSONB-document style deliberately mirrors today's file shapes
(`research/current-auth-flow.md §5`) → the pg store is a thin translation.
Truly storage-agnostic domain logic (`deriveMemoryFromSessions`,
`buildUserProfilePrompt`) doesn't change. **`updateUserMemoryFromQA` is NOT in
that set** (review M4): it calls `readUserMemory`/`writeUserMemory` internally
(`user-memory.js:427`, `:461`) and must become async with awaits on both, or
once the store is async it merges a Promise into `{}` and persists garbage —
silently, because it's called fire-and-forget from `ws-bridge.js:5099`.

**User provisioning (review M1):** the DDL's FK chain (`user_memory.uid` and
`chat_sessions.uid` REFERENCE `users(uid)`) means a `users` row must exist
before any dependent write. clerk-verify returns only `{uid, sid}`, so the pg
store runs `INSERT INTO users (uid) VALUES ($1) ON CONFLICT (uid) DO NOTHING`
(an internal `ensureUserRow(uid)`) before every `writeUserMemory` /
session-write path; `email`/`name`/`image_url` stay nullable and can be
back-filled later from Clerk profile data. Without this, the very first
pg-backed quiz save dies on an FK violation.

### app/db.js

`pg.Pool`, `max: 3` (single Render instance + Neon free pooler), `ssl` required
(Neon), `DATABASE_URL` via the existing `.env` loader pattern
(`ws-bridge.js:20-43`). Startup: bootstrap DDL, log which backend is active.
Fail-fast: if `DATABASE_URL` is set but unreachable at startup → crash loudly
(same philosophy as the materials-dir fail-fast) rather than silently falling
back to ephemeral files.

Hardening (review m4, M6):
- **Parameterized queries only** — every statement uses `$1`-style
  placeholders; no string interpolation of uid or document content, ever.
- **uid validation at the store boundary**: uid must match
  `^[A-Za-z0-9_-]{1,64}$` before any store call (`sanitizeUid()` in
  user-memory.js:50-52 only protects file paths — the pg store needs its own
  gate).
- **Per-row JSONB size cap** (~64 KB) on `user_memory.data` and
  `chat_sessions.messages` writes — the `/api/memory` POST merge path is
  otherwise uncapped (`ws-bridge.js:4388-4394`) and a single hostile account
  could bloat the free-tier DB.
- **Guest refusal (D3 belt-and-braces)**: the pg store no-ops any uid matching
  `^guest_` — guest data must never land in Neon even if a stray callsite
  slips through.

### user-memory.js dual backend

Factory gains `databaseUrl` dep; internal `store` interface of **8 primitives,
named with the module's real vocabulary** (review m2 — earlier drafts invented
names; seven are existing exports from the 13 at `user-memory.js:465-479`,
and `writeSessionFile` is the one NEW primitive):
`readUserMemory / writeUserMemory / listSessionsForUid / readSessionFile /
writeSessionFile / deleteSessionForUid / readFeedbackBoard / writeFeedbackBoard`
— where `writeSessionFile` is extracted from today's internal
`writeSessionFileAtomic` (session writes are currently fused inside
`persistSessionTurn`'s read-merge-write). File impl = existing code; pg impl
new. Domain logic layered ON TOP of the store, not part of it:
`persistSessionTurn` (merge orchestration), `updateUserMemoryFromQA`,
`deriveMemoryFromSessions`, `buildUserProfilePrompt`, plus pure helpers
`publicFeedbackItem` / `cleanFeedbackText`.

**Public functions become async** — including `persistSessionTurn` and
`updateUserMemoryFromQA`, which call store IO internally. The sync→async
ripple in `ws-bridge.js` route callsites: `/api/sessions*` (~4343-4360),
`/api/memory*` (~4366-4430 — including `writeUserMemory` at 4411 and 4428,
review M3), ask-flow `readUserMemory` (~4805), `persistSessionTurn` (~5035),
the fire-and-forget `updateUserMemoryFromQA` at ~5099, feedback routes
(~5128); all already live inside async-capable request handling. Guest uids
never reach the store (D3): with enforcement on, uid-scoped routes are
token-only; the frontend additionally stops POSTing guest memory; and the pg
store refuses `guest_*` uids outright (§db.js hardening).

## 4. Frontend session restore (D2)

- **Last location**: localStorage `aquarius-last-location` =
  `{ view, sectionId, ts }` — `sectionTitle` is deliberately NOT persisted
  (review m6: it's tamperable localStorage input and fully derivable from the
  validated `sectionId` via the syllabus map at restore time). Lesson
  granularity only.
- **Where it's written (review M7):** there is NO central view-switch
  dispatcher in `app.js` — visibility is owned by nine independent
  `show*View()` functions (`showWelcome` ~4128, `showAnswer` ~4149,
  `showLearnView` ~4167, `showSettingsView` ~4185, `showPreferenceView` ~4204,
  `showFeedbackView` ~4222, `showCourseTrackerView` ~4241,
  `showMistakeNotebookView` ~4260, `showLoginView` ~4291), and no 'library'
  view exists. Plan: add one tiny helper `recordLastLocation(view, ctx)` and
  call it from each restorable show-function — additive, no dispatcher
  refactor. Restorable views: `learn` (with sectionId), `welcome`, `settings`,
  `preference`, `feedback`, `courseTracker`, `mistakeNotebook`. `answer` and
  `login` are transient and never persisted.
- **Boot flow** (the landmine zone — the 2026-05-08 saga in
  `workspace/memory/2026-05-08.md` is the map): do NOT flip `allowAuthNavigation`
  semantics. Add one new, explicit boot step `bootRestoreLastLocation()` that runs
  after `initClerk()` resolves initial session state and only when (a) no auth
  callback/intent machinery claimed the screen and (b) a Clerk user or live guest
  session exists. It validates `sectionId` against the syllabus map, navigates,
  and falls back to welcome. Intro landing shows only when there is neither a
  Clerk session nor a guest sessionStorage uid.
- **Token plumbing**: `clerk-auth.js` exports
  `getAuthToken() → Clerk.session ? await Clerk.session.getToken() : null`
  (fresh per request — 60s expiry, `research/clerk-instance-facts.md §4`). New
  `app/api-client.js` `apiFetch(path, opts)` attaches the header; the callsites in
  `app.js` (callAsk/callIntent/quiz/saveSessionSummary), `preference-profile.js`,
  `recent-conversations.js`, `clerk-auth.js` switch to it and drop uid fields.
- **Guests**: quiz answers + derived badge state live in sessionStorage
  (`guestMemory`); no `/api/memory` traffic; ask/composer UI shows a
  "sign in to ask questions" affordance when the 401 class is active (D4).

## 5. Trade-offs (chosen → rejected)

- **JSONB documents** → normalized tables: shapes match files 1:1, classmate
  scale, zero ORM; rejected normalization buys nothing at this size.
- **Dual backend behind one interface** → pg-only: keeps `npm start` with zero
  setup, keeps visual-diff/css-probe/arbiter/e2e harnesses green with no DB, and
  is the rollback lever; cost = one extra impl to keep honest (the store
  interface is 8 small functions).
- **Env-gated enforcement** → always-on auth: enables safe rollout ordering and
  offline dev/tests; risk (forgetting to flip the flag) is mitigated by AC-driven
  prod verification in PR-C.
- **Hand-rolled JWKS verify** → Clerk backend SDK: keeps the zero-framework
  posture, is Clerk-sanctioned ("networkless" verification), and `pg` stays the
  only new dependency.
- **Feedback POST stays public/anonymous** → token-gated: it spends no LLM money,
  the board is a deliberate anonymous channel, and gating it adds guest-UX cost.

## 6. Compatibility

- Old frontend + new backend (enforcement off): uid params still honored → no
  breakage during rollout.
- New frontend + old backend: extra `Authorization` header ignored → safe.
- **New frontend + new backend, enforcement OFF** — the actual deployed state
  between PR-B and PR-C (review C3): safe because guards verify tokens
  opportunistically even with the flag unset (§2) and take uid from the token,
  so the uid fields PR-B drops don't orphan writes during the window.
- `aquarius_visual_latex_v2`, `AQUARIUS_CONFIG`, JSON maps at `app/` root: all
  untouched. Version-bump ritual applies to the frontend PR.
- Windows-illegal filename rule: new files are plain `.js`/`.sql`-free names.

## 7. Rollout / rollback

1. **PR-A (backend)**: db.js + dual-backend user-memory + clerk-verify + guards
   + CORS, everything inert without env vars. Deploy → zero behavior change.
2. **PR-B (frontend)**: api-client + token plumbing + last-location restore +
   intro gating + guest localization + version bump. Works against both backend
   modes. Rollback: revert commit (Vercel auto-deploys main, ~1 min).
3. **Set `DATABASE_URL` on Render** (dashboard) → durability lands. Moved
   AFTER PR-B (review M6): while the old uid-param frontend is live, guests
   and spoofed uids can still write via legacy paths — durability must not
   land until the frontend that stops POSTing guest memory is deployed. The
   pg store's `guest_*` refusal is the second layer. Rollback: unset the var.
4. **PR-C (ops/docs)**: set `TUTOR_REQUIRE_AUTH=1` + `CLERK_*` vars on Render →
   AC4/AC5 become enforced; update CLAUDE.md (pg exception, env vars, session
   architecture) + `.trellis/spec/app/index.md` checklist + docs/multi-session.md.
   Rollback: unset the flag (data stays durable).

Order matters twice: enforcement (step 4) must not precede the token-sending
frontend (step 2) — though the opportunistic-verification design (§2) makes
the window benign rather than broken — and durability (step 3) must not
precede PR-B, or the legacy frontend writes guest/spoofable rows into Neon.

## 8. Test strategy

- Existing: `npm run check` (add new files to its file list),
  `node tools/test-lesson-open-no-hang.js`, visual-diff/css-probe `--check` runs
  (login/intro views may shift — re-baseline only with owner-visible diff review).
- New `tools/test-auth-guard.js` (self-contained, no Clerk network): generates an
  RSA keypair in-process, serves a local JWKS on an ephemeral http server, and
  spawns the bridge **twice** — pass 1 with
  `TUTOR_REQUIRE_AUTH=1 CLERK_JWKS_URL=<local> CLERK_ISSUER=<test>`, pass 2
  with the flag unset (the C3 compat mode is untestable in the enforcement-on
  spawn). Mints valid / expired / wrong-azp / **no-azp** / wrong-sig tokens.
  Assertions per route class: 401 side is asserted exactly; the positive case
  for LLM-spending routes asserts **"not 401"** (request reaches the handler),
  NOT an end-to-end 200 (review M9 — a real 200 from `/api/ask` needs a live
  `OPENROUTER_API_KEY` and spends money; `llm-client.js:53-56` throws per-call
  without one; full success stays in Stage C2 manual verification).
  Pass-1 (enforcement ON) case list: no-azp token accepted (M2); wrong-azp
  401; unauthenticated `/api/section` `mode='intro'` and missing-mode → 401,
  `mode='lesson'` → 200, **`mode='overview'` pair: cached sectionId → 200,
  uncached/bogus sectionId → 401 before any generation** (C1 — pick a
  sectionId with a committed `parent_prelude` cache for the hit case);
  `/api/feedback/{id}/replies` POST tokenless → 200 (m1); **uid-spoof
  immunity via the hermetic uid-scoped path**: POST `/api/memory` with a valid
  token + mismatched `body.uid`, then GET `/api/memory` with the token →
  data landed under the token sub, not the body uid (C2/AC4). The
  `/api/ask`-specific persist-under-token-sub check is NOT hermetically
  observable (the handler throws at the LLM call before persisting, per M9) —
  it stays in Stage C2 prod verification.
  Pass-2 (enforcement OFF): tokenless uid-param request still works (compat);
  tokenless + valid-token request pair shows token-uid winning (C3).
- DB layer verified against a real Neon branch DB locally (owner's DATABASE_URL)
  before prod flip; AC3 verified by a Render redeploy after PR-C.
