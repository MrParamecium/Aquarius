# Render drivers + harness infra (PR-A)

## Goal

Fix the *render-driver* architecture behind the deferred demo bugs and give the
regression harness eyes on the demos it must guard. One PR (owner asked for the
drivers change as a single PR). Behavior changes to demos land here because the
owner assigned the structural root-cause fixes to PR-A.

## Scope (five workstreams, sequenced in `implement.md`)

1. **Harness shared-machinery de-dup (§13a)** — hoist the bridge-spawn +
   MASK-injection + markdown-report machinery duplicated across
   `tools/visual-diff.js` and `tools/css-probe.js` into `tools/test-utils.js`.
   Behavior-neutral: existing baselines must stay byte-identical.
2. **Lesson-settle sentinel (§11)** — app emits
   `document.documentElement.dataset.lessonLayoutStable = '1'` once MathJax typeset
   + accordion + rAF/idle have all resolved, **guarded by a render-generation token** so
   a superseded render cannot stamp the flag mid-typeset; harness `settleLesson()` gates
   on it. This addresses the MathJax-reflow contributor to sidebar-drift (§11 cause #3 of
   3) — NOT a full fix (see item 3).
3. **Restore lesson-view sidebar coverage (§11) — expected to KEEP the mask.** The
   sentinel only touches cause #3 (the least likely per §11's own ranking: MN-view `03b`
   shows the same drift with no MathJax). Cheaply falsify #3 (MN-view drift with/without
   the sentinel); only un-mask + re-baseline if #3 proves dominant. Default outcome: keep
   the mask, record a plain `deferred:` note with the measured residual. Do not force it.
4. **Dispatcher control-plumbing unify (SP-5, PH-4)** — pass the already-resolved
   `demoControls` to every render branch; make `sinusoid-phasor.js` and `phasor.js`
   consume authored controls instead of hardcoded defaults.
5. **Demo dispose lifecycle contract (SP-1, PH-6)** — a teardown contract in the
   dispatcher; wire `sinusoid-phasor.js` (rAF loop) and `phasor.js` (window resize
   listener + ResizeObserver) to it; callers tear down before `innerHTML` replace.
6. **Demo-family harness coverage (§1a, §2b)** — add visual-diff views (and/or
   behavioral assertions) for sinusoid (`b.2`), phasor/opposite-rotations (`b.2-2`),
   complex_plane (`b.1-2`); exercise ≥1 Chapter-2+ family-table dispatch path.

## Requirements

- No user-visible regression on existing views; the four DOM-isolated views, feedback
  views, and composer states stay byte-identical.
- Demo behavior changes (control plumbing, dispose) are proven by the NEW coverage,
  not just code review.
- `npm run check` stays green; nothing added to it (harnesses stay manual, they spawn
  Chromium).
- Windows-illegal filenames never created (`:` `|` `?` `*` `<` `>` `"`).
- `AQUARIUS_CONFIG` / `aquarius_visual_latex_v2` names untouched (would invalidate
  cached lessons / deployed config).

## Acceptance Criteria

- [ ] §13a: shared machinery in `test-utils.js`; both harnesses rewired; existing
      `visual-diff --check` + `css-probe --check` byte-identical (behavior-neutral).
- [ ] §11: `lessonLayoutStable` set by the app after settle; `settleLesson()` waits on
      it with a safe timeout fallback for non-lesson pages.
- [ ] §11 sidebar coverage: either restored + deterministic (cold double-baseline = 0
      drift) OR mask kept with a documented plain `deferred:` note (the expected outcome
      per §11 evidence).
- [ ] SP-5: sinusoid demo honors authored `demo.controls`/`demoSpec.controls`.
- [ ] PH-4: phasor demo renders authored controls (no empty panel; no hardcoded
      `slider_a=1, slider_b=-1.732` when controls are authored).
- [ ] SP-1: re-hydrating a sinusoid section starts no second rAF loop (old one torn
      down).
- [ ] PH-6: re-hydrating a phasor section adds no additional `window` resize listener.
- [ ] §1a/§2b: sinusoid, phasor, complex_plane covered; ≥1 family-table path exercised.
- [ ] `/code-review` clean (findings fixed-in-PR or D1–D6 deferral recorded).
- [ ] PR opened, left open for owner review.

## Notes / risks

- **Re-baseline discipline (memory `feedback-rederive-keepset`,
  `reference-visual-diff-baseline-noise`):** the settle-timing change may shift
  existing lesson-view pixels beyond the 0.061% text-AA noise floor. Any re-baseline
  must be proven deterministic by a cold double-run (baseline twice → diff 0), never a
  single capture. Prove render-neutrality by the stash-diff trick, not by chasing
  literal 0.000%.
- **Do the §13a de-dup FIRST** and prove existing baselines unchanged, so later
  re-baselines are not contaminated by a spawn/mask difference.
- **Ordering constraint:** §11 sentinel before §11 sidebar-restore (restore depends on
  the sentinel eliminating drift).
- **PH-4 witness (RESOLVED):** NO cached lesson routes to `phasor.js:renderPhasorDemo`
  (grep `phasor_panel` in lesson-cache = 0; the one phasor-shaped demo `b.1-2` satisfies
  `isComplexPlaneDemo` first). PH-4 is validated by a SYNTHETIC behavioral fixture only,
  built to route to `renderPhasorDemo` (non-`slider_a/b` ids so it doesn't misroute to
  complex-plane) and asserting a phasor-template-unique DOM marker. State this in the PR.
