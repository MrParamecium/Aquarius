# Implement — repo structure cleanup

Ordered checklist. Validation after each mutating group. No commit/push until owner approves the diff.

## Step 0 — Preconditions
- [ ] `git status` clean on `main` (rollback point).
- [ ] Final safety grep: confirm each Tier-1 app/ asset basename has zero refs in `app/index.html`, `app/app.js`, `app/style.css`, `app/css/*.css` (defense-in-depth over the audit).

## Step 1 — Archive Tier 1 (46 files)
- [ ] `mkdir -p .local/archive/2026-07-05-repo-structure-cleanup/`
- [ ] For each tracked path, `mkdir -p` mirrored parent under the archive dir, then plain `mv` the bytes there (dirs `app/src`, `workspace/app-mirror`, `HW` moved whole).
- [ ] `git add -A` to stage removals-from-tracking (`.local/` is ignored → nothing re-added there).
- [ ] Verify: `git ls-files <all 46 paths>` returns empty; files exist under `.local/archive/2026-07-05-repo-structure-cleanup/`.
- [ ] Verify `app/logo.png` still tracked (guard against fat-finger).

## Step 2 — Delete placeholder
- [ ] `git rm workspace/materials/scan-check.txt`

## Step 3 — Doc corrections
- [ ] `CLAUDE.md`: fix materials validator subdir claim, remove/annotate deleted `/api/homework` route, correct "root materials/ is the runtime tree" → workspace is canonical (align to `docs/sync-policy.md`).
- [ ] `PROJECT_STRUCTURE.md`: refresh `tools/` tree (add css-probe.js, the `_*` arbiter/strip toolchain, `_keep-important.json`/`_view-important.json`, `tools/fixtures/`); correct materials framing to match `sync-policy.md`; add a "Third cleanup pass (2026-07-05)" section listing what was archived + the deferred items.

## Step 4 — Validation gates
- [ ] `npm run check` passes.
- [ ] `npm start` boots; `curl -s http://127.0.0.1:9000/health` OK.
- [ ] Spot-check: open one lesson in the UI (or hit `/api/section`) — no broken image/asset from the removed files.
- [ ] `git status` review: only expected removals + 2 doc edits staged; no hard-constrained path touched (`git diff --cached --stat` inspected).

## Step 5 — Present for commit
- [ ] Show owner the staged diff summary. On approval: single commit on `main`, conventional message, Trellis spec update + archive.

## Rollback points
- Before Step 5 commit: `git checkout HEAD -- <paths>` / move files back from `.local/`.
- After commit (if needed): `git revert` restores tracking; archived bytes remain under `.local/`.
