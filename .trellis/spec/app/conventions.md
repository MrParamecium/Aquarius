# Conventions

> What this codebase **actually does** (not ideals). Sub-agents match this spec,
> so everything here is the real current state.

## Language & runtime

- **Frontend**: plain `app/index.html` + `app/app.js` (vanilla JS, ~5.7k lines after Phase 3 extraction) + `app/style.css`. No framework, no JSX, no TypeScript, no module bundler. New frontend modules are plain `.js` files loaded via `<script>` (see `app/lesson-render.js` for the extraction pattern).
- **Backend**: `app/ws-bridge.js` — a single Node http server using **Node built-in modules only. No Express, no third-party web framework.** Adding a dependency is a real decision, not a default.
- **Python**: invoked as a subprocess for matplotlib plot rendering (`process-python.js`). On WSL/Linux set `TUTOR_PYTHON_BIN` explicitly (the default is a macOS path).

## No build / lint / test infrastructure

- The only static check is `npm run check` → `node --check` on `ws-bridge.js` and `app.js`. **Run it before every commit.**
- There is no Jest/Vitest/ESLint/Prettier. Do not introduce one as part of an unrelated change.
- E2e regression is Playwright scripts under `tools/` (e.g. `tools/test-lesson-open-no-hang.js`) and the visual-diff / css-probe harnesses — run manually, not wired into `npm run check`.

## Hard constraints (these break things if violated)

- **Windows-illegal filenames**: never create files containing `: | ? * < > "`. The repo is used from Windows (GitHub Desktop) and WSL; legacy lesson-cache files were sanitized for this in commit `e269436`.
- **Do not rename** `aquarius_visual_latex_v2` (the lesson-cache version key) or the `AQUARIUS_CONFIG` global — renaming them invalidates every cached lesson / every deployed frontend config respectively. The "Aquarius" name is intentional legacy.
- **Do not delete or replace Chapter 2 figure recrops** (`materials/new-book-figures/page-*-figure_2_*.png` + `new-book-ocr/page-150..223.meta.json`, mirrored in `workspace/materials/`) unless explicitly asked.
- **Root-relative asset/JSON maps** (`section-page-map*.json`, `section-figure-map-new.json`, image assets) load from the `app/` root by root-relative path — do not move them into subfolders.

## Materials & lesson cache (most non-obvious behavior)

- `ws-bridge.js` resolves its materials dir through a fallback chain (`resolveExistingDir`, `ws-bridge.js:86-91`): it prefers `workspace/materials/` over root `materials/`, validated by the presence of `new-book-ocr/`. Both trees have it in a normal checkout, so **`workspace/materials/` always wins**; root is selected only if workspace is missing/loses `new-book-ocr/`. Per `docs/sync-policy.md`: **`workspace/materials/` is the canonical runtime tree; root `materials/` is a legacy one-way backup mirror the app never reads while workspace is present.** Changes go to `workspace/materials/` and are mirrored to root as backup.
- Pre-generated lessons live at `<materials>/lesson-cache/<sectionId>/<key>.aquarius_visual_latex_v2.en.md`. A cache **miss** returns "This section has not been prepared yet." — it does not generate live. So a missing/misnamed cache file is a user-facing failure.
- When the owner says "重新生成" (regenerate): locate the file the app **actually hits**, delete it, regenerate. Never patch a stale copy or guess which duplicate is live.

## Communication / documentation style (FlyM1ss preference)

- Keep PR bodies, commit messages, code comments, and docs **plain and factual**. Do **not** write "★ Insight" boxes or chat-style commentary into any committed artifact (PRs, commits, code, specs, docs). Those belong only in interactive chat.
- Commit messages: match recent history — short imperative subject with a `feat:` / `fix:` / `chore:` / `refactor:` / `docs:` prefix. PR titles target ≤50 chars; push phase tags / view counts / "closes #X" into the body.
- Planning/prep docs land **direct to main** as `chore`/`docs` commits, not bundled into the implementation PR.

## Defect triage (Gated Timebox protocol)

The owner is both student and developer. Severity: **Sev-1** = wrong math or a failure that blocks completing the current learning unit → fix immediately; **Sev-2** → batch to the dev day; **Sev-3** → backlog. (Full protocol: central DB `knowledge/gated-timebox-protocol.md`.)
