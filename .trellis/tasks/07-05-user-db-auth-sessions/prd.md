# User accounts: DB migration + login sessions

## Goal

Ship a working user login system with industry-standard session management, backed
by a durable database for user/account data (the deferred "Phase 4 — user-data DB
migration", `docs/phase3_deferred.md:21`, `docs/REFACTOR_DONE.md:463`).

User-visible outcome: a signed-in user who refreshes the page or re-opens the
browser stays signed in and lands back in the view they were in — not on the
homepage with a fresh login prompt. User data survives Render redeploys. The
backend stops trusting client-supplied identity.

## Background — three stacked causes of the symptom (verified 2026-07-05)

1. **No server-side auth/session verification exists.** Every uid-scoped endpoint
   trusts a bare client-supplied `uid` (query param or body) with zero
   token/cookie/ownership checks — confirmed by exhaustive search
   (`research/current-auth-flow.md §3`). Anyone can read/write any user's data.
2. **Frontend deliberately parks restored sessions on the homepage.** Clerk *does*
   restore the session on reload, but `allowAuthNavigation` is false on plain page
   loads, so `syncCurrentUserWithoutNavigation()` runs (`app/clerk-auth.js:632-655`)
   and the return-intent/target machine (sessionStorage-only, auth-flow-only) never
   fires. Current lesson/view state is not persisted anywhere
   (`research/current-auth-flow.md §2.2-2.3`).
3. **User data is ephemeral.** All account data is filesystem JSON under
   `app/users/` (`app/user-memory.js`, resolved at `app/ws-bridge.js:1237`), wiped
   on every Render redeploy/restart. No persistent disk exists (`Dockerfile`,
   `research/deploy-runtime-constraints.md §3`).

## Confirmed environment facts

- Runtime: Node 20 (`Dockerfile:1`), **zero runtime npm deps** (`package.json` has
  devDependencies only); `node:sqlite` unavailable on Node 20.
- Deploy: Vercel static frontend (`aquarius-seven.vercel.app`) → Render backend
  (`aquarius-5ss0.onrender.com`), cross-origin via `app/config.js:2-4`.
- CORS today: `Access-Control-Allow-Origin: *`, headers limited to
  `Content-Type`, no credentials (`app/ws-bridge.js:151-154`) — must add
  `Authorization` to allowed headers for Bearer-token auth.
- Clerk: **development instance** (`pk_test_…`, `driven-troll-28.clerk.accounts.dev`),
  Clerk JS v4 pinned (v5 broke it 2026-04). Guest mode = sessionStorage uid.
- Data families to cover in the DB (full shapes in
  `research/current-auth-flow.md §5`): user memory (quiz profile, preference
  profile, known/weak concepts, style, summaries), chat sessions (meta + messages),
  shared feedback board (items + replies).
- Endpoints reading identity today: `/api/memory` GET/POST, `/api/memory/rebuild`,
  `/api/sessions`, `/api/sessions/{id}` GET/DELETE, `/api/ask`
  (`research/current-auth-flow.md §3.1`). `/api/intent` and
  `/api/preference/draft` *receive* a body uid but the handlers never read it
  (§3.1 correction, 2026-07-05) — they still get D4 token gating, there's just
  no uid-trust logic there to replace. Frontend attaches uid from 5+ modules
  (`§4`).

## Decisions (interview, 2026-07-05)

- **D1 — Keep Clerk; add server-side verification.** Backend verifies Clerk session
  JWTs (JWKS + built-in `crypto`, no SDK) and maps Clerk uid → DB user. Accepted
  trade-off: Clerk's China-network fragility stays. *Pending verification:* dev-
  instance session-persistence semantics and production-instance requirements
  (`research/clerk-instance-facts.md`, in flight) — may refine how D1 is executed,
  not whether.
- **D1a — Session transport = `Authorization: Bearer <fresh Clerk session JWT>`**
  per request (Clerk tokens are short-lived and refreshed by Clerk.js). No
  cross-site cookies needed; CORS just allows the `Authorization` header.
- **D2 — Landing = restore last view at lesson granularity.** Signed-in users land
  back in the view they were in (lesson section, library, settings…); intro/landing
  shows only to signed-out visitors. Deliberately reverses the 2026-05-08
  "session restore never navigates" decision.
- **D3 — Guest mode stays ephemeral.** Temporary uid, data dies with the tab, no
  guest→account merge. Design simplification that follows: guest data never
  touches the DB (client-side only), so no TTL cleanup machinery is needed.
- **D4 — Live-LLM endpoints require a verified session.** Any endpoint spending
  OpenRouter credits (`/api/ask`, `/api/intent`, `/api/preference/draft`,
  `/api/pregen/*`, **plus — added by the 2026-07-05 plan review — the
  generation paths of `/api/section`** (`mode='intro'` always spends;
  `mode='overview'` spends on cache miss; see design §2 mode gate) **and the
  legacy `/api/tutor`**, a deliberate scope addition beyond this interview
  list) rejects unauthenticated requests. Guests get cached-lesson reads only —
  now literally true: unauthenticated `/api/section` is cache-only. First real
  abuse protection for the public Render URL.
- **D5 — Database = Neon free-tier Postgres + `pg` driver**, the first sanctioned
  runtime npm dependency (record the exception in CLAUDE.md +
  `.trellis/spec/app/index.md` checklist). JSONB columns carry the existing
  document shapes. Accepted trade-offs: autosuspend wake latency (~0.5–2s after
  idle), dependency-purity exception.
- **D6 — Fresh start, no data migration** of existing `app/users/*.json` (prod
  copies are wiped every deploy already; local profiles re-creatable via quiz).
- **D7 — Stay on the Clerk development instance for this task.** Verified facts
  (`research/clerk-instance-facts.md`): dev instances cap at 100 users, use a
  querystring token mechanism Clerk calls not-production-grade, and their users
  can never transfer to a production instance; production requires a custom
  domain with DNS control (impossible on `*.vercel.app`). Accepted at classmate
  scale; **follow-up backlog item: buy a domain + migrate to a Clerk production
  instance.** Free-plan sessions are a fixed 7 days — "signed in across browser
  restarts" works out of the box for ≤7-day gaps.

## Requirements

**R1 — Durable DB layer (replaces filesystem JSON)**
- Add `pg` to `dependencies`; `DATABASE_URL` via the existing `app/.env` loader
  pattern (`app/ws-bridge.js:20-43`); set in Render dashboard for prod.
- Schema covers users, user memory, chat sessions, feedback board (shapes per
  `research/current-auth-flow.md §5`); exact DDL in `design.md`.
- Swap the storage internals of `app/user-memory.js` behind its existing factory
  interface. Note: current interface is synchronous; DB makes it async — the
  ripple into `ws-bridge.js` callsites is in scope and must be enumerated in
  `design.md`.
- Feedback board migrates too (same module, same durability problem).
- No formal data migration (D6).

**R2 — Server-side identity (verify, never trust)**
- Verify Clerk session JWTs on the backend: JWKS fetch + cache, RS256 verify via
  built-in `crypto`, validate exp/nbf/azp/iss. No Clerk SDK.
- **Every** endpoint that touches per-uid data derives uid **from the verified
  token whenever one is present** — not just the uid-scoped class: `/api/ask`
  reads user memory and persists session turns and must key both off the token
  sub (2026-07-05 review, C2). Client-supplied uid params/body fields are never
  trusted; during the transition window (enforcement off) tokenless requests
  keep legacy uid-param behavior, but a presented token always wins.
- D4 gating on LLM-spending endpoints; unauthenticated → 401 JSON error.
- CORS: allow `Authorization` header; restrict origin to the Vercel app +
  localhost dev origins (design detail).
- Guest requests: no DB reads/writes, no LLM calls; cached-lesson/static routes
  stay public.

**R3 — Session persistence + state restoration (frontend)**
- Persist "last location" (view + sectionId, lesson granularity) to localStorage
  on navigation; restore it on boot when a Clerk session is present (D2).
- Intro landing gates on auth state: signed-out only.
- Replace uid-plumbing with per-request fresh token (`Clerk.session.getToken()`)
  in all API callsites (`app.js` callAsk/callIntent, quiz handler,
  `preference-profile.js`, `recent-conversations.js`, `clerk-auth.js` memory
  fetches — full list in `research/current-auth-flow.md §4`).
- Guest memory (quiz answers etc.) moves fully client-side (sessionStorage),
  consistent with D3.

**R4 — Release hygiene**
- `npm run check` stays green; version bump ritual (index.html sidebar/Settings,
  `app.js?v=`/`style.css?v=`, package.json) per CLAUDE.md on the frontend PR.
- CLAUDE.md updated: `pg` dependency exception + new env vars documented.
- No Windows-illegal filenames; `aquarius_visual_latex_v2` / `AQUARIUS_CONFIG`
  untouched.

## Acceptance Criteria

- [ ] AC1 (refresh): signed-in user mid-lesson hits refresh → same lesson view
  restored, still signed in, no login prompt, no intro page.
- [ ] AC2 (browser restart): signed-in user fully closes and re-opens the browser
  within the **fixed 7-day session lifetime** (Clerk Hobby plan — not
  configurable, don't hunt for a setting) → still signed in, lands at last
  view. **Verified in Chromium only**; Safari/WebKit is explicitly out of
  scope (ITP may cap dev-instance token persistence below 7 days — unverified,
  accepted under D7).
- [ ] AC3 (durability): backend redeploy on Render → quiz profile, preference
  profile, chat sessions, feedback board all intact afterwards.
- [ ] AC4 (authz): `/api/memory` & `/api/sessions*` with no/invalid token → 401;
  with a valid token → returns only that user's data; uid spoofing via param/body
  has no effect **on any route — including `/api/ask`, whose memory read and
  session persist must ignore `body.uid` in favor of the token sub**.
  (`/api/sessions*` is verified via curl: those routes have zero frontend
  callers today — recent-conversations is localStorage-only, multi-session
  Phase 2 deferred — expected, not a gap.)
- [ ] AC5 (LLM gate): `/api/ask`, `/api/intent`, `/api/preference/draft`,
  `/api/pregen/section`, and unauthenticated `/api/section` generation paths
  (`mode='intro'`, missing mode, `mode='overview'` on cache miss) → 401 and no
  OpenRouter call is made; signed-in requests succeed; cached `/api/section`
  reads stay public.
- [ ] AC6 (guest): guest can browse cached lessons and take the quiz; closing the
  tab discards guest state; guest cannot trigger LLM spend (cache-only
  `/api/section` behavior; intro skipped gracefully); no guest rows appear in
  the DB — verified as `SELECT count(*) FROM users WHERE uid LIKE 'guest_%'`
  = 0 after the durability flip (pg store refuses `guest_*` as backstop).
- [ ] AC7 (regressions): `npm run check` passes;
  `node tools/test-lesson-open-no-hang.js` passes; local dev (`npm start`, no
  DATABASE_URL → documented dev fallback per design.md) still works.

## Out of scope

- Guest→account data merge (D3); password reset / email flows (Clerk owns them);
  Google-OAuth China reachability work; multi-device live sync; admin/user-管理 UI;
  the six carry-forward demo bugs and other `phase3_deferred.md` items; feedback
  board copy fix (§4 there); Clerk production-instance migration (D7 follow-up —
  requires buying a custom domain first).

## Open questions

None blocking — all seven interview decisions (D1–D7) resolved 2026-07-05.

## Plan-review amendments (2026-07-05)

All 24 findings from `review-plan-2026-07-05.md` folded into prd/design/
implement. Three review-driven design choices need owner ratification at the
start gate:
1. **C1**: unauthenticated `/api/section` is cache-only (guests keep all cached
   content; only generation paths 401).
2. **C3**: guards verify tokens opportunistically even with enforcement off
   (token-uid wins over param-uid) — makes the PR-B→PR-C window safe.
3. **M6**: rollout resequenced — `DATABASE_URL` lands after PR-B, not after
   PR-A; pg store refuses `guest_*` uids as second layer.
