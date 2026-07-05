# Codebase Map — fourier-tutor-agent (2026-06-19, FULL)

> **STATUS: COMPLETE (historical). Line counts SUPERSEDED 2026-07-05 by
> [codebase-map-2026-07-05.md](codebase-map-2026-07-05.md)** — the refactor closed 2026-07-04
> and every monolith shrank massively. The **subsystem table, integration contracts, env vars,
> localStorage keys, and `window.__ftutor*` contract sections remain the authoritative deep
> reference** (nothing replaced them); verify line numbers by grep before use.
>
> Built by a 16-agent discovery workflow (run `wf_e3ed2630-c06`, second attempt
> `wylsvupzp`). All 15 inventory + cross-reference agents succeeded on the resume run; one synthesis
> agent unified the results. This was the canonical structural map for the repo as of 2026-06-19.
> Supersedes `codebase-map-2026-06-19-partial.md` (kept for historical record).
>
> The headline `cssEstimatePercent` figure dropped from ~35% (rough first-pass estimate in the partial
> map) to **6.2%** (confidently dead, grounded by the dead-css-detector on retry). The bigger CSS pain
> is selector duplication and override layering, not raw dead lines.

## The Four Monoliths

| File | Lines | Size | Pain | Dominant smell |
|---|---|---|---|---|
| `app/app.js` | **20,250** | 700 KB | critical | Top-level globals + load-time `getElementById` captures + chronological append-only growth + 5 IIFE-injected stylesheets + cross-IIFE window.* contracts |
| `app/style.css` | **47,865** | 1.8 MB | critical | Append-only fix-pack ledger (**106 named "FINAL/TRUE EOF/ABSOLUTE EOF/CODEx_FINAL/_LOCK" blocks**) with specificity escalation — same component restyled 5-12 times, each layer overriding prior, `#learnView#learnView` duplicated-ID hacks as last resort |
| `app/ws-bridge.js` | **6,868** | 250 KB | high | Single 1100-line `if(pathname===...)` chain (one dead `/generated/` duplicate at L6800); module-level synchronous `fs.readdirSync` over `BOOK_INDEX_OLD/NEW` slows startup; `loadLocalEnvFile` re-read on every `getOpenAIKey/getOpenRouterKey` call; section-identity logic scattered across 6+ helpers |
| `app/index.html` | 3,147 | 110 KB | high | 1528-line inline `<style>` + monolithic single-document SPA + inline `onmouseover/onfocus/onblur` handlers + Tailwind Play CDN production dep |

**style.css specifics:**
- **16,760 `!important` declarations** (~35% of all property lines) — cascade order IS the correctness mechanism
- **`#learnView#learnView` duplicated-ID specificity hacks in 9+ locations** — the cascade has been wedged
- Home Ask composer restyled **19×** across ~22 named iterations (L30526-45296)
- Mistake Notebook redesigned **8×** (L38489-47626)
- Feedback Board iterations **13×** (L32179-41376)
- Lesson 55:45 layout locks: 10 near-duplicate blocks at file tail (L39703-47658)
- `lesson-page-footer` restyled **12×** with escalating selector specificity
- Runtime CSS injection from `app.js` fights for cascade precedence (comments at L36390 + L45961 say "beat the duplicated-ID learn composer rules from app.js")

## Cross-File Subsystems (24 identified)

| # | Subsystem | Location | Coupling | Health |
|---|---|---|---|---|
| 1 | Lesson cache | `ws-bridge.js` L1146-1432 + `app.js` L14533-14642 + filesystem | tight to bridge | yellow |
| 2 | Dual-agent lesson generation pipeline | `ws-bridge.js` L3639/L4351-4540/L4646-4824/L5065-5333 + prompts | tight to bridge | green |
| 3 | RAGFlow retrieval sidecar | `ws-bridge.js` L124-139 + L3054-3215 | loose, single caller | green |
| 4 | User memory + preference profile | `ws-bridge.js` L1434-1745 + `app.js` L1007-1152 / L2271-2398 | moderate | green |
| 5 | Materials resolution + OCR indexing | `ws-bridge.js` L76-92 + L1076-1131 + tree fallback | tight startup | yellow |
| 6 | Interactive demos engine | `app.js` L7825-11842 (~4000 lines) | moderate | yellow |
| 7 | Lesson rendering + page pagination | `app.js` L7518-7823 + L12189-12814 + L15310-15602 | tight | yellow |
| 8 | Learn-mode shell + layout state machine | `app.js` L13708 + L14265-14817 | tight | yellow |
| 9 | Section page maps + textbook viewer | `app.js` L13612-13685 + L14833-14915 + 3 root JSONs | loose subsystem, hard constraint on JSON location | yellow |
| 10 | KC Quiz Modal (Knowledge Check) | `app.js` L15606-16737 (1100-line IIFE) | cross-IIFE via window.* | yellow |
| 11 | v1.2.3 UI Friction Fix Pack | `app.js` L19840-20249 + `style.css` L47659-47865 + test | tight to file-end position | green |
| 12 | Auth + return-intent state machine | `app.js` L147-855 + `index.html` Clerk script | moderate | yellow |
| 13 | Mistake Notebook | `app.js` L1779-2270 + `index.html` L2663-2772 + style.css | moderate | green |
| 14 | Homework subsystem | `app.js` L1288-1778 + `ws-bridge.js` L1801-1843 + /api/homework | moderate | yellow |
| 15 | Course Tracker | `app.js` L1154-1286 + `index.html` L2598-2661 | loose, self-contained | green |
| 16 | Recent Conversations persistence | `app.js` L18653-19200 | moderate | yellow |
| 17 | Attachments + DOCX extraction | `app.js` L3216-3760 + `ws-bridge.js` L2006-2090 | loose | yellow |
| 18 | Web search orchestration | `ws-bridge.js` L2287-3027 | loose | green |
| 19 | Python plotting subprocess pipeline | `ws-bridge.js` L171 + L5670-5743 + `process-python.js` + `matplotlib_gen.py` | loose (already extracted boundary) | green |
| 20 | Static-data islands | `app.js` L156-175, L1156-1196, L2426-2488, L3822-7836, L5251-5604 (~4500 lines) | tight by file location only | yellow |
| 21 | Send / Q&A pipeline | `app.js` L15113-15265 + L17635-17992 + /api/ask + /api/intent | tight (sendQuestion = 200 lines) | yellow |
| 22 | View shell + sidebar + TOC | `app.js` L16740-17390 + `index.html` L1799-2768 | tight (every view touches every other) | yellow |
| 23 | Markdown engine + math preprocessing | `app.js` L15310-15602 + `index.html` L3070-3130 | loose, pure functions, single-direction | green |
| 24 | Static file serving + CDN proxy | `ws-bridge.js` L1747-1843 + L6533-6810 | loose | yellow |
| 25 | Frontend release ritual + cache-bust | `index.html` L70/L1887/L2484/L3144-3145 + package.json × 2 + `app.js` SECTION_PAGE_MAP_VERSION | manual, no automation | **red** |

## Dead Code (concrete numbers)

- **CSS**: ~2,953 lines confidently dead (**6.2% of style.css**). Largest deletion win = `.homework-*` family (~30+ rules, ~1200+ body lines across multiple duplicated blocks — entire homework legacy class namespace appears dead, suggesting removed/renamed view path)
- **JS**: **27 unreferenced top-level functions** (~19 in app.js, ~7 in ws-bridge.js)

### Confirmed-dead inventory

**ws-bridge.js orphans (cleanest cluster — 7 helpers + 1 legacy):**
- `_legacyGenerateSectionLesson` L5629 — explicitly `/** kept for reference, not used */`
- `buildFallbackBlueprint` L5511 — 160+ lines, no callers, orphaned with legacy generator
- `loadExternalBlueprint`, `prewarmLessonVariants`, `sectionIdToBlueprintCandidates`, `buildSyntheticProfileMemory`, `runPython3`, `getActiveSectionPageMap`, `renderedBlockStartsWithKnowledgeHeading` — 7 helpers with zero in-file references
- **Duplicate dead `/generated/` route at L6800** (the one at L6717 wins)

**app.js orphans (~19 functions):**
`createIntroCosmos` (stub), `renderHyperknowLinks`, `prepareLearnReturnTarget`, `homeworkPreviewText`, `fallbackLocalUid`, `isB73VectorOperationsSection`, `getPrimaryAnchorLabel`, `createVisualChip`, `drawInteractiveDemoArrow`, `drawInteractiveDemoRoundedRect`, `ensureOverviewPreludePagination`, `openLearnFocusMode` (close-side wired, open-side orphan), `toggleLearnChatPanel`, `shrinkLearnQaToPopover`, `toggleLearnExplainPanel`, `buildOverviewSubsectionChooserHtml`, `buildTocFromSyllabus`, `renderExplanation`, `startStepAnimation`

**Duplicate-logic risk (silent drift):**
- `compactWhitespace`, `sortSourcesByType`, `sourceTypeRank` defined identically in **both** `app.js` AND `ws-bridge.js`
- `readAsDataUrl` (app.js:3641) and `readFileAsDataUrl` (app.js:1830) — two FileReader→dataURL helpers in app.js alone

**Static-data bloat:**
- `SECTION_PREVIEWS_NEW` duplicates every entry under full "X.Y Title" key AND bare "X.Y" alias key — doubles size of an already ~1000-line constant

**Dead CSS specifics:**
- `.homework-*` family (~1200 body-lines, multiple duplicated blocks) — largest single deletion win
- `.learn-chat-empty-icon` (8 occurrences, 62 body-lines) + `.learn-chat-empty-prompts` (6 occurrences, 44 body-lines) — stale Learn chat empty-state
- `.toc-sidebar` / `.toc-header-label` (~60 body-lines) — replaced by `.toc-nav` / `.toc-item`
- `.course-tracker-table`, `.chapter-overview-summary-details`, `.learn-lecture-page-indicator`, `.learn-mini-toggle`, `.login-washi-tape`, `.login-status-pill` — unambiguously orphaned

**Other dead artifacts:**
- `tools/tutor_craft.py` — one-shot CSS migration script, no callers, already ran
- `docs/legacy/CODEX_PROJECT_GUIDE.md` — contradicts CLAUDE.md (pre-rename paths, Opus vs Sonnet)
- `pptxgenjs` and `ws` npm deps — declared but no `require/import` anywhere
- `guest_qh2romk1.json` in `app/users/` — zero-byte memory file

**Waste (not dead but inefficient):**
- `process.env` mutated on every `getOpenAIKey/getOpenRouterKey` call by re-reading `app/.env` — repeated FS reads per LLM call

## Extraction Candidates — Ranked

### Tier 1: Low risk, immediate wins (do first)

| # | Candidate | Location | Lines | Effort | Payoff |
|---|---|---|---|---|---|
| 1 | **Markdown rendering engine** | `app.js` L15310-15600 | 290 | one-PR | **LARGE** ★ unlocks 4 downstream extractions |
| 2 | **Static-data extractions** (`DEFAULT_PREFERENCE_PROFILE`, `SECTION_PREVIEWS_NEW`, `syllabusData*`, `QUIZ_QUESTIONS`, course tables) | `app.js` L156-175 / L1156-1196 / L2426-2488 / L3822-7836 / L5251-5604 | **~4,500** | one-PR per island | **LARGE** (biggest app.js LOC win) |
| 3 | **UI Friction Fix Pack v1.2.3 CSS** | `style.css` L47659-47865 | 207 | one-PR | medium |
| 4 | **RAGFlow retrieval sidecar client** | `ws-bridge.js` L3054-3215 | 175 | one-PR | medium |
| 5 | **User memory + feedback IO** | `ws-bridge.js` L1434-1747 | 314 | one-PR | medium |
| 6 | **LLM client wrappers** (`callOpenRouterChat`, `callOpenAIChat`, JSON repair, env key getters) | `ws-bridge.js` L143-152 + L2092-2286 | 210 | one-PR | medium |
| 7 | **Lesson cache reader/writer + filename hygiene** | `ws-bridge.js` L1209-1432 | 224 | one-PR | LARGE (centralizes the load-bearing cache key) |
| 8 | **Static-file route handlers** | `ws-bridge.js` L6533-6810 | 278 | one-PR | small (deletes dead L6800 duplicate) |
| 9 | **Search helpers** (DuckDuckGo + Wikipedia + Wikimedia + reference-image) | `ws-bridge.js` L2546-2810 | 265 | one-PR | medium |
| 10 | **Login intro / cosmos / landing experience** | `app.js` L41-126 + L498-639 + `index.html` L1603-1797 | 350 | one-PR | medium |
| 11 | **Inline `<style>` in index.html** | `index.html` L73-1600 | 1,528 | one-PR | medium |
| 12 | **Section preview data + syllabus helpers** | `app.js` L13991-14066 | 76 | one-PR | small |
| 13 | **Splash + loading UI** | `app.js` L13745-13785 | 41 | one-PR | small |
| 14 | **Web sources rendering** | `app.js` L13841-13983 | 143 | one-PR | small |
| 15 | **Build orchestration + package script consolidation** | package.json + app/build-section-page-display-map.js | small | one-PR | small |

### Tier 2: Few-PRs, medium risk

| # | Candidate | Location | Lines |
|---|---|---|---|
| 16 | Interactive demos subsystem (split per family) | `app.js` L7825-11842 | 4,018 |
| 17 | Mistake Notebook subsystem | `app.js` L1779-2270 + `index.html` L2663-2772 | 491 |
| 18 | Homework subsystem | `app.js` L1288-1778 | 491 |
| 19 | Preference profile subsystem | `app.js` L1007-1152 + L2271-2399 | 274 |
| 20 | Attachments pipeline (core + UI split) | `app.js` L3216-3760 | 545 |
| 21 | Clerk auth + return-intent state machine | `app.js` L147-855 | 700 |
| 22 | Recent-conversations storage subsystem | `app.js` L18653-19200 | 547 |
| 23 | Glassmorphism + chapter overview CSS blocks | `style.css` L31257-33421 + L33422-47658 | **16,402** |

## Hard Constraints (20)

1. **Node built-in modules only** in `ws-bridge.js` — no Express, no fastify. Routes are `if (pathname === ...)` blocks in one request handler.
2. **Renderer = `anthropic/claude-sonnet-4.6`** (cost/quality decision). DO NOT silently upgrade to Opus. Planner = `gpt-5.5`. Any LLM-client extraction must keep model id as caller-passed parameter, never module default.
3. **`aquarius_visual_latex_v2` (LESSON_CACHE_VERSION)** — on-disk file suffix. Renaming invalidates every cached lesson, triggers "section has not been prepared yet" for every section.
4. **`AQUARIUS_CONFIG` global** — load-bearing for deployed frontend config (apiBase routing). Renaming invalidates every deployed frontend config until cache is busted.
5. **JSON maps MUST stay at `app/` root** and be loaded by root-relative path. Moving to subfolders silently breaks the UI: `section-page-map.json`, `section-page-map-new.json`, `section-page-map-display-new.json`, `section-page-anchor-new.json`, `section-figure-map-new.json`.
6. **Windows-illegal filenames forbidden**: never create files with `: | ? * < > "` — legacy lesson-cache sanitized in commit `e269436`.
7. **Do not delete Chapter 2 figure recrops**: `materials/new-book-figures/page-*-figure_2_*.png` + `new-book-ocr/page-150..223.meta.json` (mirrored in `workspace/`).
8. **Render port 9000**; **Vercel serves `app/` statically**; push to `origin/main` auto-deploys Vercel in ~1 min. Releases bump `app/index.html` sidebar (L1887) + Settings (L2484) version chips AND `app.js?v=` / `style.css?v=` query params AND 3 package.json versions together.
9. **`vercel.json`**: NEVER add `'public:'` field. Deprecated v2 schema field — symptom is rising `age` header + `x-vercel-cache:HIT` (looks like CDN lag but means no artifact was produced). Playbook: central-db `knowledge/vercel-json-public-deprecated.md`.
10. **Materials resolution fallback chain**: `workspace/materials/` preferred over root `materials/`, validated by **content presence** (existence of `new-book-ocr/` or `background-ocr-v3/`) — NOT a single env var.
11. **`TUTOR_PYTHON_BIN`** default is macOS path — WSL/Linux/Windows users MUST set explicitly or matplotlib/skill subprocess calls fail.
12. **`OPENROUTER_API_KEY` required** for any LLM call. `OPENAI_API_KEY` optional (falls back to OpenRouter).
13. **Lesson cache miss** returns "This section has not been prepared yet." — NO live generation fallback.
14. **"重新生成" rule**: locate the file the app actually hits (`workspace/materials/lesson-cache/` in practice), DELETE it, then regenerate. Never patch a stale copy.
15. **Teaching design rules** (every concept gets an example; visual priority: interactive demo > curated image > generated image > LaTeX > text; exam-oriented brevity). Lesson-generation prompt changes must respect these.
16. **MathJax `window.preprocessMath`** is a documented module boundary defined inline at `index.html` L3070-3130. Don't bundle into app.js — inline location guarantees it's defined before any module that imports markdown.js runs.
17. **`process-python.js`** is the clean factoring boundary already extracted (required at `ws-bridge.js` L171). Do not further split sandbox wrapping vs code normalization.
18. **`loadLocalEnvFile` + `.env` parser** must stay as Node built-ins only (no dotenv). <25 lines, security-relevant.
19. **Three package.json versions** must bump together at release (root + workspace + index.html cache-buster). `workspace/package.json` has drifted (missing `pregen:bg-ch1` script + playwright devDep) and must be brought back in sync.
20. **`/api/intent` triage path** (PR #14, commit `28f77bd`) is the only frontend caller of the casual-turn fast-path contract — removing/moving changes the backend-frontend contract.

## Integration Contracts (21 frozen + 4 not-frozen)

Frozen — DO NOT change without explicit owner sign-off:
- `AGENT_B_MODEL = anthropic/claude-sonnet-4.6` (ws-bridge.js:3639)
- `AGENT_A_MODEL = gpt-5.5` (ws-bridge.js:3639)
- `LESSON_CACHE_VERSION = 'aquarius_visual_latex_v2'`
- `AQUARIUS_CONFIG` global
- Lesson cache filename pattern: `<materials>/lesson-cache/<normalizedSectionId>/<bookSource>__[parent_prelude__]aquarius_visual_latex_v2.en.md`
- 5 root-relative JSON maps
- Render port 9000
- Vercel static deploy of `app/` (no `public:true`)
- RAGFlow sidecar contract (`RAGFLOW_*` env, `POST {base}/api/v1/retrieval`)
- Env var roster (see Appendix A)
- Materials directory resolution (workspace-preferred via content presence)
- Lesson cache miss semantics (no live generation)
- Lesson cache directory layout (`workspace/` has 173 dirs live, root has 42 stale)
- Static asset paths (`/pages`, `/new-pages`, `/old-pages`, `/figures`, `/generated`, `/homework-assets`)
- Python subprocess boundary (`MPLBACKEND=Agg`, `TUTOR_IMAGE_ONLY=1`, balanced-paren `savefig` rewrite)
- Local storage keys (12 of them — see Appendix B; renaming any loses student data)
- `window.__ftutor*` helper contract (consumed by KC Modal IIFE — see Appendix C)
- HTTP API routes on ws-bridge (13 endpoints)

Not-frozen (can change with care):
- HTTP API routes (the if-pathname pattern is frozen, the specific routes aren't)
- Frontend cache-bust scheme (must bump together but the strings themselves are mutable)
- Clerk publishable key (currently hardcoded `pk_test_…` inline — rotating requires code push)
- OpenAI direct API (optional fallback)
- `/api/intent` triage contract (recent addition, may iterate)

## Contradictions (8 detected)

1. **`docs/sync-policy.md` STALE.** Says root `materials/` is runtime tree; `ws-bridge.js` L86-92 prefers `workspace/materials/`. CLAUDE.md and code agree on workspace-preferred behavior. Doc disagrees with both.
2. **`docs/WINDOWS_RAG_HANDOFF.md` STALE.** Uses env vars `WINDOWS_RAG_URL` / `WINDOWS_RAG_ENABLED`; CLAUDE.md and ws-bridge.js use `RAGFLOW_*`. Names no longer match live integration.
3. **`PROJECT_STRUCTURE.md` INCOMPLETE.** Describes layout as if root `app/` and root `materials/` are primary, omits the workspace-preferred fallback that CLAUDE.md flags as "the most important non-obvious behavior."
4. extractionSeams report claims app.js has ~409 top-level functions, but per-chunk inventories total ~370 declarations. Approximate — chunked reports count `declarations` not just `function`.
5. `_legacyGenerateSectionLesson` is flagged dead by deadJsReport AND wsBridge report — both agree, but it survives in source as a documented reference (`/** kept for reference, not used */`) rather than oversight. Safe to delete.
6. `.homework-*` CSS family flagged dead, but app.js has an active homework subsystem. The CSS uses different naming (legacy class names); JS uses `#homeworkView`, `.homework-set-select`, etc. So "dead CSS" = "no-longer-referenced legacy class names," NOT "feature deleted."
7. `renderUserBadge` XSS risk: appJs_1_5000 phrases it as "via uid substring" in one place and "via currentUser.name" in another. Both fields are interpolated into HTML.
8. Severity framing for syllabus rendering's HTML-escaped data attribute round-trip: one chunk says "fragile," another says "a real hack." Both note the same fragility.

## Cross-Cutting Risks (22)

1. **Cache invalidation**: renaming `LESSON_CACHE_VERSION` or `AQUARIUS_CONFIG` invalidates every cached lesson or deployed frontend config. NEVER rename in refactor PRs.
2. **Sync-policy drift between code and docs.** Contributor following `docs/sync-policy.md` could ship to root and see no effect.
3. **Cascade order is the CSS correctness mechanism.** 16,760 `!important` + duplicated-ID hacks mean any reordering across blocks flips rendering. CSS extractions MUST preserve load order: original sections → late fix-pack ledger → newest fix-pack last.
4. **Runtime CSS injection from app.js fights cascade precedence** (comments at style.css L36390 + L45961 confirm app.js writes `<style>` tags at runtime). Extracted sheets that load in different order have different precedence — verify with live DOM, NOT static order.
5. **Module load order risk for app.js extractions.** Most subsystems read top-level globals (`currentUser`, `userMemory`, `tutorState`, `attachments*`) and reference functions hundreds/thousands of lines later. Top-level `addEventListener` and `DOMContentLoaded` handlers in 3 locations mean boot order is fragile.
6. **DOM handles captured at script-load** mean any HTML restructure that delays mount silently turns a feature off. The `|| { textContent: '' }` fallback masks failure.
7. **No CSS lint, no visual regression.** `npm run check` only runs `node --check`. Only 2 Playwright e2es (`test-lesson-open-no-hang.js`, `test-ui-friction-v123.js`).
8. **Cache-bust scheme is inconsistent and unautomated.** `?v=1218` for style.css/app.js, `?v=1778524701` for config.js, `?v=1778674347` for logo.png. Easy to ship a half-updated release.
9. **Cross-IIFE `window.__ftutor*` communication** between KC Modal IIFE (L15606-16737) and v1.2.3 fix pack IIFE (L19840-20249) means script ordering matters. Reordering or extracting silently breaks the KC modal end-state Next button (`typeof` check fallback hides failure).
10. **Renaming/relocating 5 JSON section maps** also invalidates `SECTION_PAGE_MAP_VERSION` cache buster strategy and `build-section-page-display-map.js` path constants. Touch them together or not at all.
11. **Vercel deploy schema landmine** (`public:true`). Half-formed extraction PR merged to main IS the deploy — ~1 min push-to-prod, no preview gate.
12. **Materials disk waste** (~115 MB duplicated between root and workspace trees) slows Windows GitHub Desktop checkout, amplifies merge-conflict risk on lesson-cache changes.
13. **Render free-tier ceilings**: 35 MB JSON body cap, pdftotext + pdftoppm subprocess timeouts, Python matplotlib timeouts. Refactor introducing new request-time work could push p95 past ceiling.
14. **Materials drift**: 204 lesson-cache entries only-in-workspace, 3 only-in-root. Regenerate workflow per CLAUDE.md requires locating file the app actually hits — automation must target `workspace/`.
15. **Python subprocess macOS-only default**: `TUTOR_PYTHON_BIN` confusing ENOENT for any Windows/WSL contributor not setting it.
16. **Chapter 2 figure recrop protection**. Any cleanup PR (especially deleting "stale" root `materials/`) risks deleting these protected assets.
17. **`matplotlib_gen.py` uses `eval()`** on `functions[].expr` from JSON spec (with `__builtins__` stripped). Spec originates from LLM — any path letting user input flow into `functions[].expr` becomes arbitrary-code-exec surface.
18. **Hardcoded Clerk publishable key** in source — rotating requires code push, not config push. If dev/prod keys ever need to differ at runtime, current architecture forces build-time decision.
19. **`process.env` re-read on every LLM call** (`loadLocalEnvFile()` in `getOpenAIKey`/`getOpenRouterKey`) — rapid LLM calls do extra FS work; any concurrent `.env` write could partially corrupt env.
20. **Live RAGFlow sidecar contract partially mismatched** with `docs/WINDOWS_RAG_HANDOFF.md` env var names. New contributors following docs may misconfigure.
21. **Workspace-only runtime dependencies**: `prompts/agent-a-planner.md`, `prompts/agent-b-tutor.md`, `new-book-section-ocr/`, `background-ocr-v3/`, `background-pages-split/`, `exam-priority/`, `formula-catalog/` are all read by the running bridge but **exist only under `workspace/materials`**. Deleting `workspace/materials/` thinking it's a workbench breaks the app.
22. **Top-level mutation of `process.env`** also means refactoring `loadLocalEnvFile` to a per-process-start call (not per-LLM-call) is a behavioral change that could surprise hot-reload-during-dev workflows.

## Open Questions for FlyM1ss (20)

**Priority 1 (foundational — gates other decisions):**
1. **Materials-tree authority.** Pick a single source of truth: (a) update `docs/sync-policy.md` + `PROJECT_STRUCTURE.md` to match `workspace>root` reality and delete stale root `materials/` (saves ~115 MB, removes "wrong tree" footgun), OR (b) align code with existing doc by removing workspace-preferred branch in `resolveExistingDir()` and consolidating to root.

**Priority 2 (affects multiple extractions):**
2. Are the 19 dead app.js functions safe to delete, or do any get invoked via server-rendered markdown `onclick="..."` strings the static grep misses?
3. Is the KC Modal IIFE ↔ v1.2.3 fix pack IIFE `window.__ftutor*` channel intentional or refactor target?
4. Should the old book (2nd Edition, OCR_DIR_OLD path) still be selectable in UI, or retired? If retired: ~61 keys + 209 background-ocr-v3 files + 104 background-pages-split files + `syllabusDataOld` branch become removable.

**Priority 3 (cleanup decisions):**
5. Workspace/package.json drift (missing `pregen:bg-ch1` + playwright) intentional or accidental?
6. `tools/tutor_craft.py` (one-shot CSS migration, already ran) — delete or archive to `.local/`?
7. The 71 figures in `workspace/materials/new-book-figures/` not in root — mirror or update policy?
8. `docs/legacy/CODEX_PROJECT_GUIDE.md` delete or keep as historical?

**Priority 4 (behavioral curiosities):**
9. In-page bottom-right pagination pill experiment fully reverted? (recent commits 7c227b7, f360c4c)
10. `shouldOpenSectionAsChapterOverview` (app.js:3778) always returns true when input non-empty — function name implies a conditional that no longer exists. Oversight or intentional?
11. Two `clerkInstance.addListener` calls in `initClerk` (app.js:749, 846) likely fire `onUserSignedIn` twice — visible duplication or just wasted API calls?
12. `decorateLectureContent` uses Chinese/English substring matching on heading text to wrap content into typed cards — test fixture/visual regression that catches when lesson-generation prompt changes wording?
13. `process.env` re-read on every LLM call — intentional (hot-reload) or leftover?
14. `extractWordTextFromDocumentXml` uses regex to strip XML tags — swap to real parser, or 100k char cap considered sufficient safety?
15. Inline `onmouseover/onfocus/onblur` handler pattern (CSP-unfriendly) — pinned or migrate to event listeners?
16. Clerk publishable key rotation — code push (current) or env injection at static-serve layer?
17. When lesson-generation prompt changes — full cache clear, or `LESSON_CACHE_VERSION` bumps the invalidation mechanism?
18. `/api/intent` triage (PR #14) — accuracy being measured? Rollback story if it skips a turn that should have been grounded?
19. Duplicate dead `/generated/` route at `ws-bridge.js:6800` — safe to delete or any use case?
20. 1528-line inline `<style>` in index.html — move to fix-pack-style separate sheet, or is its inline location load-bearing for first-paint of intro landing?

## Synthesis's Suggested Next Step (verbatim)

> Before any refactor, settle the materials-tree direction: pick a single source of truth (workspace/materials/ given it's already the runtime de facto) and either
>
> (a) update `docs/sync-policy.md` and `PROJECT_STRUCTURE.md` to match the workspace>root reality and delete the stale root `materials/` subtree (saving ~115 MB and removing the 'wrong tree' footgun), or
>
> (b) align the code with the existing policy doc by removing the workspace/-preferred branch in `ws-bridge.js resolveExistingDir()` and consolidating to root `materials/`.
>
> This is the most foundational decision because (1) it determines where 重新生成 actually writes, (2) it gates the lesson-cache extraction since `LESSON_CACHE_DIR`'s path constant needs to be unambiguous, (3) it unblocks any future automation of the npm scripts (`build:materials` chain), and (4) it removes the contradiction between the most-authoritative doc (CLAUDE.md) and the policy doc — a contradiction that would otherwise propagate into every PR review.

---

## Appendix A — Env var roster

Required:
- `OPENROUTER_API_KEY`
- `TUTOR_PYTHON_BIN` (no working default on Linux/WSL/Windows)

Optional:
- `OPENAI_API_KEY` (falls back to OpenRouter)
- `PORT` (default 9000)
- `TUTOR_AGENT_A_MODEL`, `TUTOR_AGENT_B_MODEL`
- `TUTOR_MAX_JSON_BODY_BYTES` (35 MB)
- `TUTOR_PDF_TEXT_MAX_CHARS` (120000)
- `TUTOR_PDF_VISUAL_PAGE_LIMIT` (3)
- `TUTOR_SKILL_SCRIPT`, `TUTOR_SKILL_TIMEOUT_MS` (45000)
- `PDFTOTEXT_BIN`, `PDFTOPPM_BIN`
- `SERPER_API_KEY`
- `RAGFLOW_ENABLED`, `RAGFLOW_BASE_URL`, `RAGFLOW_API_KEY`, `RAGFLOW_PROXY`, `RAGFLOW_DATASET_IDS`, `RAGFLOW_DOCUMENT_IDS`, `RAGFLOW_TOP_K` (8), `RAGFLOW_PAGE_SIZE`, `RAGFLOW_TIMEOUT_MS` (8000), `RAGFLOW_SIMILARITY_THRESHOLD` (0.2), `RAGFLOW_VECTOR_SIMILARITY_WEIGHT` (0.5), `RAGFLOW_RETRIEVAL_PATH` (`/api/v1/retrieval`)
- `PREGEN_CONCURRENCY` (4)

## Appendix B — localStorage keys (renaming any loses student data)

- `tutorBook` (book selection)
- `tutorRecentSessions` (max 30 sessions)
- `aquarius-learn-split` (explain/chat ratio, `DEFAULT_SPLIT_VERSION` reset key)
- `aquariusCompletedSubsections.v1` (v1.2.3 fix pack completion store; dispatches `ftutor:completion-changed` event)
- `tutorQuiz`
- `INTRO_LANDING_SEEN_KEY`
- `THEME_STORAGE_KEY`
- `COURSE_TRACKER_STORAGE_KEY`
- `HOMEWORK_STORAGE_KEY`, `HOMEWORK_EXPLANATION_STORAGE_KEY`
- `MISTAKE_NOTEBOOK_STORAGE_KEY`, `MISTAKE_NOTE_SPLIT_STORAGE_KEY`

SessionStorage:
- `kcQuizProgress_v1` (KC modal in-flight)
- `AUTH_RETURN_INTENT_KEY`, `AUTH_RETURN_TARGET_KEY`

## Appendix C — `window.__ftutor*` helper contract

Exposed by v1.2.3 fix pack IIFE (app.js:19840-20249), consumed by KC Modal IIFE kcNextBtn handler (app.js:16479-16488). Removing or renaming silently breaks the KC modal end-state Next button (typeof check fallback hides failure).

- `window.__ftutorMarkCompleted`
- `window.__ftutorIsCompleted`
- `window.__ftutorApplyCompletionIndicators`
- `window.__ftutorPeekNextSubsection`
- `window.__ftutorAdvanceSubsection`
- `window.__ftutorRetreatSubsection`
- `window.__ftutorRefreshPager`

## Appendix D — Workflow run metadata

- Workflow name: `codebase-map-discovery`
- Run ID: `wf_e3ed2630-c06`
- Initial task: `wbsmfc3n8` (9/15 inventory agents succeeded; synth ran with partial data)
- Resume task: `wylsvupzp` (all 15 inventory + cross-ref succeeded; synth re-ran with full data)
- Total agent count: 16 + 16 = 32 across both runs
- Total subagent tokens: ~3.1 M across both runs
- Script: `/home/flymiss/.claude/projects/-mnt-d-Github-fourier-tutor-agent/fbaa6726-52f1-4c76-81b7-d053082c62df/workflows/scripts/codebase-map-discovery-wf_e3ed2630-c06.js`
- Full synthesis output: `/tmp/claude-1000/-mnt-d-Github-fourier-tutor-agent/fbaa6726-52f1-4c76-81b7-d053082c62df/tasks/wylsvupzp.output`
- Superseded partial map: `workspace/memory/codebase-map-2026-06-19-partial.md`
