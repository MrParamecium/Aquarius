# A3 Phase-2 results — `.app .sidebar` `!important` strip (R5→R7)

> **CLOSED 2026-07-04.** Strip executed, all five gates green, honest yield reported.
> Phase-1 gate was the precondition task `07-03-a3-gate-witness` (PR #127, merged).
> This task is Phase-2-only (R5 classify / R6 strip / R7 reconcile). $0 generation spend.

## Outcome (honest yield)

**11 `!important` stripped / 609 kept load-bearing** on the `.sidebar`-selector surface
(620 → 609; global `!important` occurrences 9,469 → 9,458). ≈ **1.8 %** strippable — far
below the spec's unverified "44.2 % safe" estimate, and the *expected* successful shape
(A2 yielded N=2; A4 was irreducible): the sidebar's geometry/colour `!important` is the
load-bearing ID/`!important` arms race; only a thin band of redundant **typography/order**
`!important` is genuinely reducible. Small N is success (the A2/A4 precedent).

## Method (R5 — fresh keep-set derivation)

Per `cascade-and-collapse.md` Rule 6 + `feedback-rederive-keepset`: reset the **entire**
`.sidebar` surface in `tools/_keep-important.json` to zero (NOT seeded from #118), re-seeded
only the `--force-mixed` cross-view carve-outs, and ran the arbiter keep-grow loop to
byte-identical convergence (3 iterations, fresh baseline at HEAD `6f0a04c`, 330 states).

| Iter | stripped | flips → grew | keep |
|---|---|---|---|
| 1 | 463 | 6095 → +443 | 627→1070 |
| 2 | 20 | 30 → +1 | 1070→1071 |
| 3 | **19** | **PASS (0)** | 1071 |

19 arbiter-NOCOMP. Rule 6.2 per-declaration audit → **8 carve-outs** (unprovable by the
per-sidebar arbiter) + **11 provably-NOCOMP-within-coverage** (stripped). Full R5 trail:
`r5-classification.md`.

## The 11 stripped (all typography/order, sidebar-internal)

| Line | selector | decl |
|---|---|---|
| 9618  | `:root[data-theme="dark"] .sidebar-version-dot` | `background:#8ec5ff` |
| 17307 | `.app.sidebar-collapsed .sidebar .menu-toggle, .app .sidebar.collapsed .menu-toggle` | `order:2` |
| 19813 | `.sidebar .sidebar-link, .sidebar .sidebar-settings-btn` | `font-weight:600` |
| 19850 | `.sidebar .syllabus-chapter` | `font-weight:800` |
| 20076 | `.app .sidebar .sidebar-link, .app .sidebar .sidebar-settings-btn` | `white-space:nowrap` |
| 20096 | `.app .sidebar .syllabus-section.active` | `white-space:nowrap` |
| 20112 | `.app .sidebar .syllabus-chapter` | `font-weight:800` |
| 20173 | `.app .sidebar .syllabus-section-caret, …-caret-placeholder` | `font-weight:800` |
| 20212 | `.app .sidebar .syllabus-section` | `white-space:normal` |
| 20214 | `.app .sidebar .syllabus-section` | `text-overflow:clip` |
| 20215 | `.app .sidebar .syllabus-section` | `overflow-wrap:anywhere` |

`git diff app/style.css` = exactly 11 ` !important` token removals (11 insertions / 11
deletions, line count net-0). Each candidate line carried exactly one `!important` (no
doubled-line pairing), so the line-keyed strip is byte-precise.

**Coupled-pair safety** (the subtle cases): L19850↔L20112 (both `.syllabus-chapter`
font-weight:800) stay 800 whether one/both/neither keeps `!important`, because the
un-stripped general rule L10144 (`.syllabus-chapter { font-weight:800 !important }`)
survives underneath at the same value. L20096↔L20212 (white-space) resolve identically:
the higher-specificity `.active` member wins for active rows, the base member for the rest.
Both are the spec's "surviving same-value `!important` competitor" case — provable only
because every competitor is top-level (`@media`-gated: 0 for all 11).

## The five gates (all green)

1. **Cascade competitor (top-level check).** For every candidate, all same-property
   competitors are top-level (`context==""`) — **`@media`-gated: 0 across all 11**, so
   viewport-independence holds (the arbiter's 5-viewport sample generalises). Post-strip
   winner is same-value in every theme×state (NOCOMP, higher-spec-same-value normal, or a
   surviving same-value `!important`). Enumerated deterministically via
   `parseDeclarations(git show HEAD:app/style.css)`; **cross-checked by a 22-agent
   adversarial workflow** (`wf_45a5c8af-c7f`, 11 candidates × cascade-lens + JS/inline-lens
   refuters, sonnet) — **0 of 11 refuted, high confidence.**
2. **arbiter `--check`** — **PASS, 330 states byte-identical** (3 themes × 5 viewports ×
   all sidebar VIEWs incl. sidebar-expanded 851 elements, collapsed, syllabus-expanded,
   collapsed-hide, collapsed-lesson-frame).
3. **css-probe `--check`** — **PASS byte-identical.** (No sidebar coverage → sanity gate.)
   A transient 4-probe `#feedbackView .feedback-reply` diff (uniform −3.266px) appeared once
   and **cleared on an identical-tree re-run → proven nondeterministic** (scrollbar/font-load
   race), not caused by the strip. See Findings.
4. **visual-diff `--check`** — **PASS.** Views `02-syllabus-open` and `20-sidebar-collapsed`
   at **0.000 %** (0/1024000), identical before→after, under the R4 strict 0.050 % threshold.
   (Lesson cache is git-tracked/present → no `pregen:bg-ch1` regeneration → $0 spend.)
5. **Inline-style / `@media` audit** — the JS-lens refuters grepped `app/*.js` + `index.html`
   for `.style.<prop>` / `setProperty` / `cssText` / `setAttribute('style'` on the affected
   classes: **zero writes.** No `@media` breakpoint gates any of these props.

`npm run check`: **PASS** (all `node --check` + `find-dead-redeclarations --validate` 19/19
+ harness-exports OK).

## Carve-outs (8 — documented, NOT stripped)

### (a) Cross-view grouped rule — `--force-mixed` MISSED it (tooling gap)
`L9580-9583` (background/color/border-color/box-shadow) + `L9600-9601` (`:hover`
color/border-color): a **19-arm `:root[data-theme="dark"]` grouped rule** spanning
`.learn-close`, `.settings-secondary-btn`, `.login-guest-btn`, `.search-box-*`,
`.attach-btn`, `.theme-toggle-*`, … . The per-sidebar arbiter never renders the
settings/login/search/learn arms → its NOCOMP verdict there is **unproven**; blast radius
exceeds coverage → carve out (Rule 6.2 a).

### (b) Unwitnessable pseudo-element
`L11844-11845` — `:root[data-theme="dark"] .sidebar-nav-shell::-webkit-scrollbar-thumb`
(background/border-color). `::-webkit-scrollbar-thumb` is not captured by the arbiter's
`getComputedStyle` element walk → untestable by this gate (Rule 6.2 b).

## Findings (Sev-3 backlog)

- **`_grow-keep-from-report.js --force-mixed` `:root`-prefix gap.** The cross-view carve-out
  filter skips any comma-arm starting with `:root`. When **every** arm is
  `:root[data-theme] .<non-sidebar>` (the L9580 rule), the whole rule escapes carve-out.
  The `:root`/`@` guard should test the token *after* the `:root[…]`/`@media` wrapper.
  Caught by hand here; fix so future surfaces don't silently under-carve.
- **css-probe `#feedbackView .feedback-reply` nondeterminism.** 4 probes (reply/​reply-context
  width + `::before` left) intermittently shift a uniform −3.266px — a shared-container
  available-width race (scrollbar/​font-load). Orthogonal to A3; flag for a settle-before-
  snapshot hardening of the `S-feedback-rest` state.

## Acceptance criteria

- [x] Gate (R1-R4) committed + green before strip — PR #127 (precondition task), merged.
- [x] Every stripped decl proven-NOCOMP + all five gates byte-identical; `npm run check` green.
- [x] `.app .sidebar` `!important` drops by exactly the stripped set (620→609); residual is the
      documented load-bearing floor.
- [x] Carve-outs (8) documented with surface + reason; honest-yield line reported (11 / 609).
- [x] `REFACTOR_DONE.md` §1 DoD box + §A3 + §2 reconciled to the measured outcome.

## Provenance

- Baselines: arbiter (`_view-cascade-baseline.json`, gitignored) regenerated at HEAD `6f0a04c`;
  css-probe + visual baselines committed, `--check`-only (no needless re-baseline).
- Change set: `app/style.css` (−11 tokens) + `tools/_keep-important.json` (1084→1073 lines,
  the 11 stripped lines leave the keep-set) + this task dir + REFACTOR_DONE reconcile.
- Adversarial workflow transcripts: `subagents/workflows/wf_45a5c8af-c7f/`.
