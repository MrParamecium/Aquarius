# PR-B — Execution plan (stacked on PR-A)

Branch: `fix/demo-symptom-sp2-sp3` off `feat/render-drivers-harness` (PR-A's head), NOT
off main. PR base = `feat/render-drivers-harness`. Do NOT merge. Small PR.

## Step 0 — Pre-flight
- [ ] PR-A open and its branch is the current base; `git status` clean.
- [ ] `git checkout feat/render-drivers-harness && git pull` (if PR-A got fix commits),
      then `git checkout -b fix/demo-symptom-sp2-sp3`.

## Step 1 — SP-2 reset-while-paused — commit 1
- [ ] Read `sinusoid-phasor.js` init to confirm the intended running state (initial
      autoplay?). Reset handler (`:229-240`): set `state.running = true`, reset
      `state.start` so time restarts cleanly, and update the Play/Pause button label to
      the running state. Verify `elapsedSeconds` (`:74-76`) then advances.
- [ ] `npm run check`; the SP-2 behavioral assertion (Pause→Reset resumes animation)
      passes. Commit `fix(demos): reset resumes animation when paused [SP-2]`.

## Step 2 — SP-3 null-guard — commit 2
- [ ] `updateControlLabels` (`:216-220`): null-guard each
      `node.querySelector('[data-demo-value="…"]')` with a GUARDED BLOCK only —
      `const el = node.querySelector('[data-demo-value="amplitude"]'); if (el) el.textContent = …;`
      repeated per span. **NOT `?.textContent =`** (LHS optional chaining is a
      SyntaxError `[ST-12]`).
- [ ] `npm run check`; the SP-3 assertion (missing-span hydrate does not throw) passes.
      Commit `fix(demos): null-guard updateControlLabels [SP-3]`.

## Step 3 — verification + review
- [ ] `npm run check`; `visual-diff --check` (these views should be byte-identical —
      the fixes only alter broken states); `npm run test:lesson`.
- [ ] `/code-review` on the diff. Ultracode: brief adversarial verify of both fixes
      (does SP-2's running-reset match the demo's intended UX? does SP-3's guard change
      any live behavior? — should be none). Fix findings in-PR.

## Step 4 — open PR-B (do not merge)
- [ ] Push; `gh pr create --base feat/render-drivers-harness`. Body: the two bugs, the
      stack note ("merge PR-A first"), and a squash-merge rebase note `[ST-16]`: *"If PR-A
      is squash-merged, rebase this branch onto main before merging PR-B — a squash merge
      does not fast-forward this branch's base."* Test evidence. Update `task.json`.
      Leave open.

## Notes
- If PR-A's `sinusoid-phasor.js` changes conflict, resolve against PR-A's head (that's
  why PR-B is stacked, not off main).
