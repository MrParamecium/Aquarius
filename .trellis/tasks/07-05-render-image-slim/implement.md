# Implement: Render image consolidation

> Execution is gated on maintainer approval and a scope-tier choice (see
> `prd.md` Open decisions). Do not `task.py start` until approved. This is the
> ordered checklist for when it is.

## Preconditions

- [ ] Scope tier chosen (A = `/materials/` only; B = recommended full set).
- [ ] Verification path chosen. `docker.exe` is reachable from WSL (Docker Desktop
      29.6.1) so the local build test is available; the monitored Render deploy is
      the final gate regardless.
- [ ] On a fresh branch off `main` (e.g. `chore/render-image-slim`). NOT direct to
      main — merging main auto-deploys Render.

## Steps

1. **Edit `.dockerignore`** — append the dir-anchored block from `design.md`
   (Tier B):
   ```
   # --- Dev/build-only: never used by the runtime container (npm start = app/ws-bridge.js) ---
   tools/
   .local/
   /materials/
   .trellis/
   docs/
   ```
   For Tier A, include only `/materials/`.
   - Gate: no bare `*.md`; `workspace/materials/` NOT excluded; `app/` NOT excluded.

2. **Static check** — `npm run check` (expect pass; no code changed).

3. **Build-context / image proof** (verification path 1 or 2):
   - Path 1 (local Docker via `docker.exe`):
     - `docker.exe build -t fourier-test .` → succeeds.
     - `docker.exe run -d -p 9000:9000 --env-file app/.env --name fourier-test fourier-test`
     - `curl -s -o /dev/null -w '%{http_code}' localhost:9000/health` → `200`.
     - Pick a real id from `workspace/materials/new-book-figures` and
       `new-book-pages`; `curl` `/figures/<f>` and `/pages/<id>` → `200`.
     - Open one cached lesson via the UI or the section API → not the
       "not prepared yet" placeholder.
     - `docker.exe exec fourier-test sh -c 'ls workspace/materials/new-book-ocr | head; echo ---; ls materials 2>&1'`
       → workspace tree present; root `materials` absent.
     - `docker.exe exec fourier-test sh -c 'du -sh /app'` → note the shrink vs a
       pre-change build.
     - `docker.exe rm -f fourier-test`.
   - Path 2 (context probe only): throwaway `Dockerfile.ctx`
     (`FROM alpine\nCOPY . .\nRUN ls -d tools .local materials workspace/materials 2>&1; du -sh /`)
     — the technique the adversarial verifier used; delete the file after.
   - Gate: image no longer contains `tools/_view-cascade-baseline.json`, root
     `materials/`, `.local/`; `/health` + assets + a lesson all OK.

4. **Update `docs/sync-policy.md`** — mark "Future Cleanup" condition (1)
   satisfied for the *image* (root `materials/` no longer shipped); note the
   repo-mirror `git rm` remains a separate future step.

5. **Commit** on the branch — `chore(docker): exclude dev-only content from Render
   build context` with the required trailers. Open a PR (base `main`); PR body
   states the size delta and the verification evidence.

6. **Merge + monitor** — after approval, merge. Watch the Render deploy to
   `ready`; smoke `/health` + a `/figures/` + a `/pages/` + one lesson on the live
   URL. Keep the previous deploy pinned for rollback.

## Validation gates (must pass before merge)

- `npm run check` → exit 0.
- Image proof: canonical `workspace/materials/` present; excluded dirs absent;
  measurable size drop.
- Boot proof: `/health` 200 + representative assets 200 + one lesson renders.

## Rollback points

- Pre-merge: discard the branch.
- Post-merge build/boot failure: Render "Rollback to previous deploy", then
  `git revert` the `.dockerignore` commit on main (restores `COPY . .`). No data
  loss — nothing was deleted from the repo.
