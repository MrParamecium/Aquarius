# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Fourier Tutor Agent (formerly **Aquarius** — legacy identifiers like `AQUARIUS_CONFIG` and the lesson-cache version `aquarius_visual_latex_v2` intentionally keep the old name) is a local web tutor for *Signal Processing and Linear Systems*. The owner is both the **student** (studying DSP with this agent, weekdays) and the **developer** (Day-6 dev timebox). Defect triage follows the Gated Timebox protocol recorded in the central DB (`knowledge/gated-timebox-protocol.md`): Sev-1 = wrong math or a failure that blocks completing the current learning unit → fix immediately; Sev-2 → batch to the dev day; Sev-3 → backlog.

## Commands

```bash
npm install
npm start                  # node app/ws-bridge.js — serves UI + API on http://127.0.0.1:9000 (/health to verify)
npm run check              # node --check on 53 files (ws-bridge.js, app.js, all app/ modules + several tools/*.js incl. css-probe.js — but NOT the arbiter/strip tools) + a smoke test; the only static check; run before committing
npm run build:section-ocr  # rebuild per-section OCR from page OCR
npm run pregen:bg-ch1      # pre-generate Background + Chapter 1 lesson cache
node tools/test-lesson-open-no-hang.js   # Playwright e2e regression: section open must not hang (needs npx playwright install chromium)
```

There is no lint, test framework, or build step. The frontend is plain HTML/JS/CSS served statically by the bridge.

Secrets load from `app/.env` (not committed): `OPENROUTER_API_KEY` is required for any LLM call; `OPENAI_API_KEY` optional (falls back to OpenRouter). `TUTOR_PYTHON_BIN` defaults to a macOS path — set it explicitly when running on WSL/Linux/Windows.

## Architecture

```
Browser (app/index.html + app/app.js, ~5.7k lines vanilla JS + ~20 focused modules post-refactor)
   └─ app/config.js picks apiBase: '' locally, Render URL (aquarius-5ss0.onrender.com) otherwise
ws-bridge.js (~5.3k lines, single http server, Node BUILT-IN modules only — no Express)
   ├─ /api/ask, /api/section, /api/pregen/section, /api/preference/draft,
   │  /api/feedback, /api/memory, /api/tutor (legacy), /api/crop
   ├─ static: /pages, /new-pages, /old-pages, /figures, /generated, app/ files
   ├─ LLM calls via OpenRouter:
   │     Agent A (Planner)  = gpt-5.5            → Rendering Blueprint JSON
   │     Agent B (Renderer) = claude-sonnet-4.6  → lesson text (cost/quality decision; do not silently upgrade to Opus)
   │     auxiliary calls    = claude-haiku-4.5; diagrams = gpt-5.4-image-2
   ├─ process-python.js → spawns Python (matplotlib, Agg) to render model-written plot code;
   │     normalizePythonCode() sanitizes/repairs the model's script before execution
   └─ optional RAGFlow retrieval sidecar on a Windows machine (RAGFLOW_* env vars) —
        retrieval-only; prompt assembly and generation stay in this app (see docs/WINDOWS_RAG_HANDOFF.md)
```

Routes are `if (pathname === ...)` blocks in one request handler in `ws-bridge.js`; follow that pattern for new endpoints.

### Materials resolution — the most important non-obvious behavior

`ws-bridge.js` resolves its materials dir through a fallback chain (`resolveExistingDir`, `ws-bridge.js:86-91`): candidates are `workspace/materials/` then root `materials/`, validated by the presence of `new-book-ocr/`. **`workspace/materials/` is the single materials tree since 2026-07-05** — the root `materials/` legacy backup mirror was removed that day (owner decision after verifying byte-identical content; git history retains it — see `docs/sync-policy.md`). The fallback chain remains in code with one live candidate, so the bridge **throws at startup** if `workspace/materials/` is missing or loses its `new-book-ocr/`; that fail-fast is intentional — restore via `git restore workspace/materials`, never recreate a root `materials/` tree. Changes meant for the app go to `workspace/materials/` (`new-book-figures/`, `new-book-ocr/`, extraction scripts). Experiments stay in `workspace/` or git-ignored `.local/`.

### Lesson cache

Pre-generated lessons live at `<materials>/lesson-cache/<sectionId>/<key>.aquarius_visual_latex_v2.en.md`. A cache miss returns "This section has not been prepared yet." rather than generating live, so missing/misnamed cache files are a user-facing failure. When the owner says "重新生成" (regenerate), the rule is: locate the file the app *actually hits*, delete it, regenerate — never patch a stale copy or assume which duplicate is live.

## Hard Constraints

- **Windows-illegal filenames**: this repo is used from both Windows (GitHub Desktop) and WSL. Never create files containing `:` `|` `?` `*` `<` `>` `"` — legacy lesson-cache files were sanitized for this in commit e269436.
- **Do not delete or replace Chapter 2 figure recrops** (`workspace/materials/new-book-figures/page-*-figure_2_*.png` + `workspace/materials/new-book-ocr/page-150..223.meta.json`) unless explicitly asked. The former root `materials/` mirror copies went away with that tree on 2026-07-05 (owner-authorized, byte-identical to the canonical copies).
- The UI loads several JSON maps (`section-page-map*.json`, `section-figure-map-new.json`) and image assets from the `app/` root by root-relative path — do not move them into subfolders.
- Renaming `aquarius_visual_latex_v2` or the `AQUARIUS_CONFIG` global invalidates every cached lesson / deployed frontend config respectively.

## Project Memory

Before broad edits: read `workspace/memory/MEMORY.md` and the newest `workspace/memory/YYYY-MM-DD.md` files, then run `npm run check`. `MEMORY.md` also records the product's teaching design rules (exam-oriented brevity, progress visibility, every concept gets an example, visual-first hierarchy: interactive demo > curated image > generated image > LaTeX > text) — lesson-generation prompt changes must respect them.

## Deployment

- Backend: `Dockerfile` (node + python image) → Render (`aquarius-5ss0.onrender.com`), port 9000.
- Frontend: `vercel.json` serves `app/` as a static site (`fourier-tutor.vercel.app` — renamed 2026-07-06 from `aquarius-seven.vercel.app`, which may still resolve as an alias); it talks to the Render backend via `app/config.js`. **Pushing to origin main auto-deploys the Vercel frontend** (verified 2026-06-12, ~1 min). Releases bump the visible version in `app/index.html` (sidebar + Settings), the `app.js?v=` / `style.css?v=` query params, and the package.json version together (single root package.json since the 2026-07 structure cleanup).
- **`vercel.json` schema landmine (2026-06-17):** Vercel removed the legacy `"public": true` field from the v2 schema; pushes containing it fail schema validation **before** the build starts. Commits `04939da` + `6b761d9` both died this way until `9472db1` removed the line. The deceptive symptom is the frontend domain (`fourier-tutor.vercel.app`) still serving the previous deploy with `x-vercel-cache: HIT` and a rising `age` header — looks like CDN propagation lag but is actually "no artifact was produced." Diagnose by querying `gh api repos/MrParamecium/Fourier/deployments` for the failure state; do NOT add `public:` (or other legacy v2 fields) back. The deploy owner is on Vercel Hobby (no team invites — build-log access requires either a project transfer or a screenshot of the dashboard popup from them). Full diagnostic playbook + Hobby-tier workarounds at central-db `knowledge/vercel-json-public-deprecated.md`.
- **CORS/auth allowlist landmine (2026-07-06):** the Render backend reflects `Access-Control-Allow-Origin` only for origins listed in `CLERK_AUTHORIZED_PARTIES` (comma-separated; `setCORSHeaders` in `app/ws-bridge.js`), which *also* drives Clerk's `azp` token check. A wildcard is illegal once requests carry `Authorization`, so every allowed frontend origin must be named explicitly. **Renaming the frontend domain without adding the new origin here silently breaks all `/api/*` calls** — the preflight returns no ACAO, the browser blocks everything (including `/api/section`, so no subsections load), *and* auth fails — one rename, two subsystems down. The Render **env var overrides the code default** in `ws-bridge.js`, so a rename means updating *both* the default and the Render env value. Fixed for the fourier-tutor rename in `d5956c6`. **Vercel preview deploys** (rotating `https://fourier-<hash>-mrparameciums-projects.vercel.app` hostnames) are handled separately by `VERCEL_PREVIEW_ORIGIN_RE` in `ws-bridge.js`: a single `isAllowedOrigin()` matcher accepts the exact `CLERK_AUTHORIZED_PARTIES` list **or** that team-scoped regex, and feeds *both* CORS reflection and the Clerk `azp` check (`clerk-verify.js` takes an injected `isAuthorizedParty` predicate — no longer a raw `authorizedParties` array). The regex is anchored on project `fourier-` **and** team scope `-mrparameciums-projects` so only our own previews match, not arbitrary `*.vercel.app`. It lives in **code, not the env var**, so previews need no Render env edit — only a backend redeploy; if the Vercel project or team slug ever changes, update the regex.
