# Phase 3 — Plan

Owner: FlyM1ss
Drafted: 2026-06-21
Companion to `docs/REFACTOR_PLAN.md` and `docs/PHASE3_PREP.md`. Line numbers
are post-Phase-2 (against the working tree at 2026-06-21). Replaces the
sequencing sketch at the bottom of `PHASE3_PREP.md`; the inventory tables
in that doc are still authoritative for the per-handler list and per-site
sizes — corrections from direct code inspection are noted inline below.

> **STATUS: SUPERSEDED — refactor complete 2026-07-04.** This is a frozen
> planning document kept as historical record. Authoritative final status:
> `docs/REFACTOR_DONE.md` (top banner). Do not use the line numbers or
> sequencing below for new work.

## 1. Goal and non-goals

**Phase 3 ships three PRs**, in order, that together remove the last
structural-debt cluster identified in `REFACTOR_PLAN.md`:

- **#21** `hydrateInteractiveDemos` dispatcher split (`app/app.js`
  L3652–4891, 1,240 lines).
- **#22** runtime `inject*Styles` CSS collapse (6 sites in `app/app.js`,
  2,101 lines).
- **#20** Home Ask EOF CSS cluster consolidation (`app/style.css`
  L33181–44845, ~11.7k lines in range, target net ~-5.6k).

**Non-goals — explicitly deferred past Phase 3:**

- **Phase 2 #19** Glass + chapter-overview CSS (`app/style.css`
  L31257–47658, 16,402 lines). Stays deferred until the visual-diff
  harness has shipped (lands inside #22) and the simpler #20 consolidation
  has shaken out cascade-ordering bugs.
- **Phase 2 #18** interactive demos subsystem extraction (`app/app.js`
  L7825–11842, 4,018 lines). Sequence-blocked by #21 per
  `REFACTOR_PLAN.md` "Sequence Rules". Unblocks the moment #21 lands; not
  attempted in this phase.
- **Phase 4** filesystem-JSON → DB migration for `app/users/`.
- **Internal-helper deduplication for #21** (shared `drawArrow`,
  `sizeCanvas`, `formatNum`, etc. across `complex_plane`, `phasor`,
  `sinusoid_phasor_projection`). Per the investigation, the closures have
  subtle per-branch differences (drawArrow ctx-as-first-arg vs
  outer-ctx-capture; dpr/sizing math drift). First pass is mechanical
  move only; helpers consolidation is a follow-up PR after visual-diff
  confirms no regression.
- **CSS surfaces outside the Home-Ask EOF range** for #20: the
  pre-banner `#settingsView` block at L33181–33345 is in the file range
  but has no override chain inside the cluster; leave it untouched.

## 2. Hard invariants

These are non-negotiable for every Phase 3 commit. Sources: CLAUDE.md
"Hard Constraints", `REFACTOR_PLAN.md` "Hard Invariants", MEMORY.md.

- **`aquarius_visual_latex_v2`** — lesson-cache key suffix. None of the
  three PRs touches `app/lesson-cache.js`. The dispatcher in #21 runs
  *after* a lesson HTML is injected; the data-demo-b64 schema,
  `getInteractiveDemoDedupKey`, and `dataset.hydrated='1'` semantics
  must stay byte-identical or every cached lesson silently breaks.
- **`AQUARIUS_CONFIG`** — deployed frontend config global. Untouched.
- **Sonnet 4.6 = Agent B (Renderer).** Phase 3 is pure refactor; no
  prompt or model change. Do not silently upgrade to Opus.
- **Materials resolution.** Bridge prefers `workspace/materials/` over
  root `materials/`. No PR in this phase modifies the resolution chain
  or moves anything under `materials/`.
- **No Windows-illegal filenames.** New files in this phase
  (`app/interactive-demos/<family>.js`, `app/css/runtime-collapsed.css`)
  use lowercase + hyphen only. No `:` `|` `?` `*` `<` `>` `"`.
- **Root-relative JSON maps** (`section-page-map*.json`,
  `section-figure-map-new.json`) stay at `app/` root. None of the three
  PRs moves them.
- **Chapter 2 figure recrops** (`materials/new-book-figures/page-*-figure_2_*.png`
  + `new-book-ocr/page-150..223.meta.json`, mirrored in `workspace/`) —
  not touched.
- **Node built-ins only in `ws-bridge.js`.** Phase 3 does not modify
  `ws-bridge.js`. New static files under `app/` are reachable via the
  existing static-file route — no new endpoints.
- **Cascade order is load-bearing for #22 and #20.** Specific ordering
  rules are in the PR sections below.

## 3. PR sequence and gates

Confirmed order:

```
PR #21  ──►  visual-diff baseline refresh  ──►  PR #22  ──►  PR #20
```

### Gate between #21 and visual-diff baseline

- `npm run check` green on `app.js` and `ws-bridge.js`.
- `node tools/test-lesson-open-no-hang.js` green (Playwright e2e
  regression — section open must not hang).
- Manual demo-open run covers all 19 dispatch arms (list in §4.6).
- App boot and section navigation smoke clean (no console errors on
  Home, Syllabus, Lecture-tab, Textbook-tab, Q&A, Mistake Notebook,
  Settings).
- Only then refresh the visual-diff baseline. Add the 3 lesson-chrome
  views from §5.6 (`lesson-pager-states`, `lesson-lecture-toolbar`,
  `lesson-qa-column`) at this point, alongside the existing 6 views.
  The refreshed 9-view set becomes the pre-#22 reference.

### Gate between #22 and #20

- `npm run check` green.
- Visual-diff harness: the 9-view baseline captured in the post-#21
  refresh (6 original + 3 lesson-chrome from §5.6) must be **under 0.5%
  pixel difference** per view.
- Manual spot-check of the 4 surfaces #22 directly governs (lesson
  pager, lecture toolbar, Q&A column, Mistake Notebook is unaffected
  but verify it didn't regress).
- Lesson-open-no-hang green.

### Gate inside #20 (per sub-PR)

- Per §6, #20 is split into 3 sub-PRs by surface. Each sub-PR's gate:
  - `npm run check` green.
  - Visual-diff **under 0.2%** on the surfaces it touches (tightened
    from default 0.5% per the investigation — most rules in scope are
    glass/opacity/shadow values where small-percent diffs read as real
    regressions).
  - The Trial-intro / login sub-PR (banners 81–88) keeps the default
    0.5% threshold because of legitimate animated noise
    (`aquarius-glow`, `text-gradient-aurora`).

## 4. PR #21 — `hydrateInteractiveDemos` dispatcher split

**Target:** shrink `app/app.js` by ~2,900 lines without behavior change.

### 4.1 File layout

New directory `app/interactive-demos/`. One file per family branch.
All files are classic `<script>`-loaded modules in the same convention
as `app/mistake-notebook.js` / `app/recent-conversations.js` /
`app/clerk-auth.js` (bare top-level functions reaching shared
script-global free names; **no** IIFE wrapper, **no** `module.exports`,
**no** `AQUARIUS_CONFIG` attachment).

Files (16 family modules + one optional helpers file, Pass 2):

```
app/interactive-demos/complex-plane.js
app/interactive-demos/sinusoid-phasor.js
app/interactive-demos/phasor.js
app/interactive-demos/matrix-conformability.js
app/interactive-demos/opposite-rotations.js
app/interactive-demos/convolution-lab.js
app/interactive-demos/pole-zero-roc-lab.js
app/interactive-demos/frequency-response-lab.js
app/interactive-demos/transform-rule-lab.js
app/interactive-demos/sequence-system-lab.js
app/interactive-demos/signal-transform.js
app/interactive-demos/energy-power.js
app/interactive-demos/sampling-quantization.js
app/interactive-demos/system-property.js
app/interactive-demos/exponential-envelope.js
app/interactive-demos/matrix-locator.js
app/interactive-demos/parameter-response.js
app/interactive-demos/pointwise-multiplication.js
app/interactive-demos/brief-fallback.js
# Pass 2 (deferred — see §4.4):
# app/interactive-demos/helpers.js
```

Each file starts with a header comment listing: (a) external globals
read at call time, (b) public free names other scripts will reach
for, (c) any `window.*` handlers wired to inline `onclick`s.

### 4.2 Dispatcher contract

The top-level `hydrateInteractiveDemos(root)` signature stays
unchanged — it remains the only externally visible entry point
(called from `app.js` L7707, L8064, L9234) and continues to do
per-node iteration, dedup-key checking, and family inference. Only
the branch bodies move out.

**Per-family function signature:**

```
function hydrateDemo<Family>(node, demo, ctx)
```

Return semantics: family modules return void. The dispatcher already
sets `node.dataset.hydrated='1'` once at L3693 before any branch
runs, so family modules do not set it themselves. Family functions
must be idempotent — the `dataset.hydrated` guard at the top of
`hydrateInteractiveDemos` already prevents re-entry on a re-call.

**`ctx` object shape** (the module-scope read access the family
branches need):

```
ctx = {
  escapeHtml,
  decodeInlineMarkdownFragment,
  formatInteractiveDemoNumber,
  getDemoControlValue,
  getInteractiveDemoSpec,
  getInteractiveDemoText,
  normalizeInteractiveDemoControl,
  renderBriefDemoFallback,
  demoSpec,
  demoControls,
  demoText,
  family
}
```

Because new modules use the script-global free-name convention (same
as `mistake-notebook.js`), helpers like `escapeHtml` /
`decodeInlineMarkdownFragment` can also be reached directly. `ctx`
exists primarily to pass the per-node pre-computed values
(`demoSpec`, `demoControls`, `demoText`, `family`) so each family
module does not re-derive them.

### 4.3 Per-family file list with current dispatcher line ranges

The dispatcher contains 19 distinct match arms — corrects the
`PHASE3_PREP.md` claim of 18. The missing one was `isSinusoidDemo`
(matched by `demo.demo_type === 'sinusoid_phasor_projection'` OR
`demo.type === 'interactive_demo'` AND text matches `/sinusoid/i`
AND `/phasor|amplitude|frequency|phase/i`), branched at L3986.
Update `PHASE3_PREP.md` as part of this PR.

| Arm | Match kind | Dispatcher range | Lines | Target |
|---|---|---|---|---|
| chapter_one early-return | explicit | L3695–3698 | 4 | stays in dispatcher (delegates to existing `hydrateChapterOneDemo` at L3166) |
| opposite_rotations | explicit | L3700–3703 | 4 | `opposite-rotations.js` (also takes `renderOppositeRotationsDemo` body from L5612) |
| complex_plane (derived) | derived-controls | L3705–3984 | 280 | `complex-plane.js` — inlined; wrap in `renderComplexPlaneDemo(node, demo, demoSpec, demoControls)` |
| sinusoid_phasor_projection (derived) | derived-controls | L3986–4266 | 281 | `sinusoid-phasor.js` — inlined; wrap in `renderSinusoidPhasorDemo(node, demo)` |
| phasor (derived) | derived-controls | L4268–4579 | 312 | `phasor.js` — inlined; wrap in `renderPhasorDemo(node, demo, demoSpec)` |
| signal_transform | explicit | L4581–4584 | 4 | `signal-transform.js` (body from L5808) |
| energy_power | explicit | L4586–4589 | 4 | `energy-power.js` (body from L5983) |
| sampling_quantization | explicit | L4591–4594 | 4 | `sampling-quantization.js` (body from L6204) |
| system_property | explicit | L4596–4599 | 4 | `system-property.js` (body from L6349) |
| exponential_envelope | explicit | L4601–4604 | 4 | `exponential-envelope.js` (body from L6525) |
| matrix_locator | explicit | L4606–4609 | 4 | `matrix-locator.js` (body from L6651) |
| parameter_response | explicit | L4611–4614 | 4 | `parameter-response.js` (body from L6715) |
| pointwise_multiplication | explicit | L4616–4619 | 4 | `pointwise-multiplication.js` (body from L6815) |
| convolution_lab | explicit | L4621–4624 | 4 | `convolution-lab.js` (body from L5115) |
| pole_zero_roc_lab | explicit | L4626–4629 | 4 | `pole-zero-roc-lab.js` (body from L5200) |
| frequency_response_lab | explicit | L4631–4634 | 4 | `frequency-response-lab.js` (body from L5326) |
| transform_rule_lab | explicit | L4636–4639 | 4 | `transform-rule-lab.js` (body from L5431) |
| sequence_system_lab | explicit | L4641–4644 | 4 | `sequence-system-lab.js` (body from L5504) |
| brief_fallback | fallback | L4646–4649 | 4 | `brief-fallback.js` (body from L5559); dispatcher calls it as before |
| matrix_conformability | explicit (tail) | L4651–4890 | 240 | `matrix-conformability.js` — inlined; wrap in `renderMatrixConformabilityDemo(node, demo, demoControls)` |

Net app.js reduction: ~2,900 lines (1,113 from L3705–4890 inlined
branches + ~1,786 from L5115–6900s legacy `renderXxx` definitions).
New dispatcher body shrinks to ~120 lines at L3652–L3770.

### 4.4 Internal-helper extraction — two-pass strategy

**Pass 1 (this PR — mechanical, low-risk):** No shared helpers
module. Each of the three large inlined family modules
(`complex-plane.js`, `sinusoid-phasor.js`, `phasor.js`) keeps its own
local closures for `drawArrow`, `sizeCanvas`, `formatNum`, `getA`,
`getB`, `getThetaRad`, `getThetaDeg`, `formatAngle`, etc. This
preserves per-branch differences exactly (see §4.7 risks).

**Pass 2 (deferred — follow-up PR after #21 lands and visual-diff
confirms no regression):** Create `app/interactive-demos/helpers.js`
with the shared internals listed in the investigation report's
`sharedInternalHelpers` section:

- `drawArrow` (canvas vector arrow with arrowhead) — currently
  L3784–3804 inside complex_plane, also defined separately inside
  sinusoid and phasor.
- `sizeCanvas` (HiDPI canvas sizer) — currently L3770–3782.
- `formatNum` / `formatValue` (toFixed with abs<1e-9 → 0 clamp).
- `getA` / `getB` / `getThetaRad` / `getThetaDeg` / `getR`/`getC`
  (Re/Im/magnitude/angle accessors).
- `formatAngle` (angle_toggle-aware degree/radian formatter).
- `drawGrid` (currently L4080–4101 inside sinusoid only).
- `rerender + requestAnimationFrame` coalescing pattern (pendingFrame
  guard).
- `control wiring loop` (range/select/reset rendering against
  `demoControls`).

Pass 2 must reconcile the two `drawArrow` signatures (ctx-as-first-arg
in sinusoid+phasor vs outer-ctx-capture in complex_plane).

### 4.5 Module-dependency injection list

All names below are read by the new family files as **script-global
free names** — same convention as `app/mistake-notebook.js`. No
`require`/`import`/`exports`. Definitions stay where they are in
`app.js`; the new files just reach for them.

| Name | Defined at | Used by |
|---|---|---|
| `escapeHtml` | L767 | complex-plane, phasor, sinusoid-phasor, matrix-conformability |
| `decodeInlineMarkdownFragment` | L2512 | complex-plane, phasor |
| `parseBase64JsonAttr` | L2502 | dispatcher only (L3657) |
| `getInteractiveDemoDedupKey` | L4904 | dispatcher only (L3659) |
| `getInteractiveDemoSpec` | L2969 | dispatcher (L3667) + phasor (re-read at L4269; preserve) |
| `inferInteractiveDemoFamily` | L3044 | dispatcher only (L3668) |
| `getInteractiveDemoText` | L2980 | dispatcher only (L3671) |
| `inferChapterOneDemoType` | L2951 | dispatcher only (L3690) |
| `CHAPTER_ONE_DEMO_TYPES` | L2943 | dispatcher only (L3691) |
| `hydrateChapterOneDemo` | L3166 | dispatcher only (L3696) |
| `normalizeInteractiveDemoControl` | L3035 | matrix-conformability (L4651) |
| `getDemoControlValue` | L2931 | matrix-conformability (L4792–4797) |
| `renderBriefDemoFallback` | L5559 | dispatcher only (L4647) — body moves to `brief-fallback.js` |
| `window.typesetMath` | global | complex-plane (L3887), sinusoid-phasor (L4116), phasor (L4481) |
| `window.ResizeObserver` | global | complex-plane (L3976), sinusoid-phasor (L4253), phasor (L4571) |

**Preserve exactly** (DOM-property names introspected externally):
`node._complexResizeObserver`, `node._sinusoidResizeObserver`,
`node._phasorResizeObserver`.

### 4.6 Verification

- `npm run check` — add each new `app/interactive-demos/*.js` to the
  `check` script in `package.json` so `node --check` runs on each.
- `node tools/test-lesson-open-no-hang.js` — must remain green.
- Smoke: app boot, Home → Syllabus → first Background section → first
  Chapter 1 section → first Chapter 2 section. No console errors.
- **Manual demo-open run — all 19 arms exercised at least once.** Use
  these sections (selected to cover every family; the central-db has
  the demo-to-section map):
  - `bg-1` (Background §1) — complex_plane derived, opposite_rotations.
  - `bg-2` — sinusoid_phasor_projection derived, phasor derived.
  - `ch1-1` — chapter_one early-return (delegates to existing
    `hydrateChapterOneDemo`); brief_fallback.
  - `ch1-2` — signal_transform, energy_power.
  - `ch1-3` — sampling_quantization, system_property.
  - `ch1-4` — exponential_envelope.
  - `ch2-1` — matrix_conformability tail branch (the inlined 240-line
    one), matrix_locator.
  - `ch3-1` — convolution_lab, parameter_response.
  - `ch3-2` — pointwise_multiplication.
  - `ch4-1` — pole_zero_roc_lab, frequency_response_lab,
    transform_rule_lab, sequence_system_lab.
- For each demo opened: re-render via control change (drag a slider,
  toggle a select) and confirm no console error; confirm resize
  observer fires (resize the panel).
- Verify `window.typesetMath` re-runs on re-render in complex-plane,
  sinusoid-phasor, phasor (open MathJax DevTools or check rendered
  formula updates after slider drag).

### 4.7 Risks and rollback

**Risks:**

- **Module load order.** New family `<script>` tags MUST be included
  in `app/index.html` **before** `app.js`. If included after,
  `ReferenceError` at first lesson render. Copy the existing
  `mistake-notebook.js` / `recent-conversations.js` / `clerk-auth.js`
  ordering pattern.
- **Cache-busting in `index.html`.** All new
  `app/interactive-demos/*.js` files need a `?v=` query param
  coordinated with the next `app.js` bump (matching the CLAUDE.md
  Deployment section release process).
- **Sinusoid `lastFormulaHtml` closure** (L4113 guard `if
  (nextFormulaHtml !== lastFormulaHtml)`) — must stay inside the same
  function scope inside the family module, not hoisted to file top, or
  re-renders across different demo instances will collide.
- **Per-branch event-handler lifetime** (pre-existing leak): four
  `window.addEventListener('resize', rerender, { passive: true })`
  registrations across complex_plane, phasor, matrix; never removed.
  Preserve behavior — do not try to fix here.
- **Lesson cache invariant.** Do not change the data-demo-b64 schema
  or `dataset.hydrated` semantics. Keep `parseBase64JsonAttr`,
  `getInteractiveDemoDedupKey`, and `dataset.hydrated='1'` at the
  dispatcher level untouched.
- **`PHASE3_PREP.md` inventory gap** — update the prep doc in the
  same PR to add `isSinusoidDemo` to the derived-controls section,
  bringing the count from 18 to 19.
- **Vercel auto-deploy on push to main.** No preview env. Run the
  full verification in §4.6 locally before pushing.

**Rollback:** revert single PR. No data migration, no cache
invalidation (lesson cache is keyed on `aquarius_visual_latex_v2`
which is untouched). Family-file `?v=` query params can be left
stranded (404s on a reverted index.html won't trigger because the
revert removes the `<script>` tags).

## 5. PR #22 — runtime CSS collapse

**Target:** delete 6 `inject*Styles` sites (2,101 lines of CSS inside
JS string literals) and serve the equivalent CSS via a single static
`<link>`.

### 5.1 File plan

**Single file** `app/css/runtime-collapsed.css` containing all six
CSS blocks concatenated in **call order** (not declaration order):

```
1. injectStampPaginationStyles            (app.js L1014–1567)
2. injectFinalScrapbookToolbarStyles      (app.js L1571–1787)
3. injectFinalPagerArrowStyles            (app.js L1791–1871)
5. injectCenteredLectureToolbarStyles     (app.js L2026–2444)  ← called L2446
4. injectFinalPagerTextArrowFix           (app.js L1875–2024)  ← called L2447
6. injectFinalLearnQAFinalFramekiller IIFE (app.js L13339–14018)
```

**Why a single file, not a split:** sites 1+2+3+4+5 all target the
same `#learnExplainToolbar` selector tree with `!important` chains
that depend on cascade order. Splitting risks subtle ordering bugs
if anyone later reorders the `<link>`s. A single file is auditable
and atomic. All six are `dynamicCss: false` (zero template-literal
interpolations; the one `var(--theme-page-surface-soft)` reference
resolves via the normal cascade), so static extraction is safe.

### 5.2 `index.html` link order after change

```
<link rel="stylesheet" href="style.css?v=NEW">
<link rel="stylesheet" href="css/ui-friction-v123.css?v=1222">
<link rel="stylesheet" href="css/inline-styles.css?v=1335">
<link rel="stylesheet" href="css/runtime-collapsed.css?v=NEW">
```

The `?v=NEW` bump on `style.css` and `runtime-collapsed.css` (and
the matching `app.js?v=NEW`) follows the CLAUDE.md release process
to invalidate the Vercel edge cache.

### 5.3 Deletion list — exact line ranges in `app/app.js`

| Site | Function / kind | Lines to delete | Call site to delete |
|---|---|---|---|
| 1 | `injectStampPaginationStyles` (named fn) | L1014–1567 | L1569 |
| 2 | `injectFinalScrapbookToolbarStyles` (named fn) | L1571–1787 | L1789 |
| 3 | `injectFinalPagerArrowStyles` (named fn) | L1791–1871 | L1873 |
| 4 | `injectFinalPagerTextArrowFix` (named fn) | L1875–2024 | L2447 |
| 5 | `injectCenteredLectureToolbarStyles` (named fn) | L2026–2444 | L2446 |
| 6 | `injectFinalLearnQAFinalFramekiller` (inline IIFE) | L13339–14018 | (IIFE — same range) |

Net app.js delete: ~2,101 lines + 5 call lines = ~2,106 lines.

### 5.4 JS-tail side effects that must be preserved statically

Two sites have non-CSS side effects that vanish when their function
is deleted. Bake the effect into `index.html` static markup:

- **Site #1** (`injectStampPaginationStyles`, L1564–1566): adds class
  `stamp-page-btn` to four buttons (`learnKpPrevBtn`,
  `learnKpNextBtn`, `learnFocusPrevBtn`, `learnFocusNextBtn`).
  → Add `class="... stamp-page-btn"` to those four `<button>`
  elements in `index.html`.
- **Site #5** (`injectCenteredLectureToolbarStyles`, L2436–2443): sets
  `.lecture-overlay-btn-text` textContent to lowercase `'previous'` /
  `'next'` on `lecturePrevOverlayBtn` / `lectureNextOverlayBtn`.
  Today `index.html` L694, L697 have these as capitalized
  `'Previous'` / `'Next'`. → Change the static text in `index.html`
  to lowercase to match the current runtime appearance.

Forgetting either bake-in: ~30 CSS rules across sites 1+3 silently
no-op (lost `.stamp-page-btn` selector matches); lecture overlay
buttons revert to capitalized labels.

### 5.5 Cascade-preservation argument

Today's effective cascade is:

```
style.css → ui-friction-v123.css → inline-styles.css
→ tailwind runtime utilities (injected at <head> on tailwind config eval)
→ site1 → site2 → site3 → site5 → site4 → site6
```

After change:

```
style.css → ui-friction-v123.css → inline-styles.css → runtime-collapsed.css
```

With `runtime-collapsed.css` containing blocks in order `[1, 2, 3, 5,
4, 6]`. Specificity calculation is identical between `<link>`ed CSS
and runtime-injected `<style>` — same cascade. Tailwind utility
order is unchanged (its config script in `index.html` L14 runs at
the same point; its emitted `<style>` nodes still land in `<head>`
in the same position relative to the static `<link>`s).

**Sites 1, 2, 3, 4, 5 all target `#learnView #learnExplainToolbar`
descendants with `!important` at equal specificity** — last-declared
wins. Order **by call line**, not by declaration line. Site #4 must
come AFTER site #5 in the stylesheet because today it is called at
L2447, after L2446. A naive "declaration-order" concatenation
silently breaks pager arrow colors.

### 5.6 Visual-diff gate

Existing 6 baseline views (from `tools/visual-baseline/`):
- home (guest)
- syllabus
- lesson (Lecture tab, default split)
- lesson (Textbook tab)
- mistake-notebook
- settings

The 3 lesson-chrome views below are captured in the post-#21 baseline
refresh (see §3 "Gate between #21 and visual-diff baseline") so they
are already part of the 9-view set by the time #22 runs:

- **lesson-pager-states**: lesson at section 0 (prev disabled), at
  middle section (both enabled), at last section (next disabled);
  hover state captured on the next button.
- **lesson-lecture-toolbar**: `#learnExplainToolbar` visible in
  default view AND with `data-panel-focus="qa-wide"` and `="qa-full"`.
  Capture in both Lecture and Textbook modes.
- **lesson-qa-column**: `#learnChatCol` with empty-state, with one
  user+assistant turn, and with the followup-bar glass panel
  focused-within.

Threshold: under 0.5% pixel difference per view. Sites 5 hides
`#learnExplainToolbar` (display:none); after the move, site 4 is
last in the stylesheet but does not touch the toolbar container, so
site 5's `display:none` still wins. **Verify visually.**

### 5.7 Risks and rollback

**Risks:**

- **Cascade-order bug** if anyone "tidies" the block order in
  `runtime-collapsed.css` to match declaration order — silently
  breaks pager arrow colors. Add a comment block at the top of the
  CSS file noting the intentional `[1,2,3,5,4,6]` order.
- **Equal-specificity `!important` chains** across sites 1, 2, 3, 4,
  5 on the lecture toolbar — reordering any pair = visible
  regression.
- **Lost JS-tail side effects** (site 1 class add, site 5 textContent
  rewrite). Verification: confirm `.stamp-page-btn` matches in the
  DOM after change; confirm lecture overlay buttons show lowercase
  labels.
- **`var(--theme-page-surface-soft)`** used by site 6 — confirm it
  is defined upstream (in `style.css`). It is today; no new risk.
- **Vercel stale edge cache.** Bump `?v=` on `style.css`,
  `runtime-collapsed.css`, and `app.js` together. Watch for the
  `age` + `x-vercel-cache: HIT` signature flagged in MEMORY.md.
- **AQUARIUS_CONFIG cache key unaffected** — these are chrome
  styles, not lesson content. No lesson-cache regen needed.

**Rollback:** revert PR; the deleted `inject*Styles` functions and
their call sites return; the new `runtime-collapsed.css` file is
removed; `index.html` `<link>` reverts. No data migration.

## 6. PR #20 — Home Ask EOF CSS consolidation

**Target:** delete ~5,600 net CSS lines from `app/style.css`
L33181–44845 (12+ named passes, 92 banner blocks, 1 pre-banner
section) without visual regression on any of 6 distinct UI surfaces.

### 6.1 Strategy: split into 3 sub-PRs by surface, not by file order

Single-PR is rejected: 1,451 rules, 5,373 `!important`, and a
~5.6k net delete is too large to bisect if a visual-diff fires.
Bundling surfaces independently keeps each PR reviewable and the
diff signal localized.

**Sub-PR #20a — Pre-existing lesson + lecture surface (no Home-Ask).**
Banners 1–32 (style.css L33346–35958, ~3,500 lines in range). Target
delete: ~1,200 lines. Covers lesson single-page lock, full-bleed,
Q&A glass lock, BOOK SURFACE + corner nav, lecture editorial type,
page-number locks, lesson title scale locks, sidebar Home active
state, Mistake Notebook layout, feedback author tones, feedback post
button.

**Sub-PR #20b — Preference + Mistake-Notebook + course-tracker +
feedback-board big redesigns.** Banners 33–49 (L35959–38832, ~2,900
lines in range). Target delete: ~900 lines. Covers Preference page
liquid glass redesign (49 rules), Mistake Notebook liquid glass
redesign (57 rules), course tracker liquid glass redesign (65
rules), feedback board liquid glass final (65 rules), the duplicate
"EOF FEEDBACK AUTHOR COLORS" banner at L38774 (collapse with the
L35037 dupe).

**Sub-PR #20c — Home Ask + answer workspace + login + intro.**
Banners 50–92 (L39052–44845, ~5,800 lines in range). Target delete:
~3,500 lines. Largest single payoff: collapsing the top-4 duplicated
selectors (`#webSearchToggleBtnMain.home-ask-web-toggle` 21x,
`#homeModeMenu.home-mode-menu` 17x, `#searchBox.home-ask-composer`
16x, `.home-ask-stage` 15x) — these four selectors alone account
for ~70 rule-occurrences. Plus answer-workspace glass, learn-right
QA composer, RUNTIME-INJECTED CSS OVERRIDE block (L43149 — note
overlap with #22; sequence-block on #22 landing first), lesson
cards high-transparency glass, login liquid glass, references
glass, intro glass skin.

### 6.2 Pass-by-pass ordering within each sub-PR

**Within each sub-PR, two passes:**

**Pass 1 — orphan-selector deletion (the quick wins).** Targets the
15 selectors the investigation report flagged as genuinely
zero-reference (after grep-checking against runtime template-literal
patterns). Net delete: ~45 rules.

- ~~`.preference-signal-card` L36847, `.preference-signal-label`
  L36862 (banner L36805, sub-PR #20b).~~ **LIVE — DO NOT DELETE.**
  Verified during Pass 1: both classes are emitted as static
  `class="..."` strings by `app/preference-profile.js`. Skipped from
  the orphan sweep; per `docs/phase3_deferred.md §4`.
- ~~`.mistake-draft-actions` L38919,~~ `.mistake-note-image-empty`
  L38988, `.mistake-note-image-chip` L39001 (banner L38833,
  sub-PR #20c).
  **`.mistake-note-image-empty` + `.mistake-note-image-chip` are
  LIVE — DO NOT DELETE.** Verified during Pass 1: both are emitted
  by `app/mistake-notebook.js`. `.mistake-draft-actions` was the
  sole orphan and DID ship (PR #42); per `docs/phase3_deferred.md §4`.
- `.lecture-explain-text` L34351, `.lecture-block-text` L34352,
  `.lesson-page-kicker` L34370, `.math-chip` L34371, `.formula-label`
  L34372 (banner L34341, sub-PR #20a).
- `.kc-explain-card` L36913, `.formula-block` L36915 (banner L36893,
  sub-PR #20b — spot-check against template literals before delete).
- `.lecture-page-corner-sheets`, `.lecture-page-corner-cue` (banner
  L33673, sub-PR #20a — 18 internal-only rules).
- `#learnPageHeading` L34552 (banner L34551, sub-PR #20a — id was
  renamed to class `.lesson-page-heading` but the id rule was never
  deleted).

**Pass 2 — override-chain collapse.** For each top-21 duplicated
selector inside the sub-PR's range:
1. Read all overrides for the selector top-to-bottom.
2. Compute the effective final declaration **per property** (last
   `!important` value per property wins because all use
   `!important`).
3. Move that single collapsed rule UP to the first banner where the
   selector appears.
4. Delete the now-redundant later passes.

Do NOT assume the last full block wins. Properties from intermediate
blocks may survive. Build a per-property override timeline.

**Inverted preference for the intro/login surface (banners 81–88):**
the `.intro-*`, `.scrap-*`, `.proof-*` rules in
`app/css/inline-styles.css` are the canonical source; the style.css
copies are duplicates. Prefer keeping the inline-styles.css copy and
deleting the style.css copy — opposite to the rest of the strategy.
Call this out in the sub-PR #20c description.

### 6.3 Use of the unused-CSS scanner

`tools/scan-unused-css.js` reports 23 "unused" selectors out of 527
distinct (4.4%) in the cluster range. **Treat its output as a
suggestion list, not a delete list.** At least 8 of the 23 are
false positives from runtime template-literal class building:

- `.tone-0` through `.tone-5` (6 selectors) — built at
  `app.js:11687` as `` `feedback-thread tone-${threadTone}` `` and
  at `app.js:11703` as `` `feedback-reply feedback-click-reply
  is-${align} tone-${tone}` ``.
- `.is-left`, `.is-right` — same template literal at
  `app.js:11703`.

Before deleting any flagged selector, grep `app/app.js` (and
`app/index.html`) for template-literal patterns matching the
selector's prefix (`` `tone-${ ``, `` `is-${ ``, etc.). The 15
selectors in §6.2 Pass 1 above are what survives this filter.

Data-attribute selectors (92 in cluster, e.g. `[data-theme="dusk"]`,
`[data-feedback-id]`, `[data-feature-mode]`) are NOT in the scanner
output at all (it only inspects `.class` / `#id`). They ARE
cascade-sensitive; do not delete any data-attribute selector during
collapse.

### 6.4 Visual-diff gate per sub-PR

Baseline views to check per sub-PR (threshold **0.2%** unless
noted):

- **#20a** (lesson + lecture + Mistake Notebook chrome): lesson
  (Lecture tab + Textbook tab), lesson-pager-states,
  lesson-lecture-toolbar, lesson-qa-column, mistake-notebook,
  sidebar.
- **#20b** (Preference + Mistake Notebook + course-tracker +
  feedback-board redesigns): preference page, mistake-notebook,
  course-tracker, feedback-board, lesson (regression check).
- **#20c** (Home Ask + answer workspace + login + intro): home
  (guest), home (logged-in, Ask focused), home with answer-workspace
  open, login page, intro/trial scrapbook view, lesson (regression
  check for the L43149 RUNTIME-INJECTED CSS OVERRIDE block — must
  happen AFTER #22 lands), Q&A composer in Learn-right column.
  Threshold for the intro/login views: **0.5%** because of animated
  noise (`aquarius-glow`, `text-gradient-aurora`).

Each sub-PR adds its surfaces to the visual-baseline if not already
captured pre-#22.

### 6.5 Risks and rollback

**Risks:**

- **Runtime-injection collision with #22.** Banners
  `LEARN Q&A RUNTIME INJECTION OVERRIDE` (L33581) and
  `RUNTIME-INJECTED CSS OVERRIDE: beat the duplicated-ID learn
  composer rules from app.js` (L43149) are written specifically to
  outrank the runtime-injected `<style>` blocks #22 deletes. Once
  #22 lands and those `<style>` blocks become regular `<link>`ed
  CSS, the cascade still works — `runtime-collapsed.css` loads
  AFTER `style.css`, so the L33581 / L43149 banners may now lose to
  it. **Sequence enforcement:** #22 must land first; regenerate the
  visual baseline; then start #20. Inside #20c, re-evaluate whether
  the L33581 / L43149 banners are still needed at all.
- **`!important` chain order is load-bearing.** 5,373 of the file's
  15,594 `!important` declarations (34%) live in this cluster. A
  naive "consolidate at first declaration site" loses overrides if a
  later banner re-declares only some properties. Per-property
  timeline is mandatory.
- **Duplicate banner strings exist.** `EOF layout lock: strict 55:45
  split…` at L36893 AND L36929 (4 rules each); `EOF FEEDBACK AUTHOR
  COLORS…` at L35037 AND L38774 (13 + 11 rules). Read both blocks
  before merging; do not assume the later one is the final winner.
- **Media queries (60 in cluster) and keyframes (11 in cluster).**
  Do not lift a rule out of its `@media (…)` wrapper — that changes
  its applicability. Top occurrences `100%` and `0%` are keyframe
  stops, not selectors.
- **Third-party class prefixes** (`.katex-*`, `.cl-*`, `.mjx-*`):
  do not delete even if scanner flags unused. Vendor CSS targets
  them externally.
- **Runtime template-literal classes** — re-grep for every selector
  before delete; see §6.3.
- **Vercel stale edge cache** — bump `style.css?v=` and matching
  `app.js?v=` per CLAUDE.md release rule on every sub-PR.

**Rollback:** each sub-PR is independently revertible. Lesson cache
is not touched (no `aquarius_visual_latex_v2` change). Visual-diff
is the only signal — if a sub-PR fires diff on merge, revert and
re-do that sub-PR with a tighter scope.

## 7. After Phase 3 — unblocks

- **Phase 2 #18 — Interactive demos subsystem extraction** (4,018
  lines, `app/app.js` L7825–11842). Sequence rule from
  `REFACTOR_PLAN.md` was that this depends on #21 helper extraction
  landing first. After #21 ships, the dispatcher and its 19 family
  modules are already in `app/interactive-demos/`, so the remaining
  scope of #18 is the supporting infrastructure (demo registration,
  state stores, control wiring) — the bulk of the work is now done.
  Estimate after #21: net new work ~1,500 lines, not 4,018.
- **Phase 2 #19 — Glass + chapter-overview CSS** (16,402 lines,
  `app/style.css` L31257–47658). Deferred because the visual-diff
  harness did not exist when Phase 2 ran. After #20 + #22, the
  harness is mature (6 base + 3 lesson-chrome + Home-Ask + login +
  preference + feedback-board + Mistake-Notebook views), and the
  override-chain-collapse technique from #20 is proven. Schedule #19
  as the first Phase-4 work item.
- **Other REFACTOR_PLAN.md items that become candidates** once Phase
  3 lands:
  - Phase 4 user-data DB migration (rule #3) — independent of Phase
    3, but the cleanup-debt floor is now low enough to start the
    design conversation.
  - A future "shared interactive-demos helpers" follow-up PR
    (described in §4.4 Pass 2). Small, isolated; can land any time
    after #21 + visual-diff baseline includes per-demo views.

## 8. Decisions (locked 2026-06-21)

All six open questions resolved by FlyM1ss before #21 start:

1. **#21 helpers — two-pass approach approved.** Pass 1 keeps closures
   local to each large family module (mechanical move only). Pass 2
   (shared `app/interactive-demos/helpers.js`) is a follow-up PR after
   #21 lands and visual-diff confirms no regression.
2. **#20 splits into 3 sub-PRs by surface.** #20a (lesson + lecture
   chrome), #20b (preference + Mistake Notebook + course-tracker +
   feedback-board redesigns), #20c (Home Ask + answer-workspace +
   login + intro). Bisecting a 5.6k-line CSS PR on a visual-diff fire
   is too painful to risk a single-PR approach.
3. **#21 verification is manual UI only.** Manual UI verification per
   §4.6's 19-arm run covers #21 itself; the visual-diff harness is
   not run against pre/post-#21 state. Baseline refresh happens
   immediately after #21 lands and captures the post-split rendering
   as the new pre-#22 reference.
4. **The 3 lesson-chrome views fold into the post-#21 refresh.**
   `lesson-pager-states`, `lesson-lecture-toolbar`, `lesson-qa-column`
   are added alongside the existing 6 views during the
   refresh-after-#21 step (§3), not in a separate pre-#22 step. By
   the time #22 starts, the baseline is a 9-view set.
5. **L33581 / L43149 RUNTIME-INJECTED CSS OVERRIDE banners deleted
   in #20c.** Once #22 removes the runtime `<style>` injection sites
   those banners were defending against, the banners no longer have a
   target. Delete them inside #20c and verify via the 0.2% visual-diff
   gate; if any regression fires, revert just the banner deletion.
6. **`PHASE3_PREP.md` update is in-scope for the #21 PR.** The same
   PR that lands the dispatcher split also adds `isSinusoidDemo` to
   the derived-controls section of `PHASE3_PREP.md` and corrects the
   family count from 18 to 19. No separate doc-only commit.
