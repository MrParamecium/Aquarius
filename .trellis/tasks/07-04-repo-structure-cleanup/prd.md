# Chapter 2 refactor: repo structure cleanup + reorg proposal

## Goal

Remove unused files and artifacts from the tracked tree, then assess whether the
repo layout should be reorganized. Discovery was done via a 7-subsystem read-only
audit with adversarial verification of every removal candidate (workflow
`repo-structure-discovery`, 2026-07-04). Owner chose: formal Trellis task +
propose-first (approve specific moves before touching anything).

## Owner decisions (2026-07-04)

1. **Tier 1 (confirmed-safe batch):** archive to gitignored `.local/archive/` (repo convention), not `git rm`.
2. **Root `materials/` (107M):** leave in place for now; document as a tracked follow-up (needs a Dockerfile→workspace-only change + Render deploy verification before it can be archived).
3. **Live-data grey-area** (16 Problems-page figure crops, byte-identical legacy cache duplicates, `lesson-cache/0_5`, `_regen_backup/`): leave the canonical `workspace/materials/` tree alone; document as noted-but-deferred.

## Requirements

- Archive the Tier-1 zero-reference batch (46 tracked files) to `.local/archive/2026-07-05-repo-structure-cleanup/`, mirroring repo-relative paths, fully reversible.
- Hard-delete the single 0-byte placeholder `workspace/materials/scan-check.txt`.
- Correct proven-stale documentation that actively misleads future work:
  - `PROJECT_STRUCTURE.md` — refresh the `tools/` tree (omits ~⅓ of files) and the materials-tree framing (superseded by `docs/sync-policy.md`); record this cleanup pass.
  - `CLAUDE.md` — fix 3 factually-wrong claims: the materials validator subdir (`background-ocr-v3` → code checks only `new-book-ocr`), the deleted `/api/homework` route, and the "root materials/ is the runtime tree" wording.
- Do NOT restructure any directory (assessment concluded the layout is sound; app/ root loads are load-bearing root-relative and not worth moving).
- Record deferred items (root materials/ consolidation, data grey-area) so they are not lost.

## Hard constraints (must not violate)

- Never move/delete Chapter-2 figure recrops (`materials/new-book-figures/page-*-figure_2_*.png` + `new-book-ocr/page-150..223.meta.json`) or their `workspace/materials/` mirror.
- Never touch app/ root-relative JSON maps (`section-page-map*.json`, `section-figure-map-new.json`), the `aquarius_visual_latex_v2` cache key, or the `AQUARIUS_CONFIG` global.
- Never create files with Windows-illegal characters.
- `docs/legacy/` is read-only (REFACTOR_PLAN.md Rule 4) — do not edit or delete anything there.
- Keep `workspace/package.json` (release-lockstep with root, per CLAUDE.md Deployment).

## Acceptance Criteria

- [ ] 46 Tier-1 files no longer tracked (`git ls-files` returns none of them) and present under `.local/archive/2026-07-05-repo-structure-cleanup/`.
- [ ] `app/logo.png` and all live assets/maps still tracked and referenced (nothing user-visible broke).
- [ ] `workspace/materials/scan-check.txt` removed.
- [ ] `npm run check` passes (the only static gate).
- [ ] `npm start` boots and `/health` responds; a spot-check lesson still renders (no broken image/asset).
- [ ] `PROJECT_STRUCTURE.md` + `CLAUDE.md` doc corrections applied; deferred items documented.
- [ ] All hard constraints above verifiably untouched.
