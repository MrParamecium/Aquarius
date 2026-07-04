# A3 gate witness — results

> Task `07-03-a3-gate-witness`, branch `a3/gate-witness` off `main` @ `cee080b`.
> Harness-only (tools/**); `app/**` byte-identical to main. Precondition PR for
> A3 `.app .sidebar` strip (task `06-29-a3-sidebar-strip`).

## V0 — combined-state assumption (design crux), verified at HEAD

Re-verified the anchors at current HEAD (`cee080b`; only docs commits since the
`6180fc0` measurement — zero CSS drift confirmed by a fresh sweep):

- **Collapse hides the syllabus panel by `display:none`.** `app/style.css`
  L17324 / L17331 (`.app.sidebar-collapsed .sidebar .sidebar-syllabus-panel`,
  `.app .sidebar.collapsed .sidebar-syllabus-panel`) both set
  `display:none !important`. The competitor is L17507
  `.sidebar-syllabus-panel:not(.hidden){display:block !important}` (lower
  specificity). So under collapse the panel is display:none regardless of
  `.hidden` — **no product state renders a collapsed *visible* tree.** The
  witness therefore asserts the *collapse-hide cascade holds*, not a rendered
  collapsed tree (matches `design.md`).
- **Panel is `.hidden` by default** (index.html:308) and only un-hidden when the
  syllabus tab is opened; `renderSyllabus()` runs once at startup (app.js:5220)
  so the `.syllabus-*` nodes exist in the DOM even while the panel is hidden.
- **`.active` is a class-flip** on click, set *before* the section's onclick
  navigates away (syllabus-view.js:78-79) — so the witness sets `.active` by
  direct class manipulation, never a real click (a click leaves the sidebar).

Consequence for R1: the collapsed-side witness OPENS the panel (removes
`.hidden`) then collapses, so the collapse-hide `!important` (L17324/L17331) is
the *sole* thing holding the panel hidden — a strip that drops it lets L17507
win and the panel un-hides (observable). If the panel stayed `.hidden`, the
strip would be masked by `.hidden{display:none}`.

## Coverage built (tools/_view-cascade-probe.js + tools/visual-diff.js)

Primary witness = the computed-style arbiter (per `design.md`: it sees the
off-screen / display:none / hover-state flips pixel-diff cannot). Three new
arbiter VIEWs + a curated PROP_LIST extension + tight visual-diff thresholds:

| Req | Instrument | What it observes |
|---|---|---|
| R1 expanded + R2 | arbiter VIEW `sidebar-syllabus-expanded` (root `#sidebarSyllabusPanel`) | tree open + chapter expanded + section 0 `.active`; rest + hover a non-active row → the `.sidebar .syllabus-section` base / `:hover` (L5913-5918) / `.active` (L5923-5928) arms |
| R1 collapsed | arbiter VIEW `sidebar-collapsed-hide` (root `#sidebarSyllabusPanel`) | panel opened then sidebar collapsed → panel rect 0×0 + `display:none` held only by L17324/L17331; un-hide → RED |
| R3 | arbiter VIEW `sidebar-collapsed-lesson-frame` (root `.lesson-page-frame`) | §1.1-1 lesson open + `chat-collapsed` + sidebar-collapsed → the L18280-18290 (+L12156/L18381) frame geometry via rect + PROP_LIST |
| (all) | PROP_LIST += max-width, min-height, min-width, margin-top/bottom/left, border-radius, border-left-color/width, box-shadow, background-image, color, font-weight, display | the frame-geometry + syllabus-arm props the committed `#feedbackView` floor list omits |
| R4 | visual-diff `02-syllabus-open` + `20-sidebar-collapsed` `failRatio: 0.0005` | pixel backstop; the only unmasked syllabus-tree + collapsed-sidebar frames |

**css-probe (optional durable state): DROPPED as a named gap.** css-probe has
zero sidebar infrastructure and no fail-closed winner sentinel is constructible
for the collapse-hide (the S14 precedent — do not force fail-open). The arbiter
(manual) + tightened visual-diff is the same trust model A4/S14 relied on.

## Baseline + a determinism bug found and fixed

Fresh arbiter baseline regenerated whole (gitignored `_view-cascade-baseline.json`;
`app/style.css` untouched) under a 5GB Node heap: **330 states, 137,190
element-snapshots** across the 5 pre-existing + 3 new VIEWs. All 8 VIEWs entered
their fail-closed `ready` states, and the S14 VIEWs still recover the lesson/
expand chrome after the new lesson-frame VIEW — so the ordering + `resetSyllabusDirect`
did not regress them.

**Determinism bug caught by the first canary and fixed (task discovery):** the
first baseline (run on a cold font cache after an idle gap) disagreed with its
`--check` (warm cache) by ~14k flips on the **pre-existing** feedback + sidebar
VIEWs — `font-family: "Nunito…" → "Phosphor-Bold"`, a ~17px scrollbar width shift,
`::placeholder` height. Root cause: the arbiter (unlike visual-diff's
`settleLesson`) never awaited `document.fonts.ready`, so a snapshot taken
mid-font-load read fallback-font metrics. Fix (all in `_view-cascade-probe.js`):
`settle()` now awaits `document.fonts.ready` + a reflow before every snapshot; the
lesson-frame VIEW calls `settleLesson` (MathJax); dropped the noise-prone
`font-weight` prop (not an A3 strip target). **No-op control after the fix: PASS —
330 states byte-identical** (baseline vs immediate re-check), so the baseline is
deterministic and the earlier flips were confirmed font-load noise, not signal.

## Canary (gate-is-real proof) — all three requirements caught, attribution clean

Deliberate flips against the deterministic baseline (each reverted byte-identical
after). The gate observes real cascade flips — it is not decorative. Attribution
was clean on every run: **feedback / sidebar-expanded = 0 flips** (my sidebar edits
never leaked into unrelated views).

| Req | Flip applied | VIEW that went RED | Evidence line |
|---|---|---|---|
| R1-collapsed | collapse-hide `display:none !important` → strip `!important` (L17333 shared body) | `sidebar-collapsed-hide` **7050** | `#sidebarSyllabusPanel … display: "none" → "block"`, rect `[0,0,0,0] → [-74,150,224,280]` |
| R2 / R1-expanded | the **winning** `.app .sidebar .syllabus-section.active` background (L20225) `rgba(255,255,255,0.95)` → magenta | `sidebar-syllabus-expanded` **60** | `button.syllabus-section.active … background-color: "rgba(255, 255, 255, 0.95)" → "rgb(255, 0, 255)"` |
| R3 | collapsed-frame group body (L18278-90) `background`/`box-shadow`/`min-height` → sentinels | `sidebar-collapsed-lesson-frame` **60** | `article.lesson-page-frame … background-color → rgb(7,8,9); box-shadow → rgb(1,2,3) 0 0 5px; min-height: "100%" → "150px"` |

**A3 finding surfaced by the canary (feeds the R5 keep-set derivation):** the
syllabus-row styling is itself a **redeclaration pileup** — the `.sidebar
.syllabus-section` / `.active` / `:hover` arms at L5904-5928 are OVERRIDDEN by the
higher-specificity, later `.app .sidebar .syllabus-section*` rules at L20195/
L20218/L20225 (which set the observed `padding:7px 14px 7px 8px`, active
`background:rgba(255,255,255,0.95)`, hover `rgba(255,255,255,0.6)`). So the L5913-5928
`!important` arms are likely **NOCOMP/dead** (a strip there is render-neutral) while
the L20195+ arms are the load-bearing winners. A3's fresh keep-set pass must classify
per-occurrence against the L20195+ winners, not the L5904 base — the witness makes
this visible.

## R4 — visual-diff pixel backstop (validated)

`visual-diff --check` (pristine `app/`): **39/39 views pass**, including the two
tightened views at `failRatio: 0.0005`:

| View | result | diff | threshold |
|---|---|---|---|
| `02-syllabus-open` | pass | **0.000%** (0/1024000) | 0.050% |
| `20-sidebar-collapsed` | pass | **0.000%** (0/1024000) | 0.050% |

100% margin — the tighter threshold does not flake and would catch a real
single-rule sidebar flip that hid under the 0.5% default.

## Gate status — READY (all acceptance criteria met)

- ✅ V0 finding recorded; VIEW shape matches (collapsed ⇒ display:none, no visible
  collapsed tree).
- ✅ R1-R4 landed; baseline regenerated (330 states); pre-existing keys deterministic
  (no-op control PASS 330 byte-identical after the font-determinism fix).
- ✅ Canary went RED on all three new VIEWs with clean attribution; reverted
  byte-identical.
- ✅ `app/**` byte-identical to main throughout; harness-only (`tools/**`).
- ⏳ ships as its own PR; A3 (`06-29-a3-sidebar-strip`) references it as the met gate.

**css-probe durable sidebar state — DROPPED (named gap).** No fail-closed winner
sentinel is constructible for the collapse-hide without a bespoke fixture (the S14
precedent — do not force fail-open). The manual arbiter (primary) + tightened
visual-diff (backstop) is the same trust model A4/S14 relied on. A3-proper runs its
5-gate strip against this arbiter; the gitignored `_view-cascade-baseline.json`
(~330 states, not committed — the arbiter is not in `package.json`) is regenerated
on `main` before the strip, exactly as A1/S14 did.

## Review response (PR #127 review — 5 findings addressed)

Harness-hardening only; `app/**` still byte-identical to main; `npm run check` green.

1. **`20-sidebar-collapsed` mid-transition capture (`visual-diff.js`).** Adding
   `.sidebar-collapsed` fires the `.sidebar` (width/transform) + `.main` (margin)
   0.4s transitions (style.css L6913/L6921); the old setup relied on `settleLesson`'s
   waits happening to outlast 400ms (wall-clock luck → load-sensitive at the tight
   0.05% budget). Fix: setup now calls `document.getAnimations().forEach(a=>a.finish())`
   to jump the transitions to their settled end state, making the capture
   timing-independent. **Verified zero-baseline-impact:** a full-run regen with the
   fix leaves `20-sidebar-collapsed.png` byte-identical to the committed baseline (the
   full-run settle already reached the end frame), so the fix is pure insurance.
2. **`02-syllabus-open` unmasked-tree drift (`visual-diff.js`).** The `~1-2px/row`
   settled-height drift that forced `maskLessonSidebar` on downstream lesson views
   does not surface here (`ensureSyllabusOpen` gates on `.is-open:not(.is-animating)`;
   `getAnimations().finish()` added for parity). **Calibrated** 3 baseline-vs-baseline
   runs each at `0/1024000` (0.000%) — the tight 0.05% floor now has a documented
   noise floor, not a single-run assertion (matches the views-26/29 discipline).
3. **`settle()` unbounded `document.fonts.ready` (`_view-cascade-probe.js`).** The
   fonts are remote (Google Fonts `@import` + Phosphor `<script>` from unpkg); a
   stalling-egress environment would hang the probe forever. Fix: `Promise.race`
   the await against an 8000ms cap, matching the `waitForSelector`/`waitForFunction`
   timeouts already in `captureView`.
4. **`sidebar-syllabus-expanded` `section-hover` silent-degrade
   (`_view-cascade-probe.js`).** If chapter 0 ever renders a single section,
   `:not(.active)` matches nothing and `present()` silently skips the hover → the
   snapshot would degrade to a byte-identical duplicate of `rest`. Fix: the VIEW's
   `ready` predicate now also requires a `:not(.active)` row, so the degradation
   fails loud (ready timeout) instead of quietly. Re-ran the VIEW: 30 states × 795
   elements, `--check` byte-identical PASS.
5. **`task.json` bookkeeping.** `pr_url` set to PR #127 so the gated follow-up task
   `06-29-a3-sidebar-strip` has a queue-visible signal that the gate PR exists.
