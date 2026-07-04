# A3 precondition — sidebar collapsed+syllabus gate witness

> Status: **PLANNING**. Created 2026-07-03 off `main` @ `cee080b`.
> Split out of `06-29-a3-sidebar-strip` by decision (FlyM1ss, 2026-07-03,
> Q-A3-split): the gate build is its own precondition task + PR, mirroring how
> the S14 tall-content witness (#125, task `06-29-a4-s14-tall-witness`)
> preceded A4. **Harness-only — zero `app/**` production change; `app/style.css`
> byte-identical to main.** A3 proper (classify + strip) does NOT start until
> this gate is merged and green.

## Goal

Build the witness coverage that makes an `.app .sidebar` `!important` strip
*observable*, closing the three gate gaps measured in the A3 PRD (all confirmed
at HEAD `6180fc0`; re-verify at current HEAD before building —
[[feedback-reconcile-plans-against-git]]):

1. **No harness state renders the syllabus tree while the sidebar is collapsed**
   (visual-diff views 02/20 are mutually exclusive; css-probe has zero sidebar
   coverage).
2. **The syllabus `:hover`/`.active` `!important` arms (`app/style.css`
   L5915-5926) have ZERO coverage in any harness.**
3. **The collapsed `.lesson-page-frame` geometry (L18280-81, +L12156/L18381) is
   unguarded** — no witness asserts its comma-group arm precedence.

## Requirements (= R1-R4 of the A3 PRD, verbatim scope)

- **R1 — combined collapsed+syllabus witness.** Extend the existing arbiter
  (`tools/_view-cascade-probe.js`) `sidebar-expanded` / `sidebar-collapsed`
  VIEWs (or add one merged VIEW) so one matrix witnesses the syllabus tree
  under BOTH sidebar states. Per the design crux (A3 `design.md`): under
  collapse the panel is `display:none` (L17324) — the collapsed-side witness
  asserts the **collapse-hide cascade holds**, not a visible tree. **V0 verify
  this assumption live before writing the VIEW.**
- **R2 — syllabus `:hover`/`.active` coverage.** Hover interaction on a
  `.syllabus-section` row + assert the `.active` row; selectors/props from
  L5915-5926.
- **R3 — collapsed `.lesson-page-frame` guard.** Assert the winning arm's
  computed geometry (the L18282-90 prop set) under sidebar-collapsed +
  chat-collapsed.
- **R4 — tight thresholds.** Per-view `failRatio` ≈0.0005 on visual-diff views
  `02-syllabus-open` + `20-sidebar-collapsed` (cf. 12b-e/14c/14d precedent).
- *(optional)* durable `S-sidebar-collapsed` css-probe state **iff** a
  fail-closed winner sentinel is constructible (S14 precedent: do not force it;
  drop with a named-gap note if fail-open).
- **Canary proof.** After re-baselining: temporarily strip ONE known-DEFENSIVE
  sidebar `!important`, confirm ≥1 gate goes RED, revert byte-identical. A
  green-on-canary gate is decorative, not real.

## Acceptance Criteria

- [ ] V0 finding recorded (collapsed ⇒ panel `display:none`; no product state
      renders a collapsed visible tree — or the VIEW shape is corrected).
- [ ] R1-R4 landed; all three harness baselines regenerated and committed;
      pre-existing baseline keys byte-identical (additive-only) or the
      deviation explained.
- [ ] Canary went RED on ≥1 gate and was reverted byte-identical (record which
      decl + which gate).
- [ ] `npm run check` green; `app/style.css` + all `app/**` byte-identical to
      main.
- [ ] Ships as its own PR (precondition pattern); A3 task references it as the
      met gate.

## Out of scope

- ANY `app/style.css` edit (that is A3 Phase 2, separate task).
- The R5 keep-set derivation (A3 proper; runs against this gate once merged).

## Decisions inherited (FlyM1ss, 2026-07-03)

- Q-A3-scope: A3 will strip **only proven-NOCOMP** decls; carve out the rest.
  (Recorded here because the gate only needs to witness the NOCOMP-misjudged
  failure mode, not bespoke per-DEFENSIVE-decl witnesses.)
- Q-A3-split: this task IS the split — gate = own task + PR. Technical design
  lives in `../06-29-a3-sidebar-strip/design.md` (gate architecture + tool
  choice + combined-state nuance); execution checklist in this task's
  `implement.md`.
