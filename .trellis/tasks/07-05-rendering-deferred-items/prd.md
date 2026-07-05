# Rendering deferred items (drivers + demo bugs)

## Goal

Clear the **rendering-related** items of the post-refactor backlog
(`docs/REFACTOR_DONE.md` §4, `docs/phase3_deferred.md`) that were deliberately
parked when the Phase 0–3.6 refactor closed 2026-07-04. Two independently
reviewable deliverables, shipped as two PRs.

The rendering backlog splits into two structurally different problems:

1. **Render-driver weaknesses** — architectural gaps in the interactive-demo
   dispatch + the lesson-settle pipeline that are the *root causes* of several
   demo bugs, plus harness blind spots that mean the regression suite cannot
   currently *see* the demos it is meant to guard.
2. **Residual per-demo logic bugs** — small, self-contained defects in one demo
   module that are not structural.

## Deliverables (child tasks)

- **PR-A — `07-05-render-drivers-harness`** (driver + harness infra + structural
  root-cause fixes). Owner decision 2026-07-05: the structural fixes land *here*,
  in the drivers PR, not with the symptom fixes.
- **PR-B — `07-05-demo-symptom-fixes`** (residual symptom fixes only). **Stacked
  on PR-A** — both touch `app/interactive-demos/sinusoid-phasor.js`; PR-B branches
  off PR-A's head and must be merged after it.

## The six carry-forward demo bugs and their disposition

All six CONFIRMED still present 2026-07-05 (adversarial re-verification, file:line
in each child's design). Source: `phase3_deferred.md §1c`, `REFACTOR_DONE.md §4.2`.

| Bug | Sev | File | Fixed in | Why there |
|---|---|---|---|---|
| SP-5 sinusoid ignores authored controls | 3 | `sinusoid-phasor.js` | **PR-A** | structural: dispatcher control-plumbing |
| PH-4 phasor renders empty control panel | 2 | `phasor.js` | **PR-A** | structural: dispatcher control-plumbing |
| SP-1 rAF loop can race a second loop | 2 | `sinusoid-phasor.js` | **PR-A** | structural: demo dispose lifecycle contract |
| PH-6 window resize listener leak | 3 | `phasor.js` | **PR-A** | structural: demo dispose lifecycle contract |
| SP-2 reset-while-paused freezes at t=0 | 2 | `sinusoid-phasor.js` | **PR-B** | self-contained logic fix |
| SP-3 `updateControlLabels` null-deref latent | 3 | `sinusoid-phasor.js` | **PR-B** | self-contained logic fix |

## Cross-child acceptance criteria

- Both PRs: `npm run check` green; `visual-diff --check`, `css-probe --check`, and
  the cascade arbiter at the project "no regression" bar on all *then-current* views
  (existing views byte-identical unless a re-baseline is explicitly justified and
  proven deterministic via a cold double-run).
- All six bugs demonstrably fixed with before/after evidence (behavioral Playwright
  assertion or pixel/DOM check).
- The interactive-demo dispatcher passes resolved `demoControls` to *every* render
  branch (no branch structurally starved of authored controls).
- A demo dispose lifecycle contract exists; `sinusoid-phasor.js` + `phasor.js` are
  wired to it (rAF loop + window listeners torn down on re-hydration).
- The visual-diff harness has coverage (pixel and/or behavioral) for the sinusoid,
  phasor, and complex_plane demo families (§1a) and exercises at least one
  Chapter-2+ family-table dispatch path (§2b).
- Both PRs left **open** for owner review — **not auto-merged** (owner: "I'll review
  both when all done"). PR-B references PR-A and states the merge order.

## Out of scope (do not attempt this run)

- **`@layer` migration** (`§4.3`) — explicitly a trap while the `!important` wall
  stands; `!important` inverts layer precedence and the Tailwind CDN JIT injects
  unlayered `<style>`. Not touched.
- **Feedback-board `createdAt` flake (§17)** and **cascade-arbiter blind spots
  (§18/§19)** — harness-hardening items on the *feedback/sidebar/viewport* surfaces,
  tangential to lesson/demo rendering. If surfaced, record a plain `deferred:` note in
  `docs/phase3_deferred.md` (this repo uses Sev-1/2/3 + plain notes, not D-codes).
- **The other family modules' ResizeObserver-never-disconnected soft leaks** —
  GC-recoverable, not the confirmed Sev-2/3 set. The dispose *contract* is built so
  they can adopt it later, but only sinusoid/phasor are wired this run.
- Merging either PR. Owner reviews and merges.

## Execution

Unattended AFK loop (owner authorized 2026-07-05, then away). Drive PR-A to
harness-green + self-reviewed + all findings fixed-in-PR, open it; then PR-B stacked;
open it; stop and present. Do not merge. Deferred-items doc: `docs/phase3_deferred.md`.

## References

- `docs/REFACTOR_DONE.md` §4 (backlog), §4.2 (six bugs), §4.4 (harness hardening)
- `docs/phase3_deferred.md` §1c, §1a, §2b, §11, §13a
- Investigation 2026-07-05: dispatcher `app/interactive-demos/dispatcher.js:281-362`;
  settle `app/lesson-render.js:1233-1241`; harness `tools/test-utils.js`,
  `tools/visual-diff.js`, `tools/css-probe.js`.
