# Phase 3.6a — feedback + sidebar `!important`-strip

Owner: FlyM1ss
Drafted: 2026-06-26 (AFK loop session)
Continues `docs/PHASE3.6_SPEC.md` §6 surface execution (PRs #105/#106 already
shipped). Companion to `docs/phase3_deferred.md` §14 (remaining buckets).

> **⚠️ STATUS 2026-06-27:** the feedback+sidebar strip planned here shipped only
> **PARTIALLY** as **#118** (`2d7a757`, −92 total): `#feedbackView` 528→472,
> `.app .sidebar` 656→620. **Both surfaces remain OPEN** — feedback (A1) is not
> arbiter-complete; sidebar (A3) is still blocked on the §2.2 arbiter-overlay
> extension. Authoritative current status: `docs/REFACTOR_DONE.md` §A1/§A3 +
> `PHASE3.6_SPEC.md` top STATUS block (git HEAD `2d7a757`).
> **UPDATE 2026-07-03: A1 is CLOSED** — #119 reached the arbiter floor (465, D1
> css-probe floor guard); do NOT re-attack feedback from this plan (REFACTOR_DONE §A1).
> **A3 `.app .sidebar` is the only surface still open** (task `06-29-a3-sidebar-strip`). NB: the §0 line claiming
> #106 also covered settings/mistakeNotebook is **CORRECT** (git-confirmed: settings
> 100→66, MN 465→254) — those two are done; do not re-seed them.

## 0. What this is

Phase 3.6a is the next slice of the CSS structural collapse: the
`!important`-stripping vein extended from PR #106 (courseTracker/preference/
settings/mistakeNotebook) onto the two largest remaining `!important` carriers
in `app/style.css`:

| Surface | `!important` decls | Top-level | `@`-gated | Isolation |
|---|--:|--:|--:|---|
| `#feedbackView` | **528** | 506 | 22 | DOM-isolated (197 selector refs, 0 elsewhere) |
| `.app .sidebar` | **656** | 644 | 12 | NOT isolated — sidebar is on every navigated view |
| **Combined** | **1,184** | 1,150 | 34 | — |

These two surfaces alone are ~12.6% of the file's remaining 9,378 `!important`
declarations. PR #106's average conversion rate across four views was ~50% of
candidates strippable (settings 24%, MN 43%, courseTracker/preference 80%), so
the realistic upside is **~500–650 `!important` stripped, ~0 net line change**
(strips don't delete lines).

## 1. Execution model (matches the PR #106 pattern)

Per-surface loop, reusing the existing infrastructure verbatim:

1. **Extract candidates.** `tools/_extract-view-important.js` writes
   `tools/_view-important.json` for the current surface (VIEW_IDS in
   `_strip-view-important.js` already includes `feedback`).
2. **Baseline both gates on pristine main.**
   - `node tools/_view-cascade-probe.js --baseline` (the cascade arbiter:
     theme × viewport × interaction × 72 props/element + `::before`/`::after`)
   - `node tools/visual-diff.js --baseline` (35-view pixel harness)
3. **First strip pass.** `node tools/_strip-view-important.js --view=feedback`
   downgrades every `!important` not in `_keep-important.json` (gitignored).
4. **Verify both gates.**
   - `npm run check` (parser sanity + find-dead-redeclarations --validate)
   - `node tools/_view-cascade-probe.js --check` → list of cascade flips
   - `node tools/visual-diff.js --check` → pixel diffs
5. **Iterate keep-set.** For each flip / non-zero diff, identify the pristine
   line number(s) of the load-bearing `!important`, add to
   `_keep-important.json`, re-strip from pristine, re-verify. Repeat until BOTH
   gates pass (cascade-probe byte-identical, visual-diff 35/35 @ 0.000%).
6. **Commit the strip + keep-set snapshot** with the conversion numbers.
7. Move to the next surface, reset `_view-important.json` for it, repeat.

The `_strip-view-important.js` runner always strips from
`git show HEAD:app/style.css` (pristine), so the keep-set is the only state
that accumulates — runs are idempotent and order-independent.

## 2. Surfaces (in execution order)

### 2.1 `#feedbackView` (FIRST — DOM-isolated, arbiter already configured)

- **Candidate count:** 528 `!important` decls (506 top-level, 22 `@`-gated).
- **Isolation:** 197 selector references in `style.css`, 0 in
  `runtime-collapsed.css` / `ui-friction-v123.css` / `inline-styles.css`.
- **Arbiter state already in place:** `_view-cascade-probe.js` `VIEWS[0]` is
  pre-configured for feedback with the populated-board fixture
  (`seedFeedbackFixture(FEEDBACK_FIXTURE_POPULATED_PATH)`) and 9 interactions
  (rest + 5 hover targets + 3 focus targets), 3 themes × 5 viewports = 135
  states per view.
- **Visual-diff coverage:** views **14 / 14b / 14c / 14d / 14e / 14f** —
  feedback board (empty + populated, thread contexts, compose input focus,
  reply input focus, compose btn hover). 14c-14f use the STRICT `failRatio:
  0.0005` (0.05%) threshold. Per `reference-feedback-input-outline-cascade`
  memory, view 14d/14f catch the dual-deletion outline guard at 0.089%/0.051%.
- **Why mandatory for feedback specifically:** per `docs/PHASE3.6_SPEC.md`
  §3a.i and the deferred punch-list, the feedback cluster has a *documented
  visual-diff blindspot*. The cascade arbiter is therefore not optional here —
  it is the load-bearing gate. Visual-diff is the per-strip secondary catch.
- **Inline-style audit:** the cascade arbiter §0 caveat 2 calls out an
  inline-style competitor risk; before the first strip, grep
  `feedback-board.js` for `.style.` / `setProperty` / `cssText` writes that
  target the stripped props.

### 2.2 `.app .sidebar` (SECOND — NOT isolated)

- **Candidate count:** 656 `!important` decls (644 top-level, 12 `@`-gated).
  490 of these match the strict `.app .sidebar` chain; the rest are
  `.app .sidebar.<modifier>` / `.app .sidebar-*` / state-variant.
- **Isolation:** **NOT isolated.** Sidebar paints on top of every navigated
  view (home, lesson, mistake-notebook, settings, feedback, …) — so a
  competitor in any of those view's rules can win a stripped sidebar prop.
- **Arbiter extension required:** the current `_view-cascade-probe.js` walks
  one `view.root` subtree per VIEWS entry. For sidebar we need either:
  - **Option A** — a `sidebarMode: 'overlay'` flag that, for each VIEWS entry,
    additionally walks `.app .sidebar` after navigating to that view's root
    (covers sidebar-on-home, sidebar-on-lesson, sidebar-on-feedback, …); or
  - **Option B** — explicit per-view `{ id: 'sidebar-home', root: '.app .sidebar', preNav: 'home' }` entries — clearer but ~5× larger state matrix.
  - **Recommendation:** Option A for cost; revisit if a flip shows up only on
    a navigated-from view (would force per-view entries anyway).
- **Visual-diff coverage:** view **20-sidebar-collapsed** is the dedicated
  sidebar capture; views 01/02/03/04/05/12/13/14 all incidentally show the
  expanded sidebar's left rail. View 20 alone is insufficient — sidebar
  cascade flips on a navigated-from-home state may only surface at view 01.

### 2.3 Sequencing rule

Ship `#feedbackView` first (smaller blast radius, arbiter already configured).
Sidebar lands after feedback because its arbiter extension is a prerequisite
piece of infrastructure work — if that extension turns out to be the gate-day
task, sidebar gets deferred to a follow-up session rather than rushed.

## 3. Branch + PR model

Per FlyM1ss (2026-06-26): commits accumulate on a single branch
`refactor/phase3.6a-feedback-sidebar-important-strip`; **ship as one PR at
end of session UNLESS a "very large portion" (= an entire planned surface)
is finished, in which case an interim PR is acceptable**. This matches the
PR #105 pattern (many commits, one merged PR).

Commits within the branch use the established `<type>(<scope>): -N !important
[Phase 3.6a §X]` style — e.g.:
- `refactor(css): -287 !important on #feedbackView [Phase 3.6a §2.1]`
- `chore(css-probe): extend arbiter to sidebar overlay mode [Phase 3.6a §2.2]`

## 4. Verification bar (per surface)

A surface ships ONLY when ALL of:

- [ ] `npm run check` green (parser + find-dead-redeclarations validate)
- [ ] `node tools/_view-cascade-probe.js --check` byte-identical (PASS)
- [ ] `node tools/visual-diff.js --check` 35/35 PASS (0.000% on STRICT views;
      lesson views may carry the documented stable text-AA noise floor
      ≤0.061% per `reference-visual-diff-baseline-noise`)
- [ ] keep-set committed at `tools/_keep-important.json` (gitignored stays
      gitignored; pristine line numbers documented in the commit body)
- [ ] strip count + load-bearing count recorded in the commit message
      (matches the PR #106 row in `PHASE3.6_SPEC.md` §6)

## 5. Defer rules (when to stop a surface)

A surface gets a `phase3_deferred.md` entry instead of shipping when:

- **D2 (harness blindspot):** a cascade flip is real but the existing harness
  state-matrix can't pin its trigger state (e.g. an `@container` rule on the
  sidebar). Record the missing state + selector + property; surface to a
  follow-up harness PR.
- **D5 (adversarial veto):** a strip looks safe via cascade arbiter +
  visual-diff but the inline-style audit (§2.1 last bullet) surfaces a
  JS-side write that competes; defer until JS is in scope.
- **D6 (out-of-budget unblocker):** the sidebar arbiter extension (§2.2)
  turns out to need a multi-PR redesign of the probe; defer sidebar and ship
  feedback alone.

## 6. Stopping condition for the AFK loop

Per session-start AskUserQuestion (2026-06-26): loop runs until **bucket
exhausted OR a defer rule fires.** "Bucket" = the §3.6a feedback + sidebar
pair. If feedback ships cleanly and sidebar hits D6, the loop ends with the
feedback PR shipped + a sidebar deferral entry.

## 7. References

- `docs/PHASE3.6_SPEC.md` §3 (surface execution order), §4 (verification
  protocol), §6 (status table — Phase 3.6a is the next row).
- `docs/phase3_deferred.md` §14 (remaining buckets summary, naming feedback +
  sidebar explicitly as the next pair).
- `tools/_view-cascade-probe.js` — the cascade arbiter; VIEWS[0] currently
  configured for feedback.
- `tools/_extract-view-important.js`, `tools/_strip-view-important.js` —
  candidate-extract + strip executor; `--view=feedback` already wired.
- PR #106 (`6593c19`) — last shipped `!important`-strip slice, established
  the per-surface conversion-rate baseline + keep-set discipline.
