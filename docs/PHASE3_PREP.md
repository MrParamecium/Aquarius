# Phase 3 — Prep Notes

> **STATUS: SUPERSEDED — refactor complete 2026-07-04.** Frozen prep notes kept
> as historical record; authoritative final status: `docs/REFACTOR_DONE.md`.

Prep work for the next loop iteration. Companion to `docs/REFACTOR_PLAN.md`.
Last refreshed 2026-06-20 against post-Phase-2 line numbers.

## Updated line ranges (plan's numbers are post-Phase-2 stale)

| Plan # | Plan said | Actually at (2026-06-20) | Δ |
|---|---|---|---|
| 20 | `style.css` L33181–45296 (~6,000) | `style.css` L33181–44845 (~11.7k of the file; net ~5.6k after Phase 1 #11 extraction). Range start still valid; end is just EOF since file is now 44,845 lines. | end shifted |
| 21 | `app/app.js` L8580–9819 (1,240) | `app/app.js` L3652–4891 (1,242) | -4,928 |
| 22 | `app/app.js` L5894–7327 (1,430) | `app/app.js` L1014, 1571, 1791, 1875, 2026 (5 named) + L13339–14018 IIFE (1 inline) | 6 sites, 2,101 lines total |

## #22 — `inject*Styles` inventory

Six runtime CSS-injection sites. All append a `<style>` to `<head>` at
script-eval time, *after* `style.css`, `css/ui-friction-v123.css`,
`css/inline-styles.css` are already loaded. That cascade order is what
makes the rules effective — many target the same selectors as `style.css`
at equal or higher specificity. **Order must be preserved when collapsing.**

| # | Function | Lines | Range | Purpose |
|---|---|---|---|---|
| 1 | `injectStampPaginationStyles` | 554 | L1014–1567 | Pager (prev/next) controls + stamp-style pagination dots |
| 2 | `injectFinalScrapbookToolbarStyles` | 217 | L1571–1787 | Final scrapbook toolbar |
| 3 | `injectFinalPagerArrowStyles` | 81 | L1791–1871 | Final pager arrow buttons |
| 4 | `injectFinalPagerTextArrowFix` | 150 | L1875–2024 | Pager text-arrow color fix (overrides #3) |
| 5 | `injectCenteredLectureToolbarStyles` | 419 | L2026–2444 | Centered lecture-mode toolbar |
| 6 | inline IIFE `injectFinalLearnQAFinalFramekiller` | 680 | L13339–14018 | Learn-mode QA frame-killer styles. Not a named function — runs immediately. |
| | **Total** | **2,101** | | |

**Plan said 5 helpers @ 1,430 lines.** Items 1-5 sum to exactly 1,421 lines —
plan was right about the named ones. Item 6 (the inline IIFE) is a 6th site
the plan missed; fold it into #22.

**Extraction strategy for #22:**

- Create `app/css/runtime-collapsed.css` containing the literal CSS strings
  from all six sites, in the same order they currently inject.
- Link it from `index.html` after `inline-styles.css` (last `<link>` slot).
- Delete the six injection sites.
- `npm run check` + visual-diff harness must show byte-identical pixels on
  the pager / lecture toolbar / learn QA views.

**Specificity gotcha:** several rules currently rely on being injected
*after* the document `<style>` block. With the inline `<style>` block now
extracted to `css/inline-styles.css` (Phase 1 #11), the cascade hasn't
changed — both are still loaded before script eval. So the order
`style.css → ui-friction-v123.css → inline-styles.css → runtime-collapsed.css`
matches what's happening today. Don't reorder.

## #21 — `hydrateInteractiveDemos` family map

Single dispatcher, 1,242 lines, 19 distinct demo handlers (corrected from the
original 18-count during PR #21 implementation — the missing arm was
`isSinusoidDemo`, see Derived list below).

**Module-scope dependencies** (must be passed in or imported by the split files):

- `getInteractiveDemoDedupKey` — L≈2900s
- `getInteractiveDemoSpec` — L2969
- `getInteractiveDemoText`
- `inferInteractiveDemoFamily` — L3044
- `hydrateChapterOneDemo` — L3166 (delegated to for Chapter 1 demos)
- `renderBriefDemoFallback` — L5559
- `getDemoControlValue` — L2931
- `escapeHtml`, `decodeInlineMarkdownFragment`, `formatInteractiveDemoNumber` — generic helpers

**Family branches** (15 explicit + 4 derived = 19 handlers):

Explicit `family === '...'`:
1. `convolution_lab`
2. `energy_power`
3. `exponential_envelope`
4. `frequency_response_lab`
5. `matrix_conformability`
6. `matrix_locator`
7. `opposite_rotations`
8. `parameter_response`
9. `pointwise_multiplication`
10. `pole_zero_roc_lab`
11. `sampling_quantization`
12. `sequence_system_lab`
13. `signal_transform`
14. `system_property`
15. `transform_rule_lab`

Derived (matched on controls + text, not on `family`):
16. `isComplexPlaneDemo` — controls `slider_a`+`slider_b`, react_canvas framework, text matches `/complex number|rectangular|polar|complex plane/i`, NOT `/sinusoid|same frequency|cosine wave|phasor sum/i`.
17. `isPhasorDemo` — same control shape but the negation of `isComplexPlaneDemo`'s text test.
18. `isOppositeRotationDemo` — `family === 'opposite_rotations'` (overlaps with the explicit list — treat as a refinement).
19. `isSinusoidDemo` — `demo.demo_type === 'sinusoid_phasor_projection'` OR (`demo.type === 'interactive_demo'` AND text matches `/sinusoid/i` AND `/phasor|amplitude|frequency|phase/i`). Dispatcher arm at L3986 of pre-#21 app.js. Missing from the original 18-handler inventory; corrected during the PR #21 implementation.

**Suggested split:**

- Thin dispatcher in `app/app.js` (or `app/interactive-demos/index.js`) that:
  1. Parses + dedupes the demo node (lines 3652–3666).
  2. Resolves `family` and the three derived booleans.
  3. Dispatches to `hydrateDemoFamily<X>(node, demo, ctx)` where `ctx` is an
     object with the module-scope helpers above.
- One file per family under `app/interactive-demos/`. Many handlers share
  internal helpers (`drawArrow`, `drawComplexPlane`, `formatPhase`, etc.) —
  inventory them in a follow-up PR; first pass should just move whole branches.
- The `if (!isMatrixDemo) { ... }` fallback path at the tail covers all the
  not-matrix-not-handled cases. Keep it in the dispatcher.

**Unblocks:** Phase 2 #18 (interactive demos, 4,018 lines) — sequence rule.

## #20 — Home Ask EOF cluster (CSS, ~5.6k lines)

Largest single CSS slog. The plan calls this "12+ named passes" of late
overrides — typical pattern is the same selector re-declared 3-5 times in
the range, each later one winning by cascade. Goals:

1. Identify rules with zero references in `app/app.js` + `app/index.html`
   + other CSS (tool #2 above).
2. For surviving rules, dedup by collapsing the override chain into the
   final winning value at the declaration site higher in the file.
3. Verify with visual-diff harness — this is the item that most needs it.

No new tools here beyond the unused-selector scanner. Expect this to be
the slowest of the three.

## Sequence for the Phase 3 loop

1. **#21 first** — pure JS, unblocks Phase 2 #18 (the largest deferred item).
   Doesn't need the visual-diff harness; smoke + manual demo run is enough.
2. **Visual-diff harness baseline** — `npm run test:visual:baseline` while
   the codebase is on a known-good state.
3. **#22** — runtime CSS collapse. Cascade-sensitive; needs visual diff.
4. **#20** — the big CSS cleanup; needs visual diff hardest of all.
5. Revisit deferred **Phase 2 #19** (Glass + chapter-overview CSS, 16k
   lines) using the same harness now that it exists.
