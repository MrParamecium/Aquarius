# Render image consolidation: drop dev-only Docker build context

## Goal

Shrink the Render backend Docker image by excluding content that the running
container provably never uses. The headline item is root `materials/` (~107M),
but a build-context audit shows the image also ships a 344M gitignored CSS
baseline and the full Playwright harness under `tools/`, plus `.local/`.

## Background

- Deploy path: `Dockerfile` (`nikolaik/python-nodejs`) -> Render
  (`aquarius-5ss0.onrender.com`). The Dockerfile ends with `COPY . .` and runs
  `CMD ["npm", "start"]` where `npm start` = `node app/ws-bridge.js`.
- **`.dockerignore` does not respect `.gitignore`.** `COPY . .` copies every
  on-disk file not matched by `.dockerignore`. The current `.dockerignore` only
  excludes `.git`, `node_modules`, logs, `.env*`, `__pycache__`, and two user
  dirs. So gitignored-but-present files are shipped to Render.
- Build-context sizes (on disk, root of repo):

  | Item | Size | Runtime need |
  |---|---|---|
  | `tools/_view-cascade-baseline.json` | 344M | none (gitignored CSS baseline) |
  | rest of `tools/` (Playwright harness) | ~22M | none (test-only) |
  | root `materials/` | 107M | none (fallback only; `workspace/materials/` wins) |
  | `.local/` | 14M | none (gitignored archives/audits) |
  | `docs/`, `.trellis/`, root `*.md` | <1M | none (repo metadata) |

- Verified runtime-needs set: **`app/` + `workspace/materials/` + `package.json`
  (npm install) + the pip deps installed by the Dockerfile.** Nothing else.
  - `app/ws-bridge.js:86-91` resolves materials to `workspace/materials/`
    (validated by `new-book-ocr/`); root `materials/` is only a fallback, no env
    override, hard-throw if neither passes.
  - All runtime dir constants derive from `TUTOR_MATERIALS_DIR`
    (=`workspace/materials/`) or `app/` (`GENERATED_DIR=app/generated`,
    `DEBUG_DIR=app/debug`, both runtime-created).
  - `ws-bridge.js` relative `require`s are all `./` within `app/`. No runtime
    file requires from `../tools`, `.local/`, or root `materials/`.
- This work is pre-authorized in principle by `docs/sync-policy.md` ("Future
  Cleanup"), which gates the root-`materials/` reduction on: (1) the Render image
  rebuilds with only `workspace/materials/` present, (2) no external consumer
  reads root `materials/`, (3) Chapter-2 protection survives.

## Requirements

R1. Add targeted, dir-anchored `.dockerignore` entries that exclude dev-only
    content from the Docker build context: `tools/`, `.local/`, root
    `/materials/`, and repo metadata (`.trellis/`, `docs/`). The result must
    shrink the shipped image by the sizes above.

R2. `workspace/materials/` MUST remain in the image (it is the canonical runtime
    tree). The exclusion of root `materials/` must be root-anchored so it never
    matches `workspace/materials/`.

R3. No runtime-critical file may be excluded. In particular the runtime prompt
    files `workspace/materials/prompts/agent-a-planner.md` and `agent-b-tutor.md`
    (`ws-bridge.js:3267,3520`) must still ship — so **no bare `*.md` pattern**.

R4. Verify the rebuilt image boots (`/health` = 200) and serves representative
    asset routes (`/figures/…`, `/pages/…`) and at least one cached lesson,
    before or immediately after the change reaches Render, with a rollback ready.

R5. Do not delete root `materials/` from the repo in this task. Excluding it from
    the *image* (via `.dockerignore`) is in scope; `git rm` of the repo mirror is
    a separately gated follow-up (owner previously chose "leave root materials/
    for now").

## Non-goals

- Repo-level deletion of root `materials/` (kept as backup mirror per
  `docs/sync-policy.md`; separate future decision).
- Reducing the base image (`nikolaik/python-nodejs`) or the pip/npm dependency
  set.
- Any change to `workspace/materials/` contents or the resolution logic.
- Frontend/Vercel changes (Vercel serves `app/` and is unaffected).

## Hard constraints

- Chapter-2 figure recrops + `page-150..223.meta.json` in **both** trees must
  remain intact (CLAUDE.md). This task does not touch `materials/` contents; it
  only changes what the *image* copies.
- No Windows-illegal filenames.
- Do not rename `aquarius_visual_latex_v2` or `AQUARIUS_CONFIG`.
- `.dockerignore` patterns must be dir-anchored; never a bare `*.md`.

## Acceptance criteria

- [ ] `.dockerignore` excludes `tools/`, `.local/`, root `/materials/`,
      `.trellis/`, `docs/`; `workspace/materials/` and `app/` are retained.
- [ ] A local or CI build proof shows the build context / image no longer
      contains `tools/_view-cascade-baseline.json`, root `materials/`, or
      `.local/` (e.g. `docker build` context size, or `docker run … ls`).
- [ ] Rebuilt container: `GET /health` = 200; a `/figures/<id>` and `/pages/<id>`
      asset = 200; one cached lesson opens without the "not prepared yet"
      placeholder.
- [ ] Render deploy succeeds (build state = ready) and the live site serves the
      same content as before; rollback path confirmed available.
- [ ] `npm run check` passes (no code change expected, but run it).
- [ ] `docs/sync-policy.md` "Future Cleanup" updated to reflect that condition
      (1) is satisfied for the *image* (root `materials/` no longer shipped),
      leaving only the repo-mirror deletion as a future step.

## Open decisions (for the maintainer at execution time)

- **Scope tier.** Minimum ask was "~107M off (root materials/)". Recommended is
  the full targeted exclusion (~450M+) since `tools/` (344M baseline) and
  `.local/` are equally never-used at runtime and equally safe. Decide whether to
  ship the minimal or the full exclusion set.
- **Verification path.** `docker.exe` is reachable from WSL (Docker Desktop
  29.6.1, confirmed 2026-07-05), so a local build+boot test is available now — the
  adversarial verifier already used it to prove the `.dockerignore` file set. A
  monitored Render deploy with one-click rollback is the final gate regardless.
  See `design.md`.
