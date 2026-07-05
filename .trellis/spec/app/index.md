# App — Project Conventions

> Repo-wide conventions for the Fourier Tutor Agent (formerly Aquarius). This is
> the entry point for the `app` spec layer. Read it before writing any code in
> this repo; read the layer-specific specs below before touching their domain.

This is a single-package project: a vanilla HTML/JS/CSS frontend served statically
by one Node http server (`app/ws-bridge.js`). There is **no framework, no build
step, no bundler, no TypeScript, no test framework, no linter**. Treat the generic
React/TypeScript assumptions that ship with Trellis as inapplicable here.

---

## Guidelines in this layer

| Guide | Read it before |
|-------|----------------|
| [conventions.md](./conventions.md) | Writing or moving any file; touching materials/lesson-cache; naming anything |
| [architecture.md](./architecture.md) | Adding an API route, touching `ws-bridge.js`, or editing `app.js` modules |

For CSS work (the `!important` / doubled-ID collapse), use the [`css` layer](../css/index.md) instead — its verification protocol is mandatory.

---

## Pre-Development Checklist

- [ ] Confirmed the change is vanilla JS / plain CSS / Node built-ins only (no new dependency, no build step).
- [ ] Filenames contain none of `: | ? * < > "` (repo is used from Windows + WSL).
- [ ] Not renaming `aquarius_visual_latex_v2` or the `AQUARIUS_CONFIG` global (invalidates every cached lesson / deployed frontend config).
- [ ] If editing materials/OCR/figures: change goes into `workspace/materials/` — the **single** canonical tree since 2026-07-05 (root `materials/` mirror removed; see `docs/sync-policy.md`).
- [ ] If editing a lesson, located the cache file the app **actually hits** (materials-resolution fallback chain — see architecture.md) rather than a stale duplicate.
- [ ] Read the relevant layer spec (`css/` for stylesheet work).

## Quality Check

- [ ] `npm run check` passes (`node --check` on 53 files — bridge, app.js, all `app/` modules, several `tools/*.js` — plus a smoke test; the only static check; run before every commit).
- [ ] For CSS changes: the `css` layer verification gates ran green (css-probe byte-identical + visual-diff). See [css/verification.md](../css/verification.md).
- [ ] No new file violates the Windows-illegal-filename constraint.
- [ ] Change touches only the agreed scope (the PRD's acceptance criteria), nothing incidental.

---

**Language**: All spec and documentation files in English.
