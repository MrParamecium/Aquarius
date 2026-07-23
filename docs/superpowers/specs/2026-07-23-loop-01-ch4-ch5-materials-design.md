# Loop 1: Chapter 4-5 Materials Integration

## Status

Design for `codex/loop-01-ch4-ch5-materials`.

## Goal

Bring the locally verified Chapter 4 and Chapter 5 textbook material into the refactored GitHub application so the application can resolve and read the sections, pages, OCR, and verified formula records. This loop is a material and referential-integrity loop only. It does not generate lessons or change teaching behavior.

## Source Of Truth

The source project is `/Users/chenghaoxiang/Desktop/tutor agent`.

The local, hand-built `app/section-page-map-new.json` and its associated material metadata are authoritative for this loop. The refactored repository is the code and directory-structure source of truth. Existing remote maps are compared with the local maps; matching maps are retained without regeneration.

## Scope

### Included

- The 226 unique page IDs referenced by the Chapter 4-5 entries in `app/section-page-map-new.json`.
- The corresponding page images under `workspace/materials/new-book-pages/`.
- The corresponding page-level OCR text and metadata under `workspace/materials/new-book-ocr/`.
- The 83 Chapter 4-5 section OCR `.txt` and `.meta.json` pairs under `workspace/materials/new-book-section-ocr/`.
- The 32 canonical Chapter 4-5 formula catalogs under `workspace/materials/formula-catalog/` (15 Chapter 4 and 17 Chapter 5 files, excluding duplicate-suffix files).
- A deterministic material manifest and verifier under `tools/`.
- A package script that runs the material verifier.
- Minimal documentation describing the canonical material locations and the verification command, if the refactored repository needs it.

The mapped page allowlist is derived from the map, not guessed from a continuous numeric range. It currently covers Chapter 4 pages `page-330` through `page-467`, Chapter 5 pages `page-488` through `page-574`, and `page-575` because section `5.11` shares that page. Unmapped problem pages are outside this loop.

### Excluded

- Lesson cache files and lesson generation.
- Interactive demos, layout, UI, and other product behavior.
- 2nd Edition assets and routes.
- Root `materials/` mirroring.
- Files with the ` 2` duplicate suffix.
- Backup caches, debug output, `__pycache__`, and unrelated generated artifacts.
- Regenerating OCR, formula catalogs, or maps unless a validation failure proves that a local artifact is inconsistent.

## Destination Layout

All runtime material additions go into the refactored repository's canonical `workspace/materials/` tree:

```text
workspace/materials/
├── new-book-pages/
├── new-book-ocr/
├── new-book-section-ocr/
└── formula-catalog/
```

The existing refactored `app/section-page-map-new.json`, `app/section-page-map-display-new.json`, and `app/section-page-anchor-new.json` remain unchanged when their content matches the local authoritative copies.

## Migration Flow

1. Read the local authoritative section map and derive the unique page allowlist.
2. Build a source inventory containing page images, page OCR, section OCR/meta, formula catalogs, and SHA-256 hashes.
3. Reject source entries with duplicate suffixes, backup/debug paths, invalid JSON, or paths outside the explicit Chapter 4-5 allowlist.
4. Compare the local map files with the refactored copies and record any delta before copying materials.
5. Copy only validated source files into the refactored `workspace/materials/` tree. Do not overwrite unrelated refactored files.
6. Generate a committed manifest containing the selected paths, sizes, SHA-256 hashes, section/page counts, and formula counts.
7. Run the verifier against the destination tree and the committed manifest.
8. Run the representative application checks and collect evidence for the loop record.

## Verifier Contract

The new `tools/check-chapter-materials.js` is deterministic and fail-closed. It must:

- confirm the expected 83 section IDs and 226 unique mapped pages;
- confirm every mapped page image and page OCR text exists;
- confirm every section OCR text has a matching metadata file and vice versa;
- parse section metadata and verify page ranges agree with the authoritative map;
- parse the three map files and confirm anchors refer to mapped pages with ratios in `[0, 1]`;
- parse every Chapter 4-5 formula catalog, require the expected schema and `status: "verified"`, and confirm every `sourcePage` exists in the page allowlist;
- reject duplicate-suffix, backup, debug, and unexpected manifest entries;
- compare destination hashes against the committed manifest;
- print counts and failures with exact relative paths; and
- exit `0` only when all checks pass, otherwise exit non-zero without modifying files.

The verifier must not repair, regenerate, or silently drop files. A failure stops the loop for diagnosis.

## Acceptance Gates

### Gate 0: Clean baseline

- The new branch is based on GitHub `main` commit `d10beb8`.
- The refactored application passes its existing `npm run check` before material changes.

### Gate 1: Inventory integrity

- 83 Chapter 4-5 sections are accounted for.
- 226 unique mapped pages are accounted for.
- Every selected image, page OCR file, section OCR/meta pair, and formula catalog has a source hash.

### Gate 2: Referential integrity

- All map references resolve to destination files.
- Section metadata and anchors agree with the maps.
- Formula source pages resolve to destination pages.
- No duplicate or out-of-scope files are included.

### Gate 3: Runtime resolution

- The server health endpoint remains healthy.
- Representative Chapter 4 and Chapter 5 section/page requests resolve to non-missing assets and OCR.
- A browser smoke check can navigate to representative sections without missing-page errors or new console errors.

### Gate 4: Regression and evidence

- The existing refactored checks still pass.
- The new material verifier passes from a clean checkout of the branch.
- The PR includes the verifier output, counts, hashes/manifest, representative runtime evidence, and explicit exclusions.

## Rollback And PR

- The old desktop project is never modified by this loop.
- The integration branch has small, reviewable commits: design/verification scaffolding first, material migration second, and only targeted fixes if a gate fails.
- If a gate fails, stop and diagnose on the branch; do not regenerate source material or force-merge.
- Push `codex/loop-01-ch4-ch5-materials`, open a PR into `main`, and merge only after all gates and review pass.

## Stop Condition

This loop stops after the Chapter 4-5 material set is present, the verifier and runtime checks pass, and the PR evidence is complete. Lesson cache migration and all teaching/UI improvements are deferred to later loops.
