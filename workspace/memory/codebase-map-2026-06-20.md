# Codebase Map — fourier-tutor-agent (2026-06-20)

> **⚠️ SUPERSEDED 2026-07-05 by [codebase-map-2026-07-05.md](codebase-map-2026-07-05.md).**
> The refactor closed 2026-07-04 (`docs/REFACTOR_DONE.md`); the line counts, extraction
> candidates, and CSS-pain figures below predate Phase 3 / Phase 3.6 entirely (app.js was
> 14,434 here, 5,741 now). Historical record only — do NOT plan work against this file.

> **Refresh of [codebase-map-2026-06-19.md](codebase-map-2026-06-19.md)** after Phase 0 +
> Phase 1 (#17, #20–29) + Phase 2 #12, #14–17, #13 deletion landed. The 06-19 map's
> structural model (subsystems, contracts, hard constraints) is still correct; this file
> just refreshes line counts, the extraction-candidates table, and dead-code inventory so
> Phase 3 can be planned against current state. **For full subsystem table, integration
> contracts, env vars, localStorage keys, and `window.__ftutor*` contract — see the 06-19
> map.** Nothing in those sections has changed.

## Headline numbers (then → now)

| File | 06-19 | 06-20 | Δ |
|---|---:|---:|---:|
| `app/app.js` | 20,250 | **14,434** | **−5,816 (−28.7%)** |
| `app/style.css` | 47,865 | **44,845** | **−3,020 (−6.3%)** |
| `app/ws-bridge.js` | 6,868 | **5,348** | **−1,520 (−22.1%)** |
| `app/index.html` | 3,147 | **1,632** | **−1,515 (−48.1%)** |

New modules created during Phase 0–2 (none existed on 06-19):

| File | Lines | Origin |
|---|---:|---|
| `app/recent-conversations.js` | 755 | Phase 2 #17 (#34) |
| `app/clerk-auth.js` | 739 | Phase 2 #16 (#33) |
| `app/mistake-notebook.js` | 550 | Phase 2 #12 (#30) |
| `app/attachments.js` | 515 | Phase 2 #15 (#32) |
| `app/user-memory.js` | 480 | Phase 1 #5 (#23) |
| `app/preference-profile.js` | 318 | Phase 2 #14 (#31) |
| `app/markdown-engine.js` | 297 | Phase 1 #1 (#17) |
| `app/llm-client.js` | 252 | Phase 1 #6 (#24) |
| `app/lesson-cache.js` | 240 | Phase 1 #7 (#25) |
| `app/ragflow-client.js` | 220 | Phase 1 #4 (#22) |
| `app/search-helpers.js` | 194 | Phase 1 #9 (#27) |
| `app/static-routes.js` | 168 | Phase 1 #8 (#26) |
| `app/login-cosmos.js` | 152 | Phase 1 #10 (#28) |
| `app/data/syllabus-data.js` | 1,139 | Phase 1 #2 (#20) |
| `app/data/quiz-questions.js` | 67 | Phase 1 #2 (#20) |
| `app/data/course-metadata.js` | 42 | Phase 1 #2 (#20) |
| `app/data/preferences.js` | 24 | Phase 1 #2 (#20) |
| `app/css/inline-styles.css` | 1,536 | Phase 1 #11 (#29) |
| `app/css/ui-friction-v123.css` | 210 | Phase 1 #3 (#21) |
| `tools/smoke.js` | 334 | Phase 1 finale (`0abdf26`) |
| `tools/test-data-modules-shape.js` | 116 | Phase 1 #2 sidecar |

Net since `05cd118` (Phase 0 merge): **8,556 insertions, 8,388 deletions** across 25 files
(extraction migration is roughly net-flat in LOC — the win is shape, not size: monoliths
shrank ~−9.9 K LOC while 21 new focused modules absorbed ~+8.6 K).

## Monoliths — current state

| File | Lines | Pain | Notes since 06-19 |
|---|---:|---|---|
| `app/style.css` | 44,845 | **still critical** | **15,594 `!important`** (was 16,760, −1,166), **104 named FINAL/EOF/_LOCK blocks** unchanged, **452 `#learnView#learnView` duplicated-ID hits** unchanged. CSS pain is structural, not size. Phase 2 #19 (Glass + chapter-overview extraction, ~16 K lines) is the only remaining structural win and is deferred. |
| `app/app.js` | 14,434 | high (down from critical) | All Phase 1+2 subsystem extractions landed. Remaining bulk: interactive-demos engine (~4 K LOC), Send / Q&A pipeline, view shell + sidebar + TOC, lesson rendering + page pagination, KC Quiz Modal IIFE. |
| `app/ws-bridge.js` | 5,348 | high (down from high) | Lesson cache, LLM clients, RAGFlow, search helpers, static routes, user memory all extracted. Remaining bulk: dual-agent lesson generation pipeline + `/api/ask` orchestration + Python plotting glue. |
| `app/index.html` | 1,632 | medium (down from high) | Inline `<style>` block extracted to `app/css/inline-styles.css`. SPA structure unchanged. |

## Dead-code inventory — current state

Aggressive deletes have run twice (Phase 0 `96740c3` + Phase 2 #13 `ea6a7a5`). Status of
each 06-19 dead-code claim:

**ws-bridge.js orphans (8 named) — all DELETED in Phase 0 `96740c3`.** Re-grep on 2026-06-20
finds zero matches for `_legacyGenerateSectionLesson`, `buildFallbackBlueprint`,
`loadExternalBlueprint`, `prewarmLessonVariants`, `sectionIdToBlueprintCandidates`,
`buildSyntheticProfileMemory`, `runPython3`, `getActiveSectionPageMap`,
`renderedBlockStartsWithKnowledgeHeading`. Duplicate `/generated/` route also gone.

**app.js orphans (19 named) — all DELETED in Phase 0 `96740c3`.** Re-grep finds zero
matches for `createIntroCosmos`, `renderHyperknowLinks`, `prepareLearnReturnTarget`,
`homeworkPreviewText`, `fallbackLocalUid`, `isB73VectorOperationsSection`,
`getPrimaryAnchorLabel`, `createVisualChip`, `drawInteractiveDemoArrow`,
`drawInteractiveDemoRoundedRect`, `ensureOverviewPreludePagination`, `openLearnFocusMode`,
`toggleLearnChatPanel`, `shrinkLearnQaToPopover`, `toggleLearnExplainPanel`,
`buildOverviewSubsectionChooserHtml`, `buildTocFromSyllabus`, `renderExplanation`,
`startStepAnimation`.

**Homework subsystem — DELETED in Phase 2 #13 (`ea6a7a5`).** −529 app.js, −441 style.css,
−77 ws-bridge.js. Remaining `homework` mentions in `ws-bridge.js` (4 hits at L1566, L2225,
L3028, L3031) are intentional LLM prompt-string framing for "exam priority hint," NOT the
deleted subsystem.

**Duplicate-logic risk — STILL LIVE.** `compactWhitespace` is intentionally duplicated
across `app.js` + `ws-bridge.js` with a `// SYNC: keep identical to app.js compactWhitespace.`
comment at `ws-bridge.js:364`. `sortSourcesByType` was flagged in Phase 0 as a
`KNOWN DIVERGENCE` (intentionally differs between sides). Not a refactor target.

**CSS dead — Homework removed.** The ~1,200-line `.homework-*` class family flagged in the
06-19 map is gone (Phase 0 took ~50 selectors / ~1,740 lines, Phase 2 #13 took the rest).
Remaining flagged dead families — `.learn-chat-empty-icon`, `.learn-chat-empty-prompts`,
`.toc-sidebar`, `.toc-header-label`, `.course-tracker-table`,
`.chapter-overview-summary-details`, `.learn-lecture-page-indicator`, `.learn-mini-toggle`,
`.login-washi-tape`, `.login-status-pill` — status not re-audited; treat 06-19 list as
"likely still dead, re-verify before deleting."

**Other dead artifacts:**
- `tools/tutor_craft.py` — open question for owner (Q6 in 06-19 map), not actioned
- `docs/legacy/CODEX_PROJECT_GUIDE.md` — Rule 4 (legacy docs read-only), kept
- `pptxgenjs`, `ws` npm deps — DELETED in Phase 0
- `guest_qh2romk1.json` — DELETED in Phase 0
- Static-data bloat (`SECTION_PREVIEWS_NEW` double-keyed) — extracted as-is in Phase 1 #2;
  the double-key inflation is now isolated in `app/data/syllabus-data.js` and a test
  shape-check (`tools/test-data-modules-shape.js`) asserts both key forms

## Extraction Candidates — refreshed ranking

### Phase 1 (Tier 1) — DONE except #15

| # | Candidate | Status |
|---|---|---|
| 1 | Markdown rendering engine | ✓ #17 `5235e25` |
| 2 | Static-data extractions | ✓ #20 `0c06932` |
| 3 | UI Friction Fix Pack v1.2.3 CSS | ✓ #21 `bc9d3e8` |
| 4 | RAGFlow retrieval sidecar client | ✓ #22 `64cd139` |
| 5 | User memory + feedback IO | ✓ #23 `eda8626` |
| 6 | LLM client wrappers | ✓ #24 `73fdf81` |
| 7 | Lesson cache reader/writer | ✓ #25 `2137183` |
| 8 | Static-file route handlers | ✓ #26 `5176b22` |
| 9 | Search helpers | ✓ #27 `ded0cc6` |
| 10 | Login intro / cosmos | ✓ #28 `db8a0e4` (narrowed to Three.js scene) |
| 11 | Inline `<style>` in index.html | ✓ #29 `69ee416` |
| 15 | Build orchestration consolidation | not done — small, deferred |

### Phase 2 — 6 of 7 DONE

| # | Candidate | Status |
|---|---|---|
| 12 | Mistake Notebook subsystem | ✓ #30 `0ae496d` |
| 13 | Homework subsystem | ✓ #36 DELETED (was extract → aggressive ratification) |
| 14 | Preference profile subsystem | ✓ #31 `9341683` |
| 15 | Attachments pipeline | ✓ #32 `9dcc88f` |
| 16 | Clerk auth + return-intent | ✓ #33 `477bc97` |
| 17 | Recent-conversations storage | ✓ #34 `55d8420` |
| 19 | Glass + chapter-overview CSS | **DEFERRED** — 13 scattered regions across style.css with interleaved non-glass rules, needs visual-diff verification beyond smoke |

### Phase 3 — Tier 2 candidates (06-19 map's Tier 2 minus what's done)

Re-ranked by current line counts and risk:

| # | Candidate | Location | Lines | Notes |
|---|---|---|---:|---|
| 20 | Interactive demos subsystem | `app.js` (was L7825–11842) | ~4,000 | **Largest remaining app.js win.** Split per family (arrows, rounded rects, animation loops). Demos engine is heavily window-scoped — extraction must preserve global handles consumed by markdown-rendered `onclick=` strings. |
| 21 | Send / Q&A pipeline | `app.js` (was L15113–15265 + L17635–17992) | ~500+ | `sendQuestion` is ~200 LOC; entangled with attachments + intent triage + recent-conversations (already extracted). |
| 22 | Lesson rendering + page pagination | `app.js` (was L7518–7823 + L12189–12814 + L15310–15602) | ~1,200 | Markdown engine already extracted; the *driver* (pagination + page-by-page rendering) remains. |
| 23 | Learn-mode shell + layout state machine | `app.js` (was L13708 + L14265–14817) | ~600 | Tight coupling to lesson rendering. Best paired with #22. |
| 24 | KC Quiz Modal IIFE | `app.js` (was L15606–16737) | ~1,100 | Cross-IIFE `window.__ftutor*` contract — extraction MUST preserve script load order with the v1.2.3 fix pack. |
| 25 | View shell + sidebar + TOC | `app.js` (was L16740–17390) | ~650 | Every view touches every other; risky. |
| 19 | Glass + chapter-overview CSS | `style.css` | ~16 K | Same as Phase 2 #19; lifted into Phase 3 if we accept the visual-diff requirement. |

**Suggested Phase 3 entry point:** #20 (interactive demos) — largest LOC win, lowest
coupling to the lesson-rendering pipeline (it draws into canvases), and the 06-19 map
already labeled it "moderate" coupling. Splitting per family lets each PR be small.

## What changed conceptually since 06-19

1. **Three trees agree.** The runtime tree question (workspace vs root) was settled in
   Phase 0 by aligning docs to code — workspace-preferred is now blessed in
   `docs/sync-policy.md`, `WINDOWS_RAG_HANDOFF.md`, and `PROJECT_STRUCTURE.md`. The 06-19
   map's "Open Question #1 (foundational)" is resolved.
2. **2nd Edition retired.** `syllabusDataOld`, `SECTION_PREVIEWS`, `setBook`, `OCR_DIR_OLD`,
   `BOOK_INDEX_OLD`, `SECTION_PAGE_MAP`, `/old-pages` route all gone. Open Question #4
   resolved (retired, not kept).
3. **Smoke safety net exists.** `tools/smoke.js` runs 9 Playwright checks in ~11s and is
   the regression gate for every extraction. Per memory `project-afk-regression-safety-workflow`,
   this is *regression safety* — NOT simulated-user discovery.
4. **Aggressive-mood ratified for Phase 2.** Owner confirmed "delete all dead code" on
   2026-06-20 for #13. Same disposition applies to any further dead findings.

## What still needs answering

- Phase 2 #19 (Glass CSS) — visual-diff strategy. Smoke doesn't catch CSS regressions
  beyond layout breakage; need a visual baseline or accept the risk.
- Owner Open Questions 2, 3, 5–20 from 06-19 map remain open. The materials-tree question
  (Q1) and 2nd-Ed retirement (Q4) are resolved.

## Workflow run metadata

This map was refreshed by direct `wc -l` + `grep` + `git log` reads on 2026-06-20 21:50
GMT+8 after the Phase 2 #13 merge — no discovery-workflow re-run. Supersedes
`codebase-map-2026-06-19.md`; the older file is kept per Rule 5.
