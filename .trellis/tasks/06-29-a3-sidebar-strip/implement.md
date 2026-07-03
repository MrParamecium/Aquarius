# A3 — `.app .sidebar` strip: execution plan

> Companion to `prd.md` + `design.md`. Ordered checklist with validation gates.
> **Do not begin until `task.py start` (review gate passed).** Phase 1 is test-only;
> Phase 2 is the only phase that edits `app/style.css`.

## Pre-flight (read before any edit — `trellis-before-dev`)

- [ ] Read `.trellis/spec/css/cascade-and-collapse.md` (Rule 3 classify-before-strip,
      Rule 4 style.css > runtime-collapsed invariant, Rule 6) and
      `.trellis/spec/css/verification.md` (the 5 gates).
- [ ] `npx playwright install chromium` (all three harnesses need the browser binary).
- [ ] Establish clean baselines on `main` and confirm green before touching anything:
      `npm run test:css-probe:baseline && npm run test:visual:baseline &&
       node tools/_view-cascade-probe.js --baseline` → commit the baselines.

## Phase 1 — Build the gate (tools/** only; NO app/style.css edit)

- [ ] **V0 (design crux) — verify the combined-state assumption.** Via the arbiter harness
      (guest mode), confirm `.sidebar .sidebar-syllabus-panel` computes `display:none` under
      `.app.sidebar-collapsed` (expected from `app/style.css` L17324) and that no product state
      shows a collapsed-sidebar *visible* tree. Record the finding; it decides R1's VIEW shape.
- [ ] **R1 — combined collapsed+syllabus witness** in `tools/_view-cascade-probe.js`: extend the
      existing `sidebar-expanded` / `sidebar-collapsed` VIEWs (or add one merged VIEW) so the
      matrix asserts, per V0: expanded → visible `.sidebar .syllabus-*` tree; collapsed →
      `.sidebar-syllabus-panel` display:none cascade holds.
- [ ] **R2 — syllabus `:hover`/`.active`**: add a hover interaction on a `.syllabus-section` row
      + assert `.syllabus-section.active`; add selectors L5915-5926 to the VIEW's `selectors`/`props`.
- [ ] **R3 — collapsed `.lesson-page-frame` guard**: add `.lesson-page-frame` + the L18282-90
      geometry props (width/max-width/min-height/margin/padding/border/border-radius/background/
      box-shadow) under sidebar-collapsed + chat-collapsed; covers L18280-81, L12156, L18381.
- [ ] **R4 — tighten threshold**: set a tight per-view `failRatio` (≈0.0005, cf. 12b-e/14c/14d)
      on visual-diff views `02-syllabus-open` + `20-sidebar-collapsed` in `tools/visual-diff.js`.
- [ ] *(optional, design open Q)* add a durable `S-sidebar-collapsed` css-probe state in
      `tools/css-probe.js` **iff** a fail-closed winner sentinel is constructible (S14 precedent:
      may not be — do not force it).
- [ ] **Validate the gate is real, not decorative:** re-baseline the three harnesses with the new
      coverage; then run a **deliberate canary** — temporarily strip ONE known-DEFENSIVE sidebar
      `!important` and confirm at least one gate goes RED. Revert the canary. (A green-on-canary
      gate is worthless — this step proves R1-R4 actually observe a flip.)
- [ ] `node --check` clean on edited tools (`npm run check`); commit Phase-1 baselines on `main`.

### ◆ REVIEW CHECKPOINT (mandatory) ◆
Stop. Present the gate + the canary result to FlyM1ss. Resolve `prd.md` open questions
Q-A3-scope (strip depth) and Q-A3-split (one task vs precondition-split / PR granularity)
before any `app/style.css` edit.

## Phase 2 — Classify + strip (app/style.css)

- [ ] **R5 — fresh keep-set derivation**: reset the sidebar-reachable subset of
      `tools/_keep-important.json` to zero; run the arbiter keep-grow pass over the 364 decls;
      take the result as the load-bearing classification. NOT seeded from #118; NOT per-token.
- [ ] **R6 — strip proven-NOCOMP, in small batches**, each batch passing ALL FIVE gates
      byte-identical before the next:
      1. cascade-competitor check (top-level only)
      2. `node tools/_view-cascade-probe.js --check`
      3. `npm run test:css-probe:check`
      4. `npm run test:visual:check`
      5. inline-style / `@media` audit (no `@media`-gated or inline override masking the change)
- [ ] **R7 — document carve-outs + honest yield**: every DEFENSIVE/unwitnessable decl recorded
      with surface + reason in `results.md`; report "N stripped / M proven-DEFENSIVE-kept".
- [ ] Reconcile `REFACTOR_DONE.md` §1 DoD `.app .sidebar` box + §A3 to the measured outcome;
      update memory `project-phase3-status.md` + `MEMORY.md`.
- [ ] `npm run check` green; ship as one (or a few) reviewed, individually-gated PR(s) per the
      Phase-3.6 incremental pattern.

## Risky files / rollback points

- `app/style.css` (Phase 2 only) — edit **by selector token, never by line range**
  ([[reference-codebase-map]] R4); interleaved rules make line-range edits corrupting.
  Rollback = restore the ` !important` token per decl; batch small for clean reverts.
- `tools/_view-cascade-probe.js`, `tools/visual-diff.js`, `tools/css-probe.js`,
  `tools/_keep-important.json` — Phase 1, additive; rollback = revert the test commit.
- Do **not** touch `app/css/runtime-collapsed.css` (that is A4's settled-irreducible surface).

## Definition of done for the task

All `prd.md` acceptance criteria checked; gate green at full matrix; honest-yield reported;
DoD + memory reconciled; `npm run check` green.
