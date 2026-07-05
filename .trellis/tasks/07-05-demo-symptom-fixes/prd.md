# Demo symptom fixes SP-2 SP-3 (PR-B)

## Goal

Fix the two residual, self-contained logic bugs in
`app/interactive-demos/sinusoid-phasor.js` that are NOT structural (no dispatcher or
lifecycle change). Lightweight task — PRD + implement, no separate design.

**Stacked on PR-A.** Both PR-A and PR-B edit `sinusoid-phasor.js`; branch PR-B off
PR-A's head (`feat/render-drivers-harness`), target that branch as the PR base, and
state in the PR body: *merge PR-A first, then PR-B.* (Memory
`feedback-stacked-pr-squash-merge`: never `--delete-branch` the lower PR of a stack.)

## The two bugs (CONFIRMED 2026-07-05)

- **SP-2 (Sev-2) — reset-while-paused freezes the wave at t=0.** Reset handler
  (`sinusoid-phasor.js:229-240`) resets amplitude/frequency/phase + `state.start`/
  `state.pausedAt=0` but never sets `state.running=true` or updates the Play/Pause
  label; `elapsedSeconds` (`:74-76`) returns `state.pausedAt` (0) while not running, so
  after Pause→Reset the wave never animates until the user manually clicks Play.
- **SP-3 (Sev-3) — `updateControlLabels` null-deref latent** (`:216-220`). Sets
  `.textContent` on three `node.querySelector('[data-demo-value="…"]')` results with no
  null guard (the rest of the file uses `?.`). Latent today (spans always present) but
  throws `Cannot set properties of null` on any future partial-render/template variant.

## Requirements

- Preserve the demo's correct sinusoid/phasor math (no Sev-1 risk).
- No change to the dispatcher, dispose contract, or control plumbing (those are PR-A).
- No user-visible regression on existing baselines; the fixes only change behavior in
  the specific broken states (reset-while-paused; a missing-span render).

## Acceptance Criteria

- [ ] SP-2: after Pause→Reset, the wave resumes animating and the Play/Pause label is
      consistent with the running state (decide: reset resumes running, matching the
      initial autoplay behavior — verify against how the demo starts).
- [ ] SP-3: `updateControlLabels` null-guards each `querySelector` with a guarded-block
      (`const el = node.querySelector('…'); if (el) el.textContent = …`). **Do NOT use
      `?.textContent =`** — optional chaining on the LHS of an assignment is a parse-time
      SyntaxError. A synthetic missing-span demo does not throw.
- [ ] Behavioral assertions added to `tools/test-demo-lifecycle.js` (from PR-A): a
      Pause→Reset flow proves animation resumes (SP-2); a missing-span hydrate proves no
      throw (SP-3).
- [ ] `npm run check` green; harnesses at no-regression bar; `/code-review` clean.
- [ ] PR opened, stacked on PR-A, left open for owner review.

## Notes

- SP-2 decision point: "reset resumes running" vs "reset preserves paused-but-shows-the
  reset-state". The bug report frames the freeze as wrong; the initial demo state
  autoplays, so reset should return to that autoplaying state (running=true, label
  reflects it). Confirm by reading the initial `state.running` + Play/Pause init.
