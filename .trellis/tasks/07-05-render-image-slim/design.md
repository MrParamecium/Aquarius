# Design: Render image consolidation

## Problem

`Dockerfile` ends with `COPY . .`. Docker's build context is the on-disk tree
minus `.dockerignore` matches — **`.dockerignore` does not read `.gitignore`**.
So every gitignored-but-present file is copied into the Render image. The current
`.dockerignore` excludes only `.git`, `node_modules`, logs, `.env*`,
`__pycache__`, `*.pyc`, and two user dirs. Net effect: the image carries ~450M+
of dev-only content.

## Runtime-needs proof (what the container actually uses)

`npm start` = `node app/ws-bridge.js`. Tracing every path the runtime resolves:

| Runtime dir constant | Resolves to | In build context under |
|---|---|---|
| `TUTOR_MATERIALS_DIR` (ws-bridge:86) | `workspace/materials/` (root `materials/` only as fallback) | `workspace/` |
| `OCR/SECTION/PAGE/FIGURE` dirs, `BLUEPRINT_DIR`, `FORMULA_CATALOG_DIR`, `EXAM_PRIORITY_DIR`, prompts | `path.join(TUTOR_MATERIALS_DIR, …)` | `workspace/materials/` |
| `GENERATED_DIR` (ws-bridge:121) | `app/generated` (runtime-created) | `app/` |
| `DEBUG_DIR` (ws-bridge:123) | `app/debug` (runtime-created) | `app/` |
| all `require('./…')` | modules under `app/` | `app/` |
| static routes (`/generated`,`/pages`,`/figures`,`/crops`, catch-all) | `GENERATED_DIR`, `PAGE_IMAGE_DIR_NEW`, `TUTOR_MATERIALS_DIR`, `APP_DIR` | `app/` + `workspace/materials/` |

**Runtime-needs set = `app/` + `workspace/materials/` + `package.json` + pip
deps.** No runtime path reaches `tools/`, `.local/`, root `materials/`, `docs/`,
or `.trellis/`. (Grep evidence in `prd.md` Background.)

## Chosen approach: targeted, dir-anchored `.dockerignore` blacklist

Append to `.dockerignore`:

```
# --- Dev/build-only: never used by the runtime container (npm start = app/ws-bridge.js) ---
# NOTE: unlike .gitignore, a slash-free .dockerignore pattern matches ONLY at the
# build-context root, NOT at any depth. So `materials`/`/materials/` excludes the
# root materials/ mirror but NEVER workspace/materials/. Do NOT "fix" this into a
# recursive `**/materials/` — that WOULD wrongly drop workspace/materials/ and
# break the app. (Empirically verified with a real `docker build`, 2026-07-05.)
tools/          # Playwright harness + 344M gitignored CSS baseline (dev-only)
.local/         # gitignored archives / visual audits (dev-only)
/materials/     # legacy backup mirror; app reads workspace/materials/
.trellis/       # task/planning metadata, not runtime
docs/           # docs, not runtime
```

### Why a blacklist, not a whitelist

A whitelist (`*` then `!app/ !workspace/materials/ …`) is default-deny and in
principle tighter, but docker's un-ignore semantics for nested paths are
error-prone, and a mistake **drops a needed file** (silent 404s / boot failure).
A targeted blacklist can only ever over-ship (harmless) — the failure mode is
"image slightly larger than intended," never "runtime file missing." With no
local Docker to test cheaply, the conservative failure mode wins.

### Anchoring rules that matter

- `/materials/` uses a leading slash → root-anchored → matches only top-level
  `materials/`, **never** `workspace/materials/`. (`materials/` without the slash
  also matches only the root level in docker, but the leading slash makes intent
  explicit and unambiguous.)
- **No bare `*.md`.** The runtime reads `workspace/materials/prompts/*.md`
  (ws-bridge:3267,3520); an unanchored `*.md` would match them at any depth and
  break lesson generation. Metadata `.md` files are removed by excluding their
  dirs (`docs/`, `.trellis/`), not by extension.
- `tools/`, `.local/`, `.trellis/`, `docs/` are dir patterns → exclude the whole
  subtree, nothing outside it.

## Scope tiers

- **Tier A (minimum / owner's original ask):** `/materials/` only → ~107M off.
- **Tier B (recommended):** Tier A + `tools/` + `.local/` + `docs/` + `.trellis/`
  → ~470M off. `tools/` alone is the largest single win (344M baseline). Same
  safety class as Tier A (all provably unused at runtime).

Recommend Tier B; it is strictly more valuable at no additional runtime risk. The
`.dockerignore` diff is the same shape either way.

## Compatibility

- `workspace/materials/` retained → app resolves identically; no lesson-cache,
  figure, OCR, or prompt path changes.
- Chapter-2 recrops untouched (this task edits `.dockerignore` only; `materials/`
  contents in both trees are unchanged on disk).
- Vercel/frontend unaffected (Vercel serves `app/`; `.dockerignore` is Docker-only).
- No code change; `AQUARIUS_CONFIG` / `aquarius_visual_latex_v2` untouched.

## Verification strategy

**`docker.exe` is reachable from this WSL** (Docker Desktop 29.6.1, confirmed
2026-07-05 — `bash` sees `docker.exe` even though bare `docker` is not on PATH).
So the local build test is available now; it is not gated on any settings change.

Preferred, in order:

1. **Local build+boot test** (gold standard, available):
   `docker.exe build -t fourier-test .` → confirm build succeeds → `docker.exe run
   -d -p 9000:9000 --env-file app/.env fourier-test` → `curl localhost:9000/health`
   (200), a `/figures/<id>` + `/pages/<id>` (200), open one cached lesson. Confirm
   the shipped file set with `docker.exe run --rm fourier-test sh -c 'ls
   workspace/materials/new-book-ocr | head; ls materials 2>&1'` (workspace present,
   root `materials` absent).
2. **Build-context probe only** (cheap, no boot): a throwaway `Dockerfile.ctx`
   doing `FROM alpine; COPY . .; RUN ls -d tools .local materials workspace/materials
   docs .trellis 2>&1; du -sh /` → shows exactly what got copied and the size.
   This is the technique the adversarial verifier used to prove the pattern set.
   Delete the throwaway file after.
3. **Monitored Render deploy + rollback** (final gate regardless): after merge,
   watch the Render build to `ready`, smoke `/health` + asset routes on the live
   URL, keep the previous deploy pinned for one-click rollback.

## Rollout & rollback

- Land as its own PR (not direct-to-main), because merging to main auto-triggers
  the Render rebuild. Verify locally (path 1/2) before merge when possible.
- Rollback is trivial: revert the `.dockerignore` commit (restores `COPY . .`
  behavior) or use Render's "Rollback to previous deploy". No data is deleted, so
  rollback is fully lossless.
- The change is `.dockerignore`-only; `git revert` fully restores prior behavior.

## Adversarial verification results

Three independent refuters ran (workflow `wf_7f51f396-2c0`), each trying to break
the safety claim from a different lens. 2/3 returned (the ops-rollback lens timed
out mid-run; its questions are covered below by the design + the empirical build).
Both returned lenses: **refuted = false, high confidence.**

- **runtime-completeness** (refuted=false, high): grep-confirmed no runtime JS file
  reads or requires `tools/`, `.local/`, `.trellis/`, `docs/`, or root `materials/`;
  the 3 `docs/` string hits in `app/` are `//` comments, not fs reads. `npm install`
  runs *before* `COPY . .` (so `tools/` isn't even present at install), and there is
  **no `postinstall`/`prepare` hook**, so the `tools/*`-referencing dev scripts never
  run in the image. Static dispatcher is scoped to 4 injected dirs (all under `app/`
  or `workspace/materials/`) with a path-traversal guard. Prompt files + matplotlib
  generator resolve under `workspace/materials/` and `app/` (both kept).

- **dockerignore-semantics** (refuted=false, high): **empirically verified with a
  real `docker build`** (Docker Desktop 29.6.1 via `docker.exe` from WSL) using a
  throwaway probe Dockerfile that `ls`-checked every path right after `COPY . .`,
  run twice (slashed + bare-word variants — identical results):
  `workspace/materials`, `.../new-book-ocr`, `.../prompts` **PRESENT**; root
  `materials/`, `tools/`, `.local/`, `.trellis/`, `docs/` **ABSENT**; `app/`,
  `package.json`, `package-lock.json`, `Dockerfile` **PRESENT**. `.dockerignore`
  restored byte-identical afterward. Key correction to intuition: Docker's matcher
  is the **inverse** of `.gitignore` — a slash-free pattern matches only at context
  root, so `materials` cannot reach `workspace/materials`; the inline warning comment
  (added to the proposed block) prevents a future editor from "fixing" it into a
  recursive pattern that *would* break it.

Net: the safety claim survived adversarial verification, including a live build.

## Risks & mitigations

- **R: `/materials/` accidentally excludes `workspace/materials/`.** → Root-anchored
  pattern; explicit `docker run … ls` check that `workspace/materials/new-book-ocr`
  is present in the image. (Verified by the dockerignore-semantics lens.)
- **R: a runtime `.md`/asset under an excluded dir.** → Only `docs/` and `.trellis/`
  are excluded by dir; no runtime path reads them (grep-proven). Prompts live under
  `workspace/materials/` (kept). No bare `*.md`.
- **R: verification happens in prod (no local Docker).** → Prefer local build test
  (path 1); else monitored deploy with pinned rollback. `/health` + asset routes as
  smoke signals.
- **R: losing the Render-side startup fallback** (root `materials/` no longer in the
  image). → `workspace/materials/` is the canonical validated tree and always
  present; the fallback served a 131-dir-stale snapshot anyway. Repo mirror is
  retained (not deleted), so re-adding to the image is a one-line revert.
