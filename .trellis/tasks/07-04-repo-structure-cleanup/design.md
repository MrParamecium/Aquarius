# Design — repo structure cleanup

## Classification model

"Unused" was split into two detection problems, because conflating them is how
cleanups delete live data:

- **Code/asset orphans** — reference-graph question, solved by grep across
  `index.html` `<script>`/`<img>`/`<link>`, `require()` graphs, `package.json`
  scripts, and the `npm run check` file list.
- **Data orphans** — runtime-resolution question, solved by reading
  `resolveExistingDir` (`ws-bridge.js:86-91`) and the legacy-cache fallback in
  `app/lesson-cache.js`, not by grep.

Every removal candidate then passed an adversarial skeptic prompted to *refute*
(find any reference / runtime path / policy that makes it needed). Only
`refuted:false` survivors are in scope.

## Boundaries — what moves, what stays

**Archive (Tier 1, 46 files → `.local/archive/2026-07-05-repo-structure-cleanup/`):**
- app/ orphan images: `latest_cover.png`, `fourier-logo.png`, `fourier-logo-original.png`, `aquarius-logo.svg`, `aquarius-logo.jpg`, `book-002-preview.png`, `book-003-preview.png`, `favicon.png` (all zero-ref; live favicon/logo is `logo.png`).
- `app/clerk.browser.js` (Clerk loads from CDN; local copy reverted 2026-04-16).
- `app/src/` (`SearchCitations.jsx` — dead React JSX in a no-build vanilla-JS app).
- `app/pregenerate-preference-cache.js` (superseded by `ws-bridge.js --pregen-section` + `pregen-background-chapter1.js`).
- `workspace/app-mirror/` (27 files, stale code mirror, memory note: "非运行时，勿从 mirror 同步").
- `workspace/FILE_LIST.txt`, `workspace/README_FULL_SCAN.txt` (one-off scan outputs, stale since May-15 rename).
- `HW/` (homework code deleted in PR #36; asset dir stranded).

**Delete:** `workspace/materials/scan-check.txt` (0-byte placeholder).

**Explicitly kept (skeptic-corrected or hard-constrained):**
- `workspace/package.json` — release lockstep with root.
- `docs/legacy/*` — read-only per REFACTOR_PLAN.md Rule 4.
- all `tools/_*` arbiter/strip scripts + `_keep-important.json`/`_view-important.json` — still named in open backlog items (`docs/phase3_deferred.md` §4/§18/§19) and load-bearing for `npm run check`.
- `tools/scan-unused-css.js` — dormant but documented as extensible tooling.

**Deferred (documented, not executed):**
- Root `materials/` consolidation (107M dead weight in the Render image). Pre-authorized by `sync-policy.md` once: (1) Dockerfile/`.dockerignore` switched to workspace-only, (2) no external consumer, (3) Ch-2 protection preserved. Condition (1) unmet today.
- Live-data grey-area: 16 Problems-page figure crops (possible future practice-problems feature), byte-identical legacy cache version bumps, `lesson-cache/0_5` (old numbering), `_regen_backup/`.

## Archive mechanic (why not `git mv`)

`.local/` is gitignored, so `git mv <tracked> .local/...` fails ("destination
ignored"). Instead: `mkdir -p` the mirrored dest, plain `mv` the bytes, then
`git add -A` to stage the removals-from-tracking. Result: tracked tree shrinks,
physical copies survive locally, git history intact → reversible.

## Structure verdict

The `app/ · materials/ · workspace/ · tools/ · docs/ · .trellis/` layout is
coherent and well-documented; **no directory reorg is worth its blast radius.**
app/ root maps/CSS/`logo.png` are load-bearing root-relative loads — relocating
them means a coordinated edit across `index.html` + `app.js` + `ws-bridge.js`
for near-zero benefit. The only structural improvement of real value (root
materials/ + Docker) is deferred per owner decision. Remaining structural work
is doc-hygiene only.

## Rollback

- Pre-change tag/commit is clean `main` (`git status` clean at start).
- Reverse of archive: `mv` files back from `.local/archive/2026-07-05-.../` and `git add -A`, or `git checkout HEAD -- <paths>` before commit.
- `scan-check.txt` recoverable via `git checkout HEAD -- workspace/materials/scan-check.txt`.
- No commit/push happens until owner approves the diff.
