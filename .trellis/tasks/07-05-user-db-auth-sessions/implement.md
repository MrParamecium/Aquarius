# Implement — User accounts: DB migration + login sessions

Three PR stages (design.md §7). Each stage ends at a review gate; do not start
the next stage before the previous one is merged and verified. Requirement IDs
(R1–R4) and acceptance criteria (AC1–AC7) refer to `prd.md`.

## Stage A — Backend foundation (PR-A, inert without env vars) [R1, R2]

- [ ] A1. Add `pg` to `dependencies` in `package.json` (pin major). Verify
      `npm install --omit=dev` still builds in Docker (pure-JS dep, no gyp).
- [ ] A2. New `app/db.js`: Pool (max 3, ssl), `DATABASE_URL` via existing env
      loader, startup DDL bootstrap (4 tables per design §3), fail-fast when
      `DATABASE_URL` set but unreachable; log active backend. Hardening per
      design §3: parameterized (`$1`) statements only; uid gate
      `^[A-Za-z0-9_-]{1,64}$` at the store boundary; ~64KB JSONB row cap;
      `guest_*` uid refusal; `ensureUserRow(uid)` upsert
      (`ON CONFLICT (uid) DO NOTHING`) before every FK-dependent write.
- [ ] A3. `app/user-memory.js`: extract the internal 8-primitive `store`
      interface using the REAL function names (design §3): readUserMemory /
      writeUserMemory / listSessionsForUid / readSessionFile / writeSessionFile
      (extract from internal `writeSessionFileAtomic`) / deleteSessionForUid /
      readFeedbackBoard / writeFeedbackBoard. File impl = existing code; new pg
      impl; factory picks by `deps.databaseUrl`. Public surface becomes async —
      INCLUDING `persistSessionTurn` and `updateUserMemoryFromQA`, which call
      store IO internally (user-memory.js:427, :461) and need awaits added.
- [ ] A4. `app/ws-bridge.js`: await the touched callsites — `/api/sessions*`
      (~4343-4360), `/api/memory*` (~4366-4430, incl. writeUserMemory at 4411
      and 4428), ask-flow readUserMemory (~4805), persistSessionTurn (~5035),
      fire-and-forget updateUserMemoryFromQA (~5099 — keep fire-and-forget but
      attach a .catch), feedback routes (~5128). No route shape changes.
- [ ] A5. New `app/clerk-verify.js`: JWKS fetch+cache (unknown-kid refetch
      throttled + negative-cached; fetch failure → fail-closed null, design §2),
      RS256 verify, iss/exp/nbf validation, azp CONDITIONAL (present → must be
      in allowlist; absent → pass), `{uid, sid}` result. Env: `CLERK_JWKS_URL`,
      `CLERK_ISSUER`, `CLERK_AUTHORIZED_PARTIES`.
- [ ] A6. `requireAuth` guard wired to route classes (design §2 table), gated by
      `TUTOR_REQUIRE_AUTH`. Class-independent rule: whenever a valid token is
      present, uid comes from `payload.sub` in EVERY class (incl. /api/ask's
      memory read + session persist — review C2); enforcement OFF only means
      tokenless requests aren't rejected (opportunistic verification, review
      C3). LLM routes 401 before any OpenRouter call. `/api/section` mode gate
      per design §2: missing mode = intro; unauthenticated intro → 401,
      overview cache-miss generation → 401, lesson + overview cache hits public.
- [ ] A7. CORS: origin-reflect allowlist + `Authorization` header + `Vary:
      Origin` on reflected responses. Structural: the CORS decision moves
      after route dispatch — `setCORSHeaders()` currently runs before pathname
      parsing (ws-bridge.js:4298-4308), so this is NOT a local edit (design §2).
- [ ] A8. New `tools/test-auth-guard.js` with the full design §8 case list
      (incl. no-azp acceptance, /api/section mode-gate 401s, replies-route
      tokenless 200, /api/ask body-uid spoof immunity; LLM-route positive
      cases assert "not 401", never end-to-end 200) + add it and the new app
      modules to `npm run check`'s file list.
- [ ] **Validate**: `npm run check` · `node tools/test-auth-guard.js` ·
      `node tools/test-lesson-open-no-hang.js` (no-env mode must be byte-for-byte
      behavior-identical: file store, guards off) · manual: `npm start` with a
      real Neon `DATABASE_URL`, exercise quiz + a chat turn, confirm rows in Neon.
- [ ] **Review gate A** → merge PR-A → deploy → verify /health + zero behavior
      change (no env vars set yet). NOTE: `DATABASE_URL` deliberately does NOT
      land here — durability is sequenced after PR-B (design §7 step 3, review
      M6) so the legacy uid-param frontend never writes guest/spoofable rows
      into Neon.

## Stage B — Frontend sessions + restore (PR-B) [R3]

- [ ] B1. `app/clerk-auth.js`: export `getAuthToken()` (fresh per call). New
      `app/api-client.js` `apiFetch()` attaching the Bearer header. Verify
      apiFetch works when called from inside the auth state-machine callbacks
      (onUserSignedIn / syncCurrentUserWithoutNavigation memory fetches, ~606
      and ~641) during initial session restoration — getAuthToken() must
      return a fresh token there too (review I1).
- [ ] B2. Swap callsites to apiFetch + drop uid fields: `app.js`
      (callAsk ~4731, callIntent ~4755, quiz handler ~387, saveSessionSummary
      ~443, resetQuiz ~219), `preference-profile.js` (~205, ~235),
      `recent-conversations.js` (~284), `clerk-auth.js` memory fetches (~606, ~641).
      Dropping uid fields BEFORE the PR-C flip is safe by design: guards verify
      tokens opportunistically even with enforcement off and prefer token-uid
      (design §2/§6, review C3) — do not re-add uid fields "for compat".
- [ ] B3. Last-location persistence: add `recordLastLocation(view, ctx)` and
      call it from each restorable `show*View()` function — there is NO central
      dispatcher; the nine show-functions are enumerated in design §4 (review
      M7); persisted shape is `{view, sectionId, ts}`, no sectionTitle (review
      m6). Plus `bootRestoreLastLocation()` per design §4 — do NOT touch
      `allowAuthNavigation` semantics; auth-callback/intent machinery keeps
      precedence. Intro landing gates on (Clerk user ∨ guest uid) absent.
- [ ] B4. Guest localization: quiz/memory to sessionStorage, no `/api/memory`
      traffic for guests, "sign in to ask" affordance on gated composer (D3/D4).
      Handle the new guest 401s from `/api/section` (review C1): skip the
      intro gracefully and show cached overviews only — no error surfaces to
      the guest for gated generation paths.
- [ ] B5. Version-bump ritual: index.html visible version (sidebar + Settings),
      `app.js?v=` / `style.css?v=`, package.json version.
- [ ] **Validate**: `npm run check` · e2e no-hang · manual matrix on localhost:
      refresh mid-lesson (AC1), full browser restart (AC2), guest tab lifecycle
      (AC6), signed-out visitor sees intro. Visual-diff `--check`; if intro/login
      views drift, show owner the pixel diff before any re-baseline.
- [ ] **Review gate B** → merge → Vercel auto-deploy → smoke AC1/AC2 on
      aquarius-seven.vercel.app (enforcement still off). Rollback: revert commit.
- [ ] **Durability flip (design §7 step 3)**: NOW set `DATABASE_URL` on Render
      dashboard → verify a signed-in quiz save lands in Neon and that
      `SELECT count(*) FROM users WHERE uid LIKE 'guest_%'` is zero (AC6).
      Rollback point: unset `DATABASE_URL`.

## Stage C — Enforcement flip + docs (PR-C) [R2, R4]

- [ ] C1. Render dashboard: set `TUTOR_REQUIRE_AUTH=1`, `CLERK_JWKS_URL`,
      `CLERK_ISSUER`, `CLERK_AUTHORIZED_PARTIES`.
- [ ] C2. Prod verification: AC4 (curl 401s + uid-spoof immunity, INCLUDING
      /api/ask with valid token + foreign body.uid → persists under token sub;
      /api/sessions* checks are curl-only — those routes have zero frontend
      callers today, docs/multi-session.md Phase 2 deferred, review I3), AC5
      (ask/intent/preference-draft without token → 401, unauthenticated
      /api/section intro + overview-cache-miss → 401, no OpenRouter spend in
      logs), AC6 (zero `guest_%` rows in Neon), AC3 (trigger a Render redeploy,
      confirm profile/chat/feedback survive), AC1/AC2 re-check (Chromium —
      see prd AC2 scoping).
- [ ] C3. Docs: CLAUDE.md (pg exception, new env vars, session architecture
      note), `.trellis/spec/app/index.md` pre-dev checklist ("Node built-ins
      only" → "…plus the sanctioned `pg` exception"),
      `.trellis/spec/app/architecture.md`, `docs/multi-session.md` ("swapped for
      a database" note now true), `docs/phase3_deferred.md` §1 marked shipped.
      File the D7 follow-up (custom domain + Clerk production instance) in the
      backlog.
- [ ] **Review gate C** → wrap-up: AC checklist against prd.md, spec update
      (trellis-update-spec), commit protocol.
      Rollback point: unset `TUTOR_REQUIRE_AUTH` (durability stays).

## Risky files / landmines

- `app/app.js` boot sequence — the 2026-05-08 state-machine saga
  (`workspace/memory/2026-05-08.md`); every historical regression here was a
  startup navigation fight. New code must be additive (one boot step), never a
  flag-semantics change.
- `app/ws-bridge.js` sync→async conversion — missed `await` = silently empty
  memory; after A4, derive the grep pattern from **the exports that become
  async** (review M3 — criterion: store primitives + domain functions doing
  store IO): `readUserMemory|writeUserMemory|persistSessionTurn|
  listSessionsForUid|readSessionFile|writeSessionFile|deleteSessionForUid|
  readFeedbackBoard|writeFeedbackBoard|updateUserMemoryFromQA` — and assert
  none remain un-awaited. Pure sync helpers are deliberately excluded
  (`deriveMemoryFromSessions`, `buildUserProfilePrompt`, `publicFeedbackItem`,
  `cleanFeedbackText` — no store IO, they take data as arguments). ALSO scan
  user-memory.js internals: domain functions call the store directly (e.g.
  updateUserMemoryFromQA at :427/:461, review M4).
- `vercel.json` — do not touch (schema landmine, CLAUDE.md).
- Do not rename `AQUARIUS_CONFIG` / `aquarius_visual_latex_v2`.

## Sev routing

Gated Timebox applies: wrong-auth (data leak across uids) or login-blocked = Sev-1;
cosmetic landing/restore misses = Sev-2 batch to dev day.
