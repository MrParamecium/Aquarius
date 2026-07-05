# B4 — lesson-render.js extraction plan (execute-ready)

Workstream B **seam #4** (the mandatory-last, highest-risk seam) of
`docs/REFACTOR_DONE.md`. Grounded in a 6-agent read-only boundary mapping
(workflow `w6r6hg4kp`, 2026-06-25) run against `app/app.js` at **7232 lines**
(post B1/B2/B3/B5: PRs #107/#108/#109/#110 merged). All line numbers below are
from that snapshot — **re-grep every boundary before cutting**, they drift.

> **Status: ✅ EXECUTED — shipped as PR #116 (2026-06-26).** `app/lesson-render.js`
> (1,482 lines) extracted; `app.js` 7,157 → 5,720; 37-view stash-diff
> render-neutral. Workstream B complete; refactor closed 2026-07-04
> (`docs/REFACTOR_DONE.md`). This doc is kept as a worked example of
> partial-cut analysis — line numbers below are from the pre-B4 snapshot.

## Verdict: PARTIAL-CUT-SAFER (~1,455 lines → app.js ≈ 5,780)

Not a clean cut, for two independent reasons:
1. **Must-stay islands inside the engine band.** `compactWhitespace`
   (@1381–1383, has a sync-with-`ws-bridge.js` contract + 40+ app-wide callers)
   and `parseSectionTitleParts` (@1385–1413, called cross-file by
   `ui-friction-fixes.js` + non-engine app.js) sit *between* engine functions,
   so the move is necessarily **multi-range**, not one slice.
2. **The central KP state cannot move.** Three of the four KP-state lets are
   written by code that STAYS in app.js, so all four stay and the engine
   reads/writes them cross-scope at runtime (safe in this one-lexical-env,
   module-loads-first pattern):
   - `learnKnowledgePoints` @873 — written by `renderChapterOverviewContent`
     @3395 (non-engine) + focus/keydown handlers @4194–4228.
   - `currentKnowledgePointIndex` @874 — written by `renderChapterOverviewContent`
     @3397 + `learnFocusPrev/NextBtn` @4195/4203 + keydown @4223/4228.
   - `currentLessonTrailingHtml` @876 — written by `renderChapterOverviewContent`
     @3396.
   - `currentFullLessonHtml` @875 — written by `clearLearnRenderedContent` @2918
     (stays). Engine-exclusive reader is `renderCurrentKnowledgePoint` @2137.

## Move ranges (14 — extract verbatim into `app/lesson-render.js`)

Re-verify each end-brace before `sed`. Extract top-down, **delete from app.js
bottom-up** to preserve line numbers.

1. `962–1060` visual-helper cluster — `getTeachingRoleLabel`,
   `getVisualKindPriority`, `findNextLessonImage`, `isStandaloneVisualCaption`,
   `getVisualBlockNodes`, `getPairedVisualSubtitle`, `getPairedVisualPanelTitle`
   (only consumer is `enhanceVisualMetadataUI`; no cross-file callers).
2. `1062–1233` `decorateLectureContent` (close brace @1233).
3. `1235–1367` `enhanceVisualMetadataUI`.
4. `1369–1377` `resetLearnKnowledgePointState` (writes the 4 staying lets — safe).
5. `1417–1422` `const LESSON_RENDER_RULES` (`Object.freeze` pure literal — safe top-level init).
6. `1424–1714` render-rule + overview cluster — `isDiagonalIdentityCombinedTitle`,
   `normalizeOverviewConceptLabel`, `inferLessonChunkTitle`, `buildInlineMatrixVisual`,
   `buildDiagonalIdentitySplitHtml`, `isMatrixEqualityTitle`,
   `buildMatrixEqualityExampleHtml`, `applyLessonRenderRulesToKnowledgePoint`,
   `buildLessonOverviewHtml`.
7. `1716–2073` `parseLessonKnowledgePoints` (end @2073).
8. `2075–2208` page-frame cluster — `isBadLessonPageTitle`,
   `getLessonPageDisplayTitle`, `stripDuplicatePageHeading`,
   `buildLessonPageFrameHtml`, `renderCurrentKnowledgePoint` (re-declares its DOM
   consts as **function-local** `getElementById` @2133–2171 — keep them local; no
   DOM-const cross-scope coupling).
9. `2210–2267` `bindStartTestBtnIfPresent`.
10. `2269–2286` `setLearnLessonContent`.
11. `2288–2341` page-turn block — `let learnPageTurnTimer`, `learnPageTurnMidTimer`,
    `isLearnPageTurning` + `clearLearnPageTurnClasses` + `runLearnPageTurn`
    (**state moves with this block** — see below).
12. `2343–2419` `getOverviewPreludeFallbackTitle` + `buildOverviewPreludePointsFromMarkdown`
    (**DEAD — zero callers**; move as engine OR delete in a separate cleanup PR;
    do not let it block the cut).
13. `2422–2436` `moveLearnKnowledgePoint` (include doc comment @2422–2426).
14. `2496–2507` `buildLessonTestBannerHtml` (static HTML; external callers @3490,
    @3804 call cross-scope at runtime — safe). **2026-06-26 update:** the
    `2509–2526` `syncFocusModeContent` second half of this entry was deleted
    as dead code in PR #114 alongside the `#learnFocusModal` removal — no
    longer in the move scope.

## State

**Move with the engine** (engine-exclusive writers; reads from staying code are
safe cross-scope): `learnPageTurnTimer` @2288, `learnPageTurnMidTimer` @2289,
`isLearnPageTurning` @2290 (written only by the page-turn pair; read cross-scope
by staying code at L3536/L4126/L4133/L5968 — reads-only-from-staying-side is safe).

**Must stay in app.js** (cross-file writers or broad use): the 4 KP-state lets
@873–876 (above); the session/orchestration lets @2907–2915
(`learnPages`/`learnPageIndex`/`learnSectionId`/`learnSectionTitle`/`learnWebData`/
`learnAbort`/`learnRequestSeq`/`learnParentOverviewContext`); `_learnLayoutMode`
@859; `currentBookPageIndex` @2992.

## Explicitly OUT of this seam (conservative stays)

- `renderLearnPages` @2994 + book-page DOM consts @793–796 + `bookPrev/NextBtn`
  bindings @3028–3044 — this is the **textbook-image pager** (reads
  `tutorState.learnBookPages`), not the lesson-text engine.
- overlay-nav cluster @2438–2494 (`animateLectureNavButton`,
  `getLectureOverlayDeltaFromEvent`, `lastLectureOverlayNavAt`,
  `handleLectureOverlayNavEvent`) — bound at top-level `document.addEventListener`
  @4137–4138; keep cluster + bindings together in app.js.
- `clearLearnRenderedContent` @2917 — lifecycle fn in the @2907 region.
- The util island block `decodeBase64Utf8`/`parseBase64JsonAttr`/
  `decodeInlineMarkdownFragment` @922–955 + `window.parseBase64JsonAttr=` @948
  (exposed for tools + interactive-demos), `getActiveLearnTrack` @957,
  `compactWhitespace` @1381, `parseSectionTitleParts` @1385.

## Redeclaration risks (FATAL — browser `SyntaxError`, blank page)

`node --check` does **not** catch cross-file `const`/`let` redeclaration (each
file is valid alone) — only the browser/visual-diff harness + the grep audit do.
- **Must NOT be declared in `lesson-render.js`** (they stay in app.js / siblings):
  `compactWhitespace`, `parseSectionTitleParts`, `escapeHtml` @755, `detectLang`
  @6196, `getActiveLearnTrack`, `parseBase64JsonAttr`/`decodeBase64Utf8`/
  `decodeInlineMarkdownFragment`, the 4 KP-state lets @873–876, all LEARN-shell
  DOM consts @785–850, the session lets @2907–2915, `_learnLayoutMode`; plus
  cross-module globals `markdownToHtml`/`inlineFormat`/`decodeHtmlEntities`/
  `parseMdTable` (markdown-engine.js), `userMemory` (clerk-auth.js),
  `hydrateInteractiveDemos` (dispatcher.js).
- **Must be DELETED from app.js after moving** (else declared in both): every
  moved function name + `LESSON_RENDER_RULES` @1417 + the 3 page-turn lets
  @2288–2290. (`lastLectureOverlayNavAt` is NOT moved.)

## TDZ risks: NONE

Verified the entire 1062–2526 engine band is `function` declarations + one pure
`const LESSON_RENDER_RULES = Object.freeze({literal})` @1417 (reads no external
symbol). Zero top-level executable statements read an app.js symbol at load time.
All engine→app.js cross-scope calls are deferred to runtime (handlers /
post-await / orchestration). All 20+ external callers invoke the moved entry
points only at runtime.

## Load order (index.html)

Insert `<script src="lesson-render.js?v=NNNN">` **before** `app.js` (currently
@1656), recommended right after `dispatcher.js` @1655. Only "before app.js"
matters (app.js calls the engine at runtime); the module has no load-time reads,
so ordering among the before-app.js siblings is not load-critical. Bump
`app.js?v=`. Add `node --check app/lesson-render.js` to the `package.json` check
list.

## Verification strategy (lesson views are noisy — do NOT chase 0.000%)

1. `npm run check` (syntax + dead-redeclaration validator + harness-exports).
2. **grep audit**: every moved symbol → exactly ONE declaration (in
   lesson-render.js), zero in app.js; every must-stay util → NOT declared in the
   module.
3. `node tools/test-lesson-open-no-hang.js` (needs `npx playwright install
   chromium`) — exercises openLearnMode → parseLessonKnowledgePoints →
   renderCurrentKnowledgePoint + KP nav. Run before AND
   after; must stay green. **This catches cross-file redeclaration** (blank page).
4. **Stash-diff visual-diff** (not literal 0.000% — lesson views carry 0.06–0.46%
   AA/flake noise, see [[reference-visual-diff-baseline-noise]]): report on main,
   stash, apply extraction, regenerate, diff the two REPORTS. Delta within the
   known per-view noise floor = render-neutral.
5. **Manual / Playwright interactive smoke** (`npm start`,
   `http://127.0.0.1:9000`): open a cached lesson → KP pager prev/next +
   page-turn animation → Start-Quick-Check banner → chapter-overview render
   (the path that writes the staying state lets AND calls moved
   `decorateLectureContent`/`enhanceVisualMetadataUI`) →
   recent-conversations history restore (cross-module
   `setLearnLessonContent`/`renderLearnPages` callers). **This is the step that
   benefits from the owner's eyes.** *(2026-06-26: focus-mode modal removed
   in PR #114 — no longer a manual smoke target.)*
6. Bump cache-buster + add the `<script>` tag + npm-check entry.

## External callers (all runtime — no TDZ regardless of load order)

- `recent-conversations.js` (before app.js): `loadHistoricalSession` calls
  `setLearnLessonContent` @611, `renderLearnPages` @617 (user-click handler).
- `ui-friction-fixes.js` (after app.js): `moveLearnKnowledgePoint` @374 (handler)
  + `parseSectionTitleParts` @36/183/184 (stays).
- `dispatcher.js` (before app.js): `hydrateInteractiveDemos` is called BY the
  engine (`renderCurrentKnowledgePoint` @2160) cross-scope; dispatcher loads
  first so the symbol is available.
- `interactive-demos/*.js`: call `decodeInlineMarkdownFragment` (stays) at runtime.

## Source

Workflow `w6r6hg4kp` (2026-06-25): 5 read-only mappers (enumerate / call-graph /
external-callers / shared-state / deps-out) + 1 synthesis. Full output archived
in the run transcript.
