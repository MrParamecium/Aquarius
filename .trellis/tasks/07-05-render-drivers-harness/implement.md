# PR-A — Execution plan (v2, ordered; post stress-test)

Branch: `feat/render-drivers-harness` off `main`. One PR. Do NOT merge — leave open.
Commits `type(scope): summary`. `npm run check` after every code step (Chromium-free).
Harnesses are manual Chromium gates. Export `TUTOR_PYTHON_BIN=/usr/bin/python3` for
harness/`test:lesson` runs. `[ST-n]` = stress-test correction.

## Step 0 — Pre-flight
- [ ] `git status` clean; `gh pr list --state open` empty.
- [ ] Baseline-green reference: `npm run test:visual:check`, `npm run test:css-probe:check`,
      `node --max-old-space-size=5120 tools/_view-cascade-probe.js --check`. Note known
      flakes (§17 feedback 14c-f; S-feedback-rest) as known, not regressions.

## Step 1 — §13a harness de-dup (behavior-neutral) — commit 1
- [ ] `MASK_CSS` is ALREADY shared `[ST-14]` — do NOT re-diff it. Hoist only
      `spawnBridge`/`stopBridge`/`injectMaskInitScript`/`writeMarkdownReport` into
      `test-utils.js`; export; update `tools/check-harness-exports.js`.
- [ ] Rewire `visual-diff.js` + `css-probe.js`.
- [ ] Gate: `visual-diff --check` + `css-probe --check` byte-identical vs Step 0;
      `npm run check` green. Commit `refactor(tools): hoist shared harness machinery`.

## Step 2 — §11 settle sentinel WITH generation token — commit 2  (do BEFORE any §3 double-baseline `[ST-11]`)
- [ ] App: `markLessonLayoutStable(gen)` helper with the `window.__ftutorLessonRenderGen`
      guard + timed idle `[ST-2]`. Clear + gen-bump at the TRUE top of
      `renderCurrentKnowledgePoint` (before the zero-KP branch) AND the chapter-overview
      path; emit at end of the zero-KP early-return branch `[ST-13]`; decouple the main
      emit from the MathJax-loaded guard via the `Promise.resolve()` else-branch `[ST-5]`.
- [ ] Harness: `settleLesson()` bounded `waitForFunction` on the sentinel (3s, `.catch`).
- [ ] Gate: `npm run check`; `visual-diff --check`. css-probe + arbiter unaffected
      (no cascade change) — confirm.
- [ ] **Re-baseline circuit breaker `[ST-10]`:** if > 3 lesson views need re-baseline,
      STOP, do NOT re-bake, record `deferred:` for owner sign-off. Otherwise re-bake ONLY
      after a cold double-baseline proves determinism (baseline twice → diff 0). Commit
      `feat(render): lessonLayoutStable settle sentinel [§11]` (call binary re-baseline
      PNGs out as a separate commit from logic).

## Step 3 — §11 sidebar restore — EXPECT TO KEEP THE MASK `[ST-11]` — commit 3 or defer
- [ ] Cheap falsification first: measure `03b` MN-view drift with sentinel active vs not
      (MN never sets the sentinel). Unchanged drift ⇒ causes #1/#2 dominate ⇒ keep mask.
- [ ] Only if #3 looks dominant: drop `maskLessonSidebar()` on lesson views, cold
      double-baseline; restore ONLY if drift ≤ strict noise floor. ELSE keep the mask,
      record `deferred: sidebar coverage still masked …` in `phase3_deferred.md §11`.
      Either way `visual-diff --check` green.

## Step 4 — control-plumbing unify (SP-5, PH-4) — commit 4
- [ ] `dispatcher.js`: pass `demoControls` to sinusoid (L340) + phasor (L345,+demoSpec).
- [ ] `sinusoid-phasor.js`: consume authored controls via case-insensitive id+label regex
      `[ST-9]`; per-field fallback to literals; handle phase degrees/radians; comment the
      assumption.
- [ ] `phasor.js`: prefer `demoControls`, fall back to `demoSpec.controls`.
- [ ] Gate: `npm run check`; unauthored path preserves baselines (`visual-diff --check`);
      Step 6 SP-5/PH-4 assertions pass. Commit
      `fix(demos): plumb authored controls to sinusoid+phasor [SP-5,PH-4]`.

## Step 5 — dispose lifecycle contract (SP-1, PH-6) — commit 5
- [ ] `dispatcher.js`: `registerInteractiveDemoCleanup`/`disposeInteractiveDemo`/
      `teardownInteractiveDemos`; export.
- [ ] Wire teardown at the CHOKE POINT `[ST-4]`: inside `clearLearnRenderedContent`
      (app.js:1575) + the two error paths (app.js:2503, lesson-render.js:1317); leave the
      render-time calls as a no-op belt.
- [ ] `sinusoid-phasor.js`: `state.raf =` at BOTH schedule sites (:261 AND :264) `[ST-1]`;
      cleanup cancels rAF + disconnects observer.
- [ ] `phasor.js`: cleanup removes the SAME `rerender` reference + disconnects observer.
- [ ] Gate: `npm run check`; Step 6 SP-1/PH-6 assertions pass. Commit
      `fix(demos): dispose contract tears down rAF+listeners [SP-1,PH-6]`.

## Step 6 — coverage + behavioral assertions (§1a, §2b) — commit 6
- [ ] Real pixel views: `b.1-2` (complex_plane), `b.2-2` (opposite-rotations); setup
      asserts routing, fail-closed on brief-fallback. Baseline on the FIXED state.
- [ ] `tools/test-demo-lifecycle.js`: SP-5/PH-4 authored-controls (synthetic; PH-4 routes
      to `renderPhasorDemo` via non-slider_a/b ids + asserts `.phasor-demo-shell` `[ST-8]`);
      SP-1 rAF-id spy via the REAL `openLearnMode→clear→render` sequence `[ST-1][ST-4]`;
      PH-6 resize-listener-count via the real sequence.
- [ ] §2b cross-validation `[ST-7]`: infer↔map both directions (not the vacuous
      self-introspection).
- [ ] sinusoid `b.2` best-effort only `[ST-3][ST-6]` — if the freeze hook + prelude-nav +
      hard-precondition assertion aren't clean, record `deferred: sinusoid real-lesson
      pixel coverage`; behavioral + masked-canvas is the coverage of record.
- [ ] Gate: all new checks pass; new views `--baseline` then `--check` reproduces 0.
      Commit `test(harness): demo-family coverage + lifecycle assertions [§1a,§2b]`.

## Step 7 — full verification + adversarial review (ultracode)
- [ ] Full: `npm run check`; `visual-diff --check`; `css-probe --check`; arbiter `--check`;
      `npm run test:lesson`.
- [ ] `/code-review` on the diff.
- [ ] Per-PR review workflow (dimensions: demo-correctness, settle/dispose completeness,
      harness-determinism, cascade-safety → adversarially verify). Fix confirmed in-PR.
- [ ] Read the full diff end-to-end (dead code, lying comments, out-of-scope files,
      Windows-illegal names, AQUARIUS_CONFIG/aquarius_visual_latex_v2 untouched).

## Step 8 — open PR-A (do not merge)
- [ ] Push; `gh pr create` (title ≤50 chars; body: §11/§13a/§1a/§2b/bug refs; note demo
      behavior changed, which baselines re-baked, deferrals, and that PH-4/SP-5 matching
      are synthetic-only/unverified `[ST-8][ST-9]`; call out binary re-baseline commits vs
      logic commits separately `[ST-10]`). Update `task.json`. Leave open.

## Rollback points
- Every commit independently revertible. Highest re-baseline risk = Step 2 (settle
  timing) and Step 3 (sidebar) — both have STOP/defer branches `[ST-10][ST-11]`; if a
  double-baseline isn't clean, revert to the mask / defer rather than ship a flaky
  baseline.
