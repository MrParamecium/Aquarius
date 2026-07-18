# Phase 3 — Deferred Items (post-refactor backlog)

> ## ❄️ FROZEN 2026-07-18 — new AFK-loop deferrals go to GitHub issues
>
> This doc is **frozen** as an AFK-dev-loop deferral sink. New deferrals (defer
> rules D1–D6) are filed as GitHub issues labelled
> [`afk-deferred`](https://github.com/MrParamecium/Fourier/issues?q=is%3Aissue+label%3Aafk-deferred)
> — the issue queue this repo already treats as canonical. **No new entries are
> appended here.**
>
> This file remains the record for **historical and plan-level context** (the
> Phase 3 post-refactor backlog below is unchanged and still triaged by the Gated
> Timebox protocol). The **only** writer that may still append is an explicit
> `afk-loop-runner.sh --issues off` run, whose entries land under a dedicated
> `## Post-freeze fallback entries (--issues off)` subsection — never in the body
> above.
>
> Migration rationale + full protocol: central-db
> `specs/central-db-afk-loop-deferrals-to-issues-01.md` (R7) and the `afk-dev-loop`
> skill §9.

Drafted: 2026-06-21. **Pruned 2026-07-04** to the live post-refactor backlog only.

> **🔄 PRUNED 2026-07-04 (refactor closed).** The refactor is DONE — the full
> Phase 3.6 CSS `!important`/doubled-ID collapse is at its load-bearing floor and
> every `docs/REFACTOR_DONE.md` §1 DoD box is checked. This doc used to be a
> ~2,200-line historical punch-list mixing shipped work with deferrals; the
> **shipped history (PRs #21–#128 + the "why the N-line target was unreachable"
> analyses) is preserved in git history and `docs/REFACTOR_PLAN.md`** (the
> canonical multi-phase record). What remains below is *only* the post-refactor
> backlog enumerated in `REFACTOR_DONE.md` §4, with the forward entry-points that
> §4 references by anchor (§1a, §1c, §2b, §11, §13a) kept resolvable.
>
> Authoritative current status: **`docs/REFACTOR_DONE.md`** (Definition of Done +
> §4 backlog). Triage every item here by the Gated Timebox protocol
> (`knowledge/gated-timebox-protocol.md`: Sev-1 now, Sev-2 dev day, Sev-3 backlog).

---

## 1. Phase 4 — user-data DB migration

**First item after DONE (refactor-plan scope decision #3).** Filesystem JSON in
`app/users/` breaks the multi-user case on Render's ephemeral FS. Needs its own
design conversation; `app/user-memory.js` already pre-positions the swap. Out of
the refactor's scope by decision; the first thing to pick up next.

---

## 1c. Carry-forward interactive-demo bugs (six, one PR per module)

Surfaced by PR #21's adversarial review. All **pre-existing** (the family-module
extraction faithfully preserved them) and all **verified still present**. Batch
one PR per module (sinusoid-phasor, phasor) with explicit before/after repro
steps. Referenced by `REFACTOR_DONE.md` §4 item 2.

- **SP-1 (Sev-2) — `sinusoid-phasor.js` rAF tick has no detach hook.**
  Re-hydrating a sinusoid section without a full page reload starts a second tick
  loop that races the first. The `if (!node.isConnected) return;` guard fires only
  on detach, not on innerHTML wipe of a still-connected node. Rare but possible.
- **SP-2 (Sev-2) — `sinusoid-phasor.js` Reset-while-paused freezes the wave at t=0.**
  Reset handler doesn't also set `state.running = true` or update the Play/Pause
  label. Pause to inspect → Reset to revert sliders → wave never animates again
  until the user explicitly clicks Play.
- **SP-3 (Sev-3) — `sinusoid-phasor.js` `updateControlLabels` null-deref latent.**
  Doesn't null-check `querySelector` results; a future spec variant omitting any
  of the three `data-demo-value` strong elements throws
  `Cannot set properties of null`.
- **SP-5 (Sev-3) — `sinusoid-phasor.js` hardcodes amplitude/freq/phase defaults**,
  ignoring authored `demo.controls`/`demoSpec.controls` entirely.
- **PH-4 (Sev-2) — `phasor.js` ignores the dispatcher's `demoControls` fallback.**
  Reads `demoSpec.controls` directly; a phasor demo authored with controls at the
  top-level `demo.controls` (panels still in `demoSpec.panels`) renders controls
  empty with hardcoded defaults `slider_a=1`, `slider_b=-1.732`.
- **PH-6 (Sev-3) — `phasor.js` window `resize` listener leak on re-hydration.**
  Per-family `window.addEventListener('resize', rerender, {passive:true})` is never
  removed (all large family modules share this pre-existing leak).

---

## 2. `@layer` migration — TRAP until later (do not attempt yet)

Explicitly a trap while any `!important` remains: `!important` inverts `@layer`
precedence, and the Tailwind CDN runtime-JIT injects unlayered `<style>` that
would flip 646 utility sites. A late anti-regression guardrail only, with little
left to fix once the wall is down. `REFACTOR_DONE.md` §4 item 3.

---

## 3. Harness coverage hardening (regression-safety, not blocking DONE)

Enumerated in `REFACTOR_DONE.md` §4 item 4. The forward entry-points, kept
resolvable here:

### 1a — 3 demo families pixel-unverified

> **Status 2026-07-06 (PR-A):** the two renderers PR-A actually changes —
> `sinusoid_phasor_projection` (SP-5/SP-1) and `phasor`/`renderPhasorDemo`
> (PH-4/PH-6) — are now covered by DETERMINISTIC behavioral assertions in
> `tools/test-demo-lifecycle.js` (authored-control plumbing + dispose lifecycle),
> and the family-table typo class is guarded by `tools/check-demo-family-map.js`
> (§2b, in `npm run check`). **deferred: real-lesson PIXEL views for
> complex_plane / opposite-rotations / sinusoid.** complex_plane (`b.1-2`) and
> opposite-rotations (`b.2-2`) are static (rAF-free) and pixel-diffable but cover
> renderers PR-A does NOT touch (pure regression-safety); baking their baselines
> into an unattended PR risks a flaky gate, so they are parked. The sinusoid
> real-lesson view additionally needs a clock-freeze hook (its canvas animates on
> a wall clock). **Next-session entry point (turnkey):** add PAGE_C_VIEWS
> candidates in `tools/visual-diff.js` — complex_plane `{ sectionId: 'b.1-2',
> expected: 'complex_plane', chapter: 'B Background', section: 'B.1 Complex
> Numbers', title: 'B.1-2 Algebra of Complex Numbers' }`; opposite-rotations
> `{ sectionId: 'b.2-2', expected: 'opposite_rotations', chapter: 'B Background',
> section: 'B.2 Sinusoids', title: 'B.2-2 Sinusoids in Terms of Exponentials' }`
> — plus matching VIEWS entries, then `--baseline` + a cold `--check` to confirm
> determinism. Sev-3.

The visual-diff harness pixel-covers `convolution_lab` + `pole_zero_roc_lab`
family keys only. `complex_plane`, `sinusoid_phasor_projection`, and `phasor` are
NOT pixel-verified. `drawCanvasArrow` save/restore is benign (every
post-`drawArrow` callsite in sinusoid/phasor resets fillStyle/strokeStyle/lineWidth
before next use — hand-verified), but a rendering regression in these three
families would pass green. **Entry point:** add Page-C views opening Chapter-2+
subtopics whose primary demo `family` is one of these keys (with a cached lesson).

### 2b — 11 of 13 dispatcher family-keys never exercised (Sev-1 vs future refactors)

The lesson the 9-view set opens (1.1-1 Signal Energy) has a demo of
`demo_type: energy_cross_term`, which is in `CHAPTER_ONE_DEMO_TYPES`, so the
dispatcher short-circuits at `if (isChapterOneDemo)` **before** the
`INTERACTIVE_DEMO_FAMILY_RENDERERS` lookup is reached. None of the 13 family keys
are exercised by views 06/07/08/09. A typo in any key (e.g.
`pole_zero_roc_lab` → `pole_zero_ROC_lab`) or a renderer-name mismatch falls
through to `renderBriefDemoFallback` and visual-diff still reports 0.000% green.
Verified safe once by hand-walking all 13 mappings against
`app/interactive-demos/*.js`; future PRs touching this path MUST NOT rely on
visual-diff alone. **Entry point:** add a 10th view opening a Chapter-2+ subtopic
whose primary demo `family` is one of the 13 table keys (e.g. a `convolution_lab`
or `pole_zero_roc_lab` subtopic with a cached lesson).

### 11 — Lesson-view sidebar-drift Option-B root fix (masked today, not fixed)

> **Status 2026-07-06 (PR-A `feat/render-drivers-harness`):** the Option-B settle
> sentinel below IS now shipped — the app emits
> `document.documentElement.dataset.lessonLayoutStable` ('0' pending → '1' settled,
> generation-token-guarded) after MathJax + `requestIdleCallback` + 2×rAF, and
> `settleLesson` gates on it. This is a partial Option B: it settles the MathJax
> reflow (cause #3) but does NOT explicitly gate on the chapter-accordion transition
> (cause #1) or font-subpixel variance (cause #2).
>
> **deferred: full sidebar-coverage restore stays MASKED (Option A kept).** Evidence
> the sentinel alone is insufficient: the mistake-notebook view `03b` shows the same
> ~1.3% drift signature yet renders NO MathJax, so causes #1 (accordion `max-height`
> jitter) and #2 (font subpixel) dominate and are untouched by a MathJax-settle
> sentinel. Per the pre-execution adversarial review, un-masking + re-baselining is
> expected to fail its own cold-double-baseline gate; not chased. **Next-session entry
> point:** gate `markLessonLayoutStable` additionally on the `setAccordionOpen`
> transition end (`app.js:641` `dataset.accordionToken` / transitionend) + a
> font-rasterization settle, THEN retry the un-mask + cold double-baseline on the 9
> lesson/MN views. Sev-3, regression-safety only.

The 9 lesson/MN baselines drift ~1.3–1.4% because the left sidebar's vertical
layout shifts ~1–2px per row across captures (accumulated rounding from the
cascade-shadow removals #71–#83; no PR re-baselined the sidebar surface). Shipped
mitigation was **Option A** (PR #86 — mask `#sidebarSyllabusPanel` on lesson
views), which *hides* sidebar regression coverage on those views rather than
fixing the nondeterminism. Root-cause hypotheses (by likelihood): (1) chapter
accordion `max-height`-transition height jitter (`setAccordionOpen`, subpixel
rounding on the settled panel height), (2) Chromium font subpixel-hinting variance
across fresh BrowserContexts, (3) MathJax deferred re-flow after `settleLesson`
resolves. **Option B (the root fix):** have app.js emit
`document.documentElement.dataset.lessonLayoutStable = '1'` after MathJax +
chapter accordion + scrollIntoViewIfNeeded have ALL resolved (gate on
`requestIdleCallback` + 2× rAF); `settleLesson` waits on that attribute instead of
inferring from MathJax + rAFs. ~60-line PR across `app.js` + `tools/test-utils.js`.
Restoring sidebar coverage on lesson views needs Option B. *(11a — view 22
`22-lesson-quick-check` ~0.4% cold-cache flake is subsumed by this; Option B fixes
it, Option A already masks it.)*

### 13a — De-duplicate the css-probe / visual-diff shared bridge machinery

The bridge-spawn + SIGTERM-race teardown + signal handler + MASK `addInitScript`
injection + markdown-report assembly in `tools/css-probe.js` are near-duplicates
of `tools/visual-diff.js`; they will drift (a fix in one won't reach the other).
**Entry point:** hoist `spawnBridge(repoRoot, port)`, `injectMaskInitScript(context)`,
`writeMarkdownReport(path, {title, rows})` into `tools/test-utils.js`; rewire both
harnesses; verify with `npm run test:visual:check` + `npm run test:css-probe:check`.
~1 focused PR (needs a 35-view visual-diff regression run, which is why it was
deferred out of the probe-harness PR).

### 17 — visual-diff intermittent flakiness on STRICT views 14c–14f

On pristine `main`, `visual-diff --check` reproducibly (but intermittently) fails 4
STRICT-threshold (`failRatio: 0.0005`) feedback views at ~0.9% — the THREAD CARDS
column of the populated feedback board (compose card + sidebar stay clean);
pixel-diff shows red text-shift across thread author names/timestamps/body. The
same sub-views also pass at 0.000% on other runs. First suspect:
`formatFeedbackTime(item.createdAt)` — screenshots show `Jan 18` for a fixture
`2024-01-15T10:30:00Z` (either `createdAt` is overwritten in the GET/render
pipeline, or a relative-time path has an implicit `Date.now()` fallback). The 14c–f
views are STRICT on purpose (they guard the documented feedback-cascade blindspot),
so the fix is determinism, not a looser threshold. **Entry point:**
`app/feedback-board.js:47-51` + `app/user-memory.js:195` (publicFeedbackItem) +
`app/ws-bridge.js:5128-5136` (/api/feedback GET) — diff the `createdAt` reaching the
client vs the fixture, then pin determinism (freeze the captured time via a probe
hook, or pin `Date.now` in the test page) and re-baseline 14c–14f once. *(This is
the same family as the A3-surfaced `S-feedback-rest` css-probe nondeterminism in
`REFACTOR_DONE.md` §4 — a shared-container width race; harden with a
settle-before-snapshot: `fonts.ready` + scrollbar-stable.)*

### 18 — Cascade arbiter `sidebar-expanded` VIEW inherits prior view state

`tools/_view-cascade-probe.js`'s `sidebar-expanded` entry has no `nav`/`preNav`/
`ready`, so it captures whatever DOM the prior view (`feedback`, which clicks
`#navFeedbackBtn`) left active — the baseline is order-dependent on the VIEWS array
textual order. A naive `preNav: page.click('#navHomeBtn')` fires `showWelcome()`'s
async pointer-events animations and produces reproducible arbiter flips on a no-op
run. Mitigated today by (a) VIEWS array order, (b) the "feedback must come first"
comment (~L117-128), (c) treating the baseline as source of truth. **Entry point:**
extract a `resetSidebarChromeState` helper that toggles view-class /
data-panel-focus / sidebar-collapsed / open-syllabus directly via `page.evaluate`
without firing app handlers/animations (cf. visual-diff.js's
`hideSyllabusForCapture` / `closeSyllabusForCapture`). ~1–2h.

### 19 — Cascade arbiter <720px viewport blindspot

`tools/_view-cascade-probe.js` VIEWPORTS = `[1280, 1180, 980, 820, 760]`; the
narrowest is 760. PR #118 downgraded `pointer-events: none !important` on
`.app .sidebar` inside `@media (max-width: 720px)` (style.css ~L29724), so the
entire <720px band is invisible to the arbiter for this and any future sidebar
strip. Current mitigation: the `pointer-events: none` still wins in that band (no
inline/non-important competitor found in the JS audit); the risk surfaces only if a
future JS edit adds inline `el.style.pointerEvents = 'auto'` on `.app .sidebar`.
**Entry point:** add a 700px (or 600px) viewport to the VIEWPORTS array and
re-baseline the affected sidebar rules; coordinate with the spec §14 narrow-viewport
harness expansion. ~30min.

> **Also in `REFACTOR_DONE.md` §4 item 4 (detail lives in that doc, not here):** the
> A1 feedback carve-out witness extension (15 arbiter-unreachable `:disabled`/`:active`
> decls, expected yield ~0); the §3d composer fail-open gaps (5 unwitnessed composer
> props — see `docs/A4_COMPOSER_IRREDUCIBLE.md`); the `_grow-keep-from-report.js
> --force-mixed` `:root`/`@`-prefix carve-out gap (A3-surfaced).

---

## 4. Feedback board copy — "Harrison" status string (Sev-3, owner decision)

`submitFeedbackItem` (`app/feedback-board.js`) sets the post-success status line to
`"Posted. Harrison can review it later."` The owner's current identity is FlyM1ss;
this user-facing copy still names "Harrison". Pre-existing (byte-identical to `main`
before the B1 extraction). Project memory cautions against bulk-renaming "Harrison",
so the autonomous loop does not silently rewrite visible app copy. **Entry point:**
the `setFeedbackStatus('Posted. …', 'ok')` line — 1 line once FlyM1ss picks the
wording ("Posted." / "FlyM1ss can review it later." / leave as-is).

---

## 5. View-04 dead-JS / markup tidy (optional; do NOT re-enable the buttons)

`#mistakeNotebookCloseBtn` is `display:none` **by design** (style.css, grouped with
6 sibling close buttons under "Home is now the global return path" — the working
exit is the sidebar Home button). The only residue is harmless dead JS (7 click
handlers on hidden elements). Optional dead-JS/markup tidy — **do not re-enable**.
`REFACTOR_DONE.md` §4 item 5 / §C3.
