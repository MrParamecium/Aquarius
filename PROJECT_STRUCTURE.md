# Project Structure

This file describes the organized project layout after the first cleanup pass on 2026-05-15.

## 当前运行结构（2026-07-31）

下面这段是本分支当前事实；后面的英文段落保留历史清理记录，不再作为运行时设计依据。

```text
app/
├── index.html                  页面结构、课程栏、教材聚焦和工具栏入口
├── app.js                      首页问答、课程问答、会话编号和页面状态编排
├── style.css                   全局主题、课程布局、引导卡片和响应式样式
├── ws-bridge.js                单 Node HTTP 服务、鉴权、问答和会话 API
├── guidance-service.js         整本教材检索并生成本轮讲解路径
├── guidance-mode.js            引导开关、选项、选择、取消和错误状态
├── user-memory.js              只保存用户主动填写的教学要求
├── db.js                       本地文件/Neon 用户记忆与真实会话存储
├── lesson-cache.js             唯一课程缓存读取、格式校验和明确 cache miss
├── lesson-render.js             课程正文、分页、图表和交互演示渲染
├── recent-conversations.js     登录用户服务端会话与访客浏览器会话入口
├── textbook-focus.js            教材原页聚焦和教材问答镜像
├── ragflow-client.js            可选 RAGFlow 教材检索
├── search-helpers.js             本地 OCR/教材索引检索辅助
├── section-*.json               新教材章节、页码、锚点和图像映射
├── data/                        课程元数据与教学大纲
└── interactive-demos/           按知识点分发的交互演示

workspace/materials/
├── new-book-ocr/                新教材 OCR 原文
├── new-book-section-ocr/        章节级 OCR 索引
├── new-book-pages/              原书页图
├── new-book-figures/            章节图像
├── formula-catalog/             公式目录与校验信息
├── lesson-cache/                176 份唯一正式缓存：162 普通课程 + 14 parent_prelude
└── prompts/                     课程正文生成所需的既有 Prompt

tools/
├── migrate-user-memory.js       旧用户记忆预览/备份/清理工具
├── migrate-unified-lesson-cache.js 统一缓存迁移工具
├── check-unified-lesson-cache.js   课程缓存集合与格式检查
├── test-ask-guidance.js         服务端引导契约测试
├── test-guidance-ui.js          引导 UI 与手机课程工具栏测试
├── test-session-continuity.js   会话创建、追加、隔离和失败测试
├── test-session-frontend-contract.js 前端会话编号契约测试
├── test-auth-guard.js           Bearer Token 与路由门禁测试
├── css-probe.js                 计算样式回归探针
└── test-utils.js                Playwright 测试公共辅助
```

### 三条核心数据边界

- **全局教学要求**：用户主动在设置页填写，登录用户写入 `/api/memory`，访客只写当前标签页；不自动从问答推断。
- **真实会话**：登录用户以服务端 `chat_sessions` 和 `session_id` 为真源，访客只使用浏览器会话；引导选项不进入会话消息或长期要求。
- **课程与引导**：课程正文只读取统一 `aquarius_visual_latex_v2` 缓存；引导开启后先走 `/api/ask-guidance`，选择/跳过后再走正式 `/api/ask`。

## Runtime App

```text
app/
├── index.html
├── app.js
├── style.css
├── ws-bridge.js
├── process-python.js
├── matplotlib_gen.py
├── config.js
├── css/
├── data/
├── interactive-demos/
├── scripts/
├── section-page-map-new.json
├── section-page-map-display-new.json
├── section-page-anchor-new.json
└── section-figure-map-new.json
```

`app/` is the running application. Some assets and map files still live at the UI root because the existing frontend and bridge load them from root-relative paths. `debug/`, `generated/`, and `users/` are git-ignored runtime directories the bridge recreates on demand (transient guest sessions live in `users/`); they are intentionally absent from the tracked tree even though earlier cleanup passes archived their old payloads.

## Runtime Materials

The running app reads materials from **`workspace/materials/`** (resolved by
`app/ws-bridge.js:86` `resolveExistingDir`) — the **single materials tree since 2026-07-05**,
when the root `materials/` legacy backup mirror was removed (owner decision; see
`docs/sync-policy.md` for the removal record and the historical two-tree policy).

Canonical tree (read by the bridge):

```text
workspace/materials/
├── new-book-pages/
├── new-book-ocr/
├── new-book-section-ocr/
├── new-book-figures/
├── lesson-cache/                  (176 unified lesson files — live)
├── background-ocr-v3/
├── background-pages-split/
├── prompts/                       (agent-a-planner.md, agent-b-tutor.md, schemas)
├── exam-priority/
├── formula-catalog/
├── build_new_section_map.py
├── generate_chapter_ocr_local.py
└── extract_new_book_figs.py
```

The bridge validates the tree by the presence of `background-ocr-v3/` or `new-book-ocr/`
and **throws at startup** if validation fails — restore with `git restore workspace/materials`;
do not recreate a root `materials/` tree.

## Tools

```text
tools/
├── test-utils.js                  (shared Playwright helpers; required by the harness below)
├── test-utils.test.js             (unit smoke for test-utils; executed by `npm run check`)
├── visual-diff.js                 (pixel-diff harness, views across pages A/B/C)
├── visual-baseline/               (committed PNGs — the regression reference)
├── visual-current/ , visual-diff/ (last --check capture + per-view diffs; git-ignored)
├── visual-diff-report.md          (last --check pass/fail table; git-ignored)
├── visual-diff-coverage.json      (committed Page C family-routing audit record)
├── smoke.js , smoke-report.md     (deterministic UI smoke suite, ~12s; report git-ignored)
├── test-ask-guidance.js           (server-side guidance contract tests)
├── test-guidance-ui.js            (guidance state and mobile composer tests)
├── test-session-continuity.js     (server session continuity tests)
├── test-session-frontend-contract.js (front-end session source-of-truth tests)
├── migrate-user-memory.js         (explicit legacy memory cleanup; never auto-runs)
├── migrate-unified-lesson-cache.js (explicit cache migration tool)
├── check-unified-lesson-cache.js  (unified cache set/format checker)
├── css-probe.js                   (computed-style floor probe; run by `npm run check`)
├── css-probe-baseline.json        (committed proof artifact for css-probe --check)
├── css-probe-report.md            (last css-probe run output; regenerated each run, git-ignored)
├── find-dead-redeclarations.js    (dead-redeclaration validator; `npm run check`)
├── check-harness-exports.js       (asserts required window.* exports; `npm run check`)
├── test-lesson-open-no-hang.js    (legacy Playwright regression: lesson open must not hang)
├── test-ui-friction-v123.js       (legacy UI friction regression)
├── test-data-modules-shape.js     (assertion suite for app/data/*.js exports)
├── _extract-view-important.js     ┐  Phase-3.6 !important-strip arbiter toolchain.
├── _strip-view-important.js       │  Excluded from `npm run check` by design (see CLAUDE.md)
├── _grow-keep-from-report.js      │  but documented in .trellis/spec/css/* as the reusable
├── _view-cascade-probe.js         ┘  strip procedure and still named in open backlog items
├── _keep-important.json           ┐  committed load-bearing cascade state (see .gitignore
├── _view-important.json           ┘  comments); required by the reusable strip loop.
├── _view-cascade-baseline.json    (~360M regenerated baseline; git-ignored)
├── _view-cascade-report.md        ┐  arbiter flip reports; regenerated each
├── _allstrip-flips.md             │  arbiter run (git-ignored)
├── _refine1-flips.md              ┘
├── scan-unused-css.js             (dormant CSS orphan-selector finder; not wired into check)
└── unused-css-report.md           (last scan-unused-css.js output; git-ignored)
```

`tools/` contains Playwright e2e regression scripts. These are not the app entry point and require `npx playwright install chromium` before they run.

`visual-diff.js` and `smoke.js` share their Playwright helpers (`enterGuestMode`, `openSubtopic`, `MASK_CSS`, `settleLesson`, the `resolveLessonCachePath` workspace-preferred materials chain, etc.) via `test-utils.js`. The split rule is intentional: visual-diff-specific helpers (the Page C family-routing walker, the syllabus-close-for-capture helper, the PNG diff core) live in `visual-diff.js`; anything a second tool can reuse belongs in `test-utils.js`. Adding a new shared helper without a second consumer is premature centralization — keep it module-private until a real reuse case appears.

To baseline the harness against the current code: `node tools/visual-diff.js --baseline` (writes PNGs into `tools/visual-baseline/`; commit them). To check current state vs the committed baseline: `node tools/visual-diff.js --check` (writes `tools/visual-current/` + `tools/visual-diff/` + the report files; exit 0 iff every view diffs under 0.5%). The full harness-design spec is `docs/superpowers/specs/2026-06-22-harness-expansion-design.md`.

## Working Materials And Memory

```text
workspace/
├── memory/
└── materials/
```

This directory is the broader workbench and the **canonical materials tree**: project memory,
the live materials/ subtree (read by the bridge), prompts and OCR data, and
extraction experiments. The running app uses root `app/` (UI + bridge code) and
`workspace/materials/` (assets). The former root `materials/` fallback mirror was
removed 2026-07-05 — see `docs/sync-policy.md`.

## Local-Only Files

```text
.local/
├── archive/2026-05-15-cleanup/
├── archive/2026-05-15-unused-candidates/
└── visual-audit-20260514/
```

`.local/` is intentionally ignored by Git. It keeps local historical files, visual audit sheets, generated images, local user data, logs, and one-off repair scripts available without making collaborators pull them.

## First Cleanup Pass

Moved into the local archive:

- `app/debug/`
- `app/generated/`
- `app/users/`
- `app/tmp-track-samples/`
- `app/backup-codex-20260505-034837/`
- `app/*.log`
- old one-off scripts such as `fix-html.py`, `fix-intro.py`, `insert_modal.py`, `pregenerate_test.js`, `test_process_python.js`, and `verify_section_visuals.py`
- root legacy notes and the old root `style.css` moved to `docs/legacy/`
- local visual audit sheets moved to `.local/visual-audit-20260514/`

Kept in place:

- running UI files
- Node bridge files
- material folders
- Chapter 2 recrops and metadata
- UI section maps
- scripts that are still location-dependent

## Second Cleanup Pass

Moved into `.local/archive/2026-05-15-unused-candidates/`:

- `workspace/root-scripts/`
- `workspace/tmp/`
- duplicate `workspace/tutor_craft.py`
- app mirror logs, backups, temporary track samples, debug output, generated output, local users data, and old one-off app mirror scripts
- empty local runtime directories `app/debug/`, `app/generated/`, and `app/users/`
- `.DS_Store` files removed

Kept `workspace/app-mirror/` as a lightweight code mirror for reference, but removed its local generated/debug/user payloads.

## Third Cleanup Pass (2026-07-05)

Driven by a 7-subsystem read-only audit with adversarial verification of every
removal candidate (Trellis task `07-04-repo-structure-cleanup`). Archived into
`.local/archive/2026-07-05-repo-structure-cleanup/` (46 files, all zero-reference,
reversible):

- superseded `app/` image assets: `latest_cover.png`, `fourier-logo.png`,
  `fourier-logo-original.png`, `aquarius-logo.svg`, `aquarius-logo.jpg`,
  `book-002-preview.png`, `book-003-preview.png`, `favicon.png` (live logo/favicon
  is `logo.png`)
- `app/clerk.browser.js` (Clerk loads from CDN; local copy was reverted 2026-04-16)
- `app/src/` (`SearchCitations.jsx` — dead React JSX in a no-build vanilla-JS app)
- `app/pregenerate-preference-cache.js` (superseded by `ws-bridge.js --pregen-section`
  + `app/scripts/pregen-background-chapter1.js`)
- `workspace/app-mirror/` (stale point-in-time code mirror; **supersedes the "Kept
  workspace/app-mirror/" note in the Second Cleanup Pass above** — it is no longer
  in the tracked tree)
- `workspace/FILE_LIST.txt`, `workspace/README_FULL_SCAN.txt` (one-off scan outputs)
- `HW/` (homework feature code was deleted in PR #36; only the asset dir remained)

Hard-deleted: `workspace/materials/scan-check.txt` (0-byte placeholder).

**Follow-up (2026-07-05, post-audit):** removed the drifted `workspace/package.json`
— a stale 2026-06-20 snapshot of the root manifest (19-file `check` script vs the
root's current one, unpinned playwright, no lockfile, no consumers). Owner confirmed
it was NOT an intentional lighter variant; archived to
`.local/archive/2026-07-05-workspace-pkg-drift/`. `workspace/` now contains only
`memory/` and `materials/`.

**Root `materials/` consolidation — image half DONE (PR #130, 2026-07-05).**
`.dockerignore` now excludes root `materials/` (plus `tools/`, `.local/`,
`.trellis/`, `docs/`) from the Render build context, so the image builds from
`workspace/materials/` only — copied context dropped 630M → 143M, deploy verified
healthy. `docs/sync-policy.md` "Future Cleanup" conditions (1)–(3) are satisfied
for the image. The repo-level `git rm` of the root `materials/` mirror was
initially deferred as a separate owner decision — **executed later the same day;
see the removal record below.**

**Still deferred — live-data grey-area in `workspace/materials/`:** 16 end-of-chapter
"Problems"-page figure crops (possible future practice-problems feature) and
byte-identical legacy cache version bumps. Left untouched to avoid risking the
canonical runtime tree for marginal tidiness.

**Housecleaning round (2026-07-05, post-audit):** archived the two remaining
lesson-cache grey areas after verifying both unreachable — `lesson-cache/0_5/`
(old chapter numbering; no section id starting with "0" exists in any of the four
app section maps, and the demos' `"0.5"` strings are slider attributes) and
`lesson-cache/_regen_backup/` (zero code references) — to
`.local/archive/2026-07-05-lesson-cache-grey/` (lesson-cache 173 → 171 dirs).
Also cleared git-ignored regenerables: `tools/_view-cascade-baseline.json`
(344M, regenerated by the arbiter loop), `.trellis/scripts/common/__pycache__/`,
and 1,804 harness-generated guest profiles from `app/users/` (all boilerplate
test guests from smoke/visual-diff runs, no owner data, empty `sessions/`;
archived to `.local/archive/2026-07-05-guest-sessions/`), then repacked loose
git objects (`git gc`).

**Root `materials/` mirror REMOVED (2026-07-05, owner-authorized):** verified
before removal — all 29 Chapter-2 recrop figures and the page-150..223 meta
files were byte-identical to the canonical `workspace/materials/` copies; only
3 stale `b_6*` legacy cache files existed nowhere else (archived to
`.local/archive/2026-07-05-root-materials-mirror/`); no runtime consumer ever
selected the root tree in a normal checkout, and the Render image already
excluded it (PR #130). 1,073 tracked files / ~107M of working tree removed.
`workspace/materials/` is now the single materials tree, and the CLAUDE.md
Chapter-2 protection constraint names it alone.

Structure verdict: no directory reorganization was warranted — the layout is
coherent and the app/ root maps/CSS/`logo.png` are load-bearing root-relative loads.

## Before Broad Edits

1. Read `workspace/memory/MEMORY.md`.
2. Read the newest files in `workspace/memory/`.
3. Run `npm run check`.
4. Avoid deleting Chapter 2 figure crops or metadata unless FlyM1ss explicitly asks.
