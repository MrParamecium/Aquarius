# Materials Sync Policy

**Updated 2026-06-19** — rewritten to match what the running app actually does. Previous version
described root `materials/` as the runtime tree, which contradicts the bridge's resolution chain.

## Canonical Tree

`workspace/materials/` is the canonical runtime materials tree. Root `materials/` is a legacy
fallback kept temporarily for backward compatibility and as a backup mirror.

## How the Bridge Resolves

`app/ws-bridge.js:86` (`resolveExistingDir`) tries candidates in this order:

1. `workspace/materials/`
2. `materials/`

Each candidate is validated by the presence of either `background-ocr-v3/` or `new-book-ocr/`. In a
normal checkout both trees pass validation, so the workspace tree wins. The bridge throws on startup
if neither passes — there is no third fallback.

**Practical consequence:** any material change meant to affect the app must land in
`workspace/materials/`. Writing to root `materials/` has no runtime effect because the workspace
tree wins.

## Current State of the Trees (2026-06-19)

- `workspace/materials/lesson-cache/` — 173 section directories (**live**)
- `materials/lesson-cache/` — 42 section directories (**stale**, 131 directories behind workspace)
- Chapter 2 figure recrops + `page-150..223.meta.json` files: **present in both trees** (protected
  per CLAUDE.md hard constraint)

## Sync Direction

Workspace → root only. Workspace is canonical; root is a one-way backup mirror.

Do **NOT** update root with newer content than workspace and expect the app to pick it up — it
won't, because the bridge resolves to workspace first.

The current 131-directory drift in `lesson-cache/` is acceptable for now (workspace serves traffic;
root is a backup of an older snapshot).

## When to Write Where

| Destination | Use case |
|---|---|
| `workspace/materials/` | Any change meant to affect the running app |
| `.local/` (git-ignored) | Experiments, QA artifacts, one-off extraction output, scratch |
| Root `materials/` | Do not write directly. Mirror from workspace if needed for backup/deploy. |

## Chapter 2 Protection

Both trees must retain these files (do not delete unless explicitly asked):

- `workspace/materials/new-book-figures/page-*-figure_2_*.png` (canonical)
- `materials/new-book-figures/page-*-figure_2_*.png` (mirror)
- `workspace/materials/new-book-ocr/page-150.meta.json` through `page-223.meta.json` (canonical)
- `materials/new-book-ocr/page-150.meta.json` through `page-223.meta.json` (mirror)
- `app/section-figure-map-new.json` (root-relative, not in either materials tree)

See `docs/chapter-2-recrops.md` for the protection rationale.

## Future Cleanup

**Update 2026-07-05:** root `materials/` is no longer shipped to the Render image.
`.dockerignore` now excludes it (along with other dev-only content) from the
`COPY . .` build context, so the image builds from `workspace/materials/` only.
This was verified with a real `docker build` (copied context 630M → 143M) plus an
adversarial-verification pass and a live boot simulation (`/health`, `/figures`,
`/pages`, `/api/section` all 200 with root `materials/` absent). Of the three
original conditions:

1. **Satisfied for the image.** The Render image rebuilds with only
   `workspace/materials/` present.
2. **Satisfied.** No runtime code, script, or out-of-tree consumer reads root
   `materials/` (only `app/ws-bridge.js`'s workspace-first fallback, which never
   selects it in a normal checkout).
3. **Satisfied.** Chapter-2 protection is untouched — the change is
   `.dockerignore`-only; both trees' files are unchanged on disk.

Root `materials/` is **retained in the repo** as a backup mirror / startup
fallback net; only its *inclusion in the deployed image* was removed. A later pass
may still `git rm` the repo mirror to shrink clone size — a separate decision.
Until then, treat root `materials/` as a read-only mirror that nobody should write to.
