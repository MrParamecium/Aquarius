# PR-A — Technical design (v2, post adversarial stress-test 2026-07-05)

All line numbers verified 2026-07-05; re-grep before editing. **v2 folds in the 12
must-fix corrections + 4 fold-ins from the plan stress-test (workflow wcfte16e9); the
correction origin is noted inline as `[ST-n]`.**

## 0. Files touched

- `app/interactive-demos/dispatcher.js` — control plumbing + dispose contract.
- `app/interactive-demos/sinusoid-phasor.js` — consume controls (SP-5), rAF id at BOTH
  schedule sites + cleanup (SP-1).
- `app/interactive-demos/phasor.js` — consume controls (PH-4), listener cleanup (PH-6).
- `app/lesson-render.js` — teardown-before-replace + `lessonLayoutStable` emit
  (incl. the zero-KP early-return branch).
- `app/app.js` — teardown at the `clearLearnRenderedContent` choke point + error paths;
  sentinel emit + generation token on the chapter-overview path.
- `tools/test-utils.js` — hoisted spawn/inject/report helpers; `settleLesson()` gates on
  the sentinel; `resolveLessonCachePath` gains a cacheVariant; freeze hook wiring.
- `tools/visual-diff.js`, `tools/css-probe.js` — rewired to hoisted helpers; new demo
  views. `tools/check-harness-exports.js` + `tools/test-utils.test.js` kept green.
- New: `tools/test-demo-lifecycle.js` (behavioral assertions) + a §2b cross-validation
  check.
- Baselines re-baked only where intended + proven deterministic, under a blast-radius
  cap `[ST-10]`.

**Defer-code vocabulary `[ST-15]`:** this task uses the repo's Sev-1/2/3 + a
plain-English `deferred: <reason>` line in `docs/phase3_deferred.md` (NOT the D1–D6
codes, which `PHASE3.6A_PLAN.md` defines only for the CSS arbiter as D2/D5/D6).

## 1. Harness shared-machinery de-dup (§13a) — do FIRST, behavior-neutral

**`MASK_CSS` is already a single shared constant `[ST-14]`** — `test-utils.js:17`
(exported :669), imported by BOTH `css-probe.js:60-69` and `visual-diff.js:26,45`. There
is NO second copy to reconcile. Scope the de-dup to what IS duplicated:
- `spawnBridge(repoRoot, port, portEnvVar)` → the `spawn('node', ['app/ws-bridge.js'])`
  block (visual-diff.js:1964, css-probe.js:1217); parameterize the port env var name.
- `stopBridge(proc, {timeoutMs=2000})` → SIGTERM + "did not exit" warning.
- `injectMaskInitScript(context)` → the `context.addInitScript(({css})=>…, {css:MASK_CSS})`
  wrapper (visual-diff.js:2070, css-probe.js:1242).
- `writeMarkdownReport(outPath, {title, rows})` → report assembly.

Rewire both harnesses; update `check-harness-exports.js` for the new exports. **Proof:**
`visual-diff --check` + `css-probe --check` byte-identical before vs after (stash-diff);
`npm run check` green (it runs `test-utils.test.js` + `check-harness-exports.js`).

## 2. Lesson-settle sentinel (§11) — with a generation token `[ST-2]`

**Problem:** `renderCurrentKnowledgePoint` (`lesson-render.js:1233-1241`) fires
`MathJax.typesetPromise(...).catch(()=>{})` in a 60ms `setTimeout`, fire-and-forget.
No layout-stable signal → accordion captures `max-height` (`app.js:656`) before MathJax
reflow → sidebar drift (§11).

**Generation token (blocker fix `[ST-2]`):** a single global flag written by TWO render
functions races on fast page-turns / lesson↔overview toggles — a superseded render's
`idle+2rAF` tail can stamp `'1'` while the newer render is mid-typeset. Reuse the
codebase's own idiom (`learnRequestSeq` app.js:2115; `panel.dataset.accordionToken`
app.js:641): a shared counter `window.__ftutorLessonRenderGen`.

**App-side helper (global, alongside other `window.__ftutor*`):**
```
function markLessonLayoutStable(gen) {
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 0));
  idle(() => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (gen === window.__ftutorLessonRenderGen) {            // [ST-2] stale-render guard
      document.documentElement.dataset.lessonLayoutStable = '1';
    }
  })), { timeout: 2000 });                                    // [ST-2] timed idle
}
```
`renderCurrentKnowledgePoint` (and the overview path) at the TRUE top of the function
`[ST-13]` (before the `if (!learnKnowledgePoints.length)` early return):
```
const gen = (window.__ftutorLessonRenderGen = (window.__ftutorLessonRenderGen || 0) + 1);
delete document.documentElement.dataset.lessonLayoutStable;
```
- **Zero-KP 'Full Lesson' early-return branch** (`lesson-render.js:1171-1186`) `[ST-13]`:
  it has its own `innerHTML=` at :1172 and returns at :1185 with no async work — call
  `markLessonLayoutStable(gen)` (or set the flag directly) before that return.
- **Main branch** (:1233 setTimeout): decouple the emit from the MathJax-loaded guard
  `[ST-5]` (MathJax loads async from CDN — index.html:1587 — and may be unattached on the
  first lesson). Always-run side effects stay unconditional; resolve the sentinel via:
  ```
  (window.MathJax && window.MathJax.typesetPromise
      ? window.MathJax.typesetPromise([learnExplainContent])
      : Promise.resolve()
  ).then(() => markLessonLayoutStable(gen), () => markLessonLayoutStable(gen));
  ```
- **Chapter-overview path** (`app.js:2054`, `renderChapterOverviewContent`): same
  clear+gen-bump at its top and `markLessonLayoutStable(gen)` after its settle. ONE
  shared helper.

**Harness-side** — `settleLesson()` (`test-utils.js:288`): after the existing settle,
add a bounded wait:
```
await page.waitForFunction(
  () => document.documentElement.dataset.lessonLayoutStable === '1',
  null, { timeout: 3000 }
).catch(() => {});   // non-lesson pages never set it → fall through
```

## 3. Restore sidebar coverage (§11) — EXPECT TO KEEP THE MASK `[ST-11]`

**Reframed (prd.md:21 overclaimed).** `phase3_deferred.md §11` ranks THREE drift causes;
this sentinel addresses only #3 (MathJax reflow) — the *least* likely per the harness's
own evidence: the mistake-notebook view `03b` shows the SAME drift signature yet renders
no MathJax. So restoring sidebar coverage will *probably fail* and the honest outcome is
**keep the Option-A mask**.

Procedure: (a) land the generation token (§2) FIRST `[ST-11]` so there is no race for the
double-baseline to hide; (b) cheaply falsify hypothesis #3 — measure the `03b` MN-view
drift with the sentinel active vs not (MN never sets the sentinel; unchanged drift there
means font-subpixel / accordion-jitter dominate); (c) only if #3 looks dominant, attempt
the un-mask + cold double-baseline. **Default expectation: keep the mask, record
`deferred: sidebar coverage still masked — sentinel addresses only MathJax-reflow (cause
#3); MN-view drift persists → causes #1/#2 dominate` in `phase3_deferred.md §11`.** Do NOT
chase a failing double-baseline as a bug.

## 4. Dispatcher control-plumbing unify (SP-5, PH-4)

`dispatcher.js:298-299` resolves `demoControls`. `complex_plane` (L335) + matrix (L360)
get it; sinusoid (L340) + phasor (L345) do NOT. Fix the two starved branches:

- **SP-5** — L340 → `renderSinusoidPhasorDemo(node, demo, demoControls)`. In
  `sinusoid-phasor.js`: derive initial amplitude/frequency/phase + slider min/max/step
  from authored controls, **matching permissively `[ST-9]`** — a case-insensitive regex
  over `control.id` AND `control.label` (`/amplitude|amp\b/`, `/frequency|freq\b|f_?0/`,
  `/phase|theta|θ/`), because real authored demos use verbose heterogeneous labels
  (`'theta slider'`, `'Omega slider'`) and the one cached sinusoid demo (b.2) authors NO
  controls at all. Fall back to the current literals per-field when unmatched → unauthored
  demos stay byte-identical. **Phase units rider `[ST-9]`:** sinusoid-phasor.js keeps phase
  in radians (:46) but displays degrees (:73); when consuming an authored `phase` control,
  treat `|min|,|max| > ~2π` as degrees→convert, else assume radians — document the
  assumption in a code comment. Note in the PR body that the matching convention is
  UNVERIFIED against any real authored sinusoid content.
- **PH-4** — L345 → `renderPhasorDemo(node, demo, demoControls, demoSpec)`. In
  `phasor.js` (`:13-15` reads only `demoSpec.controls`; `:27-29` hardcodes
  `slider_a=1, slider_b=-1.732`): prefer `demoControls`, fall back to `demoSpec.controls`.

## 5. Demo dispose lifecycle contract (SP-1, PH-6)

**Contract** (in `dispatcher.js`, exported):
```
function registerInteractiveDemoCleanup(node, fn) {
  (node.__demoCleanups = node.__demoCleanups || []).push(fn);
}
function disposeInteractiveDemo(node) {
  (node.__demoCleanups || []).forEach(fn => { try { fn(); } catch (_) {} });
  node.__demoCleanups = []; delete node.dataset.hydrated;
}
function teardownInteractiveDemos(root) {           // returns count disposed
  if (!root) return 0;
  let n = 0;
  root.querySelectorAll('.kc-interactive-demo').forEach(node => {
    if (node.__demoCleanups || node.dataset.hydrated === '1') { disposeInteractiveDemo(node); n++; }
  });
  return n;
}
```

**Callers — the choke point matters `[ST-4]`.** The render-time `innerHTML=` sites
(`lesson-render.js:1172,:1190`; `app.js:2054`) are NOT sufficient: `clearLearnRenderedContent`
(`app.js:1575-1585`) does an unconditional `innerHTML=` on EVERY cross-section nav
(`openLearnMode:2307`, `openChapterParentLessonFromOverview:2131`,
`openChapterOverviewMode:2266`) SYNCHRONOUSLY, before the async `/api/section` resolves —
so it destroys the old demo node first and the render-time teardown finds 0 nodes. Wire
`teardownInteractiveDemos(learnExplainContent)`:
- **inside `clearLearnRenderedContent` itself** (one choke point covers all three navs),
- the two error-path `innerHTML=` sites (`app.js:2503` "Failed to load lesson",
  `lesson-render.js:1317` "Lesson render failed"),
- keep the render-time calls as a belt-and-suspenders no-op (0 nodes after clear).

**Wire the two leaky modules:**
- `sinusoid-phasor.js` — the `tick` loop self-schedules at BOTH `:261` (recursive) AND
  `:264` (kickoff) `[ST-1]`. Assign `state.raf = window.requestAnimationFrame(tick)` at
  BOTH sites; register a cleanup that `cancelAnimationFrame(state.raf)` + disconnects
  `node._sinusoidResizeObserver` (:253-257). Capturing only the kickoff id leaves the
  live loop uncancelled (SP-1 not actually fixed).
- `phasor.js` — keep the `rerender` reference (`window.addEventListener('resize',
  rerender)` :292; `rerender = coalesceFrames(renderPhasor)` :286); register a cleanup
  that `window.removeEventListener('resize', rerender)` + disconnects
  `node._phasorResizeObserver` (:287-291). The reference must be the SAME identity passed
  to add/remove.

## 6. Demo-family harness coverage (§1a, §2b) + behavioral assertions

**Coverage reality (empirically confirmed by the stress-test):** only STATIC (rAF-free)
demos can be naive-pixel-diffed. Only `sinusoid-phasor.js` + `helpers.js` use rAF.

- **complex_plane → `b.1-2`** (`renderComplexPlaneDemo`, static): real pixel view. Setup
  asserts routing (fail-closed if it falls to `renderBriefDemoFallback`).
- **opposite-rotations → `b.2-2`** (`renderOppositeRotationsDemo`, static): real pixel
  view (bonus family; the closest available "phasor-shaped" real lesson).
- **sinusoid → `b.2` is HARD `[ST-3][ST-6]`** and is NOT the primary SP-5 proof:
  (a) it animates on a wall clock (no freeze → can't reproduce 0-diff); (b) it is
  `parent_prelude` content that `resolveLessonCachePath` (hardcoded default variant) and
  `openSubtopic` (clicks a subcard) cannot reach — it renders via
  `loadChapterOverviewPrelude`/`renderChapterOverviewContent` (mode 'overview'). Decision:
  **cover sinusoid via the deterministic synthetic behavioral assertion below**; the real
  `b.2` pixel view is BEST-EFFORT only — if attempted, add a test-only freeze hook
  (`window.__ftutorFreezeDemoClock`, set via `addInitScript`, gates the initial
  `state.running/state.start` so it boots paused at a fixed frame) AND extend
  `resolveLessonCachePath` with a `cacheVariant` + a prelude-nav helper, with a HARD
  precondition assertion that FAILS if the view silently no-ops. If not straightforward,
  record `deferred: sinusoid real-lesson pixel coverage — needs clock-freeze hook +
  parent_prelude nav helper; Sev-3` and rely on the behavioral + masked-canvas coverage.

**§2b family-key cross-validation `[ST-7]`** (the self-introspection check was vacuous —
JS collapses duplicate object keys before `Object.keys`, and map-shape says nothing about
`inferInteractiveDemoFamily`'s ~19 hardcoded `return '…'` literals at
`dispatcher.js:147-223`). Respec: for each of the 13 map keys, build a synthetic demo that
trips that family branch, call `inferInteractiveDemoFamily(demo)`, assert result === key
AND `INTERACTIVE_DEMO_FAMILY_RENDERERS[result]` is a function; symmetrically, assert every
literal `inferInteractiveDemoFamily` can return that is NOT in the documented excluded set
(`complex_plane, sinusoid, opposite_rotations, matrix_conformability, brief, algebra_brief`)
has a map entry. This catches the real "key typo → brief-fallback ships green" class.

**Behavioral assertions (`tools/test-demo-lifecycle.js`, Playwright, deterministic):**
- **SP-5 / PH-4** — inject a synthetic demo with AUTHORED controls whose values differ
  from the hardcoded defaults; hydrate; assert the rendered sliders reflect the authored
  values. PH-4's synthetic demo MUST route to `renderPhasorDemo` `[ST-8]`: NO cached lesson
  does (b.1-2 satisfies `isComplexPlaneDemo` first). Build it to trip `isPhasorDemo` and
  NOT `isComplexPlaneDemo` — use control ids OTHER than `slider_a/slider_b` (or add a
  `phasor sum`/`same frequency` keyword to trip complex-plane's exclusion regex), AND
  assert on a phasor-template-unique DOM marker (e.g. `.phasor-demo-shell`), not a generic
  slider check, so an accidental misroute fails loudly.
- **SP-1** `[ST-1]` — spy on `window.requestAnimationFrame`/`cancelAnimationFrame`;
  reproduce the REAL nav sequence (`openLearnMode → clearLearnRenderedContent → (async)
  → render`) `[ST-4]`, not a bare re-hydrate on a static root; assert the exact last rAF id
  returned to the sinusoid loop was passed to `cancelAnimationFrame`. Do NOT assert "draws
  stop" or "teardown count ≥1" — the pre-existing `if (!node.isConnected) return` self-heal
  makes an orphan loop die within a frame and would pass a broken cancel green.
- **PH-6** — monkeypatch `window.add/removeEventListener` to count `'resize'` listeners;
  hydrate→re-hydrate a phasor node via the real nav sequence; assert the count returns to
  baseline.

## 7. Verification matrix

| Change | Gate |
|---|---|
| §13a de-dup | `visual-diff --check` + `css-probe --check` byte-identical; `check-harness-exports` green |
| §11 sentinel | generation-token guards the write; lesson views deterministic; non-lesson unchanged |
| §11 sidebar | probably keep mask + `deferred:` note; only restore on a proven clean double-baseline |
| SP-5/PH-4 | synthetic behavioral assertions pass (phasor-unique marker for PH-4) |
| SP-1/PH-6 | rAF-id + listener-count assertions pass via the REAL nav sequence |
| §1a | complex_plane + opposite-rotations real pixel views; sinusoid behavioral (+best-effort) |
| §2b | cross-validation check (infer↔map) passes |
| whole PR | `npm run check`; cascade arbiter no-regression; `/code-review` + per-PR review workflow clean |

## 8. Resolved facts (were open questions)

- **NO cached lesson routes to `renderPhasorDemo`** `[ST-8]` (grep `phasor_panel` in
  lesson-cache = 0; the one phasor-shaped demo b.1-2 routes to complex_plane). PH-4 is
  validated by the synthetic fixture ONLY — state this in the PR body.
- Authored sinusoid control ids: the cached sinusoid demo authors none; other demos use
  verbose labels → permissive matching (§4) `[ST-9]`.
- Settle-timing may force a lesson-view re-baseline; do so only under the blast-radius cap
  and a proven cold double-run.
