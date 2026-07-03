# A3 — `.app .sidebar` strip: technical design

> Companion to `prd.md`. Covers the gate architecture (Phase 1) and the strip
> mechanism (Phase 2). All Phase-1 changes are **test-only** (`tools/**`); the only
> production change is the Phase-2 `app/style.css` downgrades.

## Architecture: two phases, one review checkpoint

```
Phase 1  BUILD THE GATE (tools/** only)            Phase 2  CLASSIFY + STRIP (app/style.css)
─────────────────────────────────────────         ─────────────────────────────────────────
R1 combined collapsed+syllabus witness  ─┐         R5 fresh arbiter keep-set derivation
R2 syllabus :hover/.active coverage      ├─ commit  R6 strip proven-NOCOMP only, 5-gate each
R3 collapsed .lesson-page-frame guard    │  + green  R7 carve-out doc + honest-yield report
R4 tight per-view failRatio             ─┘  ──► REVIEW ──► (then and only then) strip
```

The review checkpoint after Phase 1 is mandatory: a strip is only as trustworthy as the
witness that gates it, so FlyM1ss reviews the *gate* (does it actually observe the flips a
strip could cause?) before any `app/style.css` edit. This mirrors how the S14 tall-content
witness was built and reviewed **before** A4 touched the Band-2 anchors.

## Tool choice (decided from evidence, not preference)

**Primary witness = the computed-style arbiter `tools/_view-cascade-probe.js`.**
Rationale, grounded in A1's outcome: the entire reason A1 could be *proven* converged is
that a computed-style arbiter sees cascade flips that pixel-diff cannot (off-screen,
sub-threshold, `display:none`). The sidebar surface has exactly those blind spots
(collapsed chrome, hidden panels, hover/active pseudo-states). The arbiter **already** carries
`sidebar-expanded` (5 hover interactions) + `sidebar-collapsed` (2 interactions) VIEWs from
#118 — R1-R3 extend that existing structure rather than invent a system.

**Pixel backstop = `tools/visual-diff.js` views 02/20 at a tight `failRatio`** (R4) — catches
anything geometric the arbiter's property list misses, the same belt-and-suspenders pairing
A1 used (D1 css-probe floor + visual-diff 14b/14c/14d).

`tools/css-probe.js` (the package.json-wired durable gate) has zero sidebar coverage today.
**Open design question (verify at Phase-1 start):** whether a durable `S-sidebar-collapsed`
css-probe state is worth adding for CI permanence, or whether the arbiter (run manually) +
tightened visual-diff suffice. Lean: add a minimal durable css-probe sidebar state if a
fail-closed winner sentinel is constructible (it was NOT for S14 Band-2 — do not assume).

## The combined-state nuance (the crux of R1 — must verify before building)

Under `.app.sidebar-collapsed`, `.sidebar .sidebar-syllabus-panel` is `display:none`
(`app/style.css` L17324) — **the app never renders the syllabus tree while collapsed.** So
R1's "combined collapsed+syllabus witness" is **not** a visibly-rendered collapsed tree.
The witness the surface actually needs is:
- **Expanded state:** syllabus tree visible → assert the `.sidebar .syllabus-*` computed
  styles, including the `:hover`/`.active` arms (R2). This is where a NOCOMP-misjudged strip
  on a tree selector would visibly regress.
- **Collapsed state:** assert the **collapse-hide cascade holds** — `.sidebar
  .sidebar-syllabus-panel` computes `display:none` (a strip must not accidentally un-hide it)
  — plus the collapsed `.lesson-page-frame` geometry (R3).

Capturing this correctly is the difference between a real gate and a decorative one.
**Verification to run at Phase-1 start** (before writing the VIEW): confirm via the live DOM
(arbiter harness, guest mode) that (a) the panel is display:none when collapsed, (b) no
product state shows a collapsed-sidebar visible tree. If that assumption is wrong, R1 becomes
"render the tree in both states" and the VIEW grows accordingly.

## Data flow / contracts

- **Arbiter VIEW contract** (`_view-cascade-probe.js` VIEWS, ~L116-234): each VIEW =
  `{ name, setup(page), interactions[], selectors[], props[] }`; the runner sweeps 3 themes ×
  5 viewports and records computed `props` per `selector` per state into
  `_view-cascade-baseline.json`; `--check` diffs byte-identical. R1-R3 add selectors
  (`.sidebar .syllabus-section`, `.syllabus-section.active`, `.sidebar-syllabus-panel`,
  `.lesson-page-frame`) + props (display, the L18282-90 geometry set) + a hover/active
  interaction to the existing expanded/collapsed VIEWs (or a new merged VIEW).
- **Keep-set derivation (R5):** reset the sidebar-reachable subset of `tools/_keep-important.json`
  to zero, run the arbiter's keep-grow pass (`tools/_grow-keep-from-report.js` lineage) over the
  364 decls, and take the resulting load-bearing membership as the fresh classification. Never
  seed from #118's set.
- **Strip (R6):** for each proven-NOCOMP decl, delete the ` !important` token only (no selector
  or value change), re-run all five gates, keep only if byte-identical.

## The invariant (Phase-2 correctness condition)

For comma-grouped arms like `.sidebar .syllabus-X, .syllabus-X` (L5890-5923) and the
collapsed-frame group (L18278-18290), the arms have **different specificity**; the winner is
decided by specificity-then-source-order. A sidebar `!important` may be the only thing keeping
a higher-source-order, lower-specificity arm from winning. Downgrading it can hand the cascade
to a different arm → silent geometry/visibility flip. The fresh arbiter pass (R5) is what
distinguishes "no competitor" (NOCOMP, safe) from "defends an arm" (DEFENSIVE, keep); R6 trusts
only that, per-occurrence, never per-token.

## Compatibility / rollback

- Phase 1 touches only `tools/**` + committed baselines → no runtime/deploy impact; fully
  additive; rollback = revert the test commit.
- Phase 2 edits are independent per-decl ` !important` removals → rollback = restore the token;
  no structural change. Strip in small reviewable batches so a regressing batch reverts cleanly.
- No `app/config.js` / cache-key / deployed-asset surface touched (no `aquarius_visual_latex_v2`
  or `AQUARIUS_CONFIG` impact).

## Trade-offs

- **Arbiter (not in `package.json`) as primary** means the strongest gate is run manually, not
  in `npm run check`. Accepted because css-probe's fail-closed sentinel may not be constructible
  for collapsed sidebar (the S14 precedent); the manual arbiter + tight visual-diff is the same
  trust model A4/S14 relied on. Mitigation: add a durable css-probe state only if a sentinel exists.
- **Honest-yield risk:** spec's "44.2% safe" is an unverified estimate; the fresh pass may yield
  far less (A1 reachable came in lower than hoped; A2 yielded N=2). A small N is success, not
  failure — the floor *is* the load-bearing set we intend to keep.
