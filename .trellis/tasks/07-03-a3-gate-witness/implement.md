# A3 gate witness — execution plan

> Carved from `../06-29-a3-sidebar-strip/implement.md` Phase 1 (the split
> decision, 2026-07-03). Harness-only; branch `a3/gate-witness` off `main`;
> ships as its own PR.

## Pre-flight

- [ ] Read `.trellis/spec/css/verification.md` (5 gates + canary discipline)
      and `.trellis/spec/css/cascade-and-collapse.md` (Rules 3/4/6).
- [ ] `npx playwright install chromium` if missing.
- [ ] Re-verify the measured anchors at current HEAD (they were measured at
      `6180fc0`; docs-only commits since — expect zero drift, but re-grep):
      L5890-5923 comma-grouped syllabus arms, L5915-5926 hover/active,
      L17324 collapse-hide, L18278-18290 collapsed-frame group, L12156, L18381.
- [ ] Confirm existing baselines green on main BEFORE any edit:
      `node tools/_view-cascade-probe.js --check`, css-probe `--check`,
      visual-diff `--check` (kill stale bridges first —
      [[stale-test-bridge-processes]]).

## Build (tools/** only)

- [ ] **V0** — live-DOM verify: collapsed ⇒ `.sidebar-syllabus-panel`
      `display:none`; no product state renders a collapsed visible tree.
      Record finding in results.md; it fixes the VIEW shape.
- [ ] **R1** — extend `sidebar-expanded` / `sidebar-collapsed` arbiter VIEWs
      (selectors: `.sidebar .syllabus-section`, `.syllabus-section.active`,
      `.sidebar-syllabus-panel`; props incl. `display`).
- [ ] **R2** — hover interaction on a `.syllabus-section` row + `.active`
      assertion (L5915-5926 props).
- [ ] **R3** — `.lesson-page-frame` + L18282-90 geometry props under
      sidebar-collapsed + chat-collapsed (needs a lesson open in the VIEW).
- [ ] **R4** — tight `failRatio` (~0.0005) on visual-diff views 02 + 20;
      confirm both still PASS at the tight threshold across 2 consecutive runs
      (flake check — [[reference-visual-diff-baseline-noise]]).
- [ ] *(optional)* css-probe `S-sidebar-collapsed` iff fail-closed sentinel
      constructible; else record named gap.
- [ ] Re-baseline all touched harnesses; verify pre-existing keys byte-identical
      (additive-only diff).
- [ ] **Canary**: strip one known-DEFENSIVE sidebar `!important` (candidate: an
      L18282-90 geometry decl or an L5915-5926 hover arm), ≥1 gate RED, revert,
      re-run gate green. Record decl + gate in results.md.
- [ ] `npm run check` green; `git diff app/` empty.

## Ship

- [ ] results.md: V0 finding + coverage summary + canary record + named gaps.
- [ ] PR (harness-only), gates listed in body; merge before A3 proper starts.
