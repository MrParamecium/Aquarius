# Fourier Tutor Agent

Fourier Tutor Agent is a local web tutor for signal processing and linear systems. The current app combines a browser UI, a Node bridge, textbook OCR, page images, extracted figures, lesson cache files, and project memory.

## Quick Start

```bash
npm install
npm start
```

The local server is served by `app/ws-bridge.js`. The default health endpoint is:

```text
http://127.0.0.1:9000/health
```

## Main Directories

- `app/`: runtime UI and API bridge.
- `workspace/materials/`: textbook pages, OCR metadata, extracted figure crops, and material scripts used by the app (the single canonical materials tree — the root `materials/` backup mirror was removed 2026-07-05).
- `workspace/`: working copy of source materials, project memory, extraction experiments, QA output, and historical context.
- `docs/`: project handoff notes for humans.
- `tools/`: optional maintenance scripts.
- `.local/`: local-only archives, visual audits, generated caches, and other machine-specific material. This is intentionally ignored by Git.

## Important Notes

- Chapter 2 figure recrops are current working changes. Do not delete or replace them casually.
- The UI currently expects several JSON maps and image assets directly under `app/`, so those files have intentionally not been moved into nested folders.
- `workspace/memory/` is part of the project working memory. Read the newest date files before making broad changes.

See `PROJECT_STRUCTURE.md` for the detailed layout and `docs/sync-policy.md` for the materials tree policy (single-tree since 2026-07-05).
