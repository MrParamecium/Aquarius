# Architecture

> Enough of the map to make a safe change. Source of truth is the code +
> `CLAUDE.md`; this is the orientation layer.

## Request flow

```
Browser (app/index.html + app/app.js, vanilla JS)
  └─ app/config.js picks apiBase: '' locally, Render URL otherwise
ws-bridge.js (single Node http server, built-in modules only)
  ├─ routes: /api/ask, /api/section, /api/pregen/section, /api/preference/draft,
  │          /api/feedback, /api/memory, /api/tutor (legacy), /api/crop
  ├─ static: /pages, /new-pages, /old-pages, /figures, /generated, app/ files
  ├─ LLM calls via OpenRouter:
  │     Agent A (Planner)  = gpt-5.5            → Rendering Blueprint JSON
  │     Agent B (Renderer) = claude-sonnet-4.6  → lesson text
  │                          (cost/quality decision — do NOT silently upgrade to Opus)
  │     auxiliary = claude-haiku-4.5; diagrams = gpt-5.4-image-2
  ├─ process-python.js → spawns Python (matplotlib, Agg) for model-written plot code;
  │     normalizePythonCode() sanitizes/repairs the script before execution
  └─ optional RAGFlow retrieval sidecar (RAGFLOW_* env) — retrieval only
```

## Adding a route

Routes are `if (pathname === '...')` blocks inside one request handler in `ws-bridge.js`.
Follow that pattern; do not add a router abstraction.

## Frontend layout

- `app/app.js` — the main vanilla-JS app. Phase 3 extracted focused modules out of it (e.g. `app/lesson-render.js`); follow that extraction style rather than growing `app.js`.
- `app/style.css` (~38–43k lines) + `app/css/runtime-collapsed.css` (loaded **last**, so it wins ties) — the two main stylesheets. The cascade relationship between them is load-bearing; see the [`css` layer](../css/index.md).
- `app/index.html` loads the **Tailwind CDN runtime JIT** (not a compiled sheet) — it injects an *unlayered* `<style>`. This is why `@layer` migration is a trap (see css/cascade-and-collapse.md).

## Secrets / env

- `app/.env` (not committed): `OPENROUTER_API_KEY` required for any LLM call; `OPENAI_API_KEY` optional (falls back to OpenRouter); `TUTOR_PYTHON_BIN` must be set on WSL/Linux/Windows.

## Deployment

- Backend → `Dockerfile` (node + python) → Render (`aquarius-5ss0.onrender.com`), port 9000.
- Frontend → Vercel serves `app/` statically (`aquarius-seven.vercel.app`), talks to Render via `app/config.js`. **Pushing origin/main auto-deploys Vercel (~1 min).**
- Releases bump the version in `app/index.html` (sidebar + Settings), the `app.js?v=` / `style.css?v=` query params, and the three package.json versions together.
- `vercel.json` landmine: do **not** add the legacy `"public": true` field — it fails v2 schema validation before build (central-db `knowledge/vercel-json-public-deprecated.md`).
