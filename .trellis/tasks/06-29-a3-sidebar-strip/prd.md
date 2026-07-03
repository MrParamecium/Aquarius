# A3 — `.app .sidebar` `!important` strip

> Status: **PLANNING (complex task)**. Created 2026-06-29 off `main` @ `6180fc0`.
> The genuinely-next remaining CSS-collapse surface after A1 closes (A4 settled
> irreducible; A2/A5 shipped). **Highest blast-radius strip of the series.**
> Complex → requires `prd.md` + `design.md` + `implement.md` before `task.py start`.

## Goal

Strip the non-load-bearing `!important` from the `.app .sidebar` surface to its
arbiter-verified floor, with zero visual regression. Because the surface is
**cascade-coupled and partially unwitnessable today**, the task is two-phase:
**(1) build the missing A0 gate**, then **(2) classify-and-strip** only what a witness
can prove safe — explicitly carving out (not silently skipping) what it cannot.

User value: removes the last large `!important` debt cluster that is *actually*
reducible (unlike A4), under coverage strong enough that a regression cannot hide.

## Confirmed facts (measured this session at HEAD `6180fc0` — NOT from docs)

**Surface:**
- **139** `.app .sidebar` two-class chains; **95** distinct rule blocks carry such an arm;
  **364** `!important` decls live inside those blocks (`app/style.css`).
- **6** genuine comma-grouped arms pair a sidebar selector with a bare-class syllabus arm
  reachable from the tree: `app/style.css` L5890, L5897, L5901, L5904, L5913-5914, L5923
  (`.sidebar .syllabus-X, .syllabus-X`). (L19779 is a comment false-positive.)
- Trajectory: 769 (pre-#105) → **620** (#118 −36). `PHASE3.6_SPEC.md` L42 flags it
  "◐ BARELY (#118 −36) — **A3 blocked on arbiter overlay mode**". Spec quotes 44.2% safe
  (unverified estimate; re-derive per-occurrence — [[feedback-rederive-keepset]]).

**Blast radius (CONFIRMED live at HEAD):**
- `app/style.css` L18280-18281 — `.app.sidebar-collapsed #learnView #learnBody.chat-collapsed
  .lesson-page-frame` (+ `:not(.explain-collapsed)` arm) is comma-grouped with two non-sidebar
  arms (L18278-18279) of **different specificity**; body L18282-18290 is all-`!important`
  geometry (width/max-width/min-height/margin/padding/border/border-radius/background/
  box-shadow). Dropping a sidebar `!important` elsewhere can flip **which arm wins** for the
  collapsed learn-view frame. Related collapsed-learn rules widen this: L12156
  (`.app.sidebar-collapsed .learn-body:not(.explain-collapsed) .lesson-page-frame`) and L18381.
- Syllabus `:hover` / `.active` `!important` arms at L5915-5926 are part of the strip surface.

**Existing harness coverage (the A0 GATE IS INCOMPLETE):**
- `tools/_view-cascade-probe.js` (the computed-style **arbiter**, NOT in `package.json`;
  run `node tools/_view-cascade-probe.js --baseline|--check`) already has, from #118,
  a **`sidebar-expanded` VIEW (5 hover interactions)** and a **`sidebar-collapsed` VIEW
  (2 interactions)** — sweeping 3 themes × 5 viewports, 270 states total. Partial, not whole.
- `tools/visual-diff.js`: view `02-syllabus-open` renders the tree with the sidebar
  **EXPANDED**; view `20-sidebar-collapsed` forces collapse but the syllabus panel is
  `display:none` under collapse (`app/style.css` L17324). **Mutually exclusive** — no view
  renders the syllabus tree *while collapsed*. Both run at the **loose default FAIL_RATIO
  0.005 (0.5%)**; no tight per-view override (the strict 0.0005 overrides exist only on
  12b-e/14c/14d).
- `tools/css-probe.js` (the package.json-wired durable gate) has **zero** sidebar coverage —
  every "collapse" state it models is learn-view-internal (chat/explain/overview).

**The three gate gaps that block stripping:**
1. **No state renders the syllabus tree while the sidebar is collapsed** (the union the
   doc calls the mandatory A0 prerequisite).
2. **The syllabus `:hover`/`.active` `!important` arms (L5915-5926) — exactly what A3 would
   strip — have ZERO coverage in any harness** (grep for any hover/active driver = empty).
3. **The collapsed `.lesson-page-frame` geometry (L18280-81, +L12156/L18381) is unguarded** —
   no witness asserts its arm precedence, which an A3 strip can flip.

## The invariant A3 must preserve

Every sidebar `!important` either (a) has **no same-or-higher-specificity competitor** →
NOCOMP → safe to downgrade (render-neutral), or (b) **defends a cascade competitor** (a base
rule, a comma-group arm of different specificity, or the collapsed-frame arm precedence) →
LOAD-BEARING → keep. A3 downgrades only (a), proven per-occurrence by a witness that can
*observe the flip* (a) would cause if it were actually (b).

## Requirements

- **R1 — Build the combined collapsed+syllabus witness.** Add coverage (primary: a
  `_view-cascade-probe` arbiter VIEW; see `design.md`) that renders the `.sidebar .syllabus-*`
  tree under **both** expanded and collapsed sidebar states in one matrix, so the union the
  current harness cannot see becomes witnessed. Test-only; baseline committed.
- **R2 — Cover the syllabus `:hover`/`.active` arms (L5915-5926).** Add an interaction that
  hovers a syllabus row and asserts the `.active` row, so a strip flipping those arms is caught.
- **R3 — Guard the collapsed `.lesson-page-frame` geometry (L18280-81, L12156, L18381).** Add
  a witness asserting the winning arm's computed geometry under sidebar-collapsed + chat-collapsed.
- **R4 — Tighten the gate threshold.** Give the sidebar visual-diff views a tight per-view
  `failRatio` (cf. 0.0005 on 12b-e/14c/14d); sidebar chrome is a small fraction of a 1280×800
  frame, so a real single-rule flip can hide under the 0.5% default.
- **R5 — Classify the 364 decls per-occurrence** (NOCOMP / LOSES / DEFENSIVE) via a fresh
  arbiter keep-set derivation — NOT seeded from any prior set ([[feedback-rederive-keepset]]),
  NOT per-token ([[feedback-reconcile-plans-against-git]]).
- **R6 — Strip only proven-NOCOMP decls**, each passing all five gates byte-identical
  (cascade-competitor top-level + arbiter `--check` + css-probe `--check` + visual-diff
  `--check` + inline-style/`@media` audit, per `.trellis/spec/css/verification.md`).
- **R7 — Carve-outs documented, not skipped** + **honest-yield reporting** ("N stripped, M
  proven-DEFENSIVE-kept"; small N is success — the A2 precedent).

## Acceptance Criteria

- [ ] **Gate (R1-R4) committed and green before any strip:** a single matrix witnesses
      syllabus tree × {expanded, collapsed}; syllabus `:hover`/`.active` asserted; collapsed
      `.lesson-page-frame` geometry asserted; sidebar visual-diff views run at tight `failRatio`.
      Baselines committed on `main`; **review checkpoint here** before Phase 2.
- [ ] Every stripped decl is proven-NOCOMP by the fresh arbiter pass and passes all five gates
      byte-identical; `npm run check` green.
- [ ] `.app .sidebar` `!important` count drops by exactly the stripped set; the residual is the
      documented load-bearing floor.
- [ ] Carve-outs (DEFENSIVE / unwitnessable) documented with surface + reason; honest-yield
      line reported (N stripped / M kept).
- [ ] `REFACTOR_DONE.md` §1 DoD `.app .sidebar` box + §A3 updated to the measured outcome.

## Out of scope

- A1 `#feedbackView` (independent task `06-29-a1-feedbackview-close`).
- Doubled-ID de-doubling on sidebar selectors (A2/A4 territory — `!important` strip only here).
- `@layer` migration; any sidebar *behavior*/markup change.
- Stripping anything the completed gate still cannot witness — carve out + backlog instead.

## Open questions (BLOCKING — for FlyM1ss at the review gate)

1. **Q-A3-scope — strip depth / risk tolerance.** Given the highest blast radius of the
   series, strip (A) only the proven-NOCOMP subset the completed gate can witness, carving out
   the rest [RECOMMENDED — honest-yield, matches A2/A4]; or (B) push further into DEFENSIVE-
   looking decls with extra bespoke witnesses per decl (higher cost, diminishing returns)?
2. **Q-A3-split — one task or precondition-split?** The gate-build (R1-R4) is a self-contained
   deliverable. Keep it as Phase 1 of this task with a review checkpoint [RECOMMENDED, honours
   "two independent tasks"]; or split it into its own precondition task (like the S14 witness
   preceded A4)? Affects PR granularity only.
