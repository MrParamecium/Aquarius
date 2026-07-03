# Phase 3.6 — CSS structural collapse (`!important` wall + doubled-ID pattern)

Owner: FlyM1ss
Drafted: 2026-06-24 (AFK overnight session)
Companion to `docs/REFACTOR_PLAN.md` ("The right sequence from here", step 3) and
`docs/phase3_deferred.md` (§12 entry + §3d cross-file finding).

This spec is grounded in a 6-agent inventory workflow (read-only, ~419k tokens)
that parsed all four loaded stylesheets in cascade order, classified every
doubled-ID and `!important` declaration, and stress-tested the `@layer`
alternative. Numbers below are grep/cascade-resolver verified; treat per-surface
percentages as planning-grade, not per-line ground truth.

> ## ⚠️ STATUS RECONCILIATION — 2026-06-27 (read this first)
>
> **This spec's forward-looking prose (§3 surface order, §6 execution table + AFK
> "branch-only" constraint, §6.3/§6.3c "remaining"/"natural seam") is a FROZEN
> 2026-06-24/25 branch-era snapshot. It never recorded what actually merged.** For
> authoritative current status use **`docs/REFACTOR_DONE.md`** (the live "Definition
> of Done"); where it and this spec disagree, REFACTOR_DONE wins. Reconciled against
> `git` HEAD `2d7a757` (origin/main).
>
> **What actually merged to main (incremental PRs — the "one mega-PR when complete"
> constraint in §6 was abandoned and is SUPERSEDED):**
> - `#105` (`da9fe92`) — −10k-line dead-CSS / redeclaration / doubled-ID collapse.
> - `#106` (`6593c19`) — `!important` strip on **FOUR** DOM-isolated views (NOT the
>   two its §6 row names): courseTracker, preference, **settings**, **mistakeNotebook**
>   (−598 decls) via the `_view-cascade-probe.js` arbiter. `PHASE3.6A_PLAN.md` had this right.
> - `#118` (`2d7a757`) — **partial** feedback + sidebar strip (−92 only; far from done).
> - `#111` (`bd56ef9`) — landmine C1 (unclosed `.learn-followup-bar {` brace) deleted.
>
> **Per-view `!important` trajectory (git-measured — THE antidote to re-seeding
> already-done surfaces):**
>
> | View | pre-#105 | now (HEAD) | Disposition |
> |---|--:|--:|---|
> | `#courseTrackerView` | 254 | **52** | ✅ DONE (#106, full arbiter) |
> | `#preferenceView` | 243 | **41** | ✅ DONE (#106, full arbiter) |
> | `#settingsView` | 100 | **66** | ✅ stripped by #106 (−34); 66 ≈ DEFENSIVE floor — a fresh strip is a **NO-OP** |
> | `#mistakeNotebookView` | 560 | **254** | ✅ stripped by #106 (−211); verify floor |
> | `#feedbackView` | 651 | **465** | ✅ A1 CLOSED 2026-07-03 — 465 supersedes 472 (#119 −7 + D1 floor guard); floor 100% keep-set-covered, 15 cite-and-keep carve-outs (REFACTOR_DONE §A1) |
> | `.app .sidebar` | 769 | **620** | ◐ BARELY (#118 −36) — A3 blocked on arbiter overlay mode |
> | `#learnView` (incl §3d) | 5776 | **3469** | ◐ bulk untouched — A4 composer chain (hardest, last) |
>
> **Totals:** style.css 42,991→**32,279** lines, 14,948→**9,286** `!important`-lines,
> 608→**404** doubled-IDs; runtime-collapsed 1,158→**876** `!important`, 58→58 doubled.
>
> **Process guard (why this block exists):** the Trellis trial seeded a task off this
> spec's §6.3 prose + §3 surface order and TWICE landed on already-merged work
> (courseTracker/preference, then settings). **Before seeding ANY task from a
> CSS-collapse plan, reconcile against git** — `git merge-base --is-ancestor` for the
> cited commit AND a per-view `!important` count (the metric is ground truth; the prose
> is narration). The genuinely-next strip is **`.app .sidebar` (A3)** — the last open
> surface — not any view in the ✅ rows above (A1 CLOSED 2026-07-03, REFACTOR_DONE §A1).

## 0. Problem statement

`app/style.css` is 42,991 lines carrying **14,948 `!important` lines**
(34,172 declaration-instances) and **608 doubled-ID `#X#X` selectors**
(353 `#learnView#learnView`, plus 91 tripled `#X#X#X`). `app/css/runtime-collapsed.css`
(loaded LAST) carries **1,158 `!important`** and **58 doubled-IDs** of its own.

These are not random cruft. They are the residue of two mechanisms:

1. **Iterative "FINAL / EOF / LOCK" tuning passes** that piled identical-specificity
   `!important` overrides without removing the old ones (e.g. `.learn-explain-toggle-btn`
   `height` is redeclared **11 times at the same (0,1,0) specificity** — only the last
   wins; the other 10 are dead).
2. **A cross-file specificity arms race.** Because there is no build step and no
   `@layer`, and `runtime-collapsed.css` loads *after* `style.css` (so it wins ties),
   `style.css` multiplies IDs (`#learnView#learnView#learnView` = 12-ID selectors) to
   out-specify `runtime-collapsed.css`'s own doubled-ID rules that set **different
   values on the same selectors**. This is the §3d finding, now quantified.

The goal: collapse both with **zero visual regression**, verified by computed-style
probes (pixel-diff has documented blindspots — see §4).

## 1. Strategy decision — hand-collapse surface-by-surface; `@layer` is a TRAP (now)

**Recommended: hand-collapse one surface per change, NOT a `@layer` migration.**

`@layer` cannot dissolve the arms race while the `!important` wall stands, because
**`!important` inverts layer precedence**: for important declarations the *earliest/
lowest* layer wins (the opposite of normal declarations), and unlayered `!important`
loses to every layer's `!important`. The §3d wars are `!important`-vs-`!important`
specificity tie-breaks, so:

- `@layer runtime, base` (intent: style.css wins) → for `!important`, runtime (lower)
  now wins → **exact inversion of intent; every doubled-ID win flips.**
- `@layer base, runtime` → base's *normal* declarations lose to runtime's normal
  declarations and to Tailwind utilities.
- No single ordering satisfies both important-conflicts and normal-conflicts; the two
  precedence rules run in opposite directions.

**Tailwind landmine:** `app/index.html` L14 loads the Tailwind CDN *runtime JIT* (not a
compiled sheet); it injects an **unlayered** `<style>` after the `<link>`s. Unlayered
normal declarations beat every layer's normal declarations, so moving `style.css` into
any layer flips 646 utility-class sites — a wide blast radius squarely in the pixel-diff
blindspot.

**Dependency ordering (hard prerequisites):** (1) remove `!important` per surface,
reconciling the style.css block and runtime-collapsed.css block into one source of
truth; (2) drop the now-unneeded ID multiplication; (3) *only if* `@layer` is ever
attempted — first replace the runtime Tailwind CDN with a compiled, layerable build.
By the time `!important` is gone, the doubled-ID weapon is obsolete on its own, so
`@layer` is at best a late-phase anti-regression guardrail with little left to fix.

`@layer` browser support is NOT the blocker (Baseline 2022, evergreen Chromium target).

## 2. Savings estimate (planning-grade)

| Metric | Total | Safely collapsible | Load-bearing |
|---|---|---|---|
| doubled-ID tokens (style.css) | 608 (549 learn + 59 non-learn) | ~429/549 learn (~78%) + most non-learn | ~120/549 learn (~22%) + all 58 runtime |
| tripled-ID `#learnView×3` | 49 | reduce to single/double | (within the 120) |
| `!important` decl-instances | 34,172 | 7,833 NOCOMP (23%) safe-in-isolation + much of 18,734 LOSES (55%) as whole-rule deletes | 6,986 DEFENSIVE (20%) |

**Line savings caveat:** doubled-ID collapse is ~0 net lines (selector text shrinks,
rules stay). The real line reduction comes from deleting `DROPPABLE_LOSES` dead rules
(the 10-of-11 toggle-height pileup pattern), which dovetails with the §3c.i
shadow-removal series. **Progress here is measured in `!important`-count and
doubled-ID-count reduction, not primarily line count.**

## 3. Surface execution order (safest-first)

Scope every edit **by selector token** (`#courseTrackerView`, `mistake-*`,
`#textbookFocusModal`), **NEVER by banner line range** — several banner spans are
mislabeled and physically interleave unrelated rules (e.g. the `#mistakeNotebookView`
span L14218-18292 interleaves learn-collapsed rules).

### Pilot 0 — `#textbookFocusModal` (FIRST; proves the technique, near-zero risk)
- 32 doubled-IDs in "TEXTBOOK FOCUS GLASS LOCK" (`style.css` L41720-41978), all `!important`.
- **Cross-file competitor: NONE** (grep-verified ZERO in runtime-collapsed.css /
  ui-friction-v123.css / inline-styles.css). No §3d war here.
- **Two within-file load-bearing constraints:**
  1. Page indicator (L41944/L41963/L41964): doubled-ID `!important` at (0,4,0) must
     out-rank the single-ID `!important` "paper-tag" multi-surface rule at L23398/
     L23441/L23461 (0,1,0). Flatten only to `#textbookFocusModal #textbookFocusPageIndicator`
     (0,2,0) — still beats (0,1,0); do NOT flatten to bare ID (ties, then loses on source order).
  2. All other 29 rules win over Block-1 base **class** rules (L3115-3332, no `!important`)
     **purely via the `!important` flag** — the ID-doubling is decorative there.
- **Transform:** Step 1 — de-double the 29 non-indicator rules (`#textbookFocusModal#textbookFocusModal`
  → `#textbookFocusModal`; `.class#id` → `#id`), **keep every `!important`**. Step 2 —
  page-indicator to the 0-2-0 minimum-safe form.
- **Verify:** css-probe state S12 (panel un-hidden + toggle `.is-open`) asserts page-indicator
  bg is glass radial-gradient (not paper `#fff8dd`), `#textbookFocusQaPanel` border-radius
  `24px` + glass bg, toggle width per breakpoint. View 23 pixel-diff as catch-all.
- **Expected line delta ≈ 0.** Removes 32 doubled-IDs.

### Surfaces 1-3 — DOM-isolated views (best `!important`-removal pilots)
| Surface | decl-instances | NOCOMP-safe | DEFENSIVE | Note |
|---|---|---|---|---|
| `#courseTrackerView` | 342 | 74.9% | 10.5% | lowest blast radius — best `!important` pilot |
| `#preferenceView` | 381 | 69.8% | 12.9% | same isolation profile |
| `#mistakeNotebookView` | 974 | 45.7% | 20.1% | **mislabeled banner span; scope by token only** |

Transform: strip `!important` from the NOCOMP decls; de-double the `#XView#XView`
prefixes. Verify: per-surface css-probe state opening the view, probing **every property
touched by a stripped `!important`** (not just the visible pixel), plus the existing
pixel view as layout catch-all.

### Surface 4 — settings / sidebar (moderate; verify per-property)
settings 585 (39.8% safe); sidebar 1,291 (44.2% safe) — but sidebar shares
`.app .sidebar …` chains with many surfaces; do not assume isolation.

### Surface 5 — GRATUITOUS / UNIFORM-FLOOR doubled-ID families (zero runtime competitor)
Within-style.css ladders, grep-verified zero runtime-collapsed.css competitor; safe
transform `#X#X(#X) → #X` because the doubled rule is later in source order.
**Collapse each whole family in one change** to preserve the winner.
- Page-corner / page-turner (GRATUITOUS, ~99 tokens): L33442-33498, L35840-36060,
  L37477-37581, L36042 (only `#learnView` doubled; classes target; pill skin L24142
  already crushed; corner DOM index.html L694-699, siblings of `#learnExplainScroll`).
- lesson-test-banner / key-takeaways / lecture-note-card (UNIFORM-FLOOR, ~128): DBL
  L38201-38985 + TRP L41429-41586; border-radius winner L41508.
- learn-topbar / close / title / toolbar / btnLectureView (~25): L34085-34320.
- textbook-active explain/book/bottomRail/scroll/content (~133): L33946-34060,
  L34606-34660, L34749-34965, L38201-38284 — **keep distinct-depth-5 floor** (singles
  at L24098/L26953 are earlier at equal depth; do NOT reduce to class-only).
- panel-normal (~12): L42959-42990.

### Surface 6 — learn-view §3d composer chain (LAST; cross-file LOCKSTEP, mandatory)
> **STALE ANCHORS / SUPERSEDED 2026-06-29 — A4 CLOSED as verified irreducible-by-design.**
> Every line number below drifted out of range (cited `L41334`/`rcc L1976/L2036` on files of
> 32,514 / 1,562 lines). A 24-agent adversarial re-derivation proved the war-pairs are
> IRREDUCIBLE / NO_BENEFIT (the doubled-ID repetition IS the load-bearing mechanism, not the
> tiebreak the prose below assumes). Authoritative re-derived anchors + verdicts:
> **`docs/A4_COMPOSER_IRREDUCIBLE.md`** and `REFACTOR_DONE.md §A4`. The prose below is historical.

The only region where runtime-collapsed.css sets DIFFERENT values on the SAME selectors.
Transform each war-pair in lockstep, preserving the invariant
**style.css effective specificity > runtime-collapsed effective specificity**
(runtime loads last). ~120 learn-target load-bearing tokens + all 58 runtime tokens.
1. **Followup-bar geometry:** `style.css` L41334 (**12 IDs**; width `calc(100%-36px)`,
   min-height `152px`, border-radius `28px`, pink glass) ↔ `runtime-collapsed.css` L1976
   (**8 IDs**; width `min(820px,…)`, min-height `112px`, border-radius `18px`, white
   glass). *(Correction to §3d L1024: live source is 12-vs-8 IDs, not "tripled vs 8-ID.")*
   Distinct depth is 4 on both sides — repetition is the ONLY thing making style.css win;
   collapsing to plain depth-4 ties → runtime wins on source order → 8+ props regress.
2. **Followup-bar z-index/overflow:** L33213 (8-ID, `z-index:40; overflow:visible`) ↔
   runtime L1634 (`z-index:3`). Its bg/border are DEAD (superseded by L41334); z-index/
   overflow are live, must stay > runtime's 3-ID.
3. **`#learnChatCol` background (within-file; CORRECTS §3d):** L33191 (6-ID radial-gradient)
   is **DEAD** — beaten by L37417 (6-ID flat `var(--theme-page-surface-soft)`, later
   source). Live pair is **L33191 ↔ L37417**; de-double TOGETHER to equal depth preserving
   L37417-after-L33191 order, else the radial-gradient resurfaces.
4. **`#learnModeMenu` position:** L33238 (8-ID + class, `right:66px`) ↔ runtime L1790
   (2,1,0, `right:58px`). Reducible to depth-3-single `#learnView #learnChatCol
   #learnModeMenu.edu-mode-menu` (3,1,0) — beats (2,1,0) — but NOT to class-only.
5. **`#learnChatEmptyState` transform (runtime-internal):** runtime L2036 (DBL,
   `translateY(clamp(38px,5.2vh,62px))`) beats style.css L33057 (single, 18px). De-doubling
   runtime here surfaces the 18px value.

## 4. Verification protocol — `tools/css-probe.js`

### 4.0 Why pixel-diff alone is insufficient
- **Off-screen/clipped chrome:** `page.screenshot({fullPage:false})` clips to 1280×800;
  the §3a.i regression (PR #71) painted outside the captured region and passed at
  0/1024000 px through two `--check` runs.
- **Sub-threshold property swaps:** a cascade flip (`min-height:152→112`,
  `radial-gradient→flat`) can dirty fewer pixels than even the 0.05% strict threshold
  when the element is clipped or the delta is low-contrast alpha-on-glass.
- The harness already encodes the mitigation (views 12b-12e/14d-14f read literal
  `getComputedStyle` and assert exact-string equality). This generalizes it.

### 4.1 Mechanism
Standalone `tools/css-probe.js` mirroring `visual-diff.js`'s `--baseline`/`--check`
lifecycle; output is a JSON snapshot diff, not PNG. Artifacts:
`tools/css-probe-baseline.json` (committed proof artifact) + `tools/css-probe-report.md`
(written by `--check`). Reuses `tools/test-utils.js` helpers verbatim (`enterGuestMode`,
`openSubtopic`, `resetLessonChromeState`, `settleLesson`, `assertOrThrow`,
`maskLessonSidebar`, `MASK_CSS`) and spawns its own bridge subprocess like visual-diff.js.

Data structure: `PROBE_STATES = [{ state, enter(page), probes: [[selector, pseudo, property], …] }]`.
Each `enter()` MUST **assert-as-entered** — prove the gated rule actually matches (e.g.
`panelFocus==='qa-wide'` AND chat not collapsed AND `#learnChatCol` display ≠ none) —
before snapshotting, or the probe reads an inactive rule and proves nothing.

Snapshot: `getComputedStyle(el, pseudo).getPropertyValue(prop)` for every tuple; missing
element → `__MISSING__`. `--baseline` writes the snapshot (commit BEFORE touching CSS);
`--check` compares **byte-identical**, exits 1 on any string diff or `__MISSING__`,
reporting `(state, selector, property, before → after)`.

Why it beats pixel-diff: (1) no clipping — reads resolved value regardless of viewport;
(2) pseudo-element coverage (`::before`/`::after` glass overlays invisible to pixelmatch);
(3) `calc()`/`min()` resolve to different px at 1280-width — exactly what distinguishes
the 12-ID winner (`calc(100%-36px)`) from the 8-ID one (`min(820px,…)`); (4) self-documenting
cascade contract.

Do NOT add `--check` to `npm run check` (spawns bridge + Chromium, ~30s); keep it a manual
pre-merge gate like `visual-diff`. For `:focus-within` animation states, freeze with
`* { animation: none !important }` before snapshot OR probe `animation-name` (stable string).

### 4.2 State matrix (doubled-ID rules are state-gated by classes on `#learnBody`)
| # | State | How to enter | Existing pixel view |
|---|---|---|---|
| S1/S8 | resting lesson (chat-collapsed) | open §1.1-1 non-overview | 06 |
| S2 | `data-panel-focus="qa-wide"` | set `learnBody.dataset.panelFocus='qa-wide'`, remove `chat-collapsed`, dispatch resize | 08 |
| S3 | `data-panel-focus="qa-full"` | `panelFocus='qa-full'` | 09 |
| S4 | normal + chat visible (§3d radial war) | `panelFocus='normal'` + remove `chat-collapsed` | NEW |
| S5 | `#learnFollowupBar:focus-within` | focus `.input-field` in S2/S3 | 09 (partial) |
| S6 | empty-state (not chat-active) | S2/S3, `#learnChatCol` NOT `.is-chat-active` | NEW |
| S7 | empty-state hidden (is-chat-active) | toggle `#learnChatCol.is-chat-active` | NEW |
| S9 | explain-collapsed (not chat-collapsed) | add `explain-collapsed`, remove `chat-collapsed` | NEW |
| S10 | chapter-overview-active | add `chapter-overview-active` | 15 |
| S11 | chapter-overview-split-active | add `chapter-overview-split-active` | 16 |
| S12 | textbook-focus modal | `#textbookFocusModal` remove `.hidden` + body `textbook-focus-active`; un-hide QA panel + toggle `.is-open` for the pilot | 23 |

State-setting code: `app.js` L2686-2738 (`openLearnMode`/`applyLearnPanelFocusState`),
L3990-3992 (`is-chat-active` toggle). DOM IDs: `index.html` L655/674/713/732/760/1495.

### 4.3 Highest-priority probe tuples (S2/S3/S4 §3d core)
- `#learnChatCol`: **`background-image`** (3-layer radial+linear vs `var(--theme-page-surface-soft)`),
  `background-color`, `isolation`, `overflow`, `border-radius`, `box-shadow`.
- `#learnFollowupBar`: **`width`** (resolved px), **`min-height`** (152 vs 112),
  **`border-top-left-radius`** (28 vs 18), `border-top-color`, `background-image`,
  `box-shadow`, `backdrop-filter`/`-webkit-backdrop-filter`, `margin`, `padding`, `z-index`, `overflow`.
- `#learnFollowupBar::before` / `::after`: `content`, `display`, `opacity`,
  `background-image`, `transform` (`::after` `rotate(-12deg)`).
- `#learnFollowupBar .input-wrapper`: `grid-template-columns`, `min-height`, `gap`.
- `#learnFollowupBar .input-field`: `min-height`, `font-size`, `font-weight`.

### 4.4 Sequencing
Run `css-probe --baseline` + `visual-diff --baseline` together, commit both, THEN branch.
After each collapse commit run BOTH `--check`s: css-probe is the load-bearing gate for the
§3d surfaces; visual-diff is the catch-all for layout/positioning (complementary:
property-identity + spatial-identity).

## 5. Risk register

| # | Risk | Pixel-diff blind? | Mitigation |
|---|---|---|---|
| R1 | Collapsing L41334 (12-ID) below runtime L1976 (8-ID) ties → runtime wins → 8+ followup-bar props regress | yes (clipped / sub-threshold) | css-probe S2/S3 byte-identical on width(px)/min-height/border-radius/bg/backdrop-filter — MANDATORY |
| R2 | `@layer` migration inverts `!important` + flips 646 Tailwind sites | yes (cross-cutting) | do NOT migrate now (§1) |
| R3 | Stripping a DEFENSIVE `!important` in isolation regresses panel sizing | maybe | only de-`!important` when competitor removed same step; probe every touched property |
| R4 | textbook page-indicator flattened to bare ID ties paper-tag → glass→paper regression | partial (panel `.hidden`) | keep ≥ 0-2-0; css-probe with panel un-hidden + toggle `.is-open` |
| R5 | Editing `#mistakeNotebookView` by LINE RANGE corrupts interleaved learn-collapsed rules | n/a (edit error) | scope ALL edits by selector token, never by line range |
| R6 | Pseudo-element glass overlay lost | yes | css-probe `::before`/`::after` content/opacity/bg/transform |
| R7 | Off-screen paint passes at 0px (§3a.i precedent) | yes | css-probe reads resolved value regardless of viewport |
| R8 | css-probe taken in wrong state reads inactive rule | n/a (false-confidence) | `enter()` MUST assert-as-entered |
| R9 | Within-file DEAD rule (L33191) assumed live; de-doubling resurfaces it | maybe | co-transform DEAD/live pairs (L33191↔L37417) preserving order |
| R10 | `/code-review` gives inverted-cascade false-positives | n/a | css-probe is load-bearing, not the reviewer's verdict |

## 6. Execution plan + status

**AFK constraint (FlyM1ss, 2026-06-24):** the risky cross-file CSS (Surface 6 §3d
lockstep) and the broad `!important` strips must NOT merge to main tonight. Tonight builds
the **verification infrastructure** + executes the provably-safe pilot, all on a branch.
Per FlyM1ss: Phase 3.6 ships as ONE massive PR only when COMPLETE; while incomplete it
stays branch-only (no PR).

**Verification harness lands on `main` separately** (test-only, low-risk) so the
pre-collapse baseline is captured against `main` and every future surface verifies against it.

| # | Commit | Where | Risk | Status |
|---|---|---|---|---|
| spec | this document | main (docs) | none | ✅ `1598c6f` |
| H | `tools/css-probe.js` + `css-probe-baseline.json` | main (PR #101) | none (test-only) | ✅ merged `a6c8b5b` (reviewed: 10-agent /code-review caught false-confidence holes, all fixed) |
| 1 | textbook Step 1: de-double 29 non-indicator rules, keep `!important` | branch | provably safe (zero cross-file competitor) | ✅ `bac31d2` — css-probe --check PASS, −32 doubled-IDs |
| 2 | textbook Step 2: page-indicator → 0-2-0 | branch | safe (specificity pre-verified + probe) | ✅ `6f939a2` — PASS, −3 doubled-IDs (textbook = 0 doubled-IDs) |
| 3+ | courseTracker / preference `!important`-NOCOMP strip | branch | needs per-view probe coverage first | ✅ `3385050` — −384 `!important` (384/476 NOCOMP; 92 load-bearing kept). New exhaustive computed-style arbiter (`_view-cascade-probe.js`, `a71dbda`) byte-identical over 108 states + visual-diff 35/35. See §14 pass 3. |
| 6 | §3d composer chain lockstep | branch (later nights) | high — full css-probe S2-S12 gate | deferred |

Branch: `refactor/phase3.6-css-collapse` (2 commits; **no PR** — Phase 3.6 incomplete).
Doubled-IDs: **608 → 573** (textbook pilot). `!important`: 14,948 (untouched — no `!important` work shipped yet).

## 6.1 Post-pilot finding (2026-06-24) — the textbook pilot was the clean EXCEPTION

The textbook surface had **zero cross-file competitors AND zero within-file `@media`
competitors**, so its 35 doubled-IDs collapsed as a provable no-op (css-probe-verified,
incl. a true-positive negative test: a deliberate 24px→25px regression was correctly
caught). **Every remaining doubled-ID surface is entangled** and is NOT a clean de-double:

- **`#mistakeNotebookView#mistakeNotebookView`** (17, DOM-isolated, zero cross-file): but
  `.mistake-workspace` L34808 (doubled, 0,3,0) has a LATER single-ID competitor at L35745
  (0,2,0) **inside an `@media`**. De-doubling L34808 → (0,2,0) ties L35745, which wins by
  source order at narrow viewports — a regression the 1280px harness **cannot see** (§9c
  blindspot). Other MN targets have 4-8 single-ID/bare competitors each.
- **page-corner / lecture-overlay** (~99, GRATUITOUS bucket): **272 selector lines**, deeply
  nested (`#learnView #learnBody:not(.chapter-overview-active) #learnExplainToolbar #lecture*OverlayBtn`),
  multi-state, many `@media`-wrapped. Per-property/per-state/per-viewport analysis required.
- **`#learnView#learnView` core** (353): interleaves the LOAD-BEARING §3d composer chain
  (~120 tokens, Report 1 §4) with safe UNIFORM-FLOOR/GRATUITOUS instances. No global
  `replace_all` is safe.

**Prerequisite for the bulk (next-session entry point):**
1. **Narrow-viewport probe coverage** — add a second BrowserContext at ~800px to `css-probe.js`
   (or a sibling harness) so `@media (max-width:…)` competitors (L35745 etc.) are verifiable.
   This is the §9c-deferred ~150-line task; it is the gate for de-doubling MN + learn-view.
2. **Full S4-S11 state matrix** in css-probe (spec §4.2) before touching the §3d composer chain.
3. **Per-instance cascade classification** of the 573 remaining doubled-IDs (extend the
   inventory workflow to instance granularity) → the exact safe-collapse work-list.
Only the **DOM-isolated single-instance** doubled-IDs (`#courseTrackerView#courseTrackerView`,
`#preferenceView#preferenceView`, `#settingsView#settingsView`, `#feedbackView#feedbackView`
— 1 each) might be quick wins once their view has probe coverage; verify each, do not assume.

## 6.2 Per-instance work-list (instance-classification workflow `wbnwmiwqx`, 2026-06-25)

A 7-agent read-only per-instance classification of 133 doubled-ID selector blocks across 6
surfaces **overturned the §6.1 pessimism**: page-corner is overwhelmingly *over-specified*, not
entangled. **44 blocks are COLLAPSE-SAFE-NOW** (verifiable at 1280/resting with existing harness
views; no competitor wins after reduction).

| Classification | mistake-nb | page-corner | learn-topbar | close-btns | explain-rail | composer-§3d | TOTAL |
|---|--:|--:|--:|--:|--:|--:|--:|
| COLLAPSE-SAFE-NOW | 5 | 27 | 9 | 2 | 0 | 1 | **44** |
| NEEDS-NARROW-VIEWPORT | 6 | 0 | 5 | 0 | 0 | 1 | 12 |
| NEEDS-STATE-MATRIX | 0 | 7 | 0 | 0 | 13 | 8 | 28 |
| NEEDS-NEW-VIEW | 0 | 0 | 1 | 4 | 22 | 2 | 29 |
| LOAD-BEARING (never touch) | 6 | 0 | 6 | 1 | 0 | 7 | 20 |

**COLLAPSE-SAFE-NOW work-list (style.css line numbers):**
- **page-corner (27)** — verified by visual-diff views 06/17/18/21/22; turner-content rests at
  `opacity:0` so **css-probe (computed-style) is mandatory** (pixel-diff blind): L33443, 33474,
  33479, 33484, 33791, 33830, 33836, 33856, 33875, 33879, 33883, 33899, 33905, 33911, 33931,
  33935, 37479, 37505, 37511, 37531, 37539, 37543, 37547, 37553, 37559, 37570, 37574. Drop one
  redundant `#learnView` → (0,2,2,0) still beats the pill skin (0,2,0,0); toolbar-descendant
  rivals never match (buttons are toolbar siblings).
- **learn-topbar (9)** — L34111, 34134, 34151, 34157, 34167, 34189, 34220, 34243, 34253.
  **Skip the LOAD-BEARING atomic groups** L34176-34178 and L34193-34194, and the L34088 member.
- **mistake-notebook (5)** — L34778, 34779, 34797, 34802, 34094 (covered by views 03 + 03b).
- **close-buttons (2)** — L34088 (`#learnClose`), L34089 (`#topbarCloseBtn`). **Line-precise edits
  only** — they share the grouped rule L34088-L34094; **do NOT touch L34091 (feedback) = LOAD-BEARING**
  (border flips to L36596), and the other view lines are NEEDS-NEW-VIEW.
- **composer (1)** — L33233 (`.bottom-actions` z-index/overflow; no competitor on those props).

**LOAD-BEARING — never collapse (cite-and-skip):** mistake-nb L34770/34784/34816/34820/34826/34831;
learn-topbar L34088/34176-34178/34193-34194; close-btns L34091 (feedback→L36596); composer
L33191/33192/33213-33216/33238/37415/37416/37423-37426 (the §3d runtime-collapsed.css war).

**Coverage roadmap for blocked tranches:**
- **Tranche A (narrow-viewport, 12):** add ≤1180px probe (unblocks MN 34808/34838/34842 + composer
  33277) and ≤820px probe (unblocks MN 34848/34849/34853 + topbar 34297/34302/34303/34307/34311).
- **Tranche B (state-matrix, 28-30):** a **`.learn-textbook-active` css-probe state** is the single
  biggest unlock (13 explain-rail rules); plus S10/S11 chapter-overview, `.is-chat-active`, and
  `[data-custom-split]`/`.panel-normal` states for the composer.
- **Tranche C (new-view + dead-code, 29):** settings/preference/courseTracker view bootstraps (3
  close-btns); open mode-menu (2 composer). **DEAD-CODE TRIAGE (22):** L33949-33952, 34752-34755,
  34899-34902, 34929-34934, 38204-38207 target `#learnLecturePageIndicator`/`#learnExplainBottomRail`/
  `#learnToolbarPagination` — IDs that exist in **NO HTML/JS** (only `#learnFocusPageIndicator` is
  real). These are dead-CSS DELETION candidates (big line reduction), not collapse — confirm against
  DOM, then delete whole chains.

**Recommended order:** (1) page-corner 27 — highest value/lowest risk; (2) learn-topbar 9;
(3) mistake-nb 5; (4) close-btns 2 + composer 1; (5) narrow-viewport probes → Tranche A;
(6) textbook-mode state → Tranche B; (7) dead-code triage of the 22; (8) isolated-view bootstraps.

## 6.3 Branch progress (refactor/phase3.6-css-collapse, 2026-06-24/25)

**Cumulative this session (all verified):** style.css **42,991 → 38,771 (−4,220, now < 39K)** + runtime-collapsed.css
**2,102 → 1,734 (−368)** = **−4,588 lines**; doubled-IDs **608 → 418 (−190, −31.3%)**;
`!important` lines style.css **14,948 → 13,206 (−1,742)** + runtime-collapsed.css **1,158 → 964 (−194)**.
Every change verified by css-probe (byte-identical) + visual-diff (35 views covering live chrome at
0.000%; occasional sub-0.005% antialiasing noise on text-heavy views, well under threshold); dead-CSS
deletions additionally gated on the **distinct-live-selector-context set-difference invariant** (catches
uncaptured-state loss that pixel-diff misses). Dead-CSS deletion accounts for essentially the entire line
reduction (the doubled-ID de-double tranches are ~0 net lines by design — see §2 caveat).

| Commit | Tranche | Δ | Verification |
|---|---|---|---|
| `bac31d2` + `6f939a2` | textbook (Pilot 0) | −35 doubled-IDs | css-probe S12 + negative-tested gate |
| `7fc0350` | page-corner (§6.2 #1) | −58 doubled-IDs | css-probe S-page-corner + visual-diff @ 0.000% |
| `8cd712b` | dead-CSS page-indicators (§6.3a) | **−853 lines, −78 doubled-IDs, −396 `!important`** | dead-ID grep 0; live `#learnFocusPageIndicator` intact; both gates 0.000% |
| `10935a3` | learn-topbar (§6.2 #2) | −11 doubled-IDs | css-probe PASS; visual-diff 06/07/08/15/16 @ 0.000% |
| `71dd7c9` | mistake-notebook cards (§6.2 #3) | −4 doubled-IDs | css-probe PASS; visual-diff 03 + 03b @ 0.000% |
| `6503947` | dead-CSS `.learn-explain-toggle-btn` + `#learnExplainToggleBtn` | **−662 lines, −321 `!important`** | distinct `#learnFocusBtn` selector-contexts unchanged (70=70); both gates @ 0.000% |
| `d385d00` | dead-CSS `.lecture-overlay-btn-left/-right` + `.learn-chat-restore/-topbar/-corner-toggle` + `.learn-explain-bottom-rail` | **−1032 lines, −476 `!important`** | set-difference empty for all 6 live siblings (#lecture{Prev,Next}OverlayBtn / .turner-content / #learnFocusBtn / .lecture-overlay-btn-{text,icon}); both gates @ 0.000% |
| `1dc55c5` | conservative whole-file orphan sweep (77 renamed-away classes: settings-drawer-*/library-*/old chapter-overview children/edu-* old/journal-*/mode-icon-* etc.) | **−646 lines, −111 `!important`** | set-difference over ALL 858 live selectors = 0 lost; correctly SKIPPED runtime-built `*-demo-*` + template `lecture-note-card-${type}` + harness/compound; both gates @ 0.000% |
| `61ffde1` | entangled-orphan arm-surgery (library-* / syllabus-page-* / lecture-focus-overlay-btn / textbook-zoom-overlay-btn / lesson-page-footer + dead `.lecture-overlay-btn` base) | **−313 lines, −45 `!important`** | live `.learn-focus-btn`/`.lesson-page-heading` lost 0 contexts; `.lecture-overlay-btn` verified dead (0 HTML+JS); both gates @ 0.000% |
| `c4e7030` | dead `.lecture-overlay-btn-text`/`-icon`/`.lecture-focus-overlay-text` family (58 blocks style.css −797 + 23 blocks runtime-collapsed.css −285/−154 `!important`) | **−1,082 lines, −154 `!important`** | all 81 blocks key-dead, 0 live comma-arms; **0 refs in live `app/` tree** (only stale `workspace/app-mirror` names them → confirms the `.turner-content` rename); css-probe byte-identical incl. S-page-corner; visual-diff 35/35 |

**CORRECTION to the `d385d00` row:** it listed `.lecture-overlay-btn-{text,icon}` as *live siblings to
preserve*. That was wrong — they were renamed-away orphans all along (base `.lecture-overlay-btn` was
already dead). `c4e7030` proves it: 0 refs in the live `app/` tree, both gates byte-identical after removal.

**Dead-orphan vein status: EXHAUSTED for the lecture/learn-chrome family** (6 sweeps = −4,138 style.css lines).
No known high-confidence dead orphans remain in the audited surfaces. **The remainder is the careful/risky
multi-session grind**: `!important`-stripping on DOM-isolated views (`#courseTrackerView` 74.9% NOCOMP /
`#preferenceView` 69.8%) — line-neutral + changes cascade outcomes, so it needs FlyM1ss's risk-appetite
call; harness-gated narrow-viewport/state-matrix tranches; and the §3d composer chain (hardest, cross-file
lockstep). This is the natural seam to hand back for steering.

**Orphan-sweep status:** the standalone-dead orphans are harvested (4 deletions = −3,028 lines). Remaining
orphan residuals are ENTANGLED (in comment-laced / doubled-ID / live-ancestor groups — e.g. `library-card`
×19, `settings-drawer` ×2, `lecture-focus-overlay-btn`, `textbook-zoom-overlay-btn`, old `intro-*` under live
`.intro-landing-new`) and need careful per-arm surgery — lower value-per-effort, do later. The ~130 `*-demo-*`
+ template-built families are LIVE (never delete; see SKIPPED list).

**Next: comprehensive whole-file orphan scan.** Three orphan deletions found via specific leads
removed −2,464 lines; a systematic whole-file scan (extract every class/ID token from style.css
selectors, cross-check vs index.html + all app JS, **template-literal-aware** — `tone-${n}`/`is-${align}`
etc. are LIVE despite 0 literal refs) will find the long tail. `tools/scan-unused-css.js` is scoped to
L33181+; extend it whole-file or run a careful scan. Delete via strict arm-removal + the set-difference
invariant; conservative on any template-literal-plausible candidate.

### 6.3c — dead-orphan sweep is the richest remaining SAFE vein (recommended next)

Two dead-orphan deletions (page-indicators −853, toggle-btn −662) prove **renamed-away orphan
classes/IDs** are the highest-value SAFE target (line + `!important` reduction, no cascade-rewrite
risk). The toggle-btn subagent flagged MORE candidates (verify each: 0 refs in index.html + all
app JS, not template-built): `.learn-chat-corner-toggle`, `.lecture-overlay-btn-left`,
`.lecture-overlay-btn-right`, `.learn-chat-restore`, `.learn-chat-topbar`, `.learn-explain-bottom-rail`,
plus a residual `#learnExplainToggleBtn` arm. A COMPREHENSIVE whole-file orphan scan (tools/scan-unused-css.js
is scoped only to L33181+; extend it or run a custom scan, template-literal-aware) likely finds more.

**Dead-orphan deletion protocol (corrected after a near-miss):** strict ARM-REMOVAL — delete only
dead arm-lines; whole-rule-delete ONLY when EVERY arm is dead; for mixed groups keep the live arm
(it may be re-emitted in `{`-form when the dead arm was last). **Definitive safety invariant: the SET
of distinct live-selector-contexts (e.g. `grep '#liveId' | sed 's/[,{].*//' | sort -u`) must be
UNCHANGED before/after** — this is viewport-independent and catches loss in harness-uncaptured states
(e.g. `data-panel-focus="lecture-full"`), which a raw `-`-line diff or pixel-diff will MISS.

### Remaining beyond the orphan sweep
- Small COLLAPSE-SAFE-NOW (close-btns L34088/89 + composer `.bottom-actions`, `display:none`/specific → need css-probe states).
- **`!important` removal on DOM-isolated views** (courseTracker 74.9% NOCOMP, preference 69.8%) — higher-risk;
  needs a per-view css-probe state with comprehensive per-property coverage.
- Harness-gated tranches (narrow-viewport, state-matrix) + the §3d composer chain (hardest).

css-probe states on the branch: S2/S3 (§3d baseline), **S-page-corner** (NEW), S12.

**Next clean tranches (no new infra):** learn-topbar 9 (line-precise — skip LOAD-BEARING
groups L34176-34178, L34193-34194, L34088), MN 5 (add an MN-open-case probe state à la
visual-diff view 03b), close-btns 2 + composer 1 (add probes).

### 6.3a — VERIFIED dead-CSS tranche (highest line-value; the only line-reducing one)

Grep-confirmed 2026-06-25 that three IDs are **renamed-away orphans** — `0` references in
`app/index.html` and `0` across all `app/**/*.js` (vs the real `#learnFocusPageIndicator` =
1 + 3):
- `#learnLecturePageIndicator` — 79 selector-lines in style.css, 0 in runtime-collapsed.
- `#learnExplainBottomRail` — 86 selector-lines in style.css, 0 in runtime-collapsed.
- `#learnToolbarPagination` — 90 selector-lines in style.css, **31 in runtime-collapsed.css**.

≈255 style.css lines + 31 runtime-collapsed lines of **dead CSS** (refactor-plan rule #1:
delete unused directly). Unlike doubled-ID collapse (line-neutral), this REDUCES line count.
**Execution care:** delete whole rules where the dead ID is the sole selector; for GROUPED
selectors, remove ONLY the dead arm (some group with the live `#learnFocusPageIndicator` /
other live selectors — deleting a live arm regresses real chrome). **Verifiable**: the live
`#learnFocusPageIndicator` is covered by lesson views 06/08, so visual-diff --check (0.000%)
confirms no live arm was clipped. Recommended as the next high-value tranche.

**Precise deletion plan generated** (workflow `wg12bp3ys`, 3 per-ID planners, 2026-06-25).
Bigger than first estimated: **~320 style.css lines** removable —
**74 WHOLE-RULE** deletions (the big comment-headed clusters: "page-number glass lock" /
"MONO PAGE TAG LOCK" / "compact lesson page badge lock" at L24044-26981, L33948-34937,
L38203-area — dead ID is the sole selector, no live sibling), **47 ARM-IN-GROUP** single-line
deletes (the dead arm is always the FIRST arm of shared paper-tag groups at L23231-23468 etc.,
so the trailing `,` stays and no `{` is touched), **7 ARM-LAST** (need a comma/brace fix —
handle individually), **6 RISK** (verify individually). Many WHOLE-RULE rules are also doubled-ID
(`#learnLecturePageIndicator#learnLecturePageIndicator` etc.), so this also cuts the doubled-ID count.

**Execution protocol (IMPORTANT):**
1. **Cross-ID coordination** — the 3 per-ID plans each mislabel *sibling dead IDs as "live"*
   (the `#learnLecturePageIndicator` planner lists `#learnExplainBottomRail` — also dead — as a
   live sibling). Treat ALL THREE as dead: delete every arm referencing any of the 3; a rule left
   with no *truly*-live arm (e.g. not `#learnFocusPageIndicator`/`#textbookFocusPageIndicator`/
   `#mistakePageIndicator`/`#bookPageIndicator`/`#quizPageIndicator`/overlay buttons) becomes WHOLE-RULE.
2. **Regenerate line numbers before executing** — the plan's line numbers are valid only against
   the frozen branch `refactor/phase3.6-css-collapse` HEAD; re-run the planner workflow (or re-grep)
   if any style.css edit intervenes. Execute **bottom-up** (highest line first) so edits don't shift
   later targets.
3. **Verify** with `visual-diff --check` (0.000% — the live `#learnFocusPageIndicator` on views
   06/08 catches a wrongly-removed live arm) + a CSS sanity check that no empty/orphan selector
   block (`{` with no preceding selector) was left behind.

### 6.3b — learn-topbar tranche caveat (non-unique selectors)

The 9 COLLAPSE-SAFE-NOW topbar selectors are NOT all single-occurrence: `#learnView#learnView
.learn-topbar {` (×2), `.learn-topbar-left` (×2), `.learn-topbar-actions {` (×3), `#btnLectureView`
(×2), `#btnTextbookView` (×2) — the duplicate occurrences are `@media`/state-variant rules that are
NEEDS-NARROW-VIEWPORT or NEEDS-STATE-MATRIX, **not** safe to de-double at 1280/resting. So the topbar
needs **per-occurrence** edits (the L34111-34253 resting rules only), NOT a blanket replace_all. Skip
the LOAD-BEARING groups L34176-34178 (toolbar, chapter-overview state arms) + L34193-34194 (viewselector).

## References
- `docs/REFACTOR_PLAN.md` — "The right sequence from here" (step 3 = this spec).
- `docs/phase3_deferred.md` §12 (entry), §3d (cross-file finding, with corrections folded in here).
- Inventory workflow transcript: 6-agent run `wf_99113351-aac`.
- §3d banners: `style.css` L33190-33280 (chatCol/followup 6-ID), L41333-41427 (followup 12-ID).
- Competitors: `runtime-collapsed.css` L1430-1451, L1629-1653, L1976-2002, L2034-2059.
