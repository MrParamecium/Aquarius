#!/usr/bin/env node
/**
 * Computed-style probe harness for the Phase 3.6 CSS structural collapse
 * (`!important` wall + doubled-ID `#X#X` pattern). See docs/PHASE3.6_SPEC.md §4.
 *
 * WHY THIS EXISTS (and why visual-diff.js is not enough):
 *   The 36-view pixel-diff harness has two documented blindspots for this work:
 *     1. Off-screen / clipped chrome — `page.screenshot({fullPage:false})` clips
 *        to 1280×800; the §3a.i regression (PR #71) painted OUTSIDE the captured
 *        region and passed at 0/1024000 px through two `--check` runs.
 *     2. Sub-threshold property swaps — a cascade flip (e.g. min-height 152→112,
 *        radial-gradient→flat) can dirty fewer pixels than even the 0.05% strict
 *        threshold when the element is clipped or the delta is alpha-on-glass.
 *   This harness reads literal getComputedStyle values and asserts BYTE-IDENTICAL
 *   before/after a refactor. It generalizes the per-view computed-style asserts
 *   already in visual-diff.js (views 12b-e/14d-f).
 *
 * PROBE THE CASCADE WINNER, NOT THE LAYOUT (review of PR #101):
 *   Probes pin LITERAL cascade values (min-height 152px, border-radius 28px, the
 *   glass-token inside background-image) — NOT layout-derived USED values
 *   (`width: 426px`, `grid-template-columns: 48px 258px 52px`). Used values are
 *   recomputed from viewport / scrollbar gutter / font metrics, so they drift
 *   across machines + Chromium versions (false FAIL) while telling you nothing
 *   about which rule won (a 12-ID `calc(100%-36px)` and an 8-ID `min(820px,…)`
 *   resolve to the SAME px below 820px). Literal cascade values are deterministic
 *   and discriminate the winner.
 *
 * FAIL CLOSED (review of PR #101):
 *   A verification harness must treat ABSENCE OF SIGNAL as failure, never a
 *   silent pass: `--baseline` refuses to write if any probe is `__MISSING__`
 *   (element absent → mis-specified probe); `--check` fails on a `__MISSING__`/
 *   `__ABSENT__` baseline value, a vanished element, a non-array (corrupt)
 *   baseline state, a current-only probe with no baseline entry, or a duplicate
 *   probe key. Each `enter()` asserts a SENTINEL computed value proving the
 *   gated doubled-ID rule actually wins before any probe is trusted (R8).
 *
 * Usage:
 *   node tools/css-probe.js --baseline   # snapshot resolved styles → css-probe-baseline.json
 *   node tools/css-probe.js --check      # capture current + diff vs baseline (byte-identical)
 *
 * Exit 0 only if every probed value matches the baseline byte-for-byte (or on a
 * clean --baseline). Exit 1 on any diff, any fail-closed condition, or harness failure.
 *
 * Report: tools/css-probe-report.md (only written by --check).
 *
 * NOT wired into `npm run check` for execution — it spawns the bridge + Chromium
 * (~30s). Run manually as a pre-merge gate alongside visual-diff (property-identity
 * + spatial-identity are complementary).
 *
 * KNOWN follow-up (deferred D1, docs/phase3_deferred.md §13): the bridge-spawn /
 * signal-teardown / MASK addInitScript / markdown-report blocks are near-duplicates
 * of visual-diff.js. A shared hoist into test-utils.js is its own PR (center of
 * gravity is the stable visual-diff.js; needs a visual-diff regression run).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
    waitForHealth,
    spawnBridge,
    stopBridge,
    injectMaskInitScript,
    enterGuestMode,
    openSubtopic,
    resetLessonChromeState,
    settleLesson,
    assertOrThrow,
    FEEDBACK_FIXTURE_POPULATED_PATH,
} = require('./test-utils.js');

// Separate port from visual-diff.js (:9125) so the two harnesses can run
// back-to-back (or concurrently) without an EADDRINUSE clash on the bridge.
const PORT = Number(process.env.TUTOR_CSSPROBE_PORT || 9126);
const BASE = `http://127.0.0.1:${PORT}`;
const VIEWPORT = { width: 1280, height: 800 };

const TOOLS = __dirname;
const BASELINE_PATH = path.join(TOOLS, 'css-probe-baseline.json');
const REPORT_PATH = path.join(TOOLS, 'css-probe-report.md');

const MODE = process.argv.includes('--baseline') ? 'baseline'
           : process.argv.includes('--check') ? 'check'
           : null;
if (!MODE) {
    console.error('usage: css-probe.js --baseline | --check');
    process.exit(2);
}

const SUBTOPIC = { id: '1_1-1', title: '1.1-1 Signal Energy',
    chapter: 'Chapter 1: Signals and Systems',
    section: '1.1 Size of a Signal' };

// ---------- probe states ----------
// Each state: { state, enter(page), probes: [[selector, pseudo|null, property], ...] }.
// enter() MUST assert a SENTINEL computed value proving the gated doubled-ID rule
// is the live cascade winner (R8, docs/PHASE3.6_SPEC.md §4.1) before snapshot —
// otherwise the probe reads an inactive rule and proves nothing. All states run on
// one Page-A lesson page (§1.1-1) opened once; resetLearnChrome() clears prior state.

// Drop learn-view panel state + the textbook modal to a known floor between states.
async function resetLearnChrome(page) {
    await resetLessonChromeState(page);
    await page.evaluate(() => {
        document.getElementById('textbookFocusModal')?.classList.add('hidden');
        document.body.classList.remove('textbook-focus-active');
        // A0 S4–S11: floor the JS layout-mode var. resetLessonChromeState already
        // clears the chapter-overview-* CLASSES, but not the matching JS state
        // `_learnLayoutMode` — an overview state (S10/S11) leaves it as 'overview',
        // which a later composer driver (applyLearnChatCollapsedState app.js:1200 /
        // updateLearnChatEmptyState app.js:2086) branches on, silently rendering the
        // wrong DOM. Kept LOCAL to css-probe (not pushed into the shared
        // resetLessonChromeState) so it carries zero visual-diff blast radius.
        // typeof-guarded so a future rename fails in a state's winner sentinel (loud),
        // not here (a silent floor).
        try { if (typeof _learnLayoutMode !== 'undefined') _learnLayoutMode = 'lesson'; } catch (_) {}
        // A0 S13: undo textbook mode through the REAL production path, but ONLY when a prior
        // state actually left .learn-textbook-active on #learnBody. _setLearnMode('lecture')
        // re-runs the full lecture-chrome path (applyLearnPanelFocusState + inline writes on
        // #learnExplainCol/#learnChatCol/#learnBookCol, app.js:2481-2524), which the other
        // states' own drivers (openLearnQaSidebar / applyLearnExplainCollapsedState) do NOT
        // expect to follow — so calling it unconditionally perturbs S4/S9. Gating on the class
        // makes it a TRUE no-op for every non-textbook state (the resting §1.1-1 lesson and
        // S2-S12 all rest without .learn-textbook-active). When it DOES fire it cleans up after a
        // textbook state — clears .learn-textbook-active + restores the inline styles
        // _setLearnMode wrote on #learnBookOverlay / #learnExplainContent (app.js:2460/2469).
        // NOTE: in the CURRENT ordering this branch is DORMANT — nothing calls resetLearnChrome
        // after S13 (S13 is the last resetLearnChrome state; the S-feedback-* block uses
        // openFeedbackBoard, which does not reset learn chrome). It is defensive cover that only
        // activates if a future learn-chrome state is inserted after a textbook state.
        // ORDERING CONTRACT: S13 must stay the last learn-chrome state. Its textbook class +
        // inline styles persist across the cross-view nav into #feedbackView (benign today — the
        // feedback probes read only #feedbackView nodes, proven byte-identical by --check), so any
        // learn-chrome state appended AFTER the feedback block would inherit leaked textbook mode
        // unless it resets first. Kept LOCAL to css-probe → zero visual-diff blast radius;
        // typeof-guarded so a rename fails LOUD in S13's winner sentinel, not silently here.
        try {
            const lb = document.getElementById('learnBody');
            if (lb && lb.classList.contains('learn-textbook-active') && typeof _setLearnMode === 'function') {
                _setLearnMode('lecture');
            }
        } catch (_) {}
        // A0 S7: clear any chat bubble a prior is-chat-active state appended, then
        // re-sync is-chat-active / empty-state through the production path so each
        // state starts from the natural empty (not-chat-active) chat. The §1.1-1
        // lesson rests with an empty chat, so this is a no-op for the pre-existing
        // states (proven byte-identical by --check against the committed baseline).
        const chat = document.getElementById('learnChatContent');
        if (chat) chat.replaceChildren();
        if (typeof updateLearnChatEmptyState === 'function') updateLearnChatEmptyState();
    });
}

// Sentinel for the §3d composer chain: the 12-ID L41334 rule sets min-height 152px
// and wins unconditionally over the 8-ID runtime-collapsed.css rule's 112px. If this
// does not hold, the probe state is wrong and the baseline must not be trusted.
async function assertFollowupBarWinner(page, label) {
    const mh = await page.evaluate(() => {
        const el = document.getElementById('learnFollowupBar');
        return el ? getComputedStyle(el).minHeight : null;
    });
    assertOrThrow(mh === '152px',
        `${label}: #learnFollowupBar min-height is "${mh}", expected "152px" (the 12-ID §3d winner). State invalid — probe would not exercise the cascade war.`);
}

const FOLLOWUP_PROBES = [
    ['#learnChatCol', null, 'background-image'],   // §3d war: flat var vs radial (L33191 dead / L37417 wins)
    ['#learnFollowupBar', null, 'min-height'],      // 152 (12-ID) vs 112 (8-ID) — discriminating literal
    ['#learnFollowupBar', null, 'border-top-left-radius'], // 28 vs 18
    ['#learnFollowupBar', null, 'background-image'], // pink glass vs white glass
    ['#learnFollowupBar', null, 'box-shadow'],
    ['#learnFollowupBar', null, 'backdrop-filter'], // blur(36) vs blur(34)
    ['#learnFollowupBar', null, 'z-index'],         // 40 (L33213 8-ID) vs runtime 3
    ['#learnFollowupBar', null, 'overflow'],        // visible (L33213)
];

// ---------- A0 S4–S11 composer / explain-rail / overview probe sets ----------
// Empirically derived (2026-06-28, via a throwaway cross-state matrix; provenance
// preserved in .trellis/tasks/06-28-a0-s4-s11-probe-states/): the §3d composer
// chrome (#learnFollowupBar + #learnChatCol bg/shadow/isolation) is BYTE-IDENTICAL
// across S2/S3/S4/S6/S7/S9/S10/S11 at desktop — it is panel-invariant. So each new
// state pins only what its gated rule actually changes (the cascade winner), never a
// 5th redundant copy of FOLLOWUP_PROBES. S5 (focus-within) and S1/S8 (resting) are
// intentionally absent — see the PROBE_STATES note below S3.

// S4 (normal split, chat visible): the §3d composer chain via the normal /
// no-data-panel-focus selector path S2/S3 (qa-wide/qa-full) never exercise, PLUS the
// normal-mode explain-rail backdrop (5-layer gradient) that pairs with S10/S11's
// 3-layer overview backdrop across the overview boundary.
const S4_PROBES = [
    ...FOLLOWUP_PROBES,
    ['#learnChatCol', null, 'isolation'],
    ['#learnChatCol', null, 'overflow'],
    ['#learnExplainScroll', null, 'background-image'], // 5-layer normal gradient (vs S10/S11 3-layer)
];

// S6/S7 (chat empty vs is-chat-active): the §3d empty-state + is-chat-active cascade
// (A4-gated). Both states pin the same property set; their VALUES differ. S7's winner
// sentinel keys off #learnChatCol padding / #learnChatContent min-height — PURE-CSS
// (L19955/L19966 is-chat-active) winners, NOT the empty-state display which JS also
// forces inline (an inline-masked property cannot witness a CSS-cascade change).
const CHAT_STATE_PROBES = [
    ['#learnChatEmptyState', null, 'display'],          // flex (S6) / none (S7)
    ['#learnChatEmptyState', null, 'opacity'],          // 1 / 0
    ['#learnChatEmptyState', null, 'visibility'],       // visible / hidden
    ['#learnChatEmptyState', null, 'background-image'],
    ['#learnChatEmptyState', null, 'border-top-left-radius'],
    ['#learnChatCol', null, 'padding'],                 // 0px (S6) / 0px 0px 18px (S7) — pure-CSS winner
    ['#learnChatCol', null, 'overflow'],
    ['#learnChatContent', null, 'min-height'],          // auto (S6) / 0px (S7) — pure-CSS winner
    ['#learnChatScroll', null, 'overflow-y'],
];

// S9 (explain-collapsed, not chat-collapsed): the explain-rail collapse cascade —
// the restore tab (#learnExplainRestoreBtn) is shown ONLY here (display:flex), the
// discriminating winner for `.explain-collapsed:not(.chat-collapsed)`.
const EXPLAIN_COLLAPSE_PROBES = [
    ['#learnExplainRestoreBtn', null, 'display'],       // flex (unique to S9)
    ['#learnExplainRestoreBtn', null, 'opacity'],
    ['#learnExplainRestoreBtn', null, 'background-image'],
    ['#learnExplainRestoreBtn', null, 'border-top-left-radius'],
    ['#learnExplainRestoreBtn', null, 'box-shadow'],
    ['#learnExplainCol', null, 'display'],
    ['#learnBody', null, '--learn-edge-tab-top'],       // edge-tab custom prop
];

// S10/S11 (chapter-overview-active / -split-active): the overview explain-rail
// backdrop (3-layer gradient, distinct from S4's 5-layer normal) + chat-col state
// (hidden in S10, visible in S11). Only literal cascade values — NOT #learnExplainCol
// width (a viewport-derived USED value that drifts across machines).
const OVERVIEW_PROBES = [
    ['#learnExplainScroll', null, 'background-image'],  // 3-layer overview gradient
    ['#learnChatCol', null, 'display'],                 // none (S10) / flex (S11)
    ['#learnChatCol', null, 'padding'],                 // 0px 0px 18px (overview is-chat-active)
];

// ---------- A0 S13 .learn-textbook-active (Band 1, normal textbook) probe set ----------
// Empirically derived (2026-06-28, tools/_explore-textbook.js cross-state matrix
// base/S13/S10/S14; provenance + matrix in .trellis/tasks/06-28-a0-textbook-active-probe/
// results.md). Pins the Band-1 doubled-ID winners (style.css L25118-25157, gated by
// #learnBody.learn-textbook-active) that _setLearnMode('textbook') makes the live cascade.
//   • #learnExplainScroll background-image = the Band-1 2-radial signature (L25124:
//     `18% 6% ...0.82` + `82% 16% ...0.44`) — DISTINCT from the base 2-radial (L24030:
//     `20% 8% ...0.86` + `82% 18% ...0.22`); the primary winner sentinel. NOT JS-inlined.
//   • #learnBookOverlay position relative (L25131) / min-height 100% (L25135) / padding 0
//     (L25137) — CSS-only winners, DISTINCT from base absolute / 0 / 12px 14px.
//   • #lecturePrev/NextOverlayBtn display none (L25151) — Band-1-exclusive, CSS-only.
// DELIBERATELY EXCLUDED (inline-masked — non-discriminating, design §2 AVOID list):
//   #learnExplainContent display (JS sets it inline, app.js:2469) and #learnBookOverlay
//   display (app.js:2460). padding-top is base-equal (L24029/L24886 force 0 at rest) — a
//   fail-OPEN companion, so #learnExplainScroll padding is kept only as the rule's decl, not
//   asserted as the sentinel. .textbook-pages-flow is __MISSING__ in a §1.1-1 lesson DOM
//   (no book-page nodes rendered) → not probed (a __MISSING__ baseline is refused fail-closed).
const S13_PROBES = [
    ['#learnExplainScroll', null, 'background-image'], // Band-1 2-radial signature (winner sentinel)
    ['#learnExplainScroll', null, 'padding'],          // 0px (L25120) — base-equal companion, not load-bearing
    ['#learnExplainScroll', null, 'overflow-y'],       // auto (L25122)
    ['#learnBookOverlay', null, 'position'],           // relative (L25131) vs base absolute
    ['#learnBookOverlay', null, 'min-height'],         // 100% (L25135)
    ['#learnBookOverlay', null, 'padding'],            // 0px (L25137) vs base 12px 14px
    ['#learnBookOverlay', null, 'background-color'],   // transparent (L25139)
    ['#lecturePrevOverlayBtn', null, 'display'],       // none (L25151) — Band-1-exclusive
    ['#lectureNextOverlayBtn', null, 'display'],       // none (L25151)
];

// ---------- A0 S14 .chapter-overview-active.learn-textbook-active (Band 2) — DROPPED ----------
// S14 (the combined-selector (6,2,0) Band, style.css L24575-24609) is DROPPED under the §3
// ship/drop gate (the S5 discipline): NO fail-closed Band-2 winner sentinel is constructible
// in a §1.1-1 lesson DOM. The empirical matrix (tools/_explore-textbook.js, recorded in
// results.md) showed EVERY Band-2-exclusive winner is one of:
//   (a) used-value-collapsed to the post-deletion fallback — #learnExplainScroll height:100%
//       (L24577) and #learnBookOverlay height:auto (L24592) both resolve to the SAME 738px as
//       the overview-alone fallback (calc(100dvh-60px) → 738px); min-height:0 (L24578) equals
//       the base 0px. A used-value tie cannot witness the Band-2 rule's deletion (fail-OPEN);
//   (b) inline-masked — #learnExplainContent display:none (L24603) is also written inline by
//       _setLearnMode (app.js:2469), so CSS and JS resolve the same value (design §2 AVOID);
//   (c) already provided by overview-alone — #learnChatCol/#learnResizer display:none
//       (L24606-08) is ALSO set by the overview-alone rule (S10 already shows none) and inline
//       by setChapterOverviewLayoutActive itself (Risk #5), so removing Band-2 changes nothing;
//   (d) __MISSING__ — .textbook-pages-flow min-height/padding (L24598-99) has no rendered node
//       in this lesson DOM (no book-page flow), so it cannot be probed at all.
// The remaining Band-2 decls (#learnBookOverlay position:relative / min-height:100% / padding:0
// at L24587/91/79... — actually padding lives only in Band-1) are NOT Band-2-exclusive: Band-1
// (gated by .learn-textbook-active alone, still present in the S14 DOM) provides the same value,
// so they survive a Band-2 deletion (fail-OPEN against the true Band-2-removed fallback).
// CONSEQUENCE (named coverage gap, see prd "Residual risk"): the 7 Band-2 doubled-ID occurrences
// carry NO css-probe witness. A2's later Band-2 strip must lean on visual-diff + the arbiter
// keep-set, not a computed-style baseline. "documented-dropped" is an honest gap, not "covered".
//
// ── 2026-06-29 re-verification + closure decision (FlyM1ss) ──
// Re-attacked the drop with a property the 2026-06-28 matrix never evaluated:
// #learnExplainScroll `overscroll-behavior` (Band-2 sets `contain`, L24582; the three S14-DOM
// competitors — overview-alone L15024, base L18832, Band-1 L25118 — all set NONE). It LOOKS
// fail-closed but is NOT: #learnExplainScroll carries class `learn-explain-scroll` (index.html:686),
// and `.learn-explain-scroll` (L12102-12104, !important) already sets overscroll-behavior:contain /
// overflow-x:hidden / -webkit-overflow-scrolling:touch — so deleting Band-2 leaves the CLASS rule
// supplying the same values (fail-OPEN). A new death-mode (same-element class backstop), distinct
// from (a)-(d); the no-witness conclusion is now TWICE-verified.
// NARROWED RISK SURFACE: only TWO Band-2 decls are both unique AND geometric — #learnExplainScroll
// height:100% (scroll-cap vs content-grown auto) and .textbook-pages-flow min-height:100% + larger
// padding-bottom (L24598-99). The other 5 are Band-1-redundant (Band-1 is itself S13-guarded) or
// inline-masked → transitively backstopped through a de-double. Those two are observable by NO tool
// (css-probe, arbiter, OR visual-diff) without a fixture rendering a TALL chapter-level textbook page
// flow — the arbiter is used-value + offset-rect keyed (see its header), sharing the collapse
// blindness and catching the height delta only once content overflows.
// → A4 PRECONDITION (docs/REFACTOR_DONE.md §A0/§A4): before stripping the 7 Band-2 doubled-IDs,
//   build that tall-content combined-state witness (visual-diff view + fresh arbiter keep-set)
//   covering those two decls. Do NOT ship Band-2 on the current harness. Deferred here with NO
//   speculative pre-build, per the closure decision.

// ---------- viewport-banded learn-chrome states (docs/phase3_deferred.md §14 prerequisite 1) ----------
// The `!important` / doubled-ID wall's single largest remaining lever is the redeclaration pileup
// inside width @media queries; the desktop-only (1280) probe + visual-diff harnesses are blind to
// it — exactly the narrow-viewport blindspot spec §4 warns about. These states render §1.1-1's
// always-present learn-chrome (#learnExplainToolbar + the inherited --learn-edge-tab-top custom
// property) across five viewport widths and pin only LITERAL cascade values — never layout-derived
// used values (toolbar-center's clamp() gap interpolates 17.92→16.24→12.46px with the viewport and
// would false-FAIL across machines; deliberately NOT probed, per the header doc).
//
// Each band transition is BRACKETED — a state just above and just below it both capture the shared
// probe set — so a deletion is caught from the narrow side AND a media-query hoist that changes the
// desktop value is caught from the wide side (N0). The single discriminator per transition
// (empirically verified 2026-06-25; every probed value is byte-stable across two independent runs):
//   N0 @1280 → N1 @1160 (≤1180): toolbar grid-template-areas none → "left right"/"center center";
//                                toolbar-center flex-wrap nowrap → wrap.
//   N1 @1160 → N2 @890  (≤900):  toolbar flex-wrap nowrap → wrap.
//   N2 @890  → N3 @740  (≤820):  --learn-edge-tab-top 22px → 14px.
//   N3 @740  → N4 @700  (≤720):  toolbar grid-template-areas → fully-stacked "center"/"left"/"right".
// flex-wrap on #learnExplainToolbar is INERT (the toolbar resolves to display:grid) — it is probed
// as a cascade WITNESS that the ≤900 rule wins, not for a layout effect. Cells that repeat across
// adjacent states (e.g. toolbar-center flex-wrap is "wrap" at every ≤1180 width) are intentional:
// they pin the persists-down winner, so deleting its single source rule flips every state below it.
//
// NOT covered (elements absent from a §1.1-1 lesson DOM — recorded as a follow-up gap in §14):
//   chapter-overview book-spread (≤1120/≤760), lecture-overlay nav buttons (≤1320/≤900),
//   collapsed-panel edge tabs (≤900), and runtime-collapsed.css @container lecture-panel bands
//   (keyed off the explain-panel's own width, not the viewport).

// Assert a band's literal value is the live cascade winner BEFORE trusting any probe (R8 /
// FAIL-CLOSED) — proves the rule actually applies at this viewport, not merely that
// setViewportSize was called. Reads RAW (no trim) so the sentinel and the probe (snapshotState,
// also raw) agree byte-for-byte on what "the value" is, rather than the sentinel masking a
// whitespace divergence the probe would surface.
async function assertNarrowBand(page, label, sel, prop, expected) {
    const got = await page.evaluate(({ sel, prop }) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).getPropertyValue(prop) : '__MISSING__';
    }, { sel, prop });
    assertOrThrow(got === expected,
        `${label}: ${sel} { ${prop} } resolved "${got}", expected "${expected}" — the band rule is not the live cascade winner at this viewport; baseline invalid.`);
}

// One shared probe list captured at every banded width, so each transition is pinned from both
// sides. flex-wrap on the toolbar is inert-on-grid (above) — a cascade witness, not layout.
const NARROW_PROBES = [
    ['.learn-explain-toolbar', null, 'grid-template-areas'], // none (≥1181) / 2-row (≤1180) / 3-row stack (≤720)
    ['.learn-explain-toolbar', null, 'flex-wrap'],           // nowrap (≥901) → wrap (≤900); witness of the ≤900 rule
    ['.learn-toolbar-center', null, 'flex-wrap'],            // nowrap (≥1181) → wrap (≤1180)
    ['.learn-body', null, '--learn-edge-tab-top'],           // 22px (≥821) → 14px (≤820)
];

// Factory for a banded state: apply the per-state viewport (snapshotState reads .viewport), floor
// the chrome to the natural (non-collapsed) lesson — explicitly clear explain-collapsed so the
// higher-specificity `.explain-collapsed:not(.chat-collapsed)` edge-tab rule (0,3,0) cannot leak
// in from a prior state and mask the ≤820 band (0,1,0) — then sentinel-assert the band winner.
function bandState(id, width, sentinel) {
    return {
        state: id,
        viewport: { width, height: 800 },
        enter: async (page) => {
            await resetLearnChrome(page); // dispatches resize at the already-applied viewport
            await page.evaluate(() => document.getElementById('learnBody')?.classList.remove('explain-collapsed'));
            await assertNarrowBand(page, id, sentinel.sel, sentinel.prop, sentinel.expected);
        },
        probes: NARROW_PROBES,
    };
}

// ---------- #feedbackView floor guard (D1, REFACTOR_DONE §A0) ----------
// The committed durable guard for the feedback `!important` floor (#118 left 0
// feedback states here, so the 472-decl floor was previously unguarded against
// future edits). These states render the seeded multi-tone board (route-intercepted
// — no disk write, so the gitignored live board `app/users/feedback-board.json` is
// never touched and there is no restore step) and pin the LITERAL cascade-winning
// value of every floor-carrying property, on representative tone / is-left|right /
// reply-context nodes. They are the FIRST cross-view-navigating states, so they are
// appended LAST in PROBE_STATES (after N4): any learn/band state running after a
// feedback nav would find #learnView hidden → __MISSING__.
const FEEDBACK_FIXTURE = require(FEEDBACK_FIXTURE_POPULATED_PATH);
// Stringified once at load — the route handler reuses this body for every intercepted
// request instead of re-serialising the fixture per navigation.
const FEEDBACK_FIXTURE_BODY = JSON.stringify(FEEDBACK_FIXTURE);

// The 55 floor-carrying property names (extracted by _extract-view-important.js with
// its VIEWS const = ['#feedbackView']; the committed tools/_view-important.json is its
// output). Rest probes are DERIVED from this so the guard covers every floor property
// and stays tied to the actual floor declarations (the mutation check exercises this).
const FEEDBACK_FLOOR = require('./_view-important.json')['#feedbackView'];
// Fail loud, not cryptic: this durable guard derives its entire rest-probe set from the
// frozen `#feedbackView` floor list. If _view-important.json is ever regenerated for
// another surface (the strip pipeline rotates VIEWS), this key goes undefined and the
// guard would otherwise die with "undefined is not iterable" at buildFeedbackRestProbes.
if (!Array.isArray(FEEDBACK_FLOOR)) {
    throw new Error(
        'css-probe: tools/_view-important.json no longer carries the "#feedbackView" key. '
        + 'The durable feedback guard needs that frozen floor list; do not regenerate '
        + '_view-important.json for another surface without giving this guard its own snapshot.');
}

// Selectors whose cascade state the populated REST board does not render (they belong
// to dedicated focus/hover/disabled states below, or to nodes absent when the board is
// populated): non-rest pseudo-classes, the runtime `.is-target` class, the data-kind
// status variants, the empty-board node, and the dusk/dark theme override. Excluded
// from the rest probe set so the baseline does not fail closed on a __MISSING__ element.
// COVERAGE NOTE (dusk/dark `data-theme` box-shadow, e.g. L27385/L27386): this guard runs
// dawn only, so the THEMED box-shadow variants are not directly pinned here; the box-shadow
// PROPERTY is still covered by the 17 dawn rest probes (e.g. .feedback-thread / .feedback-reply),
// and the themed lines are backed by the D2 arbiter's documented 3-theme matrix {dawn,dusk,dark}.
// A dawn-only guard is the proportionate durable guard (design.md §2.4); the arbiter is the
// exhaustive strip gate — so a dusk-only probe state is intentionally NOT added.
const FEEDBACK_NONREST_RE = /:hover|:active|:disabled|:focus|is-target|data-kind|feedback-empty|data-theme/;

// Build the rest probe list programmatically: take each floor declaration's first
// comma-part as a representative node, lift any trailing pseudo-element, and skip the
// cross-view L24702 part (its first part names #learnView — absent on the feedback
// page) in favour of the feedback close button that SHARES the rule. Deduped by
// (selector, pseudo, property). Covers the 52 rest-reachable floor properties; the
// remaining 3 (outline / cursor / filter) are covered by the focus + disabled states.
function buildFeedbackRestProbes() {
    const seen = new Set();
    const probes = [];
    for (const decl of FEEDBACK_FLOOR) {
        if (FEEDBACK_NONREST_RE.test(decl.selector)) continue;
        let first = decl.selector.split(',')[0].trim();
        // L24702 cross-view grouped rule — its first comma-part is the (absent)
        // #learnView close button. Probe the feedback close button instead, which is
        // in the SAME grouped rule, so the shared `border` floor value is still pinned.
        if (first.startsWith('#learnView')) first = '#feedbackView #feedbackCloseBtn.feature-close-btn';
        let pseudo = null;
        const pm = first.match(/::(before|after|placeholder)$/);
        if (pm) { pseudo = pm[0]; first = first.slice(0, pm.index); }
        const key = `${first}||${pseudo || ''}||${decl.prop}`;
        if (seen.has(key)) continue;
        seen.add(key);
        probes.push([first, pseudo, decl.prop]);
    }
    return probes;
}
const FEEDBACK_REST_PROBES = buildFeedbackRestProbes();

// Open the feedback view on the seeded multi-tone board. Route-interception (mechanism
// A, design.md §2.2): stub GET /api/feedback with the populated fixture BEFORE nav, so
// the production loadFeedbackBoard → renderFeedbackBoard path runs against it and no
// on-disk file is touched. (showFeedbackView re-runs loadFeedbackBoard on every nav, so
// any localStorage / pre-render injection would be clobbered — route-interception is the
// only mechanism that survives the navigation fetch without a disk write.)
async function openFeedbackBoard(page) {
    // Register the GET /api/feedback stub once per page (each feedback state calls this;
    // stacking identical handlers is harmless but the guard keeps it to a single route).
    if (!page.__feedbackRouteRegistered) {
        await page.route('**/api/feedback', (route) => route.fulfill({
            contentType: 'application/json',
            body: FEEDBACK_FIXTURE_BODY,
        }));
        page.__feedbackRouteRegistered = true;
    }
    // showFeedbackView() re-runs loadFeedbackBoard() on navigation, re-rendering the
    // board from scratch. But #feedbackSubmitBtn lives in the STATIC shell (not the
    // rendered list), so a prior state's `disabled=true` would persist — and hover is
    // pointer-driven. Floor the interaction state explicitly so each feedback state
    // starts clean regardless of order: un-disable the submit button, blur, move the
    // mouse off any control. (Idempotent; harmless on the first entry.)
    await page.mouse.move(0, 0).catch(() => {});
    await page.evaluate(() => {
        document.activeElement?.blur?.();
        const btn = document.getElementById('feedbackSubmitBtn');
        if (btn) btn.disabled = false;
    });
    await page.click('#navFeedbackBtn');
    await page.waitForSelector('#feedbackView:not(.hidden)', { timeout: 8000 });
    await page.waitForFunction(
        () => document.querySelectorAll('#feedbackView .feedback-thread').length > 0,
        { timeout: 8000 });
    await page.waitForTimeout(200);
}

// Jump every running CSS transition/animation on the page to its end state, then settle
// a frame, so a hover-state probe reads the SETTLED cascade-determined transform — not a
// mid-tween frame (the refresh/submit hover transforms animate via `transition` floor
// decls). Chromium exposes CSS transitions through getAnimations(), so .finish() lands
// them on the cascade-determined target regardless of specificity / !important; the
// duration wait is a belt-and-braces fallback for any transition .finish() cannot reach.
async function settleFeedbackHover(page) {
    await page.waitForTimeout(260); // > the 170-180ms hover transition durations
    await page.evaluate(() => {
        document.getAnimations().forEach((a) => { try { a.finish(); } catch (_) {} });
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

// Single-property winner sentinel (R8) for the focus/disabled/hover interaction states:
// read `prop` on `sel` and fail closed unless it equals the discriminating floor value
// `expected`, so the baseline cannot bake an inactive floor that --check forever-passes.
// `ref` names the floor source line + pseudo-class for the failure message. One uniform
// getPropertyValue read replaces the per-state ad-hoc .outlineStyle/.cursor/.transform
// accessors. (Probes are unchanged — this only gates whether the state is trusted.)
async function assertFeedbackSentinel(page, label, sel, prop, expected, ref) {
    const got = await page.evaluate(([s, p]) => {
        const el = document.querySelector(s);
        return el ? getComputedStyle(el).getPropertyValue(p) : '__MISSING__';
    }, [sel, prop]);
    assertOrThrow(got === expected,
        `${label}: ${sel} { ${prop} } is "${got}", expected "${expected}" (${ref}). The floor !important rule is not winning — baseline invalid.`);
}

// Winner sentinel (R8 — non-negotiable, mirrors assertFollowupBarWinner / S12): assert
// that REAL floor `!important` declarations are the live cascade winners BEFORE any probe
// is trusted, so the baseline cannot bake an inactive/wrong floor and --check forever-pass
// a broken guard (fail-open). Discriminating literals (verified against the live board):
//   • is-left ::before  left  = -5px   (L25067) — base .feedback-reply::before is -9px (L20917)
//   • is-right ::before right = -5px   (L25071)
//   • tone[class*] thread ::after width = 4px (L25001) AND its background carries the
//     tone-0 token `56, 189, 248` (L25003) — proves the tone rule won, not a base rule
//   • tone reply-context border-color = rgba(45, 212, 191, 0.22) (L24984) — tone-2 token,
//     proves the tone+reply-context floor rule won
//   • close button border-top-width = 0px (L24702 shared cross-view rule)
async function assertFeedbackFloorWinner(page, label) {
    const v = await page.evaluate(() => {
        const cs = (sel, pseudo, prop) => {
            const el = document.querySelector(sel);
            return el ? getComputedStyle(el, pseudo || undefined).getPropertyValue(prop) : '__MISSING__';
        };
        return {
            isLeftBeforeLeft: cs('#feedbackView .feedback-reply.is-left', '::before', 'left'),
            isRightBeforeRight: cs('#feedbackView .feedback-reply.is-right', '::before', 'right'),
            toneRailWidth: cs('#feedbackView .feedback-thread[class*="tone-"]', '::after', 'width'),
            toneRailBg: cs('#feedbackView .feedback-thread[class*="tone-"]', '::after', 'background-image'),
            toneCtxBorder: cs('#feedbackView .feedback-reply[class*="tone-"] .feedback-reply-context', null, 'border-color'),
            closeBorder: cs('#feedbackView #feedbackCloseBtn.feature-close-btn', null, 'border-top-width'),
        };
    });
    assertOrThrow(v.isLeftBeforeLeft === '-5px',
        `${label}: .feedback-reply.is-left::before { left } is "${v.isLeftBeforeLeft}", expected "-5px" (L25067 is-left lane floor). The is-left !important rule is not winning — baseline invalid.`);
    assertOrThrow(v.isRightBeforeRight === '-5px',
        `${label}: .feedback-reply.is-right::before { right } is "${v.isRightBeforeRight}", expected "-5px" (L25071 is-right lane floor). The is-right !important rule is not winning — baseline invalid.`);
    assertOrThrow(v.toneRailWidth === '4px',
        `${label}: tone thread ::after { width } is "${v.toneRailWidth}", expected "4px" (L25001 tone accent rail floor). The tone !important rule is not winning — baseline invalid.`);
    assertOrThrow(v.toneRailBg.includes('56, 189, 248'),
        `${label}: tone thread ::after background lacks the tone-0 token "56, 189, 248" (got "${v.toneRailBg}"). The tone !important rule is not winning — baseline invalid.`);
    assertOrThrow(v.toneCtxBorder === 'rgba(45, 212, 191, 0.22)',
        `${label}: tone reply-context { border-color } is "${v.toneCtxBorder}", expected "rgba(45, 212, 191, 0.22)" (L24984 tone-2 reply-context floor). The tone+reply-context !important rule is not winning — baseline invalid.`);
    assertOrThrow(v.closeBorder === '0px',
        `${label}: feedback close button { border } is "${v.closeBorder}", expected "0px" (L24702 cross-view close-button floor). The shared !important rule is not winning — baseline invalid.`);
}

const PROBE_STATES = [
    {
        // S2 — data-panel-focus="qa-wide" (mirrors visual-diff view 08). Baselines
        // the §3d composer-chain war (Surface 6, deferred): #learnChatCol bg +
        // #learnFollowupBar 12-ID vs runtime-collapsed.css 8-ID geometry. NOT edited
        // tonight — captured now so future Surface-6 work diffs against pre-collapse truth.
        state: 'S2-qa-wide',
        enter: async (page) => {
            await resetLearnChrome(page);
            // C2 (REFACTOR_DONE §C2): drive the REAL production path (see S3 below) so
            // the probe DOM equals the app's rendered qa-wide composer — panel-qa-wide
            // class added AND chat-/explain-collapsed cleared in lockstep, not a bare
            // dataset.panelFocus poke that the app's applyLearnPanelFocusState never
            // produces on its own.
            const driven = await page.evaluate(() => {
                if (typeof applyLearnPanelFocusState !== 'function') return false;
                learnPanelFocus = 'qa-wide';
                applyLearnPanelFocusState();
                window.dispatchEvent(new Event('resize'));
                return true;
            });
            assertOrThrow(driven, 'S2-qa-wide: applyLearnPanelFocusState() not reachable from the page — app.js not loaded or symbol renamed');
            await page.waitForTimeout(400);
            const ok = await page.evaluate(() => {
                const b = document.getElementById('learnBody');
                return !!b
                    && b.dataset.panelFocus === 'qa-wide'
                    && b.classList.contains('panel-qa-wide')
                    && !b.classList.contains('chat-collapsed')
                    && !!document.getElementById('learnFollowupBar');
            });
            assertOrThrow(ok, 'S2-qa-wide: qa-wide composer DOM not rendered (need panel-qa-wide class + chat-collapsed cleared + #learnFollowupBar present)');
            await assertFollowupBarWinner(page, 'S2-qa-wide');
        },
        probes: FOLLOWUP_PROBES,
    },
    {
        // S3 — data-panel-focus="qa-full" (mirrors visual-diff view 09). Same §3d
        // war coverage as S2 in the largest-chat state.
        state: 'S3-qa-full',
        enter: async (page) => {
            await resetLearnChrome(page);
            // C2 (REFACTOR_DONE §C2): drive the REAL production path (app.js:1116
            // applyLearnPanelFocusState, reading the module-global learnPanelFocus)
            // instead of a bare dataset.panelFocus poke, so the probe DOM equals the
            // app's rendered qa-full composer — panel-qa-full class added AND
            // chat-/explain-collapsed cleared in lockstep. The hand-poke omitted all
            // of that (latent today, but a forward trap for A4's composer diff).
            const driven = await page.evaluate(() => {
                if (typeof applyLearnPanelFocusState !== 'function') return false;
                learnPanelFocus = 'qa-full';
                applyLearnPanelFocusState();
                window.dispatchEvent(new Event('resize'));
                return true;
            });
            assertOrThrow(driven, 'S3-qa-full: applyLearnPanelFocusState() not reachable from the page — app.js not loaded or symbol renamed');
            await page.waitForTimeout(400);
            const ok = await page.evaluate(() => {
                const b = document.getElementById('learnBody');
                return !!b
                    && b.dataset.panelFocus === 'qa-full'
                    && b.classList.contains('panel-qa-full')
                    && !b.classList.contains('chat-collapsed')
                    && !!document.getElementById('learnFollowupBar');
            });
            assertOrThrow(ok, 'S3-qa-full: qa-full composer DOM not rendered (need panel-qa-full class + chat-collapsed cleared + #learnFollowupBar present)');
            await assertFollowupBarWinner(page, 'S3-qa-full');
        },
        probes: FOLLOWUP_PROBES,
    },
    {
        // S-page-corner — lecture page-turn overlay buttons (#lecturePrevOverlayBtn /
        // #lectureNextOverlayBtn, static .lecture-page-corner.page-turner per index.html
        // L694/697) in the resting lesson. Gate for the Phase 3.6 §6.2 page-corner
        // de-double (27 over-specified #learnView#learnView rules). The .turner-content
        // span rests at opacity:0 — INVISIBLE to pixel-diff — so computed-style probing is
        // the only reliable way to verify those rules survive the de-double unchanged.
        state: 'S-page-corner',
        enter: async (page) => {
            await resetLearnChrome(page);
            // Buttons + .turner-content are static; the page-corner rules match
            // unconditionally (only the .lecture-page-corner.page-turner classes gate them).
            const ok = await page.evaluate(() => {
                const prev = document.getElementById('lecturePrevOverlayBtn');
                const next = document.getElementById('lectureNextOverlayBtn');
                return !!prev && prev.matches('.lecture-page-corner.page-turner')
                    && !!next && next.matches('.lecture-page-corner.page-turner')
                    && !!prev.querySelector('.turner-content')
                    && !!next.querySelector('.turner-content');
            });
            assertOrThrow(ok, 'S-page-corner: overlay buttons missing or lack .lecture-page-corner.page-turner / .turner-content child');
        },
        // NOTE on which probes are load-bearing: the visual treatment lives on
        // the PSEUDO-elements + the inner span — ::before carries the gradient,
        // ::after the noise data-URI (opacity:1), .turner-content the rest
        // transform. On the BASE button, background-image/border-top-left-radius/
        // box-shadow rest at their defaults (none/0px/none) in this state, so
        // those three probes are change-detectors for an accidental ADDITION by
        // the de-double, not witnesses of a preserved value. Both roles are
        // wanted; the §6.2 de-double is proven equivalent only by the ::before/
        // ::after/.turner-content probes, which pin real non-default values.
        probes: [
            ['#lecturePrevOverlayBtn', null, 'background-image'],
            ['#lecturePrevOverlayBtn', null, 'border-top-left-radius'],
            ['#lecturePrevOverlayBtn', null, 'box-shadow'],
            ['#lecturePrevOverlayBtn', '::after', 'background-image'],
            ['#lecturePrevOverlayBtn', '::after', 'opacity'],
            ['#lecturePrevOverlayBtn', '::before', 'background-image'],
            ['#lecturePrevOverlayBtn .turner-content', null, 'opacity'],
            ['#lecturePrevOverlayBtn .turner-content', null, 'transform'],
            ['#lectureNextOverlayBtn', null, 'background-image'],
            ['#lectureNextOverlayBtn', null, 'border-top-left-radius'],
            ['#lectureNextOverlayBtn', null, 'box-shadow'],
            ['#lectureNextOverlayBtn', '::after', 'background-image'],
            ['#lectureNextOverlayBtn', '::after', 'opacity'],
            ['#lectureNextOverlayBtn .turner-content', null, 'opacity'],
            ['#lectureNextOverlayBtn .turner-content', null, 'transform'],
        ],
    },
    {
        // S12 — textbook-focus modal, Q&A panel un-hidden, empty-state node rendered.
        // THE PILOT GATE: pins the resolved values of every selector the textbook
        // de-double rewrites (docs/PHASE3.6_SPEC.md §3 Pilot 0). The page-indicator
        // background-image is load-bearing — it must stay the GLASS radial-gradient
        // (carries the `253, 224, 71` token), not the paper-tag `#fff8dd` gradient
        // from the L23441 single-ID !important rule; a Step-2 over-flatten to a bare
        // ID would surface the paper-tag value here. The sentinel asserts the glass
        // rule wins BEFORE any probe is trusted.
        state: 'S12-textbook-qa-open',
        enter: async (page) => {
            await resetLearnChrome(page);
            await page.evaluate(() => {
                const modal = document.getElementById('textbookFocusModal');
                const content = document.getElementById('textbookFocusContent');
                const indicator = document.getElementById('textbookFocusPageIndicator');
                const panel = document.getElementById('textbookFocusQaPanel');
                const scroll = document.getElementById('textbookFocusQaScroll');
                if (!modal) return;
                document.body.classList.add('textbook-focus-active');
                modal.classList.remove('hidden');
                // Un-hide the Q&A panel so its de-doubled internals are live.
                panel?.classList.remove('hidden');
                // Render the empty-state node so `.textbook-focus-qa-empty` (L41810,
                // a de-double target) is actually in the DOM. It is otherwise only
                // emitted by app.js:3052 on the live Q&A render path. Matches that markup.
                if (scroll) scroll.innerHTML = '<div class="textbook-focus-qa-empty">No questions yet.</div>';
                const placeholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFBAJ/wlseKgAAAABJRU5ErkJggg==';
                if (content) {
                    content.innerHTML = `
                        <div class="textbook-focus-scroll">
                            <div class="textbook-focus-scroll-page">
                                <img class="textbook-focus-single-page" src="${placeholder}" alt="mock page">
                            </div>
                        </div>`;
                }
                if (indicator) indicator.textContent = '1 / 1';
            });
            await page.waitForTimeout(200);
            // Sentinel 1: modal + panel + empty node present.
            const present = await page.evaluate(() => {
                const modal = document.getElementById('textbookFocusModal');
                const panel = document.getElementById('textbookFocusQaPanel');
                return !!modal && !modal.classList.contains('hidden')
                    && !!panel && !panel.classList.contains('hidden')
                    && !!document.querySelector('.textbook-focus-qa-empty');
            });
            assertOrThrow(present, 'S12: modal hidden, QA panel missing/hidden, or .textbook-focus-qa-empty not rendered');
            // Sentinel 2: the GLASS LOCK rules win (not the paper-tag / base rules).
            const win = await page.evaluate(() => {
                const ind = document.getElementById('textbookFocusPageIndicator');
                const panel = document.getElementById('textbookFocusQaPanel');
                return {
                    indBg: ind ? getComputedStyle(ind).backgroundImage : '',
                    panelRadius: panel ? getComputedStyle(panel).borderTopLeftRadius : '',
                };
            });
            assertOrThrow(win.indBg.includes('253, 224, 71'),
                `S12: page-indicator background-image lacks the glass token "253, 224, 71" (got "${win.indBg}"). The doubled-ID GLASS LOCK rule is not winning — paper-tag rule may have taken over; baseline invalid.`);
            assertOrThrow(win.panelRadius === '24px',
                `S12: QA panel border-top-left-radius is "${win.panelRadius}", expected "24px" (the GLASS LOCK rule). Base class rule (16px) may be winning; baseline invalid.`);
        },
        probes: [
            ['#textbookFocusModal', null, 'background-image'],
            ['#textbookFocusDialog .learn-focus-headings', null, 'background-image'],
            ['#textbookFocusDialog .learn-focus-headings', null, 'backdrop-filter'],
            ['#textbookFocusQaPanel', null, 'border-top-left-radius'],   // 24 vs base 16 — discriminating
            ['#textbookFocusQaPanel', null, 'background-image'],
            ['#textbookFocusQaPanel', null, 'box-shadow'],
            ['#textbookFocusQaPanel', null, 'backdrop-filter'],
            ['#textbookFocusQaPanel', '::before', 'content'],            // "" -> '""' (discriminating)
            ['#textbookFocusQaPanel', '::before', 'opacity'],            // 0.72
            ['.textbook-focus-qa-head', null, 'background-image'],
            ['.textbook-focus-qa-head', null, 'border-bottom-color'],
            ['.textbook-focus-qa-close', null, 'background-image'],
            ['.textbook-focus-qa-empty', null, 'border-top-left-radius'], // 22 — now rendered
            ['.textbook-focus-qa-empty', null, 'background-image'],
            ['.textbook-focus-qa-compose', null, 'gap'],                  // 12px literal (NOT grid-template-columns used value)
            ['.textbook-focus-qa-compose', null, 'border-top-color'],
            ['.textbook-focus-qa-input', null, 'min-height'],            // 48px literal
            ['.textbook-focus-qa-input', null, 'border-top-left-radius'], // 18px
            ['.textbook-focus-qa-send', null, 'width'],                  // 48px FIXED literal (not auto/derived)
            ['.textbook-focus-qa-send', null, 'border-top-left-radius'], // 18px
            ['#textbookFocusQaToggle', null, 'width'],                   // 74px FIXED literal
            ['#textbookFocusQaToggle', null, 'background-image'],
            // The load-bearing page-indicator probes (Step-2 specificity guard).
            // Pseudo content/display dropped — they resolve `none` whether the
            // doubled-ID or single-ID rule wins (non-discriminating, review PR #101).
            ['#textbookFocusPageIndicator', null, 'background-image'],   // GLASS token vs paper-tag
            ['#textbookFocusPageIndicator', null, 'border-top-left-radius'], // 16px
            ['#textbookFocusPageIndicator', null, 'min-width'],          // 80px
        ],
    },
    // Viewport-banded learn-chrome (§14 prereq 1). N0 captures the desktop (pre-transition) side
    // so every band is bracketed; each sentinel asserts the band-entry literal at its own width.
    bandState('N0-desktop-1280', 1280,
        { sel: '.learn-explain-toolbar', prop: 'grid-template-areas', expected: 'none' }),
    bandState('N1-toolbar-1160', 1160,
        { sel: '.learn-explain-toolbar', prop: 'grid-template-areas', expected: '"left right" "center center"' }),
    bandState('N2-toolbar-890', 890,
        { sel: '.learn-explain-toolbar', prop: 'flex-wrap', expected: 'wrap' }),
    bandState('N3-edgetab-740', 740,
        { sel: '.learn-body', prop: '--learn-edge-tab-top', expected: '14px' }),
    bandState('N4-toolbar-700', 700,
        { sel: '.learn-explain-toolbar', prop: 'grid-template-areas', expected: '"center" "left" "right"' }),

    // ---- A0 S4–S11 composer / explain-rail / overview states (REFACTOR_DONE §A0
    // gate 2 for A4). In-lesson (they mutate the one open §1.1-1 page) so they slot
    // AFTER the N-band states and BEFORE the cross-view feedback block. Composer/
    // explain states (S4/S6/S7/S9) run first in NORMAL mode; the overview states
    // (S10/S11) run LAST so their _learnLayoutMode / inline-style residue cannot leak
    // into a composer state (belt; resetLearnChrome's _learnLayoutMode floor is the
    // suspenders). Each enter() drives the REAL production function and fail-closed
    // asserts a discriminating cascade winner before snapshot (R8), exactly as S2/S3.
    //
    // SCOPE (2026-06-28, scope decided with FlyM1ss, sentinels derived empirically via a
    // throwaway matrix — record in .trellis/tasks/06-28-a0-s4-s11-probe-states/): S4,S6,S7,S9,S10,S11.
    //   • S5 (focus-within) DROPPED — focus engages and `.input-wrapper:focus-within`
    //     matches, but every focus-within declaration LOSES to the !important wall
    //     (wrapper resolves to border:0 / box-shadow:none / transparent bg, identical
    //     to non-focus). No gated rule wins → no fail-closed sentinel is constructible
    //     → a probe state would be fail-open. Pixel coverage stays in visual-diff view 09.
    //   • S1/S8 (resting lesson) deferred — view 06 pixel-covers resting; add a
    //     computed-style resting state later only if A4's gate needs one.
    {
        // S4 — normal split, chat visible. S2/S3 only cover qa-wide/qa-full; a collapse
        // that breaks the NORMAL-mode composer cascade slips past them. The §3d chrome
        // values equal S2's (panel-invariant at desktop — itself a pinned invariant);
        // what S4 uniquely exercises is the normal / no-data-panel-focus selector path.
        state: 'S4-normal-chat',
        enter: async (page) => {
            await resetLearnChrome(page);
            const driven = await page.evaluate(() => {
                if (typeof openLearnQaSidebar !== 'function') return false;
                openLearnQaSidebar();                 // learnPanelFocus='normal', chat un-collapsed
                window.dispatchEvent(new Event('resize'));
                return true;
            });
            assertOrThrow(driven, 'S4-normal-chat: openLearnQaSidebar() not reachable — app.js not loaded or symbol renamed');
            await page.waitForTimeout(400);
            const ok = await page.evaluate(() => {
                const b = document.getElementById('learnBody');
                const col = document.getElementById('learnChatCol');
                return !!b
                    && !b.dataset.panelFocus
                    && !b.classList.contains('chat-collapsed')
                    && !b.classList.contains('explain-collapsed')
                    && !b.classList.contains('chapter-overview-active')
                    && !b.classList.contains('chapter-overview-split-active')
                    && !!col && getComputedStyle(col).display !== 'none'
                    && !!document.getElementById('learnFollowupBar');
            });
            assertOrThrow(ok, 'S4-normal-chat: normal-split composer DOM not rendered (need no panel-focus / no collapse / no overview class + chat col visible + #learnFollowupBar)');
            await assertFollowupBarWinner(page, 'S4-normal-chat'); // 152px §3d winner, normal-mode path
        },
        probes: S4_PROBES,
    },
    {
        // S6 — qa-wide, chat EMPTY (not .is-chat-active). Pins the empty-state node's
        // VISIBLE cascade. updateLearnChatEmptyState() clears the inline display props
        // in non-overview-empty, so CSS controls and the probe reads the real winner.
        state: 'S6-chat-empty',
        enter: async (page) => {
            await resetLearnChrome(page);
            const driven = await page.evaluate(() => {
                if (typeof applyLearnPanelFocusState !== 'function' || typeof updateLearnChatEmptyState !== 'function') return false;
                learnPanelFocus = 'qa-wide';
                applyLearnPanelFocusState();
                const chat = document.getElementById('learnChatContent');
                if (chat) chat.replaceChildren();     // ensure empty
                updateLearnChatEmptyState();          // not-is-chat-active branch
                window.dispatchEvent(new Event('resize'));
                return true;
            });
            assertOrThrow(driven, 'S6-chat-empty: applyLearnPanelFocusState/updateLearnChatEmptyState not reachable');
            await page.waitForTimeout(400);
            const ok = await page.evaluate(() => {
                const col = document.getElementById('learnChatCol');
                return !!col && !col.classList.contains('is-chat-active') && !!document.getElementById('learnChatEmptyState');
            });
            assertOrThrow(ok, 'S6-chat-empty: #learnChatCol unexpectedly .is-chat-active or #learnChatEmptyState missing');
            const win = await page.evaluate(() => {
                const e = document.getElementById('learnChatEmptyState');
                const cs = e ? getComputedStyle(e) : null;
                return cs ? { d: cs.display, v: cs.visibility } : null;
            });
            assertOrThrow(win && win.d === 'flex' && win.v === 'visible',
                `S6-chat-empty: empty-state not shown (display=${win && win.d}, visibility=${win && win.v}, expected flex/visible). not-is-chat-active cascade not winning — baseline invalid.`);
        },
        probes: CHAT_STATE_PROBES,
    },
    {
        // S7 — qa-wide, chat ACTIVE (.is-chat-active). Pins the is-chat-active composer
        // cascade. Winner sentinel keys off PURE-CSS literals (#learnChatCol padding
        // L19955, #learnChatContent min-height L19966) — NOT the empty-state display,
        // which JS also forces inline (an inline-masked prop can't witness a CSS change).
        // The bubble child flips is-chat-active through the production observer/path;
        // resetLearnChrome clears it before the next state.
        state: 'S7-chat-active',
        enter: async (page) => {
            await resetLearnChrome(page);
            const driven = await page.evaluate(() => {
                if (typeof applyLearnPanelFocusState !== 'function' || typeof updateLearnChatEmptyState !== 'function') return false;
                learnPanelFocus = 'qa-wide';
                applyLearnPanelFocusState();
                const chat = document.getElementById('learnChatContent');
                if (chat) {
                    const b = document.createElement('div');
                    b.className = 'followup-bubble';
                    b.textContent = 'probe';
                    chat.appendChild(b);
                }
                updateLearnChatEmptyState();          // is-chat-active branch
                window.dispatchEvent(new Event('resize'));
                return true;
            });
            assertOrThrow(driven, 'S7-chat-active: applyLearnPanelFocusState/updateLearnChatEmptyState not reachable');
            await page.waitForTimeout(400);
            const ok = await page.evaluate(() => {
                const col = document.getElementById('learnChatCol');
                return !!col && col.classList.contains('is-chat-active');
            });
            assertOrThrow(ok, 'S7-chat-active: #learnChatCol did not gain .is-chat-active after appending a chat bubble');
            const win = await page.evaluate(() => {
                const col = document.getElementById('learnChatCol');
                const content = document.getElementById('learnChatContent');
                return {
                    pad: col ? getComputedStyle(col).padding : null,
                    mh: content ? getComputedStyle(content).minHeight : null,
                };
            });
            assertOrThrow(win.pad === '0px 0px 18px',
                `S7-chat-active: #learnChatCol padding is "${win.pad}", expected "0px 0px 18px" (L19955 is-chat-active floor). Rule not winning — baseline invalid.`);
            assertOrThrow(win.mh === '0px',
                `S7-chat-active: #learnChatContent min-height is "${win.mh}", expected "0px" (L19966 is-chat-active floor). Rule not winning — baseline invalid.`);
        },
        probes: CHAT_STATE_PROBES,
    },
    {
        // S9 — explain-collapsed (NOT chat-collapsed). Pins the explain-rail collapse
        // cascade; the restore tab (#learnExplainRestoreBtn) is shown ONLY here — the
        // discriminating winner for `.explain-collapsed:not(.chat-collapsed)`.
        state: 'S9-explain-collapsed',
        enter: async (page) => {
            await resetLearnChrome(page);
            const driven = await page.evaluate(() => {
                if (typeof openLearnQaSidebar !== 'function' || typeof applyLearnExplainCollapsedState !== 'function') return false;
                openLearnQaSidebar();                 // normal, chat visible
                isLearnExplainCollapsed = true;
                applyLearnExplainCollapsedState();
                window.dispatchEvent(new Event('resize'));
                return true;
            });
            assertOrThrow(driven, 'S9-explain-collapsed: openLearnQaSidebar/applyLearnExplainCollapsedState not reachable');
            await page.waitForTimeout(400);
            const ok = await page.evaluate(() => {
                const b = document.getElementById('learnBody');
                return !!b && b.classList.contains('explain-collapsed') && !b.classList.contains('chat-collapsed')
                    && !b.classList.contains('chapter-overview-active') && !b.classList.contains('chapter-overview-split-active');
            });
            assertOrThrow(ok, 'S9-explain-collapsed: #learnBody not .explain-collapsed:not(.chat-collapsed) (or an overview class present)');
            const disp = await page.evaluate(() => {
                const r = document.getElementById('learnExplainRestoreBtn');
                return r ? getComputedStyle(r).display : '__MISSING__';
            });
            assertOrThrow(disp === 'flex',
                `S9-explain-collapsed: #learnExplainRestoreBtn display is "${disp}", expected "flex" (explain-collapsed restore tab). Collapse cascade not winning — baseline invalid.`);
        },
        probes: EXPLAIN_COLLAPSE_PROBES,
    },
    {
        // S10 — chapter-overview-active. The overview explain-rail backdrop (3-layer
        // gradient, distinct from S4's 5-layer normal) + chat col hidden. Driven via
        // _learnLayoutMode='overview' THEN setChapterOverviewLayoutActive(true) — which
        // reads _learnLayoutMode on its first line (app.js:1063) to pick active vs split.
        state: 'S10-overview-active',
        enter: async (page) => {
            await resetLearnChrome(page);
            const driven = await page.evaluate(() => {
                if (typeof setChapterOverviewLayoutActive !== 'function') return false;
                _learnLayoutMode = 'overview';
                setChapterOverviewLayoutActive(true);
                window.dispatchEvent(new Event('resize'));
                return true;
            });
            assertOrThrow(driven, 'S10-overview-active: setChapterOverviewLayoutActive not reachable');
            await page.waitForTimeout(400);
            const ok = await page.evaluate(() => {
                const b = document.getElementById('learnBody');
                return !!b && b.classList.contains('chapter-overview-active') && !b.classList.contains('chapter-overview-split-active');
            });
            assertOrThrow(ok, 'S10-overview-active: #learnBody not .chapter-overview-active (or split-active leaked)');
            const bg = await page.evaluate(() => {
                const s = document.getElementById('learnExplainScroll');
                return s ? getComputedStyle(s).backgroundImage : '__MISSING__';
            });
            assertOrThrow(bg.includes('780px 520px at 8% 0%'),
                `S10-overview-active: #learnExplainScroll background lacks the overview gradient signature "780px 520px at 8% 0%" (got "${bg}"). Overview cascade not winning — baseline invalid.`);
        },
        probes: OVERVIEW_PROBES,
    },
    {
        // S11 — chapter-overview-split-active. Overview explain-rail backdrop (3-layer)
        // WITH the chat col visible (vs S10's hidden chat). Driven via
        // _learnLayoutMode='overview_lesson'.
        state: 'S11-overview-split',
        enter: async (page) => {
            await resetLearnChrome(page);
            const driven = await page.evaluate(() => {
                if (typeof setChapterOverviewLayoutActive !== 'function') return false;
                _learnLayoutMode = 'overview_lesson';
                setChapterOverviewLayoutActive(true);
                window.dispatchEvent(new Event('resize'));
                return true;
            });
            assertOrThrow(driven, 'S11-overview-split: setChapterOverviewLayoutActive not reachable');
            await page.waitForTimeout(400);
            const ok = await page.evaluate(() => {
                const b = document.getElementById('learnBody');
                return !!b && b.classList.contains('chapter-overview-split-active') && !b.classList.contains('chapter-overview-active');
            });
            assertOrThrow(ok, 'S11-overview-split: #learnBody not .chapter-overview-split-active (or active leaked)');
            const v = await page.evaluate(() => {
                const s = document.getElementById('learnExplainScroll');
                const col = document.getElementById('learnChatCol');
                return {
                    bg: s ? getComputedStyle(s).backgroundImage : '__MISSING__',
                    chat: col ? getComputedStyle(col).display : '__MISSING__',
                };
            });
            assertOrThrow(v.bg.includes('780px 520px at 8% 0%'),
                `S11-overview-split: #learnExplainScroll background lacks the overview gradient signature (got "${v.bg}"). Overview cascade not winning — baseline invalid.`);
            assertOrThrow(v.chat !== 'none',
                `S11-overview-split: chat col is display:none — split layout should keep chat visible (distinguishes from S10). State invalid.`);
        },
        probes: OVERVIEW_PROBES,
    },
    {
        // S13 — .learn-textbook-active (Band 1, normal textbook mode). Driven via the
        // REAL production fn _setLearnMode('textbook') (app.js:2449) with _learnLayoutMode
        // floored to 'lesson' by resetLearnChrome — supportsTextbookLayout is then true so
        // _setLearnMode toggles .learn-textbook-active ON #learnBody (app.js:2456), making
        // the Band-1 doubled-ID rules (L25118-25157) the live cascade winners. NOT the
        // combined overview+textbook Band (that is the dropped S14 — see the comment block
        // above S13_PROBES). Winner sentinel: #learnExplainScroll background-image carries
        // the Band-1 2-radial signature (distinct from the base 2-radial), proving the
        // Band-1 cascade — not the resting-lecture base — is live before any probe is trusted.
        state: 'S13-textbook-active',
        enter: async (page) => {
            await resetLearnChrome(page);
            const driven = await page.evaluate(() => {
                if (typeof _setLearnMode !== 'function') return false;
                _setLearnMode('textbook'); // _learnLayoutMode is 'lesson' (resetLearnChrome floor)
                window.dispatchEvent(new Event('resize'));
                return true;
            });
            assertOrThrow(driven, 'S13-textbook-active: _setLearnMode not reachable from the page — app.js not loaded or symbol renamed');
            await page.waitForTimeout(400);
            // One round-trip for both reads: the entered-class check and the winner-sentinel
            // background-image (both read the same settled frame after the 400ms wait).
            const { ok, bg } = await page.evaluate(() => {
                const b = document.getElementById('learnBody');
                const ok = !!b && b.classList.contains('learn-textbook-active')
                    && !b.classList.contains('chapter-overview-active')
                    && !b.classList.contains('chapter-overview-split-active');
                const s = document.getElementById('learnExplainScroll');
                return { ok, bg: s ? getComputedStyle(s).backgroundImage : '__MISSING__' };
            });
            assertOrThrow(ok, 'S13-textbook-active: #learnBody not .learn-textbook-active (or a chapter-overview-* class leaked in — Band-1 cascade not isolated)');
            // Band-1 L25124 signature (`circle at 18% 6% ...0.82` + `circle at 82% 16% ...0.44`),
            // DISTINCT from the base L24030 2-radial (`20% 8% ...0.86` + `82% 18% ...0.22`).
            assertOrThrow(bg.includes('circle at 18% 6%') && bg.includes('rgba(255, 255, 255, 0.82)')
                && bg.includes('circle at 82% 16%') && bg.includes('rgba(255, 255, 255, 0.44)'),
                `S13-textbook-active: #learnExplainScroll background lacks the Band-1 textbook 2-radial signature ("circle at 18% 6% ...0.82" + "circle at 82% 16% ...0.44"); got "${bg}". Band-1 cascade not winning — baseline invalid.`);
        },
        probes: S13_PROBES,
    },

    // ---- #feedbackView floor guard (D1). Appended LAST — these are the FIRST
    // cross-view-navigating states (they leave the lesson page for #feedbackView). ----
    // CONTRACT: do NOT append a learn-chrome state after this block. S13 leaves
    // .learn-textbook-active + textbook inline styles on the (now-hidden) lesson DOM, and the
    // feedback states use openFeedbackBoard (no resetLearnChrome), so a later learn state would
    // start from leaked textbook mode. New learn-chrome states belong BEFORE S13; see the S13
    // cleanup floor in resetLearnChrome for the full rationale.
    {
        // S-feedback-rest — the populated multi-tone board at desktop rest. Pins the
        // literal cascade-winning value of every rest-reachable floor property (52 of
        // the 55) on representative tone-0..5 / is-left|right / reply-context nodes;
        // the remaining 3 (outline / cursor / filter) are covered by the focus +
        // disabled states below. Probes derived from _view-important.json so the guard
        // stays tied to the actual floor declarations.
        state: 'S-feedback-rest',
        enter: async (page) => {
            await openFeedbackBoard(page);
            await assertFeedbackFloorWinner(page, 'S-feedback-rest');
        },
        probes: FEEDBACK_REST_PROBES,
    },
    {
        // S-feedback-input-focus — covers the focus floor `outline: none !important`
        // (L27177) on the compose name input. The sentinel proves the focused-input
        // rule won (a global `input:focus { outline }` would otherwise paint a ring).
        state: 'S-feedback-input-focus',
        enter: async (page) => {
            await openFeedbackBoard(page);
            await page.focus('#feedbackView .feedback-input');
            await assertFeedbackSentinel(page, 'S-feedback-input-focus',
                '#feedbackView .feedback-input', 'outline-style', 'none', 'L27177 :focus floor');
        },
        probes: [
            ['#feedbackView .feedback-input', null, 'outline'],
            ['#feedbackView .feedback-textarea', null, 'outline'],
        ],
    },
    {
        // S-feedback-submit-disabled — covers the disabled-state floor props `cursor:
        // wait` (L25244) and `filter: saturate(0.82)` (L25246), the only two floor
        // properties carried solely by #feedbackSubmitBtn:disabled. css-probe can
        // render this state (set .disabled on the button) even though the arbiter
        // deliberately cannot (synthetic disabled gave false positives) — that is
        // exactly why the durable guard probes it. Sentinel: cursor === 'wait'.
        state: 'S-feedback-submit-disabled',
        enter: async (page) => {
            await openFeedbackBoard(page);
            await page.evaluate(() => {
                const btn = document.getElementById('feedbackSubmitBtn');
                if (btn) btn.disabled = true;
            });
            await assertFeedbackSentinel(page, 'S-feedback-submit-disabled',
                '#feedbackSubmitBtn', 'cursor', 'wait', 'L25244 :disabled floor');
        },
        probes: [
            ['#feedbackView #feedbackSubmitBtn.feedback-primary-btn', null, 'cursor'],
            ['#feedbackView #feedbackSubmitBtn.feedback-primary-btn', null, 'filter'],
            ['#feedbackView #feedbackSubmitBtn.feedback-primary-btn', null, 'opacity'], // 0.74 (L25245) — same disabled rule
        ],
    },
    {
        // S-feedback-refresh-hover — the refresh icon button's hover floor (transform /
        // border-color / box-shadow, L20962-20964 + the icon rotate L20971). These are
        // the load-bearing hover floor decls most exposed to a global interactive rule.
        state: 'S-feedback-refresh-hover',
        enter: async (page) => {
            await openFeedbackBoard(page);
            await page.hover('#feedbackView .feedback-refresh-icon-btn');
            // The hover transform is animated by a `transition` floor decl (L20949).
            // Jump every running transition/animation to its end state so the probe
            // reads the SETTLED cascade-determined value, not a mid-tween frame.
            await settleFeedbackHover(page);
            // translateY(-1px) → matrix(1, 0, 0, 1, 0, -1)
            await assertFeedbackSentinel(page, 'S-feedback-refresh-hover',
                '#feedbackView .feedback-refresh-icon-btn', 'transform', 'matrix(1, 0, 0, 1, 0, -1)',
                'L20962 :hover translateY(-1px) floor');
        },
        probes: [
            ['#feedbackView .feedback-refresh-icon-btn', null, 'transform'],
            ['#feedbackView .feedback-refresh-icon-btn', null, 'border-color'],
            ['#feedbackView .feedback-refresh-icon-btn', null, 'box-shadow'],
            ['#feedbackView .feedback-refresh-icon-btn i', null, 'transform'],
        ],
    },
    {
        // S-feedback-submit-hover — the submit button's hover floor (transform /
        // border-color / box-shadow, L25225-25227 + the icon transform L25235). Same
        // role as refresh-hover for the primary CTA.
        state: 'S-feedback-submit-hover',
        enter: async (page) => {
            await openFeedbackBoard(page);
            await page.hover('#feedbackView #feedbackSubmitBtn');
            // Settle the animated hover transform (transition floor decl L25221) so the
            // probe reads the settled end value, not a mid-tween frame.
            await settleFeedbackHover(page);
            // translateY(-2px) → matrix(1, 0, 0, 1, 0, -2)
            await assertFeedbackSentinel(page, 'S-feedback-submit-hover',
                '#feedbackView #feedbackSubmitBtn', 'transform', 'matrix(1, 0, 0, 1, 0, -2)',
                'L25225 :hover translateY(-2px) floor');
        },
        probes: [
            ['#feedbackView #feedbackSubmitBtn.feedback-primary-btn', null, 'transform'],
            ['#feedbackView #feedbackSubmitBtn.feedback-primary-btn', null, 'border-color'],
            ['#feedbackView #feedbackSubmitBtn.feedback-primary-btn', null, 'box-shadow'],
            ['#feedbackView #feedbackSubmitBtn.feedback-primary-btn i', null, 'transform'],
        ],
    },
];

// Read every probe tuple's resolved computed value for one state.
async function snapshotState(page, stateDef) {
    // Per-state viewport (defaults to desktop). Set UNCONDITIONALLY each iteration so every state
    // runs at its own width regardless of order — the page + context are shared and the viewport
    // is sticky on the context (set once at newContext), so a prior banded state's width must not
    // persist into the next. setViewportSize queues a resize but does not await layout; settle the
    // reflow (double-rAF) BEFORE enter() so the app's resize handlers recompute at the new width.
    await page.setViewportSize(stateDef.viewport || VIEWPORT);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await stateDef.enter(page);
    await settleLesson(page);
    return page.evaluate((probes) => {
        return probes.map(([sel, pseudo, prop]) => {
            const el = document.querySelector(sel);
            if (!el) return { sel, pseudo, prop, value: '__MISSING__' };
            const cs = getComputedStyle(el, pseudo || undefined);
            return { sel, pseudo, prop, value: cs.getPropertyValue(prop) };
        });
    }, stateDef.probes);
}

function keyOf(state, p) {
    // Explicit field separators so a selector that literally contains `::before`
    // can never collide with a (selector, '::before') tuple.
    return `${state} | ${p.sel} || ${p.pseudo || ''} || ${p.prop}`;
}

// ---------- runner ----------
let bridgeProcess = null;
let signalHandled = false;
function signalCleanup(signal) {
    if (signalHandled) return;
    signalHandled = true;
    if (bridgeProcess && !bridgeProcess.killed) {
        try { bridgeProcess.kill('SIGTERM'); } catch (_) {}
    }
    process.exit(signal === 'SIGTERM' ? 143 : 130);
}
process.once('SIGINT', () => signalCleanup('SIGINT'));
process.once('SIGTERM', () => signalCleanup('SIGTERM'));

(async () => {
    const repoRoot = path.resolve(__dirname, '..');

    // FAIL CLOSED (static precondition, before any resource is spawned): duplicate state names
    // would silently overwrite in `snapshot[name]`, dropping a whole state's coverage with zero
    // signal (the per-key / missing-state guards cannot see it). Reject before the bridge starts.
    const stateNames = PROBE_STATES.map((s) => s.state);
    const dupState = stateNames.find((n, i) => stateNames.indexOf(n) !== i);
    if (dupState) {
        console.error(`[css-probe] duplicate PROBE_STATES name "${dupState}" — state ids must be unique`);
        process.exit(1);
    }

    console.log(`[css-probe] mode=${MODE}`);
    console.log(`[css-probe] starting bridge on :${PORT}`);
    const server = spawnBridge(repoRoot, PORT);
    bridgeProcess = server;

    let exitCode = 0;
    const snapshot = {};

    try {
        await waitForHealth(BASE);
        const browser = await chromium.launch();
        const context = await browser.newContext({
            viewport: VIEWPORT,
            timezoneId: 'UTC',
            locale: 'en-US',
        });
        // Inherit the same mask as visual-diff (freezes .is-animating transitions
        // so a probe taken mid-transition reads the settled value). The masked
        // properties (visibility/color/caret/animation on login + meta elements)
        // do not overlap any probed property, and the mask is identical across
        // --baseline and --check so it cannot create a false diff.
        await injectMaskInitScript(context);

        const page = await context.newPage();
        await enterGuestMode(page, BASE);
        await openSubtopic(page, SUBTOPIC);

        for (const stateDef of PROBE_STATES) {
            try {
                const rows = await snapshotState(page, stateDef);
                snapshot[stateDef.state] = rows;
                console.log(`  ✓ ${stateDef.state} (${rows.length} probes)`);
            } catch (err) {
                console.log(`  ✗ ${stateDef.state}: ${err.message}`);
                snapshot[stateDef.state] = { error: err.message };
                exitCode = 1;
            }
        }

        await page.close().catch(() => {});
        await context.close().catch(() => {});
        await browser.close();
    } catch (err) {
        console.error('[css-probe] FATAL', err);
        exitCode = 1;
    } finally {
        await stopBridge(server, { label: 'css-probe' });
    }

    if (MODE === 'baseline') {
        if (exitCode !== 0) {
            console.error('[css-probe] a state errored during capture — NOT writing a partial baseline');
            process.exit(1);
        }
        // FAIL CLOSED: a probe whose element is absent records __MISSING__, which would
        // then compare __MISSING__===__MISSING__ forever (false confidence). Refuse to
        // bake one into the proof artifact — fix the probe/state instead.
        const missing = [];
        const dupKeys = [];
        for (const [state, rows] of Object.entries(snapshot)) {
            if (!Array.isArray(rows)) continue;
            const seen = new Set();
            for (const p of rows) {
                if (p.value === '__MISSING__' || p.value === '__ABSENT__') missing.push(keyOf(state, p));
                const k = keyOf(state, p);
                if (seen.has(k)) dupKeys.push(k); else seen.add(k);
            }
        }
        if (missing.length) {
            console.error('[css-probe] refusing to write baseline — these probes resolved __MISSING__ (element absent in state):');
            for (const m of missing) console.error(`  ! ${m}`);
            console.error('  Fix the probe selector or render the element in enter().');
            process.exit(1);
        }
        // FAIL CLOSED: a duplicate probe key within a state would bake two rows the --check
        // de-dup silently collapses (here multiplied across every state sharing NARROW_PROBES).
        // --check already rejects dup current keys; refuse to WRITE one too, symmetrically.
        if (dupKeys.length) {
            console.error('[css-probe] refusing to write baseline — duplicate probe keys (de-dup the probe list):');
            for (const k of dupKeys) console.error(`  ! ${k}`);
            process.exit(1);
        }
        fs.writeFileSync(BASELINE_PATH, JSON.stringify(snapshot, null, 2) + '\n');
        console.log(`\n[css-probe] baseline → ${BASELINE_PATH} (${Object.keys(snapshot).length} states, all probes have a real value)`);
        process.exit(0);
    }

    // --check: byte-identical comparison against the committed baseline, fail-closed.
    if (!fs.existsSync(BASELINE_PATH)) {
        console.error(`[css-probe] no baseline at ${BASELINE_PATH} — run --baseline first`);
        process.exit(1);
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    const diffs = [];
    const errors = [];
    for (const state of Object.keys(baseline)) {
        const baseRows = baseline[state];
        const curRows = snapshot[state];
        if (!Array.isArray(baseRows)) {
            errors.push(`${state}: baseline state is not a probe array (corrupt/partial baseline) — failing closed`);
            continue;
        }
        if (!curRows || !Array.isArray(curRows)) {
            errors.push(`${state}: current run produced no rows (${curRows && curRows.error ? curRows.error : 'missing'})`);
            continue;
        }
        const curByKey = new Map();
        for (const p of curRows) {
            const k = keyOf(state, p);
            if (curByKey.has(k)) errors.push(`${state}: duplicate probe key "${k}" — de-dup the probe list`);
            curByKey.set(k, p.value);
        }
        const baseKeys = new Set();
        for (const bp of baseRows) {
            const k = keyOf(state, bp);
            baseKeys.add(k);
            if (bp.value === '__MISSING__' || bp.value === '__ABSENT__') {
                errors.push(`${state}: baseline value for "${k}" is ${bp.value} — probe never had a real value; re-baseline / fix the probe`);
                continue;
            }
            const cur = curByKey.has(k) ? curByKey.get(k) : '__ABSENT__';
            if (cur === '__MISSING__') {
                errors.push(`${state}: "${k}" element vanished (baseline ${bp.value}, now __MISSING__)`);
                continue;
            }
            if (cur !== bp.value) diffs.push({ key: k, before: bp.value, after: cur });
        }
        // Reverse pass: a current probe with no baseline entry means someone added a
        // probe without re-baselining — it would otherwise be silently uncovered.
        for (const p of curRows) {
            const k = keyOf(state, p);
            if (!baseKeys.has(k)) errors.push(`${state}: current probe "${k}" has no baseline entry — re-baseline after adding/renaming probes`);
        }
    }

    // Symmetric fail-closed: a current state absent from the baseline (a probe
    // state added without re-baselining) would otherwise be silently uncovered.
    for (const state of Object.keys(snapshot)) {
        if (!(state in baseline)) {
            errors.push(`${state}: current run has a probe state with no baseline entry — re-baseline after adding a new state`);
        }
    }

    const cell = (v) => String(v).replace(/\|/g, '\\|'); // guard the markdown table
    const pass = diffs.length === 0 && errors.length === 0;
    const lines = ['# css-probe report', '',
        `States: ${Object.keys(baseline).join(', ')}`,
        `Result: ${pass ? 'PASS — all probes byte-identical' : 'FAIL'}`,
        ''];
    if (errors.length) {
        lines.push('## Fail-closed errors', '');
        for (const e of errors) lines.push(`- ${e}`);
        lines.push('');
    }
    if (diffs.length) {
        lines.push('## Probe diffs (baseline → current)', '',
            '| Probe | Before | After |', '|---|---|---|');
        for (const d of diffs) lines.push(`| ${cell(d.key)} | \`${cell(d.before)}\` | \`${cell(d.after)}\` |`);
    } else if (!errors.length) {
        lines.push('Every probed (state, selector, property) resolved value matches the baseline byte-for-byte.');
    }
    fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n');
    console.log(`\n[css-probe] report → ${REPORT_PATH}`);

    if (!pass) {
        console.error(`[css-probe] FAIL: ${diffs.length} probe diff(s), ${errors.length} fail-closed error(s)`);
        for (const d of diffs) console.error(`  ~ ${d.key}\n      before: ${d.before}\n      after:  ${d.after}`);
        for (const e of errors) console.error(`  ! ${e}`);
        process.exit(1);
    }
    console.log('[css-probe] PASS — all probes byte-identical');
    process.exit(0);
})();
