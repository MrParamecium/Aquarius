# Plan review — 07-05 user-db-auth-sessions (review gate, pre-`task.py start`)

- **Date**: 2026-07-05
- **Method**: multi-agent workflow (`wf_0eaf6ed0-e56`): 8 review dimensions (backend/frontend anchor verification, independent endpoint re-derivation, independent frontend-callsite re-derivation, adversarial security review, cross-artifact consistency, implementer dry-run, external Clerk fact-check) → dedup → adversarial refutation votes (2 votes on critical/major, 1 on minor/info). 48 agents, 0 failures. 40 raw findings → 26 merged → **24 kept (21 confirmed, 3 contested), 2 refuted-and-dropped**.
- **Verdict**: The plan set is well-researched and internally traceable (D1–D7 → R1–R4 → stages all map; line anchors are essentially accurate — the "plans drift from git" trap did NOT bite here). But it is **not ready for `task.py start`**: 3 critical and 10 major defects need artifact amendments first. None of them invalidate the overall approach (Clerk JWT verify + Neon dual-backend + 3-PR rollout stands); all are fixable with edits to `design.md` / `implement.md` / `prd.md`.

---

## Critical — must fix before start

### C1. `/api/section` is classified public but spends LLM money (breaks AC6/D4) — CONFIRMED 2/2
- **Claim**: design §2 puts `/api/section` in the public class, but its `mode='intro'` path unconditionally calls `generateSectionIntro` → `callOpenRouterChat` (haiku), and `mode='overview'` calls the full `preGenerateSectionLesson` dual-agent pipeline (gpt-5.5 + sonnet) on cache miss. Both modes are reached by ordinary unauthenticated section-open flows.
- **Evidence**: `ws-bridge.js:4482-4515` (intro/overview branches; only `mode='lesson'` is a pure cache read), `app.js:1954-1965` (`loadChapterOverviewPrelude` posts `mode:'overview'` unconditionally), `app.js:2200-2205` (intro fallback). Contradicts prd D4 ("guests get cached-lesson reads only"), R2, and AC6 ("guest cannot trigger LLM spend") — the plan's own acceptance criterion is falsified by its route table.
- **Fix**: Gate `/api/section` **by mode**: token required for `mode='intro'`/`'overview'`, only `mode='lesson'` stays public. Update design §2 table + extend AC5/test-auth-guard to assert 401 on unauthenticated intro/overview.

### C2. `/api/ask` still trusts client `body.uid` for per-user reads/writes even after enforcement — CONFIRMED 2/2
- **Claim**: the design's "uid from token only" rule is scoped to the *uid-scoped* route class; `/api/ask` sits in the *LLM-spending* class whose rule is only "valid token required". But `/api/ask` reads the victim's profile (`ws-bridge.js:4804-4805`, `const uid = data.uid || null` → `readUserMemory`) and writes their history (`persistSessionTurn` ~5035). An authenticated attacker passes any `uid` in the body → cross-user data leak/poisoning survives PR-C.
- **Evidence**: design.md §2 table row rules vs `design.md:49-50` ("client uid ignored **everywhere**") — the table contradicts the prose; check.jsonl's AC4 checklist assumes token-uid on every §3.1 endpoint, implement A6 scopes it to uid-scoped routes only.
- **Fix**: add an explicit rule: any LLM-spending route that touches per-uid data also derives uid from `payload.sub`. Extend AC4 to cover `/api/ask` uid-spoof immunity.

### C3. PR-B drops uid params while enforcement is still OFF → persistence breaks in the step-3→4 window — CONFIRMED (escalated from info by verifier)
- **Claim**: B2 says "swap callsites to apiFetch + **drop uid fields**", deployed at rollout step 3; enforcement (token-derived uid) only turns on at step 4. In between, the backend (enforcement off) still reads uid from params/body — which the new frontend no longer sends → quiz saves, memory writes, session persistence silently no-op on prod. Design §6's compatibility matrix covers old-FE/new-BE and new-FE/old-BE but not **new-FE/new-BE-with-enforcement-off**, which is the actual deployed state in the window.
- **Fix** (pick one, write it into design §6/§7 + B2): (a) guards verify the token opportunistically even with enforcement off and prefer token-uid over param-uid (best — makes the window safe and shrinks PR-C to pure gating); (b) keep sending uid fields in PR-B, drop them in PR-C; or (c) accept + document a same-day B→C flip.

---

## Major — should fix before start

### M1. Nobody provisions `users` rows → every first pg write hits an FK violation (AC1/AC3 break) — CONFIRMED 2/2
DDL: `user_memory.uid` / `chat_sessions.uid` `REFERENCES users(uid)`; clerk-verify returns only `{uid, sid}`; no artifact contains an upsert/INSERT INTO users step. Rollout step 2 (set `DATABASE_URL`) fails on the first quiz save. **Fix**: specify `INSERT ... ON CONFLICT (uid) DO NOTHING` (profile fields nullable) before any dependent write, in design §3 + implement A3.

### M2. Mandatory `azp` check bricks sign-in when `azp` is absent — CONFIRMED 2/2 (web-verified)
Clerk's own manual-JWT-verification doc (fetched 2026-07-05): "If the `azp` claim doesn't exist, you can skip this step"; a Clerk GitHub issue documents azp missing at scale, especially cross-origin (exactly this app's topology). design §2 says "azp ∈ list — not optional". **Fix**: conditional rule — if present, must match (fail-closed); if absent, pass. Add a no-azp token case to test-auth-guard.

### M3. `writeUserMemory` missing from the async-ripple safety-net grep — CONFIRMED 2/2
implement.md's landmine grep pattern omits `writeUserMemory`; it's called synchronously at `ws-bridge.js:4411` and `:4428` (both inside routes A4 declares in scope). A missed await there = silent data loss. **Fix**: add it to the grep; better, derive the grep list from `user-memory.js` exports (465-479).

### M4. `updateUserMemoryFromQA` is NOT storage-agnostic — silent corruption on every Q&A turn — CONFIRMED 2/2
design §3 claims it "doesn't change at all", but it directly calls `readUserMemory`/`writeUserMemory` internally (`user-memory.js:427`, `:461`) with no await path; once those go async it merges a Promise into `{}` and persists garbage, fire-and-forget from `ws-bridge.js:5099` (so no error surfaces). **Fix**: remove it from the "unchanged" list; make it async; extend the grep to scan user-memory.js internals.

### M5. `/api/preference/draft` misclassified (uid-scoped, not LLM-spending) — CONFIRMED 2/2
prd D4 names it as LLM-spending; the handler unconditionally calls OpenRouter (`ws-bridge.js:4672-4720`); design table has it under uid-scoped only, and no AC verifies pre-spend 401 for it. **Fix**: move it to the LLM-spending row (it touches no per-uid server data today — see I4); add 401 assertions for it + `/api/intent` + `/api/pregen/section` to test-auth-guard.

### M6. Guest data reaches the durable DB during the rollout window (violates D3/AC6) — CONFIRMED 2/2
After step 2 (DATABASE_URL set) and before PR-B ships, the **old** deployed frontend keeps POSTing `guest_xxx` uids (quiz/memory/session persists check `if (!currentUser)`, not `.isGuest`; backend `if (uid)` persists anything). Guest rows land in Neon. **Fix**: sequence DATABASE_URL after PR-B, or add a documented `DELETE FROM ... WHERE uid LIKE 'guest_%'` purge step before AC6 verification, or add backend guest-uid filtering in PR-A.

### M7. The "central view-switch state machine" does not exist — B3 is underspecified — CONTESTED 1c/1r
app.js has ~9 independent `show*View()` functions (`showWelcome` 4128 … `showLoginView` 4291), no single dispatcher; grep finds no 'library' view. B3's "write last-location in the central view-switch functions" has no single hook point. **Fix**: enumerate the exact show-functions that write last-location (or scope a tiny dispatcher first). (Contested: one verifier read "functions" plural as already acknowledging this; the enumeration is still missing either way.)

### M8. AC2 (browser-restart persistence) is unverifiable as stated on a dev instance — CONFIRMED 2/2
Research only confirms same-tab dev-browser token behavior; no Clerk doc confirms dev-instance persistence across a full browser restart on a third-party domain; Safari ITP may cap the relevant storage at ~1 day, under the 7-day window. **Fix**: scope AC2 to Chromium explicitly (documented), note Safari as unverified in prd D7/AC2.

### M9. test-auth-guard's "200 case" for LLM routes can't be hermetic — CONFIRMED 2/2
A real 200 from `/api/ask` requires a live OpenRouter key + spend (`llm-client.js:53-56` throws per-call without a key), contradicting "self-contained, no network". **Fix**: state that the positive case asserts "non-401 / reaches handler", not full success; full success stays in Stage C2 manual verification.

### M10. CORS change is structural, not a local edit — and omits `Vary: Origin` — CONFIRMED 1c (sev raised from minor)
`setCORSHeaders()` runs before pathname parsing (`ws-bridge.js:4298-4308`), so "reflect for API, keep `*` for static" needs the CORS logic moved/re-invoked after route dispatch. Reflected origins also need `Vary: Origin`. **Fix**: note both in design §2.

---

## Minor

- **m1. `/api/feedback/{id}/replies` POST missing from the route-class table** (regex-dispatched at `ws-bridge.js:5171-5213`; public-by-design, but test-auth-guard needs an expected status for it). Add it to the public row. *(contested 1c/1r — substance stands, severity was debated)*
- **m2. Store-interface vocabulary is invented** — design §3's 8 names (`readMemory/writeSession/...`) match neither `user-memory.js`'s actual 13 exports nor implement.md's grep list; `writeSession` doesn't exist as a primitive (session writes are fused inside `persistSessionTurn`'s read-merge-write). Name the real functions and decide whether `writeSessionFileAtomic` gets extracted. *(contested 1c/1r)*
- **m3. JWKS cache lacks negative-cache/backoff** — random-`kid` spray forces a Clerk fetch per request (self-DoS, risks Clerk rate-limiting during key rotation); fetch-failure behavior (fail-open/closed) unstated. Specify: refetch at most once per N min, cache unknown-kid misses, fetch failure → 401 fail-closed with stale-key serving.
- **m4. No parameterized-query / input-validation note** — uid flows into SQL/JSONB with no format check (`sanitizeUid` only guards file paths); `/api/memory` POST merge is uncapped (`ws-bridge.js:4388-4394`). Require `$1` placeholders, `^[A-Za-z0-9_-]{1,64}$` uid check, and a per-row JSONB size cap.
- **m5. AC2 wording says "configured session lifetime"** — Hobby plan is *fixed* 7 days (web-verified against Clerk pricing). Reword so nobody hunts for a nonexistent setting.
- **m6. `bootRestoreLastLocation` trusts stored `sectionTitle`** — tamperable localStorage input that's derivable from the validated `sectionId`. Drop it from the persisted shape.

## Info

- **I1.** clerk-auth.js memory fetches (~606, ~641) run inside auth state-machine callbacks — B1/B2 should verify `apiFetch`/`getAuthToken()` works during initial session restoration.
- **I2.** `/api/favicon` (`ws-bridge.js:5215-5280`, outbound-fetching proxy) appears in no route class — add to public row or note as intentionally omitted.
- **I3.** `/api/sessions*` has **zero** frontend callers today (recent-conversations.js is fully localStorage; docs/multi-session.md Phase 2 deferred) — AC4 verification for those routes is curl-only; expected, not a gap.
- **I4.** research §3.1 overstates: `/api/intent` and `/api/preference/draft` handlers never read `data.uid` today (client sends it, server ignores it). Correct the research note.
- **I5.** design adds `/api/tutor` to the gated class beyond what D4 names — fine, but mark it as a deliberate scope addition (owner sign-off) so it isn't flagged later.

## Refuted and dropped (for transparency)

1. "Replies route can evict board items via the 300-cap" — the unshift+slice(0,300) lives in the top-level feedback POST, not the replies handler; misattributed.
2. "Async conversion breaks test-lesson-open-no-hang's byte-for-byte comparison" — that test does no byte comparison (Playwright text-marker wait); misread of implement.md's wording.

## Suggested amendment map

| Artifact | Edits |
|---|---|
| `design.md` | §2: mode-gate `/api/section` (C1); token-uid rule for LLM routes touching user data (C2); conditional azp (M2); replies + favicon rows (m1, I2); CORS structural note + Vary (M10); JWKS negative-cache/fail-closed (m3). §3: users upsert (M1); real store function names (m2); remove `updateUserMemoryFromQA` from "unchanged" (M4); parameterization/validation note (m4). §4: drop sectionTitle (m6). §6/§7: new-FE/new-BE-enforcement-off row + chosen sequencing fix (C3); guest-purge or resequencing (M6). §8: non-401 semantics for LLM-route positive cases (M9). |
| `implement.md` | A3/A6/B2 per C2/C3/M1; grep list += `writeUserMemory` + user-memory.js internals (M3/M4); B3 enumerate show*View() sites (M7); test-auth-guard cases: intro/overview 401, no-azp, replies route (C1/M2/m1). |
| `prd.md` | AC2 wording + Chromium scoping (M8/m5); AC4 covers `/api/ask` spoof-immunity (C2); AC5 covers intro/overview + preference/draft (C1/M5); D4 note re `/api/tutor` (I5). |
| `research/current-auth-flow.md` | §3.1 correction (I4). |

---

## Closure log (2026-07-05, same day)

All 24 findings folded into the artifacts (owner: "tackle all of them").
Verification workflow `wf_6e4e0bf2-94e` (24 per-finding checkers + fresh-eyes):
**22/24 fully closed on first pass**; 2 partial + 6 fresh-eyes residues, all
fixed in a second edit round:

- C1 residue: test-auth-guard case list lacked the overview cache-miss→401 /
  cache-hit→200 pair → added to design §8 (regression-tested, not just the
  one-off Stage C2 prod check).
- M7/F1 residue: §1 architecture diagram still said "view-switch state
  machine" → reworded to the nine show*View() + recordLastLocation() reality.
- F2: §2 "uid ignored everywhere" absolute prose contradicted the C3 compat
  mode → qualified (holds exactly when a token exists).
- F3: enforcement-OFF compat case untestable in a single enforcement-ON spawn
  → test harness now spawns the bridge twice.
- F4: /api/ask spoof-immunity not hermetically observable (handler throws at
  the LLM call before persisting) → hermetic spoof case moved to the
  /api/memory POST+GET pair; /api/ask persist check stays in Stage C2 prod.
- F5: prd "endpoints reading identity today" cited §3.1 for the pre-correction
  claim → aligned with the I4 correction.
- F6: store-primitives export claim over-stated (13 exports, writeSessionFile
  is new) + landmine grep included a pure helper and lacked its exclusion
  criterion → both reworded ("exports that become async" criterion).

Three review-driven design choices await owner ratification at the start gate
(recorded in prd "Plan-review amendments"): C1 cache-only guests, C3
opportunistic verification, M6 resequenced rollout.
