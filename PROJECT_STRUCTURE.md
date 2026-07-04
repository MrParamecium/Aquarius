# Project Structure

This file describes the organized project layout after the first cleanup pass on 2026-05-15.

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
├── scripts/
├── src/
├── section-page-map.json
├── section-page-map-new.json
├── section-page-map-display-new.json
├── section-page-anchor-new.json
└── section-figure-map-new.json
```

`app/` is the running application. Some assets and map files still live at the UI root because the existing frontend and bridge load them from root-relative paths.

## Runtime Materials

The running app reads materials from **`workspace/materials/`** by default (verified by
`app/ws-bridge.js:86` `resolveExistingDir`). Root `materials/` is a legacy fallback mirror kept for
backward compatibility — see `docs/sync-policy.md` for the full sync rules.

Canonical tree (read by the bridge):

```text
workspace/materials/
├── new-book-pages/
├── new-book-ocr/
├── new-book-section-ocr/
├── new-book-figures/
├── lesson-cache/                  (173 section directories — live)
├── background-ocr-v3/
├── background-pages-split/
├── prompts/                       (agent-a-planner.md, agent-b-tutor.md, schemas)
├── exam-priority/
├── formula-catalog/
├── build_new_section_map.py
├── generate_chapter_ocr_local.py
└── extract_new_book_figs.py
```

Legacy fallback mirror (kept but not currently read):

```text
materials/
├── new-book-pages/
├── new-book-ocr/
├── new-book-figures/
├── lesson-cache/                  (42 section directories — stale, 131 dirs behind workspace)
├── build_new_section_map.py
├── generate_chapter_ocr_local.py
└── extract_new_book_figs.py
```

The bridge prefers `workspace/materials/` when either `background-ocr-v3/` or `new-book-ocr/`
exists under it. Both subdirs exist in a normal checkout, so workspace wins. Writing to root
`materials/` has no runtime effect.

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
├── css-probe.js                   (computed-style floor probe; run by `npm run check`)
├── css-probe-baseline.json        (committed proof artifact for css-probe --check)
├── find-dead-redeclarations.js    (dead-redeclaration validator; `npm run check`)
├── check-harness-exports.js       (asserts required window.* exports; `npm run check`)
├── test-lesson-open-no-hang.js    (legacy Playwright regression: lesson open must not hang)
├── test-ui-friction-v123.js       (legacy UI friction regression)
├── test-data-modules-shape.js     (assertion suite for app/data/*.js exports)
├── fixtures/                      (committed test fixtures, e.g. feedback-board.populated.json)
├── _extract-view-important.js     ┐  Phase-3.6 !important-strip arbiter toolchain.
├── _strip-view-important.js       │  Excluded from `npm run check` by design (see CLAUDE.md)
├── _grow-keep-from-report.js      │  but documented in .trellis/spec/css/* as the reusable
├── _view-cascade-probe.js         │  strip procedure and still named in open backlog items
├── _probe-harness-gap.js          ┘  (docs/phase3_deferred.md) — NOT spent scaffolding.
├── _keep-important.json           ┐  committed load-bearing cascade state (see .gitignore
├── _view-important.json           ┘  comments); required by css-probe.js and the strip loop.
├── _view-cascade-baseline.json    (~360M regenerated baseline; git-ignored)
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
├── materials/
└── app-mirror/
```

This directory is the broader workbench and the **canonical materials tree**: project memory,
the live materials/ subtree (preferred by the bridge), mirrored prompts and OCR data, and
extraction experiments. The running app uses root `app/` (UI + bridge code) and
`workspace/materials/` (assets). Root `materials/` is a legacy fallback mirror — see
`docs/sync-policy.md`.

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

**Root `materials/` consolidation — image half DONE (PR #130, 2026-07-05).**
`.dockerignore` now excludes root `materials/` (plus `tools/`, `.local/`,
`.trellis/`, `docs/`) from the Render build context, so the image builds from
`workspace/materials/` only — copied context dropped 630M → 143M, deploy verified
healthy. `docs/sync-policy.md` "Future Cleanup" conditions (1)–(3) are satisfied
for the image. **Still deferred:** the repo-level `git rm` of the root `materials/`
mirror (~107M off *clone* size). It is retained as a backup mirror / startup
fallback net; deleting it is a separate owner decision with no further image
benefit (already excluded).

**Still deferred — live-data grey-area in `workspace/materials/`:** 16 end-of-chapter
"Problems"-page figure crops (possible future practice-problems feature),
byte-identical legacy cache version bumps, `lesson-cache/0_5` (old chapter
numbering), and `_regen_backup/`. Left untouched to avoid risking the canonical
runtime tree for marginal tidiness.

Structure verdict: no directory reorganization was warranted — the layout is
coherent and the app/ root maps/CSS/`logo.png` are load-bearing root-relative loads.

## Before Broad Edits

1. Read `workspace/memory/MEMORY.md`.
2. Read the newest files in `workspace/memory/`.
3. Run `npm run check`.
4. Avoid deleting Chapter 2 figure crops or metadata unless FlyM1ss explicitly asks.
