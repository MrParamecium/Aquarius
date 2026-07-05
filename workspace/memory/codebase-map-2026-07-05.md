# Codebase Map — fourier-tutor-agent (2026-07-05, post-refactor)

> **Current snapshot after the refactor closed 2026-07-04** (`docs/REFACTOR_DONE.md` top
> banner = authoritative close-out). This file refreshes the headline numbers and module
> inventory only. For the deep structural reference (subsystem table, integration
> contracts, env vars, localStorage keys, `window.__ftutor*` contract) the
> [06-19 map](codebase-map-2026-06-19.md) sections are still the only written source —
> re-grep any line number before trusting it.

## Headline numbers (pre-refactor 2026-06-19 → now)

| File | 06-19 | Now (2026-07-05) | Δ |
|---|---:|---:|---|
| `app/app.js` | 20,250 | **5,741** | −71.6% |
| `app/style.css` | 47,865 | **32,514** | −32.1% (402 doubled-IDs = documented load-bearing floor) |
| `app/ws-bridge.js` | 6,868 | **5,348** | −22.1% |
| `app/index.html` | 3,147 | **1,641** | −47.9% |
| `app/css/runtime-collapsed.css` | — | 1,562 | (876 `!important` by design) |

Residual `!important` (~9,286 in style.css) and doubled-IDs (402) are the **intended
load-bearing floor**, not debt — see `docs/REFACTOR_DONE.md` DONE banner and
`docs/A4_COMPOSER_IRREDUCIBLE.md` (composer cluster proven irreducible-by-design).

## Module inventory (23 `.js` under `app/`)

`app.js` (5,741 — orchestrator), `ws-bridge.js` (5,348 — server), plus focused modules:
`attachments`, `build-section-page-display-map`, `clerk-auth`, `config`, `feedback-board`,
`lesson-cache`, `lesson-render` (1,482 — the B4 extraction), `llm-client`, `login-cosmos`,
`markdown-engine`, `mistake-notebook`, `preference-profile`, `process-python`,
`ragflow-client`, `recent-conversations`, `search-helpers`, `static-routes`,
`syllabus-view`, `textbook-focus`, `ui-friction-fixes`, `user-memory`.
Also `app/data/*` (static data islands), `app/css/` (`inline-styles.css`,
`runtime-collapsed.css`), and the harness under `tools/` (visual-diff 39 views,
css-probe 21 states, cascade arbiter ~330 states — run arbiter with
`node --max-old-space-size=5120`).

## Structure facts (post 2026-07 cleanup)

- **Single root `package.json`** (v1.4.1) — the old three-package.json release bump is gone.
- **`workspace/materials/` is the single materials tree** — root `materials/` mirror removed
  2026-07-05 (`docs/sync-policy.md`); bridge throws at startup if it goes missing (intentional).
- `npm run check` = `node --check` on 53 files + smoke test; the only static check.
- Render image ships `app/` + `workspace/materials/` only (PR #130 slimmed build context).

## What's next (not refactor work)

Post-refactor backlog lives in `docs/REFACTOR_DONE.md` §4: Phase 4 DB migration (first
item, needs its own design conversation), six carry-forward demo bugs, `@layer`
migration, harness hardening + Sev-3 tooling fixes (§4.4).
