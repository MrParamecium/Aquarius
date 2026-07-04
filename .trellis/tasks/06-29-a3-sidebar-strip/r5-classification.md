# A3 R5 — fresh arbiter keep-set derivation (`.app .sidebar` `!important`)

> **Report-only session (2026-07-04).** No `app/style.css` edit; working tree restored
> clean after the loop. This is the honest-yield classification for the mandatory
> **review checkpoint** before any Phase-2 strip. Converged keep-set preserved at
> `scratchpad/_keep-important.CONVERGED.json`.

## Method (per `cascade-and-collapse.md` Rule 6 + `feedback-rederive-keepset`)

1. Regenerated the arbiter baseline at pristine HEAD `6f0a04c` — **330 states, 137,190
   element-snapshots** (3 themes `dawn/dusk/dark` × 5 viewports × all VIEWs), $0 spend.
2. **Reset the whole `.sidebar` surface to zero** (removed all 617 distinct sidebar keep
   lines) — NOT seeded from #118's set. Re-seeded only the `--force-mixed` structural
   carve-outs (157 cross-view/collapsed-state lines).
3. Ran the keep-grow loop (`_strip-view-important.js --view=sidebar` → arbiter `--check`
   → `_grow-keep-from-report.js --force-mixed`) to byte-identical convergence.

| Iter | stripped | flips → grew | keep |
|---|---|---|---|
| 1 | 463 | 6095 → +443 | 627→1070 |
| 2 | 20 | 30 → +1 | 1070→1071 |
| 3 | **19** | **PASS (0)** | 1071 |

## Honest yield

- **620** `.sidebar`-family `!important` decls total (617 distinct lines). The strip tool
  operates on the full `.sidebar` family — broader than the PRD's 380 `.app .sidebar`.
- **19** are arbiter-NOCOMP (byte-identical across all 330 states when stripped).
- Post-audit (Rule 6.2 (a)+(b), per declaration): **8 of the 19 are carve-outs** the
  per-sidebar arbiter cannot actually prove → **11 provably-NOCOMP within coverage.**

> **≈ 11 / 620 ≈ 1.8 %** — far below the spec's unverified "44.2 % safe" estimate. Small N
> is the expected, successful outcome (A2 yielded N=2, A4 irreducible): the sidebar's
> geometry/colour `!important` is load-bearing (the ID/`!important` arms race), and only a
> thin band of redundant typography `!important` is genuinely strippable.

## The 11 provably-NOCOMP-within-coverage (Phase-2 R6 candidates)

All sidebar-internal, rendered under a driven VIEW root, prop ∈ PROP_LIST, dark swept.

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

These are **arbiter-proven only**; each still owes the other four R6 gates before strip:
cascade-competitor top-level check, css-probe `--check` (no sidebar coverage → sanity
only), visual-diff `--check` on views 02/20 at the tight failRatio, and the inline-style
/`@media` audit.

## Carve-outs (documented, NOT stripped)

### (a) Cross-view grouped rule — force-mixed MISSED it (tooling gap)
`L9580-9583` (background/color/border-color/box-shadow) + `L9600-9601` (`:hover`
color/border-color) — a **19-arm `:root[data-theme="dark"]` grouped rule** spanning
`.learn-close`, `.book-nav-btn`, `.settings-secondary-btn`, `.login-guest-btn`,
`.search-box-*`, `.attach-btn`, `.theme-toggle-*`, … . The per-sidebar arbiter never
renders the settings/login/search/learn arms, so its NOCOMP verdict is **unproven**.
Blast radius exceeds sidebar coverage → carve out regardless of reachability (Rule 6.2 a).

> **Tooling finding:** `_grow-keep-from-report.js --force-mixed` skips any arm starting
> with `:root` (meant for theme-scoped *sidebar* arms). When **every** arm is
> `:root[data-theme] .<non-sidebar>`, the rule escapes the cross-view carve-out. The
> `:root`/`@` guard should test the token *after* the `:root[…]`/`@media` wrapper, not the
> wrapper itself. Caught here by hand; worth a Sev-3 backlog fix so future surfaces don't
> silently under-carve.

### (b) Unwitnessable pseudo-element
`L11844-11845` — `:root[data-theme="dark"] .sidebar-nav-shell::-webkit-scrollbar-thumb`
(background / border-color). `::-webkit-scrollbar-thumb` is not captured by the arbiter's
`getComputedStyle` element walk → its NOCOMP is untestable by this gate (Rule 6.2 b).

## Restore / provenance

- `git checkout app/style.css tools/_keep-important.json` — tree clean, nothing committed.
- Arbiter baseline (`_view-cascade-baseline.json`, gitignored) is fresh at HEAD `6f0a04c`.
- Converged keep-set: `scratchpad/_keep-important.CONVERGED.json` (for R6 re-use).
