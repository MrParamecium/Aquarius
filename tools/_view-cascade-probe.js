#!/usr/bin/env node
/**
 * _view-cascade-probe.js — TEMP scratch arbiter for the Phase 3.6 per-view
 * !important-strip. Its target surface moves over time via the VIEWS const
 * (below); the live targets currently cover the sidebar and lesson witnesses.
 *
 * The spec (§4) warns pixel-diff is blind to off-screen / sub-threshold cascade
 * flips — exactly the failure mode of downgrading !important. This is the
 * load-bearing gate: it walks the ENTIRE view subtree (element + ::before +
 * ::after + ::placeholder) and records, per element:
 *   - offset-box metrics (offsetLeft/Top/Width/Height — scroll-INVARIANT, so
 *     Playwright's non-deterministic auto-scroll can't perturb them; still
 *     catches ANY reflow a cascade flip causes)
 *   - every candidate property's resolved value (catches recolor/reborder/etc.)
 * across the state matrix that rules under the view actually use:
 *   themes {dawn,dusk,dark} × viewports {1280,1180,980,820,760} × interactions
 *   {rest, hover, focus, data-tone}. A stripped !important can only change
 *   rendering where a competing RULE exists, and every such rule's state is one
 *   of these — so byte-identical here ⇒ render-neutral, SUBJECT TO the two
 *   coverage assumptions below.
 *
 * COVERAGE CAVEATS (this gate is necessary, not sufficient on its own):
 *   1. State-matrix completeness. A competitor gated on a state OUTSIDE the
 *      matrix (unprobed breakpoint / pseudo-class / data-attr) is invisible
 *      here and may only be caught by visual-diff. Always pair with visual-diff
 *      as a per-strip gate; never ship on the probe alone.
 *   2. Inline-style competitors. Cascade order is
 *      `!important author > inline style > normal author`, so a stripped prop
 *      that JS sets inline beats the now-normal rule. The probe renders the real
 *      app with JS live, so it catches this IN probed states — but an inline
 *      write firing only in an UNPROBED state regresses silently. Before a strip,
 *      audit JS .style/.setProperty/.cssText writes of the stripped props on the
 *      target view against this matrix.
 *
 *   node tools/_view-cascade-probe.js --baseline   # → _view-cascade-baseline.json
 *   node tools/_view-cascade-probe.js --check       # compare byte-identical, report flips
 *
 * Reuses the css-probe.js bridge-spawn + test-utils navigation verbatim.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { MASK_CSS, waitForHealth, enterGuestMode, openSubtopic, enterTextbookOverflowState, settleLesson } = require('./test-utils.js');

// A4 S14 witness (task 06-29-a4-s14-tall-witness): the lesson the textbook-overview
// VIEWs open. Same §1.1-1 the visual-diff harness uses (cache present).
const S14_SUBTOPIC = { id: '1_1-1', title: '1.1-1 Signal Energy',
  chapter: 'Chapter 1: Signals and Systems', section: '1.1 Size of a Signal' };
// openSubtopic (~25s) only if the lesson view isn't already visible — the `fill`
// VIEW inherits the open lesson from `tall`, so it skips the re-open.
async function s14EnsureLessonOpen(page) {
  // A prior collapsed sidebar VIEW (sidebar-collapsed / sidebar-collapsed-hide /
  // sidebar-collapsed-lesson-frame) may leave `.app.sidebar-collapsed` set, which
  // hides the syllabus → openSubtopic's chapter click fails "not visible".
  // Expand the sidebar first (deterministic: both baseline + check do the same).
  await page.evaluate(() => {
    document.querySelector('.app')?.classList.remove('sidebar-collapsed');
    document.getElementById('leftSidebar')?.classList.remove('collapsed');
  });
  const open = await page.evaluate(() => {
    const v = document.getElementById('learnView');
    return !!(v && getComputedStyle(v).display !== 'none' && v.offsetParent !== null);
  });
  if (!open) await openSubtopic(page, S14_SUBTOPIC);
}
// Re-inject the combined state after each viewport resize. Strict at desktop
// (>=1180 must establish cleanly, or the witness is invalid); tolerant of narrow
// responsive layouts (the arbiter compares baseline vs check at the SAME viewport,
// so a degraded narrow cell stays self-consistent and still flags real flips).
async function s14ReassertState(page, variant) {
  try {
    await enterTextbookOverflowState(page, { variant });
  } catch (e) {
    const w = await page.evaluate(() => window.innerWidth).catch(() => 0);
    if (w >= 1180) throw e;
  }
}

// A3 gate witness (task 07-03-a3-gate-witness). Force the left-sidebar syllabus
// tree into a deterministic OPEN + chapter-expanded + one-section-active state
// WITHOUT firing the app's accordion animation (mirrors the view-15/16/20
// direct-class-flip philosophy — setAccordionOpen uses a 380ms maxHeight
// tween + setTimeout that would race the snapshot). renderSyllabus() ran once
// at startup (app.js:5220) so the `.syllabus-*` nodes already exist; we only
// flip the visibility classes. `active` is set by class-flip, NOT a real
// section click, because a click fires openLearnMode and navigates away from
// the sidebar (syllabus-view.js:78-91).
async function openSyllabusTreeDirect(page) {
  await page.evaluate(() => {
    const openPanel = (el) => {
      if (!el) return;
      el.classList.remove('hidden', 'is-animating');
      el.classList.add('is-open');
      el.style.maxHeight = 'none';
      el.style.opacity = '';
      el.style.transform = '';
      el.style.overflow = '';
      el.style.pointerEvents = '';
      el.dataset.accordionState = 'open';
    };
    // Expand the sidebar (a prior collapsed VIEW may have left it collapsed).
    document.querySelector('.app')?.classList.remove('sidebar-collapsed');
    document.getElementById('leftSidebar')?.classList.remove('collapsed');
    openPanel(document.getElementById('sidebarSyllabusPanel')); // the syllabus accordion
    openPanel(document.getElementById('syllabus-0'));           // chapter 0's sections
    // Mark the first section active (drives the L5923-5928 `.active` arm).
    const secs = document.querySelectorAll('#courseSyllabus .syllabus-section');
    secs.forEach((b) => b.classList.remove('active'));
    if (secs[0]) secs[0].classList.add('active');
  });
}

// A3 gate witness. Open the syllabus panel (so it is NOT .hidden) and THEN
// collapse the sidebar — so the ONLY thing holding the panel hidden is the
// collapse-hide cascade (.app.sidebar-collapsed …{display:none !important},
// style.css L17324/L17331). A `.app .sidebar` strip that drops that !important
// would let `.sidebar-syllabus-panel:not(.hidden){display:block !important}`
// (L17507, lower specificity) win → the panel un-hides → a non-zero rect +
// display:block here goes RED. If the panel stayed .hidden the strip would be
// masked by `.hidden{display:none}`, which is exactly the collapsed-tree gate
// gap this witness closes.
async function openPanelThenCollapse(page) {
  await openSyllabusTreeDirect(page);   // panel + chapter open, sidebar expanded
  await page.evaluate(() => {
    document.querySelector('.app')?.classList.add('sidebar-collapsed');
    document.getElementById('leftSidebar')?.classList.add('collapsed');
  });
}

// A3 gate witness. Undo openSyllabusTreeDirect's class-flips — close the panel,
// every chapter's `.syllabus-sections`, and clear `.active`/`.open`. Called
// before the lesson-frame VIEW opens a lesson, because openSubtopic() TOGGLES
// the chapter accordion by clicking it: an already-open `#syllabus-0` (left by
// the two VIEWs above) would be CLOSED by that click → the section click then
// times out on a display:none row. Resetting to the app's fresh closed state
// makes openSubtopic's toggle open it cleanly.
async function resetSyllabusDirect(page) {
  await page.evaluate(() => {
    const close = (el) => {
      if (!el) return;
      el.classList.add('hidden');
      el.classList.remove('is-open', 'is-animating');
      el.style.maxHeight = '';
      el.style.opacity = '';
      el.style.transform = '';
      el.style.overflow = '';
      el.style.pointerEvents = '';
      el.dataset.accordionState = 'closed';
    };
    close(document.getElementById('sidebarSyllabusPanel'));
    document.querySelectorAll('#courseSyllabus .syllabus-sections').forEach(close);
    document.querySelectorAll('#courseSyllabus .syllabus-section.active').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('#courseSyllabus .caret.open').forEach((c) => c.classList.remove('open'));
  });
}

const PORT = Number(process.env.TUTOR_VIEWPROBE_PORT || 9127);
const BASE = `http://127.0.0.1:${PORT}`;
const TOOLS = __dirname;
const BASELINE = path.join(TOOLS, '_view-cascade-baseline.json');
const REPORT = path.join(TOOLS, '_view-cascade-report.md');

const MODE = process.argv.includes('--baseline') ? 'baseline'
           : process.argv.includes('--check') ? 'check' : null;
if (!MODE) { console.error('usage: _view-cascade-probe.js --baseline | --check'); process.exit(2); }

// Property union actually carrying !important under the target view (+ a few
// layout staples) — i.e. "every property touched by a stripped !important"
// (spec §4.3). NOTE: _view-important.json is TRACKED (committed), and is
// REGENERATED by _extract-view-important.js for the surface currently under strip,
// so PROP_LIST only covers the props of whichever view the extract last targeted.
// Regen order per surface: set VIEWS in _extract-view-important.js → run it → run
// this probe. The committed copy currently carries the sidebar property list.
const cand = require('./_view-important.json');
const PROP_LIST = [...new Set([
  ...Object.values(cand).flat().map((d) => d.prop),
  // layout/visual staples so a reflow's downstream resolved values are pinned too
  'left', 'right', 'bottom', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom',
  'margin-right', 'border-width', 'border-style', 'background-color', 'flex-grow', 'flex-basis',
  // A3 gate witness (task 07-03-a3-gate-witness): props a `.app .sidebar` !important
  // strip could flip but that the generated sidebar floor list may omit — the
  // collapsed .lesson-page-frame geometry (style.css L18282-90) + the syllabus
  // :hover/.active arms (L5913-5926). rect already pins width/height/offset; these
  // pin the rest so the sidebar VIEWs below observe the flip a NOCOMP-misjudged strip
  // would cause. `display` makes the collapse-hide cascade (L17324/L17331) explicit
  // as a string, not only via the 0×0 rect.
  'max-width', 'min-height', 'min-width', 'margin-top', 'margin-bottom', 'margin-left',
  'border-radius', 'border-left-color', 'border-left-width', 'box-shadow',
  'background-image', 'color', 'display',
])].sort();

const THEMES = ['dawn', 'dusk', 'dark'];
const VIEWPORTS = [1280, 1180, 980, 820, 760];

async function setExpandedSidebarState(page) {
  await page.evaluate(() => {
    document.querySelector('.app')?.classList.remove('hidden', 'sidebar-collapsed');
    document.getElementById('leftSidebar')?.classList.remove('collapsed');
    document.querySelectorAll('.sidebar-link.active').forEach((node) => node.classList.remove('active'));
    document.getElementById('navHomeBtn')?.classList.add('active');
  });
}

const VIEWS = [
  // -------------------------------------------------------------------------
  // .app .sidebar — NOT DOM-isolated. The sidebar paints on every navigated
  // view; cascade competitors live both within the .sidebar subtree (own
  // descendants) AND in cross-cutting grouped rules (.learn-close, .book-nav-btn,
  // .feature-close-btn-compact, .syllabus-section, etc.) that share a rule
  // with sidebar arms — those 51 mixed candidates are force-kept upfront by
  // _grow-keep-from-report.js's --force-mixed flag. The expanded + collapsed
  // contexts cover the two sidebar layout modes; the home subtree is the
  // default after enterGuestMode (no navigation needed).
  {
    id: 'sidebar-expanded', root: '.app .sidebar',
    preNav: setExpandedSidebarState,
    ensureState: setExpandedSidebarState,
    // Real DOM IDs in app/index.html: the prior list named `.sidebar-toggle`,
    // `#navRecentConversationsBtn`, `#navSettingsBtn` — none exist (real IDs
    // are `#menuToggleBtn`, `#navRecentBtn`, `#sidebarSettingsBtn`). The
    // missing selectors silently skipped via present(), so 3 label-cells were
    // baselined as duplicates of `rest`.
    interactions: [
      { label: 'rest' },
      { label: 'menu-toggle-hover', hover: '#menuToggleBtn' },
      { label: 'recent-hover', hover: '#navRecentBtn' },
      { label: 'settings-hover', hover: '#sidebarSettingsBtn' },
      { label: 'preference-hover', hover: '#navPreferenceBtn' },
    ],
  },
  {
    id: 'sidebar-collapsed', root: '.app .sidebar',
    preNav: async (page) => {
      await page.evaluate(() => {
        document.querySelector('.app')?.classList.add('sidebar-collapsed');
        document.getElementById('leftSidebar')?.classList.add('collapsed');
      });
    },
    // Ensure the collapsed class is reapplied after each viewport resize —
    // some app-level resize handlers reset chrome state.
    ensureState: async (page) => {
      await page.evaluate(() => {
        document.querySelector('.app')?.classList.add('sidebar-collapsed');
        document.getElementById('leftSidebar')?.classList.add('collapsed');
      });
    },
    interactions: [
      { label: 'rest' },
      { label: 'menu-toggle-hover', hover: '#menuToggleBtn' },
    ],
  },
  // -------------------------------------------------------------------------
  // A3 gate witness (task 07-03-a3-gate-witness) — the three coverage gaps a
  // `.app .sidebar` !important strip needs observed before it can start.
  // Appended AFTER the two #118 sidebar VIEWs; each sets up its own state in
  // preNav (so it does NOT depend on inherited chrome the way sidebar-expanded
  // does) and re-asserts in ensureState after every viewport resize.
  // -------------------------------------------------------------------------
  // R1 (expanded side) + R2 — the syllabus tree rendered + VISIBLE, so the
  // `.sidebar .syllabus-section` base / :hover / .active arms (style.css
  // L5904-5928, the `!important` ones at L5913-5928) are witnessed. This is
  // where a NOCOMP-misjudged strip on a tree selector visibly regresses; no
  // prior harness state rendered the tree with its hover/active arm live.
  {
    // root = #sidebarSyllabusPanel (not the whole .app .sidebar): the tree arms
    // all live inside it, the rest of the sidebar is covered by sidebar-expanded,
    // and this keeps the (expanded-tree) walk small.
    id: 'sidebar-syllabus-expanded', root: '#sidebarSyllabusPanel',
    preNav: openSyllabusTreeDirect,
    ensureState: openSyllabusTreeDirect,
    ready: () => {
      const p = document.getElementById('sidebarSyllabusPanel');
      const s = document.querySelector('#courseSyllabus .syllabus-section.active');
      // Require a NON-active row too. The `section-hover` interaction hovers
      // `.syllabus-section:not(.active)`, but captureView's present() silently
      // SKIPS a zero-match hover — so if chapter 0 ever renders with a single
      // section (all rows .active after openSyllabusTreeDirect), the section-hover
      // snapshot would degrade to a byte-identical duplicate of `rest`, silently
      // losing the :hover witness (the same silent-duplicate failure the
      // sidebar-expanded VIEW hit once, L250-255). Failing `ready` here surfaces
      // that as a loud timeout instead of a quietly-decorative gate.
      const other = document.querySelector('#courseSyllabus .syllabus-section:not(.active)');
      return !!p && !p.classList.contains('hidden') && !!s && !!other;
    },
    interactions: [
      { label: 'rest' },
      // Hover a NON-active row so the :hover arm (L5913-5918) and the resting
      // .active arm (L5923-5928) are both live in the same snapshot.
      { label: 'section-hover', hover: '#courseSyllabus .syllabus-section:not(.active)' },
    ],
  },
  // R1 (collapsed side) — the collapse-hide cascade (.app.sidebar-collapsed …
  // .sidebar-syllabus-panel {display:none !important}, L17324/L17331) is the
  // SOLE hider of an OPENED panel here. A strip that drops that !important lets
  // `.sidebar-syllabus-panel:not(.hidden){display:block !important}` (L17507,
  // lower specificity) win → the panel un-hides → non-zero rect + display:block
  // → RED. (If the panel stayed .hidden the strip would be masked by
  // `.hidden{display:none}` — exactly the collapsed-tree gap this closes.)
  {
    // root = #sidebarSyllabusPanel: the collapse-hide rule hides THIS element, so
    // its own rect (0×0) + display:none is the witness. Un-hide → non-zero → RED.
    id: 'sidebar-collapsed-hide', root: '#sidebarSyllabusPanel',
    preNav: openPanelThenCollapse,
    ensureState: openPanelThenCollapse,
    ready: () => {
      const p = document.getElementById('sidebarSyllabusPanel');
      const app = document.querySelector('.app');
      return !!p && !p.classList.contains('hidden') && !!app && app.classList.contains('sidebar-collapsed');
    },
    interactions: [{ label: 'rest' }],
  },
  // R3 — the collapsed `.lesson-page-frame` geometry (#learnView
  // #learnBody.chat-collapsed .lesson-page-frame under .app.sidebar-collapsed,
  // style.css L18280-18290 + L12156/L18381 — all !important). A `.app .sidebar`
  // collapse-arm strip can flip which comma-group arm wins → the frame's
  // width/max-width/min-height/margin/padding/border/border-radius/background/
  // box-shadow change. root = `.lesson-page-frame` (focused walk): rect pins
  // width/height, the A3 PROP_LIST staples pin the rest. Opens the §1.1-1
  // lesson (reuses the S14 helper); MUST precede the S14 VIEWs which recover
  // the sidebar/expand + reset chrome in their own s14EnsureLessonOpen.
  {
    id: 'sidebar-collapsed-lesson-frame', root: '.lesson-page-frame',
    preNav: async (page) => {
      await resetSyllabusDirect(page);   // undo the two VIEWs' class-flips so openSubtopic's toggle is clean
      await s14EnsureLessonOpen(page);   // opens §1.1-1 (expands the sidebar first)
      await page.evaluate(() => {
        const body = document.getElementById('learnBody');
        if (body) { body.classList.add('chat-collapsed'); body.classList.remove('explain-collapsed'); }
        document.querySelector('.app')?.classList.add('sidebar-collapsed');
        document.getElementById('leftSidebar')?.classList.add('collapsed');
      });
      await settleLesson(page);  // wait out MathJax typeset so the frame's content height is deterministic
    },
    ensureState: async (page) => {
      await page.evaluate(() => {
        const body = document.getElementById('learnBody');
        if (body) body.classList.add('chat-collapsed');
        document.querySelector('.app')?.classList.add('sidebar-collapsed');
        document.getElementById('leftSidebar')?.classList.add('collapsed');
      });
      await settleLesson(page);  // re-settle after each viewport resize (MathJax may re-typeset)
    },
    ready: () => {
      const b = document.getElementById('learnBody');
      const f = document.querySelector('#learnView .lesson-page-frame');
      const app = document.querySelector('.app');
      // Assert the VIEW's DEFINING precondition — the sidebar IS collapsed — not
      // just that a frame exists: a frame captured while expanded witnesses the
      // WRONG comma-group arm (the non-.app.sidebar-collapsed arm, style.css
      // L18278-79) and silently bakes a decorative R3 baseline, so fail LOUD at
      // open time instead (parity with the sibling sidebar-collapsed-hide ready).
      // NB: `ready` runs ONCE pre-loop (captureView, before the theme×viewport
      // sweep); the PER-CELL guard is ensureState's unconditional re-add on each
      // resize. That re-add is race-free because NO app
      // resize/matchMedia/ResizeObserver handler clears sidebar-collapsed — the
      // class is toggled ONLY by the menu-toggle CLICK (app.js
      // setWorkspaceSidebarCollapsed), so nothing can race it out between the
      // re-add and the snapshot.
      return !!b && b.classList.contains('chat-collapsed') && !!f
        && !!app && app.classList.contains('sidebar-collapsed');
    },
    interactions: [{ label: 'rest' }],
  },
  // A4 S14 witness (task 06-29-a4-s14-tall-witness): the combined overview+textbook
  // (Band-2) state — the ONLY arbiter coverage of style.css L24575-24609. APPENDED LAST
  // (per the order-dependence warning above): these navigate to a lesson, so nothing
  // after them inherits sidebar chrome. The arbiter pins scrollTop=0 before
  // each snapshot, but offset-box geometry is scroll-invariant, so the 3 at-risk decls
  // are witnessed via rect.height: tall → #learnExplainScroll offsetHeight 738
  // (height:100% — MEASURED NOCOMP: deleting it leaves both offsetHeight and the
  // probed `height` computed value at 738, the calc(100dvh-60px) fallback resolving
  // identically, so this decl is excluded from the keep-set) + .textbook-pages-flow
  // offsetHeight (padding-bottom);
  // fill → .textbook-pages-flow offsetHeight 738 (min-height:100% pads it up, fallback ~300).
  // enterTextbookOverflowState re-runs in ensureState (re-inject after each viewport resize).
  {
    id: 'learn-textbook-overview-tall', root: '#learnExplainScroll',
    preNav: async (page) => {
      await s14EnsureLessonOpen(page);
      await enterTextbookOverflowState(page, { variant: 'tall' });
    },
    ready: () => {
      const b = document.getElementById('learnBody');
      return !!b && b.classList.contains('chapter-overview-active') && b.classList.contains('learn-textbook-active');
    },
    ensureState: async (page) => { await s14ReassertState(page, 'tall'); },
    interactions: [{ label: 'rest' }],
  },
  {
    id: 'learn-textbook-overview-fill', root: '#learnExplainScroll',
    preNav: async (page) => {
      await s14EnsureLessonOpen(page);
      await enterTextbookOverflowState(page, { variant: 'fill' });
    },
    ready: () => {
      const b = document.getElementById('learnBody');
      return !!b && b.classList.contains('chapter-overview-active') && b.classList.contains('learn-textbook-active');
    },
    ensureState: async (page) => { await s14ReassertState(page, 'fill'); },
    interactions: [{ label: 'rest' }],
  },
];

const round = (n) => Math.round(n * 1000) / 1000;

// Walk the subtree in document order; snapshot geometry + props + pseudo-elements.
function makeSnapshotFn() {
  return (args) => {
    const { root, props } = args;
    const rootEl = document.querySelector(root);
    if (!rootEl) return { __error: `root ${root} missing` };
    const els = [rootEl, ...rootEl.querySelectorAll('*')];
    const r3 = (n) => Math.round(n * 1000) / 1000;
    const pseudo = (el, which) => {
      const g = getComputedStyle(el, which);
      return [
        g.content, g.getPropertyValue('background-image'), g.getPropertyValue('background-color'),
        g.color, g.opacity, g.transform, g.boxShadow, g.getPropertyValue('border-color'),
        g.width, g.height, g.display,
      ].join(' ¦ ');
    };
    return els.map((el, i) => {
      const cs = getComputedStyle(el);
      // Layout-box metrics (offset*) — scroll-INVARIANT (Playwright auto-scrolls
      // to hover/focus below-fold controls non-deterministically). Transforms are
      // pre-layout so they don't show here, but `transform` is snapshotted as a
      // prop, so reflow + transform coverage is complete between the two.
      const rect = { x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
      const cls = (el.className && typeof el.className === 'string')
        ? '.' + el.className.trim().split(/\s+/).join('.') : '';
      const pv = {};
      for (const p of props) pv[p] = cs.getPropertyValue(p);
      return {
        i,
        desc: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls,
        rect: [rect.x, rect.y, rect.width, rect.height],
        props: pv,
        before: pseudo(el, '::before'),
        after: pseudo(el, '::after'),
        placeholder: pseudo(el, '::placeholder'),
      };
    });
  };
}

async function settle(page) {
  await page.evaluate(async () => {
    // Wait out any in-flight webfont load BEFORE snapshotting. The body font +
    // the Phosphor icon font (`i.ph-bold` → font-family "Phosphor-Bold") load
    // lazily on first use; a snapshot taken mid-load reads fallback-font metrics
    // (Nunito) whose different glyph widths shift text wrapping → content height
    // → scrollbar presence → a ~17px content-width flip on unrelated views. The
    // visual-diff harness gates on this via settleLesson's font.load; the arbiter
    // never did, so a COLD-cache baseline vs a WARM-cache check disagreed on the
    // sidebar views (task 07-03-a3-gate-witness discovery). Awaiting
    // document.fonts.ready + a reflow makes every snapshot font-deterministic.
    // Bound the wait: the fonts are remote (Google Fonts @import in style.css +
    // the Phosphor icon <script> from unpkg in index.html). A stalling-egress
    // environment leaves the FontFaceSet in `loading` forever → fonts.ready never
    // resolves and this evaluate() would hang the whole probe. Cap at 8000ms to
    // match the waitForSelector/waitForFunction timeouts in captureView, so a
    // blocked network degrades the run's font-determinism instead of hanging it.
    if (document.fonts && document.fonts.ready) {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise((r) => setTimeout(r, 8000)),
        ]);
      } catch (_) {}
    }
    void document.body.offsetHeight;  // force a layout flush with the loaded font
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

async function captureView(page, view, snapFn) {
  const out = {};
  // Open the view once at desktop.
  await page.setViewportSize({ width: 1280, height: 800 });
  await settle(page);
  if (view.preNav) await view.preNav(page);   // e.g. seed a localStorage fixture before opening
  if (view.nav) {
    await page.click(view.nav);
    await page.waitForSelector(`${view.root}:not(.hidden)`, { timeout: 8000 });
  }
  if (view.ready) await page.waitForFunction(view.ready, { timeout: 8000 });

  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      for (const act of view.interactions) {
        // Clear prior interaction state, then set theme + viewport.
        await page.mouse.up().catch(() => {});
        await page.mouse.move(0, 0);
        await page.evaluate(() => {
          document.activeElement?.blur?.();
          const ss = document.querySelector('.preference-save-state');
          if (ss) ss.removeAttribute('data-tone');
        });
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await page.setViewportSize({ width: vp, height: 800 });
        await settle(page);
        // Re-assert a content state that a viewport re-render may have dropped
        // (e.g. MN closes the open case detail on resize). Idempotent.
        if (view.ensureState) await view.ensureState(page);
        // Apply this interaction — query existence + visibility FIRST so a missing
        // or guest-hidden control (e.g. .settings-page-back is absent) fails fast
        // instead of blocking on page.hover's 30s default timeout.
        const present = async (sel) => {
          const el = await page.$(sel).catch(() => null);
          if (el && await el.isVisible().catch(() => false)) return el;
          return null;
        };
        if (act.hover && await present(act.hover)) await page.hover(act.hover, { timeout: 1500 }).catch(() => {});
        if (act.focus && await present(act.focus)) await page.focus(act.focus, { timeout: 1500 }).catch(() => {});
        if (act.active) {
          const el = await present(act.active);
          const box = el && await el.boundingBox().catch(() => null);
          if (box) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down().catch(() => {}); }
        }
        if (act.tone) {
          await page.evaluate((tone) => {
            const ss = document.querySelector('.preference-save-state');
            if (ss) { ss.setAttribute('data-tone', tone); if (!ss.textContent.trim()) ss.textContent = 'state'; }
          }, act.tone);
        }
        await settle(page);
        // Force-settle EVERY transition/animation to its end state. The CSS freeze
        // alone loses to (1,1,0) !important `transition` rules on .course-timeline-item
        // (the same arms race we're unwinding), so the WAAPI .finish() is load-bearing
        // for determinism — it jumps each animation to its cascade-determined target
        // independent of specificity/!important.
        await page.evaluate(() => { document.getAnimations().forEach((a) => { try { a.finish(); } catch (_) {} }); });
        await settle(page);
        await page.waitForTimeout(80);
        // Pin scroll so geometry is deterministic.
        await page.evaluate((root) => {
          window.scrollTo(0, 0);
          const el = document.querySelector(root); if (el) el.scrollTop = 0;
        }, view.root);
        const rows = await page.evaluate(snapFn, { root: view.root, props: PROP_LIST });
        out[`${view.id} | ${theme} | ${vp} | ${act.label}`] = rows;
      }
    }
  }
  // Reset theme/viewport for the next view.
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dawn'));
  await page.setViewportSize({ width: 1280, height: 800 });
  return out;
}

let bridge = null;
function cleanup(sig) { if (bridge && !bridge.killed) { try { bridge.kill('SIGTERM'); } catch (_) {} } process.exit(sig === 'SIGTERM' ? 143 : 130); }
process.once('SIGINT', () => cleanup('SIGINT'));
process.once('SIGTERM', () => cleanup('SIGTERM'));

(async () => {
  const repoRoot = path.resolve(__dirname, '..');
  console.log(`[view-probe] mode=${MODE}  props=${PROP_LIST.length}  states/view=${THEMES.length}×${VIEWPORTS.length}`);
  console.log(`[view-probe] starting bridge on :${PORT}`);
  bridge = spawn('node', ['app/ws-bridge.js'], { cwd: repoRoot, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
  bridge.stdout.on('data', () => {});
  bridge.stderr.on('data', (d) => { const s = String(d); if (!/OpenRouter|OPENAI/.test(s)) process.stderr.write(`  [bridge] ${s}`); });

  let exitCode = 0;
  const snapshot = {};
  try {
    await waitForHealth(BASE);
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'en-US' });
    // MASK_CSS (shared with the other harnesses) + a blanket animation/transition
    // freeze so entrance lifts / theme-cross-fades / hover transitions snap to their
    // settled cascade-determined target (the spec's css-probe prescribes the same
    // `* { animation: none }` freeze for animation states). Without it the timeline
    // items' in-flight translateY makes every geometry read jitter sub-pixel.
    const FREEZE_CSS = `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }`;
    await context.addInitScript(({ css }) => {
      const inject = () => { const s = document.createElement('style'); s.id = '__probe_freeze__'; s.textContent = css; document.head.appendChild(s); };
      if (document.head) inject(); else document.addEventListener('DOMContentLoaded', inject);
    }, { css: MASK_CSS + '\n' + FREEZE_CSS });
    const page = await context.newPage();
    await enterGuestMode(page, BASE);
    const snapFn = makeSnapshotFn();
    for (const view of VIEWS) {
      const part = await captureView(page, view, snapFn);
      Object.assign(snapshot, part);
      const nEls = Object.values(part)[0]?.length ?? 0;
      console.log(`  ✓ ${view.id}: ${Object.keys(part).length} states × ${nEls} elements`);
    }
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close();
  } catch (err) {
    console.error('[view-probe] FATAL', err);
    exitCode = 1;
  } finally {
    const exited = new Promise((res) => bridge.once('exit', res));
    bridge.kill('SIGTERM');
    await Promise.race([exited, new Promise((res) => setTimeout(res, 2500))]);
  }
  if (exitCode) process.exit(exitCode);

  if (MODE === 'baseline') {
    fs.writeFileSync(BASELINE, JSON.stringify(snapshot) + '\n');
    const states = Object.keys(snapshot).length;
    const cells = Object.values(snapshot).reduce((a, r) => a + (Array.isArray(r) ? r.length : 0), 0);
    console.log(`\n[view-probe] baseline → ${BASELINE} (${states} states, ${cells} element-snapshots)`);
    process.exit(0);
  }

  // --check
  if (!fs.existsSync(BASELINE)) { console.error('[view-probe] no baseline — run --baseline first'); process.exit(1); }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

  // Tolerant value equality: identical non-numeric skeleton (so rgba→rgb, none→matrix,
  // an added shadow layer, etc. are ALWAYS caught), and each numeric token equal —
  // px lengths within PX_TOL=0.25px (absorbs the #courseProgressRing aspect-ratio subpixel
  // jitter), everything else (color channels, alpha, opacity, unitless) EXACT.
  const PX_TOL = 0.25;
  function parseVal(str) {
    const nums = []; let skel = ''; let last = 0;
    const re = /-?\d*\.?\d+(?:e[+-]?\d+)?/gi; let m;
    while ((m = re.exec(str)) !== null) {
      skel += str.slice(last, m.index) + '#';
      const after = str.slice(m.index + m[0].length, m.index + m[0].length + 2).toLowerCase();
      nums.push({ v: parseFloat(m[0]), px: after === 'px' });
      last = m.index + m[0].length;
    }
    return { skel: skel + str.slice(last), nums };
  }
  function valEq(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    const pa = parseVal(String(a)), pb = parseVal(String(b));
    if (pa.skel !== pb.skel || pa.nums.length !== pb.nums.length) return false;
    for (let i = 0; i < pa.nums.length; i++) {
      const tol = pa.nums[i].px ? PX_TOL : 0;
      if (Math.abs(pa.nums[i].v - pb.nums[i].v) > tol) return false;
    }
    return true;
  }
  const rectEq = (a, b) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const va = a[i], vb = b[i];
      // SVG elements expose `undefined` for offsetLeft/Top/Width/Height; both
      // sides see the same undefined → null round-trip, so treat null==null
      // as equal explicitly (`Math.abs(null - null)` is 0 but NaN once one
      // side survives as undefined in memory).
      const aNil = va == null, bNil = vb == null;
      if (aNil !== bNil) return false;
      if (aNil && bNil) continue;
      // Reject non-finite values explicitly — `Math.abs('auto' - 0)` is NaN,
      // and `NaN > PX_TOL` is false, which would silently treat a real flip
      // as equal. Guard so any non-numeric survivor flags as unequal.
      if (!Number.isFinite(va) || !Number.isFinite(vb)) return false;
      if (Math.abs(va - vb) > PX_TOL) return false;
    }
    return true;
  };

  const diffs = [];
  for (const state of Object.keys(base)) {
    const b = base[state], c = snapshot[state];
    if (!c) { diffs.push(`${state}: MISSING in current`); continue; }
    if (b.length !== c.length) { diffs.push(`${state}: element count ${b.length} → ${c.length} (DOM changed!)`); continue; }
    for (let i = 0; i < b.length; i++) {
      const eb = b[i], ec = c[i];
      const tag = `${state} | [${i}] ${eb.desc}`;
      if (!rectEq(eb.rect, ec.rect)) diffs.push(`${tag} | rect ${JSON.stringify(eb.rect)} → ${JSON.stringify(ec.rect)}`);
      for (const p of PROP_LIST) if (!valEq(eb.props[p], ec.props[p])) diffs.push(`${tag} | ${p}: "${eb.props[p]}" → "${ec.props[p]}"`);
      if (!valEq(eb.before, ec.before)) diffs.push(`${tag} | ::before "${eb.before}" → "${ec.before}"`);
      if (!valEq(eb.after, ec.after)) diffs.push(`${tag} | ::after "${eb.after}" → "${ec.after}"`);
      if (!valEq(eb.placeholder, ec.placeholder)) diffs.push(`${tag} | ::placeholder "${eb.placeholder}" → "${ec.placeholder}"`);
    }
  }
  const header = [`# view-cascade-probe report`, ``, `states: ${Object.keys(base).length}  props/element: ${PROP_LIST.length}`, ``];
  if (diffs.length === 0) {
    header.push(`**PASS — byte-identical across all states.**`);
    fs.writeFileSync(REPORT, header.join('\n') + '\n');
    console.log(`\n[view-probe] PASS — ${Object.keys(base).length} states byte-identical`);
  } else {
    // Stream the diffs to disk in chunks — spreading 100k+ lines into one push
    // overflows the call stack, and diffs.join() builds a huge intermediate string.
    // Wrap in try/catch so a transient Windows EBUSY (AV holding the file briefly
    // between the truncate-write and the append-open) doesn't leave a truncated
    // report on disk that poisons the next grow-keep parse.
    try {
      fs.writeFileSync(REPORT, header.join('\n') + '\n' + `**FAIL — ${diffs.length} cascade flips:**\n\n`);
      const fd = fs.openSync(REPORT, 'a');
      try {
        const CHUNK = 1000;
        for (let i = 0; i < diffs.length; i += CHUNK) {
          const slice = diffs.slice(i, i + CHUNK);
          let s = '';
          for (const d of slice) s += '- ' + d + '\n';
          fs.writeSync(fd, s);
        }
      } finally { fs.closeSync(fd); }
    } catch (err) {
      // Partial report on disk would mislead the next iteration; clean it up
      // and surface the error so the run aborts visibly rather than silently.
      try { fs.unlinkSync(REPORT); } catch (_) {}
      console.error(`[view-probe] failed to write report: ${err.message}`);
      process.exit(2);
    }
    console.log(`\n[view-probe] FAIL — ${diffs.length} flips (see ${REPORT})`);
    for (const d of diffs.slice(0, 20)) console.log(`  ✗ ${d}`);
  }
  process.exit(diffs.length ? 1 : 0);
})();
