# Refactor — Definition of Done

Owner: FlyM1ss
Drafted: 2026-06-25
Companion + finish-line doc for `docs/REFACTOR_PLAN.md` (canonical history) and
`docs/PHASE3.6_SPEC.md` (CSS-collapse protocol). This document answers one
question: **what must be true to call the refactor finished, and what is the
shortest verified path to get there.**

It is grounded in a 6-agent read-only verification sweep (workflow `w5rd3xio0`,
2026-06-25) that re-counted every CSS surface, mapped the live `app.js`
extraction seams, confirmed the three "landmines" against current line numbers,
re-verified the six carry-forward demo bugs, inventoried the harness gaps, and
established the exact branch/PR state. Numbers below are grep/cascade-resolver
verified; treat per-surface `!important` figures as planning-grade.

The refactor "can go on forever." This doc draws the line at a state that
**re-organizes the project into a maintainable shape for at least a couple
months of dev**: the `!important`/doubled-ID CSS wall brought down to its
irreducible load-bearing floor, `app.js` reasonably split (~5K), and the loose
correctness threads tied off — with everything else parked in a clean,
triaged backlog.

---

> ## 🔄 RECONCILED 2026-06-27 (git HEAD `2d7a757` = origin/main)
>
> This doc's §1 checklist + §3 workstreams stay valid; only counts/status move since the 2026-06-25 draft:
> - **#118** (`2d7a757`) shipped a **partial** feedback+sidebar strip (feedback 528→472, sidebar 656→620) — so **A1 and A3 are STARTED, not complete**; A1 is no longer "the next untouched target." *(Since superseded: A1 CLOSED 2026-07-03 — see the last bullet + §A1; only A3 remains.)*
> - **Workstream B is COMPLETE** — B4 (`app/lesson-render.js`) shipped in **#116**; `app/app.js` = **5,720** lines (marginally above the ~5,100 stretch target; "reasonably split" met). The §1 `app.js` box can be checked.
> - **Landmine C1** (unclosed `.learn-followup-bar {` brace, §C1) shipped in **#111** (`bd56ef9`). **C2** (panelFocus desync) **MERGED as #120 (`4d7b47b`)** — probe-neutral, baseline unchanged (see §C2). A4's C2 prerequisite is met; the S4–S11 composer-state harness (A4's second gate) **MERGED as #122 (`b3086c6`)** and the S13 `.learn-textbook-active` Band-1 probe **MERGED as #123 (`62ddf06`)** — A4's composer-state matrix is in place (S5 dropped as non-constructible, S1/S8 deferred; **S14 Band-2 dropped = named no-css-probe-witness gap**; see §A0).
> - Current metrics (supersede §2's 06-25 table): `app/style.css` **32,279** lines / **9,286** `!important`-lines / **402** doubled-IDs (A2 warm-up **#124** `3b4d7d8` de-doubled `.mistake-workspace` ×2, 404→402; N=2 de-doubled / M=10 MN-band proven-DEFENSIVE-kept); `runtime-collapsed.css` **1,523** / **876** / **58**.
> - §2 per-view dispositions are git-CONFIRMED (per-view trajectory in `PHASE3.6_SPEC.md` top STATUS block): settings & MN were ✅ stripped by #106 — **do not re-seed them**. A1 `#feedbackView` is now DONE (#119 guard + measured floor; **A1 CLOSED 2026-07-03** — floor 465, 100% keep-set-covered, §A1). **Genuinely-next = close the S14 Band-2 witness gap, then A4** (collapse-and-merge the §3d composer cluster vs `runtime-collapsed.css` — NOT piecemeal de-double) — *both since done (S14 witness #125; A4 CLOSED 2026-06-29, §A4); A3 `.app .sidebar` was the last surface — **A3 CLOSED 2026-07-04** (11 stripped / 609 floor, §A3), so the §1 `!important`/doubled-ID collapse is at its load-bearing floor; only the §A5 media-gated dead-redeclaration box remains open per §1's own checklist.*

---

## 0. Scope decisions (locked 2026-06-25 with FlyM1ss)

| # | Decision | Choice |
|---|---|---|
| 1 | CSS-collapse "done" line | **Full Phase 3.6** — the entire `!important` wall + all doubled-IDs + `.app .sidebar` + the §3d composer chain. The harness infra gates are therefore **in scope** (hard prerequisites, not optional). |
| 2 | `app.js` split target | **~5K** via the named seams (verified as **5** seams, see §3 Workstream B). |
| 3 | DB migration (Phase 4) | **Out of scope** — first item *after* DONE; needs its own design conversation. |
| 4 | Standalone landmines | **In scope** (small dedicated PRs). |
| 5 | Carry-forward demo bugs | **Out of scope** — fixed *after* refactor (one PR per module). |

> **Framing change (verified):** Phase 3.6 is **no longer "one big PR when
> complete."** PRs #101, #104, #105, #106 already merged to `origin/main`
> incrementally, each gated by the cascade arbiter + probe harness. Continue
> that pattern — ship one reviewed, individually-gated PR per surface. The
> AFK "branch-only until complete" constraint in `PHASE3.6_SPEC.md §6` is
> **superseded**.

---

## 1. Definition of DONE (the exit checklist)

The refactor is **DONE** when every box below is checked. CSS completion is
defined by **surface disposition**, not a magic line/`!important` target —
because de-doubling is ~0 net lines by design and the residual `!important`
floor *is* the load-bearing set we intend to keep.

### CSS structural collapse (Full Phase 3.6)
- [x] **`#feedbackView`** — ✅ CLOSED (A1, 2026-07-03, docs-only): #119 already delivered the criterion — non-load-bearing stripped, arbiter-verified against the seeded multi-tone fixture, permanent D1 css-probe floor guard. Measured floor **465** decls, 100% keep-set-covered; 15 arbiter-unreachable carve-outs accepted cite-and-keep (§A1).
- [x] **`.app .sidebar`** — ✅ CLOSED (A3, 2026-07-04): non-load-bearing `!important` stripped to floor under multi-view + sidebar-collapsed arbiter coverage (§A3). Gate PR #127; strip = **11 NOCOMP stripped / 609 kept** (620→609 on the `.sidebar` surface), all 5 gates byte-identical, 8 carve-outs cite-and-keep. Honest yield ≈1.8% (small-N success, A2/A4 precedent).
- [x] **§3d composer chain — verified IRREDUCIBLE-by-design (A4 CLOSED 2026-06-29, docs-only).** A 24-agent adversarial re-derivation proved the doubled-ID repetition IS the load-bearing cross-file specificity-war mechanism, not removable debt — every war-pair is IRREDUCIBLE / NO_BENEFIT in isolation; the only reductions need new witnesses + a high-risk two-file lockstep for ~0 net gain. The invariant *style.css eff-specificity > rcc eff-specificity* is preserved precisely BY the repetition. Proof + re-derived anchors: `docs/A4_COMPOSER_IRREDUCIBLE.md` (§A4).
- [x] **Doubled-ID inventory fully dispositioned** — the composer cluster (the bulk, ~368/402) is the documented LOAD-BEARING floor (A4, irreducible-by-design); the non-composer subset (MN-band, close-btn, learn-internal) was settled by A2 #124 (`3b4d7d8`) as pervasively load-bearing (N=2 de-doubled, rest proven-DEFENSIVE-kept). Residual doubled-IDs (402) == that documented floor.
- [ ] **Media-gated dead-redeclaration slice** (78 style + 6 runtime) deleted under narrow/`@container` probe coverage, or documented as provably unreachable (§A5).
- [ ] **Both harnesses green at the full matrix** — `css-probe --check` and `visual-diff --check` pass across S1–S12 + N0–N4; pre-collapse baselines committed on `main`.

### `app.js` split
- [ ] **`app/app.js` ≤ ~5,100 lines** via the 5 seams in §B; `npm run check` green and 35-view `visual-diff` green per PR.

### Landmines (correctness)
- [ ] **Unclosed `.learn-followup-bar {` brace** (style.css L5464) resolved — dead block deleted, render-neutrality verified (§C1).
- [ ] **css-probe S2/S3 `panelFocus` desync** fixed — state driven through `applyLearnPanelFocusState()` rather than hand-poking the attribute (§C2; also unblocks the §3d composer probes).

### Bookkeeping
- [ ] `docs/REFACTOR_PLAN.md` status header updated to "refactor complete."
- [ ] `docs/phase3_deferred.md` pruned to only the **post-refactor backlog** enumerated in §4 of this doc.

---

## 2. Where we are now (verified 2026-06-25, `HEAD` == `origin/main`)

| File | Lines | `!important` | Doubled-ID `#X#X` |
|---|---:|---:|---:|
| `app/style.css` | 33,328 | 9,884 occ (9,694 lines) | 404 (`#learnView#learnView` = 246) |
| `app/css/runtime-collapsed.css` | 1,602 | 888 | — |
| `app/app.js` | 8,339 | — | — |
| `app/ws-bridge.js` | 5,348 | — | — |
| `app/index.html` | 1,655 | — | — |

> Methodology: `wc -l`, `grep -o '!important'` (occurrences) / `grep -c`
> (lines), `grep -oE '#id#id'`. Counts are methodology-sensitive — **always
> re-grep before quoting in a PR.**

**Per-surface `!important` (block-aware proxy, planning-grade):**

| Surface | style.css | Isolation | Disposition |
|---|---:|---|---|
| `#learnView` (core) | ~3,410 | shared (cross-file arms race) | mixed — §3d + doubled-ID tranches |
| `.app .sidebar` | ~639 | **shared** (syllabus tree + learn-collapsed layout) | ✅ A3 CLOSED 2026-07-04 — 11 stripped / 609 floor (§A3) |
| `#feedbackView` | ~503 | isolated | ✅ A1 CLOSED 2026-07-03 — floor 465, D1-guarded (§A1) |
| `#mistakeNotebookView` | ~237 | isolated | ✅ stripped −193 (#106) |
| `#settingsView` | ~64 | isolated | ✅ stripped −21 (#106) |
| `#courseTrackerView` | ~52 | isolated | ✅ stripped −384 CT+pref (#106) |
| `#preferenceView` | ~40 | isolated | ✅ (bundled above) |
| runtime `#learnFollowupBar` / `#learnChatCol` | 141 / 386 | cross-file | §3d composer (A4) |

**Already shipped on `origin/main` (Phase 3.6 so far):**
- `#101` computed-style `css-probe` harness; `#104` +4 narrow-viewport states (N1–N4).
- `#105` −10k-line collapse (dead-CSS deletion of renamed-away learn-chrome IDs — 6 sweeps, −4,138 lines — + top-level redeclaration-pileup sweep + empty husks).
- `#106` `!important` strip on the four DOM-isolated views (CT/pref/settings/MN = −598) via the `tools/_view-cascade-probe.js` arbiter (108–150 states byte-identical) + visual-diff 35/35.
- Doubled-ID COLLAPSE-SAFE-NOW tranches: page-corner −58, learn-topbar −11, mistake-cards −4, textbook Pilot 0 −35.

**The free-deletion vein (dead CSS) is exhausted** for the lecture/learn-chrome
family. What remains is the cascade-changing grind — every remaining surface
changes cascade *outcomes* and is verified render-neutral only via the
computed-style arbiter, never pixel-diff alone.

> **Already done — do NOT re-mine** (these appear "open" in older session
> summaries but `REFACTOR_PLAN.md` confirms them shipped): Phase 2 **#18**
> (interactive-demos subsystem → `app/interactive-demos/` family modules,
> −1,042 lines) and **#19** (Glass + chapter-overview CSS, PRs #63–#68) are
> **complete**. They are not part of any workstream below.

---

## 3. The remaining work

Three workstreams. **A (CSS)** is the long pole and is internally sequential.
**B (`app.js`)** runs fully in parallel — it never touches the cascade.
**C (landmines)** are independent small PRs.

### Workstream A — CSS structural collapse to completion (Full Phase 3.6)

The critical path is **harness infra → isolated strip → entangled strip →
composer last**, because pixel-diff is provably blind on these surfaces (the
PR #71 regression painted outside the 1280×800 capture and passed at
0/1,024,000 px *twice*).

#### A0 — Harness prerequisites (build these first; they gate A1–A5)

These are test-only, low-risk, and land on `main` separately so every surface
verifies against a `main` baseline. Source of truth: `PHASE3.6_SPEC.md §4`.

| Gate | What | Unblocks |
|---|---|---|
| Feedback probe state + fixture | ✅ **SHIPPED (#119, `e2f3431`) — the D1 floor guard.** 5 `S-feedback-*` css-probe states on the seeded multi-tone fixture `tools/fixtures/feedback-board.populated.json` (tone-0..5, is-left/is-right, reply-context); floor frozen in `tools/_view-important.json['#feedbackView']`. | **A1** — gate met; A1 CLOSED 2026-07-03 (§A1) |
| `css-probe` states S4/S6/S7/S9/S10/S11 | ✅ **SHIPPED (2026-06-28, pending PR; stacked on §C2).** S4 (normal + chat visible), S6 (empty-state not chat-active), S7 (is-chat-active), S9 (explain-collapsed), S10 (chapter-overview-active), S11 (chapter-overview-split-active) — each drives the **real** production fn (`openLearnQaSidebar` / `applyLearnPanelFocusState` / `updateLearnChatEmptyState` / `applyLearnExplainCollapsedState` / `setChapterOverviewLayoutActive`) + fail-closed winner sentinel, sentinels derived empirically. **S5 (`:focus-within`) DROPPED** — focus engages and `:focus-within` matches but every focus-within decl loses to the `!important` wall (no constructible winner → would be fail-open; visual-diff view 09 retains pixel cover). **S1/S8 deferred** (view 06 pixel-covers resting). Empirical finding: the §3d composer chrome is **panel-invariant** at desktop (S4≡S2 values), so the new states pin only the cascade each gates. | **A4** (composer chain) — gate now met |
| `panelFocus` desync fix (= §C2) | Drive S2/S3 through `applyLearnPanelFocusState()` (app.js:2725) instead of hand-setting `dataset.panelFocus`; have `resetLessonChromeState` also clear `chat-collapsed`/`explain-collapsed`. | **A4** (correct composer-state capture) |
| Narrow per-selector probes | Extend N0–N4 (currently only 3 learn-chrome selectors on a §1.1-1 DOM) to the home-ask / feedback / login / MN / chapter-overview / settings families; add ≤560px state + an `@container lecture-panel` panel-width driver. | **A2** (narrow tranches) + **A5** (media-gated slice) |

`css-probe` states on the branch today (21): `S2-qa-wide`, `S3-qa-full`,
`S4-normal-chat`, `S6-chat-empty`, `S7-chat-active`, `S9-explain-collapsed`,
`S10-overview-active`, `S11-overview-split`, `S12-textbook-qa-open`,
`S13-textbook-active`, `S-page-corner`, `N0–N4`, `S-feedback-*`. The S4–S11 baseline was captured
**additively** off the §C2 branch (which is itself off pre-collapse `main`):
`git diff css-probe-baseline.json` = +264/−0, every pre-existing key byte-identical.
**`S13-textbook-active` SHIPPED (2026-06-28, pending PR)** — drives the real `_setLearnMode('textbook')`
with `_learnLayoutMode='lesson'`; fail-closed sentinel = `#learnExplainScroll` Band-1 2-radial gradient
(L25124, empirically ≠ base ≠ overview); additive `+56/−0`. Covers the **7 Band-1 (textbook-normal)
`.learn-textbook-active` doubled-IDs** (L25118–25157). **`S14-textbook-overview` (the 7 Band-2
`.chapter-overview-active.learn-textbook-active` combined-band occurrences, L24575–24609) was DROPPED**
— no fail-closed sentinel constructible (every Band-2 winner used-value-collapses to the overview-alone
fallback, is inline-masked, is also provided by Band-1, or is `__MISSING__`; S5 discipline). **Named
coverage gap:** those 7 Band-2 doubled-IDs carry **no css-probe witness** → A2's Band-2 strip must lean
on visual-diff + a fresh arbiter keep-set. (Corrects earlier "13 explain-rail rules": the measured count
is **14 occurrences in two cascade bands**.)
> **S14 closure decision (2026-06-29, FlyM1ss):** drop **re-verified** by attacking it with a property
> the original matrix never tried — `#learnExplainScroll` `overscroll-behavior` (Band-2 L24582; no S14-DOM
> competitor sets it). It still fails: `#learnExplainScroll` carries class `learn-explain-scroll`
> (index.html:686) and `.learn-explain-scroll` (style.css L12102-12104, !important) already supplies
> `overscroll-behavior:contain` — a *same-element class backstop* (a 5th death-mode). The gap is now
> twice-verified. **Risk narrowed:** only **2** Band-2 decls are unique+geometric (`#learnExplainScroll`
> height:100%, `.textbook-pages-flow` min-height/padding-bottom, L24598-99); the other 5 are
> Band-1-redundant (Band-1 is S13-guarded) or inline-masked → backstopped through a de-double. Those 2 are
> witnessable by **no** tool (css-probe/arbiter/visual-diff all collapse) without a **tall-content
> combined-state fixture**. **Resolution = defer to A4 with a hard precondition (no speculative pre-build);
> see §A4.**

#### A1 — `#feedbackView` `!important` strip — ✅ CLOSED 2026-07-03 (floor reached + guarded; docs-only close)

> **DONE = arbiter floor reached, D1-guarded, bookkeeping reconciled** (task
> `06-29-a1-feedbackview-close`, docs-only — no `app/**` change). A 4-agent recon
> (2026-06-29, measured at HEAD `6180fc0`, brace-aware parse — NOT from docs) confirmed
> the surface is **already converged at its load-bearing floor**: **465** `!important`
> decls target `#feedbackView` or descendants (197 selectors); trajectory 651 (pre-#105)
> → 472 (#118) → **465** (#119). **100% keep-set-covered** — 415 exact-line matches in
> `tools/_keep-important.json` + 50 multi-line value continuations whose declaration-START
> line is kept → 0 uncovered; there is no present-but-unstripped decl the arbiter can see.
>
> **#119 (`e2f3431`) satisfied the §1 criterion in substance**: it applied the fresh-reset
> discipline (controlled reset of the 457 arbiter-reachable feedback keep lines, re-derived
> load-bearing membership, stripped 7 `border-radius` over-keeps from #118) and shipped the
> permanent **D1 css-probe floor guard** — 5 `S-feedback-*` states on the seeded fixture
> `tools/fixtures/feedback-board.populated.json` (tone-0..5 / is-left / is-right /
> reply-context); floor frozen in `tools/_view-important.json['#feedbackView']`, required
> at `tools/css-probe.js:397`. A1's residual deliverable was this reconciliation only.
>
> **Accepted carve-outs (cite-and-keep, 15 decls):** the arbiter-unreachable subset
> preserved by #119 — headline members incl. submit-btn `:disabled`
> (`app/style.css` L25244-25247), the `:active` transform (L25240), and the cross-view
> close-btn border (L24702); NOT an exhaustive enumeration. Arbiter-
> **unreachable** by nature (synthetic `mouse.down`/`disabled=true` probing produced
> false-positive cascade flips), so they rest on manual cite-and-keep, the same disposition
> as the project's other unwitnessable decls (A2/A4 precedent). Witness extension filed as
> Sev-3 backlog (§4 item 4); expected yield ~0.

#### A2 — Doubled-ID tranches (`PHASE3.6_SPEC.md §6.2` work-list)

De-doubling is ~0 net lines; progress is measured in doubled-ID count. Order
and gating:

| Tranche | Count | Gate | Notes |
|---|---:|---|---|
| Residual COLLAPSE-SAFE-NOW | ~3 | small new probes | close-btns L34088/34089 + composer `.bottom-actions` L33233 (z-index/overflow). |
| Dead-code deletion subset | 22 | DOM grep + visual-diff | `#learnLecturePageIndicator` / `#learnExplainBottomRail` / `#learnToolbarPagination` chains — IDs in **no HTML/JS**. **Line-reducing** (not collapse). Mostly cleared by #105 sweeps; finish the remainder. |
| NEEDS-NARROW-VIEWPORT | 12 | A0 narrow probes | MN L34808/34838/34842 + composer 33277 (≤1180); MN L34848+ + topbar L34297+ (≤820). |
| NEEDS-STATE-MATRIX | 28 | A0 S4–S11 + S13 | S10/S11 + `.is-chat-active` (S6/S7) + `.panel-normal` (S4) + `.learn-textbook-active` **Band 1** (S13, 7 occ) now **probe-covered** (2026-06-28). Remaining: the **7 Band-2** `.chapter-overview-active.learn-textbook-active` occurrences (**named gap — no css-probe witness**, S14 dropped; cover via visual-diff + a fresh arbiter keep-set) + `[data-custom-split]`. |
| NEEDS-NEW-VIEW | ~7 | isolated-view bootstraps | settings/preference/courseTracker close-btns; open-mode-menu composer. |
| LOAD-BEARING (never touch) | 20 | — | cite-and-skip: composer L33191/33213-16/33238/37415-26, MN L34770/34784/34816+, topbar L34088/34176-78/34193-94, close-btn L34091. |

#### A3 — `.app .sidebar` `!important` strip — ✅ CLOSED 2026-07-04 (gate #127 + strip done)

> **Split (FlyM1ss, 2026-07-03) into gate + strip** — the S14-witness-before-A4 pattern:
> - **Gate ✅ BUILT — PR #127** (branch `a3/gate-witness`, task `07-03-a3-gate-witness`,
>   harness-only, `app/**` byte-identical). Closes the 3 coverage gaps below via 3 new
>   arbiter VIEWs (`sidebar-syllabus-expanded`, `sidebar-collapsed-hide`,
>   `sidebar-collapsed-lesson-frame`) + PROP_LIST staples + visual-diff 02/20
>   `failRatio: 0.0005`. Canary-proven: each VIEW goes RED on a deliberate flip of its
>   target's cascade winner (7050 / 60 / 60), attribution clean. Arbiter determinism
>   bug found+fixed en route (`settle()` now awaits `document.fonts.ready`; no-op control
>   PASS 330 states byte-identical). css-probe durable sidebar state dropped as a named
>   gap (no fail-closed sentinel — S14 precedent). **Run the arbiter with
>   `node --max-old-space-size=5120`.** Full trail: task `results.md`.
> - **Strip ✅ DONE — A3-proper (`06-29-a3-sidebar-strip`), 2026-07-04.** Fresh arbiter
>   keep-grow over the `.sidebar` surface (620 decls, reset-to-zero not seeded) → 19 NOCOMP
>   → **11 stripped / 609 kept** (8 carve-outs). All 5 gates byte-identical: arbiter 330
>   states + a **22-agent adversarial cascade/JS cross-check** (0/11 refuted) + visual-diff
>   02/20 @ 0.000% + css-probe + `npm run check`. `@media`-gated competitors: **0** across
>   all 11 → viewport-independent neutrality. Honest yield ≈ 1.8% (typography/order only;
>   the geometry/colour wall is the load-bearing floor). Trail: task `results.md`.
> - **Finding CORRECTED by the measurement:** the gate-witness prediction that the syllabus
>   arms L5913-5928 (`.sidebar .syllabus-section*`) are "likely NOCOMP/dead" did **not** hold
>   — the fresh keep-grow retained them as **load-bearing** (they flip when stripped). The
>   actual strippable NOCOMP band was the *redundant typography* on the higher-specificity
>   `.app .sidebar .syllabus-section*`/`.sidebar-link`/`.syllabus-chapter` winners
>   (L20076/20096/20112/20173/20212/20214/20215 + L19813/19850), not the L5913-5928 arms.
> - **Carve-outs (8, cite-and-keep):** L9580-83/9600-01 = a 19-arm `:root[data-theme="dark"]`
>   cross-view grouped rule that `--force-mixed` missed (its `:root`-prefix guard skips the
>   whole rule when every arm is `:root[…] .<non-sidebar>` — Sev-3 tooling fix filed);
>   L11844-45 = `::-webkit-scrollbar-thumb`, unwitnessable by the arbiter's element walk.

**Files:** `app/style.css` (`.app .sidebar` chains + comma-grouped `.sidebar` arms).
**Risk:** **NOT isolated** — 169 `.app .sidebar` chains + 193 comma-grouped arms pair sidebar selectors with bare-class arms reachable from the **syllabus tree** (`.sidebar .syllabus-*, .syllabus-*`) and gate **learn-view layout** via `.app.sidebar-collapsed #learnView #learnBody.chat-collapsed .lesson-page-frame`. Stripping a sidebar `!important` can flip the cascade on the syllabus tree and on collapsed learn-view geometry.
**Gate:** ✅ the above (PR #127) — multi-view arbiter coverage **including a sidebar-collapsed state** + the syllabus tree, before any strip. ~639 candidates (375 inside `.app .sidebar` blocks by the fresh measurement); spec quotes 44.2% safe — the highest blast radius of the view strips.

#### A4 — §3d learn-view composer chain — ✅ CLOSED 2026-06-29 (verified IRREDUCIBLE-by-design)

> **DONE = irreducible-by-design, docs-only (task `06-29-a4-composer-chain`).** A
> 24-agent adversarial re-derivation at HEAD `9c27ba0` (8 mappers × 2 skeptics) proved
> the §3d composer-chain doubled-ID pattern is **the load-bearing cross-file
> specificity-war mechanism, not removable debt** — safe reduction yield is ~0. Full
> proof + per-surface cascade evidence: **`docs/A4_COMPOSER_IRREDUCIBLE.md`**. The
> "collapse-and-merge the five war-pairs in lockstep" goal below was the *plan*; the
> *measured* outcome is that every war-pair is IRREDUCIBLE / NO_BENEFIT in isolation.
> Decision (FlyM1ss, 2026-06-29): document-and-close, no production change.

**Files:** `app/style.css` ↔ `app/css/runtime-collapsed.css`. The only region where
runtime-collapsed.css (loads LAST) sets **different values on the same selectors** — a
true cross-file specificity war. **Invariant** (preserved precisely BY the doubled-ID
repetition): *style.css effective specificity > rcc effective specificity*. Remove the
repetition → ties/loses to rcc on source order → regress by construction.

**Re-derived anchors (the prior anchors below were STALE/out-of-range — `style L41334` /
`rcc L1976/L2036` on files of 32,514 / 1,562 lines):**

| War-pair | style.css winner | rcc competitor | FINAL verdict |
|---|---|---|---|
| WP1 followup geometry | L30901-30920 `(12,0,0)` | L1435-1462 `(8,0,0)` | **IRREDUCIBLE**; `width` fail-open |
| WP2 followup z-index/overflow | L23940-23947 `(8,0,0)` z40 | L1089-1113 `(4,0,0)` z3 | IRREDUCIBLE iso; LOCKSTEP-able; **witnessed** |
| WP3 #learnChatCol bg | L27795-27801 `(6,0,0)` | L890-911 *same value* | SAFE but **≈0 benefit** |
| WP4 #learnModeMenu pos | L23954-23977 + later L30860 | L1250-1276 `(2,1,0)` | **IRREDUCIBLE** (skeptic-refuted); fail-open |
| WP5 #learnChatEmptyState transform | L23795-23798 (loser) | L1494-1498 (winner) | NO_BENEFIT |
| Group A close-btn | L24685-24706 + L27005 | (same-file) | NO_BENEFIT (#feedbackView arm irreducible) |
| Group C learn-internal | L27795/L27803 (glass DEAD) | L1435/L1503/L1511 | NO_BENEFIT (skeptic-refuted) |
| Band-2 textbook | L24575-24609; fallback L23115 | (none) | IRREDUCIBLE (keep-set L24598/24599) |

**Band-2 NOCOMP note:** `#learnExplainScroll height:100%` (L24577) is a dead decl
(fallback = overview-alone `calc(100dvh−header)` @L23115 = identical 738px) — **safe to
remove anytime but LEFT IN PLACE**: removal yields 0 doubled-ID reduction and shifts 564
committed keep-set line-refs >24577 (pure churn). If ever removed, first re-confirm the
`calc==100%-of-parent` equivalence at a 2nd viewport height (700h/1000h) — MEASURED only @800h (#125).

**Gate (had a reduction shipped):** css-probe S2–S13 byte-identical is the load-bearing
gate; visual-diff is catch-all. WP2 is the only war-pair witnessed today; WP1 `width`,
WP4 menu position, WP5 transform are **fail-open** (see backlog §4.4).

<details><summary><b>Historical — S14 witness build (#125), the precondition that made the verdict measurable</b></summary>

**HARD PRECONDITION — Band-2 textbook slice (S14 gap, folded in from A2 Group C):** ✅ **SATISFIED
2026-06-29 (task `06-29-a4-s14-tall-witness`, branch `a4/s14-tall-witness`).** The tall-content
combined-state witness is BUILT, gate-verified, and MEASURED the at-risk decls' real load-bearing status
(the prior "un-witnessable, twice-verified" framing held only for the SHORT-content harness; a tall
overflowing fixture makes them observable). The witness instruments (all additive, `style.css`
byte-identical to main):
> - **visual-diff** views `17t-textbook-overview-tall` + `17f-textbook-overview-fill` (synthetic
>   fixed-height `.textbook-pages-flow` injected into `#learnBookOverlay`; fail-closed sentinel =
>   `.textbook-pages-flow` padding-bottom `64px @800h` ⇒ Band-2 winner; 0.000% baseline).
> - **arbiter** VIEWs `learn-textbook-overview-tall` + `-fill` in `_view-cascade-probe.js` (offset-box +
>   PROP_LIST on `#learnExplainScroll` subtree, all themes × viewports).
> - **fresh minimal keep-set** `tools/_keep-important.json` += **24598, 24599** (re-derived, not seeded).
>
> **MEASURED verdict (Step-4 deletion tests, reverted):**
> - `#learnExplainScroll` **height:100% (L24577) = NOCOMP-safe** — the plan assumed the deletion
>   fallback was `height:auto` (content-grown → no scroll), but the real winner is the overview-alone
>   rule `height: calc(100dvh − var(--header-height))` (3 IDs out-specify the `.learn-explain-scroll`
>   class), resolving to the **identical 738px** → render-neutral (arbiter root offsetHeight unchanged;
>   visual-diff 0.000%). NOT at-risk; no keep-set entry. **A4 must re-confirm at a 2nd height:** this
>   `calc(100dvh − header) == 100%`-of-parent equivalence was MEASURED only at the harness's pinned
>   800h, and both harnesses render no other viewport height — a divergence at an unrendered height is
>   invisible to these gates. Before A4 actually deletes L24577, spot-check the equivalence at one more
>   viewport height (e.g. 700h / 1000h) so the NOCOMP verdict isn't 800h-only.
> - `.textbook-pages-flow` **min-height:100% (L24598) = load-bearing** (arbiter prop flip `100%→0px`, 30
>   cells; note: geometrically inert vs the `height:auto` overlay parent, but kept — over-keep is safe).
> - `.textbook-pages-flow` **padding-bottom (L24599) = load-bearing** (deletion ⇒ Band-1 fallback 40px ⇒
>   the visual-diff + arbiter SENTINEL errors in BOTH harnesses — a tighter fail-closed guard than a diff).
>
> **Superseded (A4 CLOSED 2026-06-29):** A4 did NOT de-double Band-2 — the re-derivation
> MEASURED the slice as IRREDUCIBLE (min-height L24598 + padding-bottom L24599 regress on a
> naive de-double; no lockstep escape since rcc has no overview selectors) and height:100%
> L24577 as NOCOMP-but-not-worth-removing (0 doubled-ID gain + 564 keep-set line-shifts).
> See the §A4 CLOSED verdict above + `docs/A4_COMPOSER_IRREDUCIBLE.md`.

</details>

#### A5 — Media-gated dead-redeclaration slice (78 style + 6 runtime) — ✅ SHIPPED in #106

> **✅ DONE (#106, `6593c19`):** the media-gated sweep (`find-dead-redeclarations.js
> --media`, 78 dead style decls / 72 `!important` + 6 runtime) shipped as #106's first
> sub-commit. The prose below is historical; this box can be checked.


Deferred from #105 (which swept the ~98% top-level slice). The 78 sit on
**unprobed selectors** (home-ask/feedback/login/MN/chapter-overview/settings)
and unreachable contexts (`@media max-width:560px`, `@container lecture-panel`,
`prefers-reduced-motion`). **Gate:** the A0 narrow/`@container`/≤560px probes.
Marginal reward (~78 lines / ~72 `!important`); do it once the probes exist or
document the slice as provably unreachable and close it.

---

### Workstream B — split `app.js` → ~5,050 lines (5 seams)

Runs **fully in parallel** with Workstream A (never touches CSS). Extraction is
mechanical: the codebase already uses plain `<script>`-tag concatenation into
shared global scope (21 existing sibling modules). Cut a block, add a `<script>`
tag in `app/index.html` in the right order, bump the `app.js?v=` cache-buster,
`npm run check`, smoke-test, 35-view visual-diff. **Recommended order is
cleanest-first; the tangled lesson engine last once its boundary is clear.**

| # | Module | app.js lines | ~Lines | Risk | Entry points / notes |
|---|---|---|---:|---|---|
| 1 | `app/feedback-board.js` | 6172–6440 (+ helpers 487/489–517) | ~300 | low | Cleanest. `renderFeedbackBoard`, `loadFeedbackBoard`, `submitFeedbackItem`, `setFeedbackReplyTarget`, `feedbackAuthorName`, `formatFeedbackTime`. Only external caller is `loadFeedbackBoard` (in `showFeedbackView`); move the `feedbackReplyTargets` Map with it. Validate the extraction workflow here. |
| 2 | `app/textbook-focus.js` | 3043–3335 | ~293 | low | **Unnamed seam (found).** Full-page zoom/pan reader modal: `openTextbookFocusMode`/`close…`, `renderTextbookFocusPages`, transform/zoom HUD, pointer/wheel binding, QA passthrough. One external caller (`openTextbookFocusMode` at 4521). Move/relazily-query the 962–971 element consts. |
| 3 | `app/ui-friction-fixes.js` | 7929–8338 | ~410 | low | **Unnamed seam (found).** Already a self-contained `ftutorUiFrictionFixV123` IIFE with `typeof`/`window` guards — essentially a file-move. **Must load AFTER `app.js`** (it monkey-patches `renderSyllabus`). |
| 4 | `app/lesson-render.js` | 1505–3464 | ~1,950 | **high** | **Largest win, do LAST.** KP engine: `parseLessonKnowledgePoints`, `renderCurrentKnowledgePoint`, `setLearnLessonContent`, `runLearnPageTurn`, `renderLearnPages`, `decorateLectureContent`. **Quick-Check/Key-Takeaways KP rendering lives INSIDE `decorateLectureContent`/`parseLessonKnowledgePoints` — it extracts WITH this module, not separately.** Narrow public surface (5 entry points) but wide internal call graph; move module state `learnKnowledgePoints`/`currentKnowledgePointIndex`/`learnPages` with it. |
| 5 | `app/syllabus-view.js` | 786–1021 (+ helpers 3628–3810) | ~350 | medium | `renderSyllabus`, `findSyllabusSubsections`, overview-context helpers. Data half already in `data/syllabus-data.js`. `renderSyllabus` binds onclick → `openLearnMode`/`openChapterOverviewMode` (keep load order: this **before** `app.js`, ui-friction **after**). Leave the pagination half (`_sectionPageMap` inside `loadTextbookPages`) in `app.js`. |

**Estimate:** ~3,300 extractable → `app.js` ≈ **5,050 lines**. ~5K reachable
*with caveat* (the lesson engine's tangle with focus-mode/overview helpers may
leave a few hundred lines behind — acceptable for "reasonably split").

---

### Workstream C — Standalone landmines (in scope)

#### C1 — Unclosed `.learn-followup-bar {` brace (DELETE)

**File:** `app/style.css` L5464 (open) → L5640 (rebalance); dead region L5465–L5635.
**Finding (verified):** the brace never closes at its intended point; a comment
+ 23 nested rule-blocks (77 `!important`) covering `.explain-body` typography,
`.lecture-note-card*` variants, and the 55/45 col ratio are scoped one level too
deep and **do not apply as authored**. The rule's real declarations
(`display:flex; flex-direction:column; gap:6px; flex-shrink:0;`) sit at
L5636–5639. **Every swallowed selector already loses to a later equal/higher-
specificity rule** (`.explain-body p,li` → L9160; `.lecture-note-card-example`
→ L9209; col ratio → L14528), so the "keep this last to win" comment is
obsolete and the block is dead.
**Action:** **delete** L5465–L5635, keep `.learn-followup-bar { display:flex; flex-direction:column; gap:6px; flex-shrink:0; }`. Render-neutral (the activated decls still lose); verify with visual-diff + css-probe (expect text-AA noise floor only). Sev-3, standalone correctness PR.

#### C2 — css-probe S2/S3 `panelFocus` desync (FIX — also an A0 gate)

> **✅ FIXED on branch `fix/c2-panelfocus-desync` (2026-06-28, pending PR).** S2/S3
> `enter()` now drive the real `learnPanelFocus = '<focus>'; applyLearnPanelFocusState()`
> path and `resetLessonChromeState` clears `chat-collapsed`/`explain-collapsed`; the
> assert-as-entered was upgraded to a fail-closed state+winner check. Outcome was
> **probe-neutral — `css-probe --check` byte-identical incl. S2/S3, baseline unchanged**
> (the corrected DOM yields the same FOLLOWUP_PROBES values, confirming the desync was
> latent on the probed cascade). `visual-diff` render-neutral, proven via stash-trick on
> the 5 `resetLessonChromeState`-using views (15/16/20/21/26). `npm run check` green.
> Live line numbers re-measured (the L206–240 / app.js:2725 below had drifted post-B):
> S2/S3 enter `css-probe.js:383–418`, `applyLearnPanelFocusState` `app.js:1116`.

**File:** `tools/css-probe.js` L206–240 (S2/S3 enter), `tools/test-utils.js` L219–234 (`resetLessonChromeState`).
**Finding (verified):** enter() hand-sets only `dataset.panelFocus`, omitting the
`.panel-qa-*` class, the `chat-collapsed`/`explain-collapsed` reset, and the
`learnPanelFocus` JS var that the app's `applyLearnPanelFocusState()`
(app.js:2725) sets in lockstep. Currently **latent** (no CSS keys off
`.panel-qa-*`; the sentinel guards the winner) but a forward trap.
**Action:** drive the state through `applyLearnPanelFocusState()`; have
`resetLessonChromeState` also `classList.remove('chat-collapsed','explain-collapsed')`. **Land this before the A4 composer work** so its probes capture a DOM the app actually renders.

> **C3 (not a bug) — view-04 `#mistakeNotebookCloseBtn`:** verified to be
> `display:none` **by design** (style.css L25470, grouped with 6 sibling close
> buttons under "Home is now the global return path"). The working exit is the
> sidebar Home button. **Do NOT re-enable.** The only residue is harmless dead
> JS (7 click handlers on hidden elements). Optional dead-JS/markup tidy →
> **backlog** (§4); not a refactor-done requirement.

---

## 4. Explicitly OUT of scope — post-refactor backlog

Parked deliberately. Triage by the Gated Timebox protocol
(`knowledge/gated-timebox-protocol.md`: Sev-1 now, Sev-2 dev day, Sev-3 backlog).

1. **Phase 4 — user-data DB migration** (refactor-plan rule #3). **First item after DONE.** Filesystem JSON in `app/users/` breaks the multi-user case on Render's ephemeral FS. Needs its own design conversation; `app/user-memory.js` already pre-positions the swap.
2. **Six carry-forward interactive-demo bugs** (`phase3_deferred.md §1c`, all verified still present). One PR per module:
   - `sinusoid-phasor.js`: **SP-1** (Sev-2, rAF loop has no detach → racing second loop on re-hydration), **SP-2** (Sev-2, reset-while-paused freezes at t=0), **SP-3** (Sev-3, `updateControlLabels` null-deref latent), **SP-5** (Sev-3, hardcoded defaults ignore authored controls).
   - `phasor.js`: **PH-4** (Sev-2, reads `demoSpec.controls` only — ignores `demo.controls` fallback → empty control panel), **PH-6** (Sev-3, window `resize` listener leak on re-hydration).
3. **`@layer` migration** — explicitly a **trap** until the `!important` wall is down (`!important` inverts layer precedence; the Tailwind CDN runtime-JIT injects unlayered `<style>` that would flip 646 utility sites). A late anti-regression guardrail only, with little left to fix once Workstream A completes.
4. **Harness coverage hardening** (regression-safety, not blocking DONE):
   - 11 of 13 dispatcher family-keys never exercised (`§2b`, Sev-1 vs future renderer-table refactors) — add Page-C views opening Chapter-2+ subtopics per missing key.
   - `complex_plane` / `sinusoid_phasor` / `phasor` demos pixel-unverified (`§1a`).
   - §11 sidebar-drift **Option-B root fix** (a `lessonLayoutStable` sentinel) — today masked, not fixed; restoring sidebar coverage on lesson views needs it.
   - De-duplicate the css-probe/visual-diff shared bridge-spawn/mask/report machinery (`§13a`) to stop drift.
   - **A1 feedback carve-out witness extension (Sev-3, filed at A1 close 2026-07-03).** The 15 accepted cite-and-keep carve-outs (§A1; incl. submit-btn `:disabled` L25244-25247, `:active` transform L25240, cross-view close-btn border L24702 — not exhaustive) are arbiter-unreachable — synthetic `:disabled`/`:active` probing false-flips. To ever retire them, extend the feedback VIEW/css-probe with real `:disabled` + `is-target`/`data-kind` states. Expected yield **~0** (almost certainly load-bearing); regression-safety only, does not block DONE.
   - **§3d composer fail-open gaps (Sev-3, surfaced by A4 2026-06-29 — see `docs/A4_COMPOSER_IRREDUCIBLE.md`).** Five composer props have NO witness, so any future edit touching them is unsafe until one is built (the S14-witness pattern, #125): (1) `#learnFollowupBar` **width** — add to `FOLLOWUP_PROBES` (css-probe.js) in S2/S3/S4 (the load-bearing gate currently omits it); (2) `#learnModeMenu` **position/right/bottom/z-index** — needs a css-probe state that adds `.show` + a same-file competitor check (later L30860 ties a de-doubled menu); (3) `#learnChatEmptyState` **transform** — add to `CHAT_STATE_PROBES` (freeze animation); (4) the **6 close-btn arms** display/visibility/size — no state asserts the hidden buttons; (5) `#learnChatCol` **background shorthand** (only background-image probed). None block DONE (A4 makes no edit here).
    - **`_grow-keep-from-report.js --force-mixed` `:root`/`@`-prefix carve-out gap (Sev-3, surfaced by A3 2026-07-04).** The cross-view carve-out filter skips any comma-arm starting with `:root`/`@`; when EVERY arm is `:root[data-theme] .<non-sidebar>` (the L9580-83/9600-01 19-arm dark rule), the whole rule escapes carve-out and would be silently under-carved. Caught by hand at A3 R5 (kept). Fix: test the token AFTER the `:root[…]`/`@media` wrapper, not the wrapper itself. Affects any future per-view keep-grow, not just A3.
    - **css-probe `S-feedback-rest` `#feedbackView .feedback-reply` nondeterminism (Sev-3, surfaced by A3 2026-07-04).** 4 probes (reply + reply-context width, `::before` left) intermittently shift a uniform −3.266px — a shared-container available-width race (scrollbar/font-load), reproduced once then cleared on an identical-tree re-run. Orthogonal to any strip. Harden the state with a settle-before-snapshot (fonts.ready + scrollbar-stable) like the S14-14c precedent; until then, an isolated `--check` fail on ONLY these 4 feedback-reply probes is a known flake, not a regression.
5. **View-04 dead-JS/markup tidy** (C3 above) — optional cleanup, do not re-enable the buttons.

---

## 5. Critical path & sequencing

```
CSS (Workstream A, sequential):
  A0 harness gates ─┬─> A1 #feedbackView ──┐
                    ├─> A2 doubled-ID tranches (per-gate)
                    ├─> A3 .app .sidebar (needs collapsed-state probe)
                    └─> A4 §3d composer (LAST; needs S4–S11) ──> A5 media-gated slice

app.js (Workstream B, parallel — never touches CSS):
  B1 feedback-board ─> B2 textbook-focus ─> B3 ui-friction ─> B4 lesson-render ─> B5 syllabus-view

Landmines (Workstream C, independent):
  C1 brace delete (anytime)   C2 panelFocus fix (BEFORE A4)
```

**Rules baked into the order (do not reorder without re-checking):**
- A4 (composer) is **mandatory-last** in CSS — it depends on the full S4–S11 probe matrix (A0) and on C2.
- A1 (`#feedbackView`) **cannot start** without its seeded-fixture probe (pixel-diff is blind on feedback).
- A3 (`.app .sidebar`) **cannot start** without sidebar-collapsed-state + syllabus-tree probe coverage.
- B4 (`lesson-render`) is **last** in the `app.js` split (widest internal call graph); B1 first (lowest risk, validates the workflow).
- Every CSS commit runs **both** `css-probe --check` (load-bearing for cascade) and `visual-diff --check` (catch-all). Neither is added to `npm run check` (they spawn Chromium, ~30s) — manual pre-merge gates.

**Effort (planning-grade, per `REFACTOR_PLAN.md` realistic-finish-line):**
- Workstream A: multi-session (~4–6 dev days), front-loaded by A0 harness build.
- Workstream B: ~1 dev day per seam × 5, but the 3 low-risk seams are near-mechanical.
- Workstream C: <½ day total.

---

## 6. Risk register (carried from `PHASE3.6_SPEC.md §5`, re-scoped)

| # | Risk | Pixel-diff blind? | Mitigation |
|---|---|---|---|
| R1 | Collapsing the 12-ID followup-bar below runtime's 8-ID ties → runtime wins → 8+ props regress (A4) | yes | css-probe S2/S3/S4 byte-identical on width(px)/min-height/radius/bg/backdrop-filter — MANDATORY |
| R2 | `@layer` inverts `!important` + flips 646 Tailwind sites | yes | do NOT migrate (backlog §4.3) |
| R3 | Stripping a feedback/sidebar `!important` in isolation regresses a state pixel-diff can't see | yes (off-screen / sub-threshold) | computed-style arbiter + **seeded fixture** (A1); collapsed-state probe (A3) |
| R4 | Editing `#mistakeNotebookView`/sidebar **by line range** corrupts interleaved rules | n/a (edit error) | scope ALL edits **by selector token**, never by line range |
| R5 | css-probe taken in the wrong state reads an inactive rule | n/a (false confidence) | `enter()` MUST assert-as-entered; fix C2 desync first |
| R6 | Within-file DEAD rule assumed live; de-doubling resurfaces it | maybe | co-transform DEAD/live pairs preserving source order (e.g. L33191↔L37417) |
| R7 | `app.js` extraction breaks load order (monkey-patch / global binding) | n/a (runtime) | keep `<script>` order: helpers before `app.js`, ui-friction after; `npm run check` + smoke per PR |

---

## 7. References

- `docs/REFACTOR_PLAN.md` — canonical multi-phase history; "Forward outlook" seeded Workstream B.
- `docs/PHASE3.6_SPEC.md` — CSS-collapse protocol: §3 surface order, §4 css-probe spec + state matrix, §6.2 per-instance doubled-ID work-list, §6.3 branch progress.
- `docs/phase3_deferred.md` — live deferred punch-list: §1c (demo bugs), §3d (composer war-pairs), §14/§14a (redecl lever + unclosed brace), §15 (panelFocus desync).
- `tools/css-probe.js`, `tools/_view-cascade-probe.js`, `tools/visual-diff.js`, `tools/test-utils.js` — the verification harness.
- `knowledge/gated-timebox-protocol.md` (central DB) — Sev-1/2/3 triage for the backlog.
- Ground-truth verification: workflow `w5rd3xio0` (2026-06-25, 6 read-only agents).
