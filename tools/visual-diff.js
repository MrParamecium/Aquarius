#!/usr/bin/env node
/**
 * Visual-diff harness for CSS-heavy refactors (Phase 3 #20, #22, deferred #19).
 *
 * Captures PNG screenshots of the key visual surfaces in guest mode, then
 * compares them pixel-for-pixel against a saved baseline. Animated regions
 * (login cosmos Three.js canvas, in-flight panel transitions) are masked so
 * a deterministic diff is possible.
 *
 * Usage:
 *   node tools/visual-diff.js --baseline    # save current state to tools/visual-baseline/
 *   node tools/visual-diff.js --check       # capture current + diff vs baseline
 *
 * Exit 0 if every view diffs under THRESHOLD pixels (or on --baseline).
 * Exit 1 if any view exceeds threshold, or on harness failure.
 *
 * Report: tools/visual-diff-report.md (only written by --check).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch').default;
const { PNG } = require('pngjs');
const {
    waitForHealth,
    spawnBridge,
    stopBridge,
    injectMaskInitScript,
    enterGuestMode,
    enterLoginView,
    ensureSyllabusOpen,
    openSubtopic,
    resetHomeChromeState,
    resetLessonChromeState,
    enterTextbookOverflowState,
    settleLesson,
    finishAnimations,
    assertOrThrow,
    resolveLessonCachePath,
    closeFeaturePopovers,
    maskLessonSidebar,
    runFlow,
} = require('./test-utils.js');

const PORT = Number(process.env.TUTOR_VDIFF_PORT || 9125);
const BASE = `http://127.0.0.1:${PORT}`;
const VIEWPORT = { width: 1280, height: 800 };
const PIXELMATCH_THRESHOLD = 0.1;        // per-pixel YIQ-distance threshold
const FAIL_RATIO = 0.005;                // default — fail if >0.5% of pixels differ
// Cascade-sensitive views can opt in to a tighter threshold by setting
// `failRatio` on the view declaration; a real regression on chrome that
// covers ≪0.5% of the frame would otherwise hide under FAIL_RATIO.
// Pick a value comfortably above baseline-vs-baseline noise (0 px on masked
// views) and below the measured regression diff, then leave a comment on
// the view explaining the pixel-coverage math.

const TOOLS = __dirname;
const BASELINE_DIR = path.join(TOOLS, 'visual-baseline');
const CURRENT_DIR = path.join(TOOLS, 'visual-current');
const DIFF_DIR = path.join(TOOLS, 'visual-diff');
const REPORT_PATH = path.join(TOOLS, 'visual-diff-report.md');

const MODE = process.argv.includes('--baseline') ? 'baseline'
           : process.argv.includes('--check') ? 'check'
           : null;
if (!MODE) {
    console.error('usage: visual-diff.js --baseline | --check');
    process.exit(2);
}

const SUBTOPIC = { id: '1_1-1', title: '1.1-1 Signal Energy',
    chapter: 'Chapter 1: Signals and Systems',
    section: '1.1 Size of a Signal' };

// Page C lesson candidates per view. Each view tries candidates in order;
// the first whose hydrated demos include `expected` family is used.
// On swap, the view file MUST be renamed to reflect the actual family
// (see docs/superpowers/specs/2026-06-22-harness-expansion-design.md).
//
// chapter/section/title MUST match app/data/syllabus-data.js exactly;
// openSubtopic uses substring `hasText` + a `data-section` attr lookup.
const PAGE_C_VIEWS = [
    {
        viewName: '17-lesson-convolution',
        candidates: [
            { sectionId: '3.8-1', expected: 'convolution_lab',
              chapter: 'Chapter 3: Time-Domain Analysis of Discrete-Time Systems',
              section: '3.8 System Response to External Input: The Zero-State Response',
              title:   '3.8-1 Graphical Procedure for the Convolution Sum' },
            { sectionId: '3.8-2', expected: 'convolution_lab',
              chapter: 'Chapter 3: Time-Domain Analysis of Discrete-Time Systems',
              section: '3.8 System Response to External Input: The Zero-State Response',
              title:   '3.8-2 Interconnected Systems' },
            { sectionId: '3.8-3', expected: 'convolution_lab',
              chapter: 'Chapter 3: Time-Domain Analysis of Discrete-Time Systems',
              section: '3.8 System Response to External Input: The Zero-State Response',
              title:   '3.8-3 Total Response' },
            { sectionId: '3.11-4', expected: 'convolution_lab',
              chapter: 'Chapter 3: Time-Domain Analysis of Discrete-Time Systems',
              section: '3.11 MATLAB: Discrete-Time Signals and Systems',
              title:   '3.11-4 Discrete-Time Convolution' },
        ],
    },
    {
        viewName: '18-lesson-pole-zero-roc',
        candidates: [
            { sectionId: '4.11-1', expected: 'pole_zero_roc_lab',
              chapter: 'Chapter 4: Continuous-Time System Analysis Using the Laplace Transform',
              section: '4.11 The Bilateral Laplace Transform',
              title:   '4.11-1 Properties of the Bilateral Laplace Transform' },
            // 3.12 / 3.13 are present in cache but live as section-level
            // entries (no `subsections` in syllabus-data.js), so openSubtopic
            // cannot navigate to them with the current (chapter+section+title)
            // 3-tuple shape. They appear in the spec's fallback list and stay
            // here for visibility; preFlightCacheCheck treats their cache
            // presence as adequate. If 4.11-1 ever drops out, the implementer
            // must teach openSubtopic to handle section-card entries before
            // these become usable. Tracked in docs/phase3_deferred.md.
            // { sectionId: '3.12', expected: 'pole_zero_roc_lab', ... },
            // { sectionId: '3.13', expected: 'pole_zero_roc_lab', ... },
        ],
    },
];

const COVERAGE_REPORT_PATH = path.join(TOOLS, 'visual-diff-coverage.json');

// ---------- view definitions ----------
// One long-lived page bootstrapped through enterGuestMode; each setup() takes
// the page from "wherever we are" to its target state. `06-lesson-view` runs
// last because it mutates the page the most — sidebar nav is still clickable
// from inside a lesson, but it's cheaper to capture sidebar destinations first.
//
// Landing was intentionally excluded from this harness: style.css L33181-44845
// (Phase 3 #20) and the runtime inject*Styles cluster (Phase 3 #22) are both
// post-marketing lesson-UI rules. The landing page sits outside Phase 3's blast
// radius and its decorative font-swap noise made deterministic diffs painful.
// Re-add if a future phase touches global rules.
//
// Views 01-09 = Phase 3 PR #21 baseline. Views 10-18 = Phase 3.5 PR #44
// expansion. Views 19-25 = Phase 3.5 v2 (Glass coverage gate for Step G.3 /
// Phase 2 #19). See docs/superpowers/specs/2026-06-22-harness-expansion-design.md
// + docs/phase3_deferred.md §7d.8.
//
// Numbering convention for state-variant additions to an existing view: use
// the existing view's NN with a lowercase letter suffix (NN[a-z]). A new view
// that does not share an existing surface should take the next free integer.
// Existing view numbers stay stable when a surface is removed.

// Pagination helper used by Phase 3.5 v2 views 21 + 22 to walk the lesson
// pager until a sentinel selector lands in the current KP. Watches
// `[data-lesson-page]` changes (or the sentinel itself) to gate "advance
// complete" — runLearnPageTurn's 720ms animation lock (app.js L2474) is
// NOT mirrored on the next-button disabled state, so successive clicks
// within the lock silently no-op. Each iteration waits ≤2s; the outer
// loop is capped at 25 to fail-fast on a stuck pager.
//
// No per-page-seen loopback guard — throttled clicks (which leave the
// pager on the same data-lesson-page) would falsely trigger it. The 25-
// iter cap and the `if (!clicked) break` next-button-disabled exit
// terminate genuine end-of-pager cases.
async function advanceLessonUntil(page, sentinelSelector) {
    const readPage = () => page.evaluate(() => document
        .querySelector('#learnExplainContent .lesson-page-frame')
        ?.getAttribute('data-lesson-page') || '');
    for (let i = 0; i < 25; i++) {
        if (await page.$(sentinelSelector)) return;
        const prior = await readPage();
        const clicked = await page.evaluate(() => {
            const btn = document.querySelector('#learnKpNextBtn:not([disabled])');
            if (!btn) return false;
            btn.click();
            return true;
        });
        if (!clicked) break;
        await page.waitForFunction(
            ({ prev, sel }) => {
                if (document.querySelector(sel)) return true;
                const cur = document.querySelector('#learnExplainContent .lesson-page-frame')
                    ?.getAttribute('data-lesson-page');
                // Strict !==prev — when prev=='' (first read raced settle)
                // an empty cur stays falsy, so the wait still times out
                // rather than early-resolving on null-equals-anything.
                return Boolean(cur) && cur !== prev;
            },
            { prev: prior, sel: sentinelSelector },
            { timeout: 2000 },
        ).catch(() => {});
    }
    await page.waitForSelector(sentinelSelector, { timeout: 3000 });
}

const sharedViews = [
    // ----- Page A (lesson-loaded guest mode) -----
    { name: '01-guest-home', page: 'A', setup: async (page) => {
        await closeFeaturePopovers(page);
        await page.waitForTimeout(300);
    } },
    // A3 gate witness (task 07-03-a3-gate-witness) — R4: tight failRatio. This is
    // the ONLY view that renders the syllabus tree unmasked, so it is the pixel
    // backstop for a `.app .sidebar` strip that flips a `.syllabus-*` arm
    // (color/border-left/background ≈ a few hundred px of a 1280×800 frame, well
    // under the 0.5% default). 0.0005 (0.05%) = 512px. The ~1-2px/row settled-
    // height drift that forced maskLessonSidebar on the downstream LESSON views
    // (test-utils L169) does NOT surface here: ensureSyllabusOpen gates on
    // `.is-open:not(.is-animating)` and getAnimations().finish() jumps any residual
    // tween to its end, so the settled render is deterministic before capture.
    // CALIBRATED: 3 baseline-vs-baseline runs each measured 0/1024000 (0.000%).
    { name: '02-syllabus-open', page: 'A', failRatio: 0.0005, setup: async (page) => {
        await ensureSyllabusOpen(page);
        await finishAnimations(page);
        await page.waitForTimeout(400);
    } },
    // View 03 — Page A — mistake notebook EMPTY landing. Idempotent
    // localStorage clear at the top defends against a sibling view that
    // might seed mistakes before this view. The harness's Chromium context
    // starts each run with empty localStorage, so the clear is a no-op on
    // clean runs.
    //
    // INVARIANTS for the mistake-notebook localStorage key. None of these
    // are machine-enforced (the JS comment is the only contract); a
    // contributor adding a view that seeds aquariusMistakeNotebook.v1 must
    // follow ALL of them or view 04's silent close-button failure (see
    // view 04 setup) will let populated mistake-notebook state leak into
    // view 04's "mistake-notebook empty + recent panel open" capture:
    //   1. The seeding view MUST clear the key in its own setup() prologue
    //      (defensive — covers re-entry, parallel-run races).
    //   2. The seeding view MUST run AFTER view 04 in the Page A schedule.
    //   3. SAFEST placement: end of Page A schedule (after view 23+).
    //      Mid-schedule placement requires auditing every subsequent
    //      Page A view's assumed mistake-notebook state.
    // See view 03b setup comment for the full diagnostic trace.
    { name: '03-mistake-notebook', page: 'A', setup: async (page) => {
        await page.evaluate(() => {
            try { localStorage.removeItem('aquariusMistakeNotebook.v1'); } catch (_) {}
        });
        await page.click('#navMistakeNotebookBtn');
        await page.waitForSelector('#mistakeNotebookView:not(.hidden)', { timeout: 5000 });
        // Empty-state assertion: #mistakeEmptyPanel visible, #mistakeDetailContent hidden.
        const emptyOpen = await page.evaluate(() => ({
            empty: !document.getElementById('mistakeEmptyPanel')?.classList.contains('hidden'),
            detailHidden: document.getElementById('mistakeDetailContent')?.classList.contains('hidden'),
        }));
        assertOrThrow(emptyOpen.empty && emptyOpen.detailHidden,
            `view 03: expected empty-panel visible + detail-content hidden, got ${JSON.stringify(emptyOpen)}`);
        await page.waitForTimeout(400);
    } },
    { name: '04-recent-conversations', page: 'A', setup: async (page) => {
        // NOTE (PR #70 follow-up): the page.click('#mistakeNotebookCloseBtn')
        // here is a no-op — that button is hidden via the doubled-ID rule
        // `#mistakeNotebookView#mistakeNotebookView #mistakeNotebookCloseBtn
        // .feature-close-btn { display: none !important; visibility: hidden
        // !important; width: 0 !important; ... }` at style.css L34394. The
        // click has been silently swallowed by the .catch since the harness
        // was added; view 04 has always captured mistake-notebook view +
        // sidebar recent-panel open, not welcomeScreen. The waitForSelector
        // for `.hidden` also always times out (same .catch pattern).
        // Kept as-is rather than fixed (fixing it would shift the baseline
        // significantly; out of scope for the harness expansion track).
        await page.click('#mistakeNotebookCloseBtn').catch(() => {});
        await page.waitForSelector('#mistakeNotebookView.hidden', { timeout: 3000 }).catch(() => {});
        await page.click('#navRecentBtn');
        await page.waitForTimeout(700);
    } },
    { name: '05-settings', page: 'A', setup: async (page) => {
        await page.click('#sidebarSettingsBtn');
        await page.waitForSelector('.settings-page-version', { timeout: 5000 });
        await page.waitForTimeout(400);
    } },
    { name: '06-lesson-view', page: 'A', setup: async (page) => {
        await closeFeaturePopovers(page);
        await openSubtopic(page, SUBTOPIC);
        // Mask the syllabus accordion (sticky on Page A from here through 03b).
        // Lesson-view pixel diffs were dominated by sidebar row-layout drift
        // that no settle helper could eliminate — see docs/phase3_deferred.md §11
        // Option A. Side effect: views 06-22 + 03b on Page A all capture WITHOUT
        // sidebar accordion content, which is acceptable because views 02 (Page A,
        // before this mask is added), 12/13/14 (Page B, separate page) already
        // cover sidebar rendering in their deterministic resting states.
        await maskLessonSidebar(page);
        await page.waitForTimeout(800); // let KaTeX settle
    } },
    { name: '07-lesson-pager-states', page: 'A', setup: async (page) => {
        // Force the pager to its last-subsection state so the next-button
        // disabled treatment is visible. We do this by reaching the
        // sentinel "is at end" state without leaving the lesson:
        // hover the next-button to surface its hover treatment.
        await page.evaluate(() => {
            const nextBtn = document.querySelector('#learnKpNextBtn');
            if (nextBtn) nextBtn.scrollIntoView({ block: 'center' });
        });
        const nextBtn = page.locator('#learnKpNextBtn').first();
        await nextBtn.hover({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
    } },
    { name: '08-lesson-lecture-toolbar', page: 'A', setup: async (page) => {
        // qa-wide focuses the QA column to ~2/3 width and is one of the
        // most-overridden states across both #22's runtime inject*Styles
        // sites and #20's banner cluster.
        await page.evaluate(() => {
            const shell = document.getElementById('learnBody');
            if (shell) shell.dataset.panelFocus = 'qa-wide';
            window.dispatchEvent(new Event('resize'));
        });
        await page.waitForTimeout(400);
    } },
    { name: '09-lesson-qa-column', page: 'A', setup: async (page) => {
        // qa-full collapses lecture entirely and exposes the followup-bar
        // glass panel + chat composer chrome. Also exercise :focus-within
        // on the followup bar so PR #22's hover/focus rules are captured.
        await page.evaluate(() => {
            const shell = document.getElementById('learnBody');
            if (shell) shell.dataset.panelFocus = 'qa-full';
            window.dispatchEvent(new Event('resize'));
        });
        await page.waitForTimeout(300);
        await page.locator('#learnFollowupBar input, #learnFollowupBar textarea').first()
            .focus({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(300);
    } },
    // ----- Page B (Home Ask + sidebar destinations) -----
    // View 10 — Page B — focuses #userInput inside #searchBox.home-ask-composer
    // so the :focus-within cascade fires on the composer (10 #20c top-4 sites).
    // #searchBox itself is a <div> and not focusable — focusing the inner
    // textarea is what triggers :focus-within.
    { name: '10-home-ask-focused', page: 'B', setup: async (page) => {
        // Close any feature popovers and reset menu state.
        await closeFeaturePopovers(page);
        await resetHomeChromeState(page);
        await page.focus('#userInput');
        const focused = await page.evaluate(() =>
            !!document.querySelector('#searchBox.home-ask-composer')?.matches(':focus-within')
        );
        assertOrThrow(focused, 'view 10: #searchBox.home-ask-composer does not match :focus-within after focusing #userInput');
        await page.waitForTimeout(150);
    } },
    // View 11 — Page B — forces #homeModeMenu.home-mode-menu.show via
    // classList.add (bypasses #homeModeToggleBtn click handler so a stray
    // document.click cannot auto-close the menu mid-screenshot). The
    // MASK_CSS .home-mode-menu.show transition guard ensures we don't
    // capture mid-transition.
    { name: '11-home-mode-menu-open', page: 'B', setup: async (page) => {
        await page.evaluate(() => {
            // Reset composer focus from previous view; otherwise the focused
            // textarea cursor leaks into this capture.
            document.activeElement?.blur?.();
            const menu = document.getElementById('homeModeMenu');
            const toggle = document.getElementById('homeModeToggleBtn');
            menu?.classList.add('show');
            toggle?.setAttribute('aria-expanded', 'true');
        });
        const open = await page.evaluate(() =>
            document.getElementById('homeModeMenu')?.classList.contains('show')
        );
        assertOrThrow(open, 'view 11: #homeModeMenu does not have .show class after forcing');
        await page.waitForTimeout(200);
    } },
    // View 12 — Page B — preference profile resting state.
    // Uses resetHomeChromeState to strip view 11's aria-expanded='true' +
    // .show in one place (selector-keying off either today is harmless but
    // the harness shouldn't be silently order-dependent).
    { name: '12-preference-page', page: 'B', setup: async (page) => {
        await resetHomeChromeState(page);
        await page.click('#navPreferenceBtn');
        await page.waitForSelector('#preferenceView:not(.hidden)', { timeout: 5000 });
        // Wait for the markdown preview to render at least one signal block.
        await page.waitForSelector('#preferenceProfilePreview', { timeout: 5000 });
        await page.waitForTimeout(300);
    } },
    // View 12b — Page B — preference page, .preference-primary-btn :hover.
    // Hovers #preferenceSaveBtn so the :hover cascade fires; cascade winner
    // is the L35558 `#preferenceView .preference-primary-btn:hover {
    // transform: translateY(-1px) !important }` rule. The earlier L13985
    // rule wants -2px but is shadowed by specificity. Required by deferred
    // §3b.iv to safely delete redundant `:hover` rules.
    //
    // Cascade-arm assertion (the LOAD-BEARING check, NOT pixel diff). A
    // 1-px translateY shift on a ~120×50 px button dirties only the
    // leading + trailing edge rows ≈ 2 × 120 = 240 px ≈ 0.023% of the
    // 1280×800 frame — WAY under the 0.5% default threshold. So the
    // assert below MUST verify which cascade arm won by literal matrix
    // equality, not "any non-'none' transform". A weaker assert lets
    // §3b.iv silently swap -1px → -2px (or vice versa) past the harness.
    // The failRatio: 0.0005 (0.05%) override below catches a ~2× safety
    // margin above the 0.023% expected diff if the assert ever loosens.
    //
    // The 350ms post-hover wait lets the 150ms transform transition
    // (style.css L13969) settle into its steady-state translated frame.
    // A MASK_CSS transition-freeze was tried but contaminated lesson
    // views 21/22 (~1.3% drift) via cascade side effects that could not
    // be localized; the per-view wait is locally scoped and pixel-neutral.
    { name: '12b-preference-primary-btn-hover', page: 'B', failRatio: 0.0005, setup: async (page) => {
        // Defensive blur — view 11 already blurred composer focus, but a
        // future intervening view could leak focus state and tint the
        // captured chrome. blur is a no-op if nothing is focused.
        await page.evaluate(() => document.activeElement?.blur?.());
        // Snapshot resting transform BEFORE hover so the assert can
        // distinguish "hover landed on the right cascade arm" from
        // "page.hover silently no-op'd" (the latter would leave resting
        // unchanged). Resting computes to 'none' for this button — the
        // base .preference-primary-btn rule sets no transform.
        const before = await page.evaluate(() => {
            const btn = document.getElementById('preferenceSaveBtn');
            return btn ? getComputedStyle(btn).transform : null;
        });
        await page.hover('#preferenceSaveBtn');
        // POLL-UNTIL-SETTLED: wait for the 150ms transform transition
        // (style.css L13969) to fully settle. A fixed waitForTimeout has
        // proven flaky in WSL Chromium because mouse-event → :active
        // latency varies (observed values 0.969-0.992 at 500ms wait —
        // ease-curve tail still in flight). Polling the computed style
        // exits as soon as the transition reaches the target, so this
        // is both faster on the common case and reliable on slow runs.
        // Expected literal: 'matrix(1, 0, 0, 1, 0, -1)' from L35558's
        // translateY(-1px) !important. If a future §3b.iv delete makes
        // L13985 (translateY(-2px), non-important) the winner instead,
        // waitForFunction times out and the assertion below surfaces.
        const EXPECTED = 'matrix(1, 0, 0, 1, 0, -1)';
        await page.waitForFunction(
            (exp) => {
                const btn = document.getElementById('preferenceSaveBtn');
                return Boolean(btn) && getComputedStyle(btn).transform === exp;
            },
            EXPECTED,
            { timeout: 5000 },
        ).catch(() => {});
        const after = await page.evaluate(() => {
            const btn = document.getElementById('preferenceSaveBtn');
            return btn ? getComputedStyle(btn).transform : null;
        });
        assertOrThrow(before === 'none',
            `view 12b: #preferenceSaveBtn resting transform should be 'none' (no base transform on .preference-primary-btn) but is "${before}" — has a new base transform rule been added?`);
        assertOrThrow(after === EXPECTED,
            `view 12b: #preferenceSaveBtn :hover transform is "${after}", expected "${EXPECTED}" (L35558 cascade winner). If L35558 was deleted, L13985's translateY(-2px) becomes the winner — check the cascade.`);
    } },
    // View 12c — Page B — preference page, .preference-profile-editor :focus.
    // Focuses #preferenceProfileEditor (textarea) so the :focus cascade at
    // L35511 fires (border-color → sky-300; box-shadow → 4px sky-glow ring).
    // The 4px ring around the ~700×420 textarea covers ≈ perimeter × 4 ≈
    // 9000 px ≈ 0.88% of the frame, so the default 0.5% threshold WOULD
    // catch a full ring deletion — but a subtle alpha-channel cascade swap
    // (e.g. 0.18 → 0.16) only shifts pixel YIQ slightly and may slip
    // under 0.5%. failRatio: 0.0005 keeps the safety margin tight.
    //
    // page.mouse.move(0,0) clears view 12b's lingering hover on
    // #preferenceSaveBtn so the only state-variant visible in this frame is
    // the focused editor.
    // 500ms wait covers the 150ms box-shadow transition on
    // .preference-profile-editor (style.css cascade) + settle slack
    // (was 350ms; aligned with view 12b after observed ease-curve-tail flake).
    { name: '12c-preference-editor-focused', page: 'B', failRatio: 0.0005, setup: async (page) => {
        await page.mouse.move(0, 0);
        await page.focus('#preferenceProfileEditor');
        const focused = await page.evaluate(() => {
            const t = document.getElementById('preferenceProfileEditor');
            return Boolean(t) && document.activeElement === t;
        });
        assertOrThrow(focused, 'view 12c: #preferenceProfileEditor is not document.activeElement after page.focus()');
        await page.waitForTimeout(500);
    } },
    // View 12d — Page B — preference page, .preference-secondary-btn :hover.
    // Hovers #preferenceResetBtn (the "Reset Draft" button) to close the
    // grouped-selector blind spot left by 12b. The :hover cascade rules
    // at L13985 + L35558 group `.preference-primary-btn:hover` WITH
    // `.preference-secondary-btn:hover` — a §3b.iv refactor that splits
    // the comma list could break secondary while leaving primary intact,
    // and the harness has no view exercising secondary-btn hover otherwise.
    //
    // Cascade winner for #preferenceResetBtn:hover: L35558 (translateY
    // -1px !important) via #preferenceView ID, same as #preferenceSaveBtn.
    // Resting transform is 'none' (base .preference-secondary-btn rule at
    // L13979 sets no transform). The exact-match assert below catches a
    // cascade-arm swap the same way 12b does.
    { name: '12d-preference-secondary-btn-hover', page: 'B', failRatio: 0.0005, setup: async (page) => {
        // Move mouse to (0,0) first to clear 12c's focus chrome — that
        // view focused the textarea but the box-shadow ring is steady-
        // state and unaffected by mouse position; the move is for
        // schedule-symmetry with 12b/12c, not pixel correctness.
        await page.mouse.move(0, 0);
        const before = await page.evaluate(() => {
            const btn = document.getElementById('preferenceResetBtn');
            return btn ? getComputedStyle(btn).transform : null;
        });
        await page.hover('#preferenceResetBtn');
        // Poll until the transition settles — see view 12b for the
        // rationale (fixed wait was flaky under variable CDP latency).
        const EXPECTED = 'matrix(1, 0, 0, 1, 0, -1)';
        await page.waitForFunction(
            (exp) => {
                const btn = document.getElementById('preferenceResetBtn');
                return Boolean(btn) && getComputedStyle(btn).transform === exp;
            },
            EXPECTED,
            { timeout: 5000 },
        ).catch(() => {});
        const after = await page.evaluate(() => {
            const btn = document.getElementById('preferenceResetBtn');
            return btn ? getComputedStyle(btn).transform : null;
        });
        assertOrThrow(before === 'none',
            `view 12d: #preferenceResetBtn resting transform should be 'none' but is "${before}"`);
        assertOrThrow(after === EXPECTED,
            `view 12d: #preferenceResetBtn :hover transform is "${after}", expected "${EXPECTED}" (L35558 secondary-btn cascade arm)`);
    } },
    // View 12e — Page B — preference page, .preference-primary-btn :active.
    // Closes the v4 harness blind spot flagged in docs/phase3_deferred.md
    // §3b.iv.followup gap 1: PR #79 deleted L13998's :active block on
    // cascade-shadow analysis only — there was no pixel-verifiable
    // :active view. A future delete or reorder of L35463-L35469 (now
    // the SOLE :active rule for these buttons after #79) would silently
    // regress mousedown chrome.
    //
    // Cascade reality at edit time: L13998 is GONE; L35463-L35469 is the
    // ONLY .preference-primary-btn:active rule in app/style.css. Delete it
    // and `:active` matches no rule → transform stays 'none' through
    // mousedown, distinguishable from the EXPECTED matrix.
    //
    // mouse.move(0,0) clears view 12d's hover on #preferenceResetBtn so
    // the only cascade arm exercised here is :active on #preferenceSaveBtn.
    // A 350ms wait covers the 150ms transform-transition reversal on
    // reset-btn (style.css L13969) before snapshotting the resting frame.
    //
    // page.mouse.down() simulates the physical button press and keeps
    // `:active` matching across the screenshot frame (setup → screenshot
    // happens in that order; the mouse stays down through capture).
    // View 13 defensively releases at entry (see its setup).
    //
    // failRatio: 0.0005 keeps the chrome-recolor safety margin tight —
    // L35463 also sets a different box-shadow recipe; a partial cascade
    // collapse that drops only one !important could slip a 1-2 px shadow
    // shift under the default 0.5%.
    { name: '12e-preference-primary-btn-active', page: 'B', failRatio: 0.0005, setup: async (page) => {
        await page.mouse.move(0, 0);
        await page.waitForTimeout(350);
        const before = await page.evaluate(() => {
            const btn = document.getElementById('preferenceSaveBtn');
            return btn ? getComputedStyle(btn).transform : null;
        });
        // Position the cursor over #preferenceSaveBtn — page.hover() also
        // arms the :hover cascade (L35458 → translateY(-1px)). page.mouse
        // .down() then ADDS :active (L35463 → translateY(1px)). On a
        // matching element, :active wins over :hover via source order
        // (L35463 is after L35458). Capturing this layered state is the
        // realistic mousedown frame.
        await page.hover('#preferenceSaveBtn');
        await page.mouse.down();
        // Poll until the :active transition settles — see view 12b for
        // the rationale. The :hover → :active transition has the same
        // 150ms duration but CDP latency for the mousedown event has
        // shifted the observed flake values (0.969-0.992 at 500ms).
        // Expected literal: L35463's translateY(1px) !important wins over
        // L35458's :hover translateY(-1px). If L35463 is deleted with no
        // replacement, the :hover rule wins → 'matrix(1, 0, 0, 1, 0, -1)'.
        // If both are deleted, falls through to base 'none'.
        const EXPECTED = 'matrix(1, 0, 0, 1, 0, 1)';
        await page.waitForFunction(
            (exp) => {
                const btn = document.getElementById('preferenceSaveBtn');
                return Boolean(btn) && getComputedStyle(btn).transform === exp;
            },
            EXPECTED,
            { timeout: 5000 },
        ).catch(() => {});
        const after = await page.evaluate(() => {
            const btn = document.getElementById('preferenceSaveBtn');
            return btn ? getComputedStyle(btn).transform : null;
        });
        assertOrThrow(before === 'none',
            `view 12e: #preferenceSaveBtn resting transform should be 'none' (no base transform on .preference-primary-btn) but is "${before}" — has a new base transform rule been added?`);
        assertOrThrow(after === EXPECTED,
            `view 12e: #preferenceSaveBtn :active transform is "${after}", expected "${EXPECTED}" (L35463 cascade winner). If L35463 was deleted, :hover's translateY(-1px) becomes the winner — check the cascade.`);
    } },
    // View 13 — Page B — course tracker resting state.
    { name: '13-course-tracker', page: 'B', setup: async (page) => {
        // Defensive mouse.up() — view 12e leaves the primary button
        // pressed to capture :active across the screenshot. Without
        // this release, the subsequent #navCourseTrackerBtn click
        // would dispatch into a held-down mouse state that some
        // Playwright internals treat inconsistently across Chromium
        // releases. The .catch swallows the "mouse is not down"
        // error if a future schedule edit removes view 12e.
        await page.mouse.up().catch(() => {});
        await page.click('#navCourseTrackerBtn');
        await page.waitForSelector('#courseTrackerView:not(.hidden)', { timeout: 5000 });
        // Tracker timeline renders synchronously from COURSE_SCHEDULE — wait
        // for at least one .course-timeline-item article (the body is a div,
        // not a <table>, so we walk children rather than `tr`).
        await page.waitForFunction(
            () => document.querySelectorAll('#courseTrackerTableBody .course-timeline-item').length > 0,
            { timeout: 5000 }
        );
        await page.waitForTimeout(200);
    } },
    // ----- Page A (continued — lesson chrome class flips) -----
    // View 15 — Page A — forces learnBody.classList.add('chapter-overview-active')
    // to flip the `:not(.chapter-overview-active)` negation that 30+ #20a rules
    // toggle against. Runs after view 09 (qa-full state) — uses
    // resetLessonChromeState to recover.
    { name: '15-lesson-chapter-overview', page: 'A', setup: async (page) => {
        await resetLessonChromeState(page);
        await page.evaluate(() => {
            document.getElementById('learnBody')?.classList.add('chapter-overview-active');
        });
        await page.waitForTimeout(300);
    } },
    // View 16 — Page A — forces learnBody.classList.add('chapter-overview-split-active')
    // — companion to view 15, exercises the split-active class negations.
    // resetLessonChromeState removes chapter-overview-active from view 15
    // before adding split-active so the captures stay distinct.
    { name: '16-lesson-chapter-overview-split', page: 'A', setup: async (page) => {
        await resetLessonChromeState(page);
        await page.evaluate(() => {
            document.getElementById('learnBody')?.classList.add('chapter-overview-split-active');
        });
        await page.waitForTimeout(300);
    } },
    // Views 17t/17f — Page A — A4 §S14 PRECONDITION: the tall-content combined
    // overview+textbook witness (task 06-29-a4-s14-tall-witness). These are the
    // ONLY views that drive `#learnBody.chapter-overview-active.learn-textbook-active`
    // (Band-2, style.css L24575-24609). They render a SYNTHETIC fixed-height
    // `.textbook-pages-flow` (no production fn / no /api prelude / no real-scan
    // decode) so the two at-risk Band-2 doubled-ID decls become observable:
    //   (a) #learnExplainScroll height:100% (L24577) — only with OVERFLOW
    //   (b) .textbook-pages-flow min-height:100% + padding-bottom (L24598-24599)
    // The rigorous offset-box witness is the arbiter (_view-cascade-probe.js, scroll-
    // invariant offsetHeight); these visual-diff views are the human-visible catch-
    // all. enterTextbookOverflowState() fails closed if the combined classes aren't
    // set, Band-2 isn't the live winner (padding-bottom != 64px @800h), or the
    // overflow/fill precondition isn't met. resetLessonChromeState (extended for
    // this task) tears the state down for the next Page A view (view 20 resets).
    //
    // 17t (tall): content >> container; scroll #learnExplainScroll to the bottom so
    // the last card + the Band-2 padding-bottom whitespace (the visible signal of
    // decl (b)) is in frame — fullPage:false clips to 1280x800 and only the inner
    // container overflows, so we bring the bottom into the viewport (view-14c
    // pattern) and assert it before screenshot. failRatio 0.0005: synthetic solid
    // cards carry ~0 AA noise; deleting padding-bottom shifts the last-card bottom
    // band (~24px × 680px ≈ 1.6% of frame) far above this floor — calibrated post-
    // baseline.
    { name: '17t-textbook-overview-tall', page: 'A', failRatio: 0.0005, setup: async (page) => {
        await enterTextbookOverflowState(page, { variant: 'tall' });
        const probe = await page.evaluate(() => {
            const scroll = document.getElementById('learnExplainScroll');
            // Force INSTANT scroll — #learnExplainScroll inherits scroll-behavior:smooth,
            // so `scrollTop = …` would animate and read back ~0 (view-14c documents the
            // same trap). scrollTo({behavior:'instant'}) + style override pins it now.
            scroll.style.scrollBehavior = 'auto';
            scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'instant' });
            const flow = scroll.querySelector('.textbook-pages-flow');
            const cards = flow ? flow.querySelectorAll('.textbook-page-card') : [];
            const last = cards.length ? cards[cards.length - 1] : null;
            const sr = scroll.getBoundingClientRect();
            const lr = last ? last.getBoundingClientRect() : null;
            return {
                atBottom: Math.abs((scroll.scrollTop + scroll.clientHeight) - scroll.scrollHeight) <= 2,
                lastBottomInView: lr ? (lr.bottom <= sr.bottom + 1 && lr.bottom >= sr.top) : false,
                probe: { cards: cards.length, lastBottom: lr ? Math.round(lr.bottom) : null, scrollBottom: Math.round(sr.bottom) },
            };
        });
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        assertOrThrow(probe.atBottom,
            `view 17t: did not pin #learnExplainScroll to the bottom; ${JSON.stringify(probe.probe)}`);
        assertOrThrow(probe.lastBottomInView,
            `view 17t: last card bottom not inside the scroll viewport after scroll-to-bottom (padding-bottom band off-screen); ${JSON.stringify(probe.probe)}`);
    } },
    // 17f (fill): content < container so Band-2 min-height:100% pads the flow box UP
    // to fill (inert on overflowing content). The rigorous witness for min-height:100%
    // is the arbiter's .textbook-pages-flow offsetHeight (transparent bgs make the
    // pixel delta sub-threshold); this view is the render-neutrality catch-all for
    // the fill DOM state. Scroll pinned to top.
    { name: '17f-textbook-overview-fill', page: 'A', failRatio: 0.0005, setup: async (page) => {
        await enterTextbookOverflowState(page, { variant: 'fill' });
        await page.evaluate(() => { document.getElementById('learnExplainScroll').scrollTop = 0; });
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    } },
    // ----- Page C (Chapter 2+ family-routed lessons) -----
    // View 17 — Page C — Chapter 3 §3.8-1 with hard-asserted family routing
    // to convolution_lab. Tries candidates in PAGE_C_VIEWS[0].candidates
    // in order; on success the chosen section ID + asserted family are
    // written to tools/visual-diff-coverage.json + the dispatcher-coverage
    // report block. Page C bootstrap (enterGuestMode) already ran for the
    // first candidate — runPageCView handles the re-enter for the rest.
    {
        name: '17-lesson-convolution', page: 'C',
        setup: async (page) => runPageCView(page, '17-lesson-convolution'),
    },
    // View 18 — Page C — Chapter 4 §4.11-1 with hard-asserted family routing
    // to pole_zero_roc_lab. Page C is sticky from view 17 — runPageCView
    // sees this page in pageCSeeded and re-enters guest mode cleanly.
    {
        name: '18-lesson-pole-zero-roc', page: 'C',
        setup: async (page) => runPageCView(page, '18-lesson-pole-zero-roc'),
    },
    // ----- Phase 3.5 v2 (Glass coverage for Step G.3 / Phase 2 #19) -----
    //
    // The 18-view harness left 7 distinct Glass banner clusters uncovered:
    // FINAL LOGIN LIQUID GLASS (L43321+), FINAL COLLAPSED SIDEBAR GLASS FIX
    // (L43241+), ABSOLUTE EOF KEY TAKEAWAYS GLASS LOCK (L39295+), ABSOLUTE
    // EOF QUICK CHECK GLASS LOCK (L39494+), TEXTBOOK FOCUS GLASS LOCK
    // (L42981+), ANSWER WORKSPACE LIQUID GLASS (L41934+), and TRUE EOF QUICK
    // SETUP GLASS MODAL (L40258+). Key Takeaways and Quick Check live on
    // SEPARATE KP pages — the lesson parser at parseLessonKnowledgePoints
    // (app.js L2179, L2200) produces a 'summary' KP (containing
    // .learn-key-takeaways-list) followed by a 'quiz' KP (containing
    // #testBannerCard), so each banner needs its own view + screenshot.
    // Adding the 7 views below brings every Phase 2 #19 banner under pixel-
    // diff so Glass + chapter-overview CSS extraction can ship without
    // banner-by-banner hand-walking.

    // ----- Page D (pre-guest login surface) -----
    // View 19 — Page D — login card visible (intro dismissed, guest not
    // entered). Covers FINAL LOGIN LIQUID GLASS banner at app/style.css
    // L43321+ + .login-* tokens at L43326+. The login Three.js cosmos
    // canvas (#loginWebglContainer) is masked via MASK_CSS so the per-run
    // particle seed cannot drift.
    { name: '19-login-screen', page: 'D', setup: async (page) => {
        // initLoginExperience() may schedule a rAF/tilt setup; settle a
        // couple frames + 200ms slack before capture.
        await page.evaluate(() => new Promise(r =>
            requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.waitForTimeout(200);
        const visible = await page.evaluate(() =>
            !document.getElementById('loginView')?.classList.contains('hidden')
        );
        assertOrThrow(visible, 'view 19: #loginView is still hidden after enterLoginView');
    } },
    // ----- Page A continued (lesson chrome class flips + lesson tail) -----
    // View 20 — Page A — force `.app.sidebar-collapsed` + `#leftSidebar.collapsed`
    // per setWorkspaceSidebarCollapsed (app.js L7443) so the FINAL COLLAPSED
    // SIDEBAR GLASS FIX cluster at L43241+ is exercised. resetLessonChromeState
    // strips view 15/16's `.chapter-overview-active*` classes so the underlying
    // lesson layout doesn't bleed in. Reversible cleanup not required — view
    // 21 is the next Page A view and does its own state reset.
    // A3 gate witness (task 07-03-a3-gate-witness) — R4: tight failRatio. The
    // collapsed-sidebar chrome (icons + the FINAL COLLAPSED SIDEBAR GLASS FIX
    // cluster) is a small fraction of the frame; a single-rule collapse-arm flip
    // would hide under the 0.5% default. 0.0005 (0.05%) = 512px. Adding
    // `.sidebar-collapsed` fires the .sidebar (width/transform) + .main (margin)
    // 0.4s transitions (style.css L6913/L6921); settleLesson's waits happen to
    // outlast 400ms today, but that is wall-clock luck — a mid-transition capture
    // on the full-frame slide would blow the tight budget under load, so setup
    // calls getAnimations().finish() to jump the transitions to their end state,
    // making the capture transition-independent. CALIBRATED: 3 baseline-vs-
    // baseline runs each measured 0/1024000 (0.000%).
    { name: '20-sidebar-collapsed', page: 'A', failRatio: 0.0005, setup: async (page) => {
        await resetLessonChromeState(page);
        await page.evaluate(() => {
            document.querySelector('.app')?.classList.add('sidebar-collapsed');
            document.getElementById('leftSidebar')?.classList.add('collapsed');
        });
        // Jump the collapse transitions straight to their settled end state
        // (see the CALIBRATED note above) so timing/scheduler jitter cannot
        // land the screenshot mid-slide.
        await finishAnimations(page);
        await page.evaluate(() => new Promise(r =>
            requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.waitForTimeout(200);
    } },
    // View 21 — Page A — paginate to the SUMMARY KP page (where
    // parseLessonKnowledgePoints at app.js L2179-2192 emits a {type:
    // 'summary', title: '📌 Key Takeaways'} block containing the bullet
    // list that decorateLectureContent later promotes to
    // `.learn-key-takeaways-list`). Covers ABSOLUTE EOF KEY TAKEAWAYS
    // GLASS LOCK at style.css L39295+. View 20 left the sidebar collapsed;
    // reset before pagination so the lesson chrome lines up with the views
    // 06-09 baselines.
    { name: '21-lesson-key-takeaways', page: 'A', setup: async (page) => {
        await resetLessonChromeState(page);
        await page.evaluate(() => {
            document.querySelector('.app')?.classList.remove('sidebar-collapsed');
            document.getElementById('leftSidebar')?.classList.remove('collapsed');
        });
        await advanceLessonUntil(page, '.learn-key-takeaways-list');
    } },
    // View 22 — Page A — continue paginating from view 21 (which left the
    // pager on the summary KP) to the FINAL "quiz" KP where
    // buildLessonTestBannerHtml emits `#testBannerCard`. Covers ABSOLUTE
    // EOF QUICK CHECK GLASS LOCK at style.css L39494+. The Quick Check
    // banner is rendered with inline `margin-top:40px` so end-aligned
    // scrollIntoView lifts the full banner into the 800px viewport.
    { name: '22-lesson-quick-check', page: 'A', setup: async (page) => {
        await advanceLessonUntil(page, '#testBannerCard');
        await page.evaluate(() => {
            document.getElementById('testBannerCard')?.scrollIntoView({
                block: 'end', behavior: 'instant',
            });
        });
    } },
    // View 26 — Page A — FLOW view. Bounds the B4 lesson-render.js
    // extraction by exercising the KP pager engine through real clicks:
    // page-frame data-lesson-page must change, prev/next disabled state
    // must update, the 720ms page-turn animation lock must resolve so
    // the second click registers. Covers B4 §6 (renderCurrentKnowledgePoint)
    // + §11 (runLearnPageTurn) + KP-state writes
    // (learnKnowledgePoints / currentKnowledgePointIndex).
    //
    // Placement rationale: AFTER view 22 (which leaves the lesson at the
    // final 'quiz' KP via advanceLessonUntil). Inserting view 26 between
    // view 20 and 21 instead perturbed views 21-22 baselines because the
    // correct hardened flow leaves the lesson at KP 2, while the
    // original baselines were taken with view 21 starting at KP 0
    // (post-view-06 state). Running view 26 LAST among Page A lesson
    // views removes that coupling — only view 23 (textbook-focus modal
    // overlay) and view 03b (mistake-notebook) come after, and neither
    // reads lesson chrome / KP state.
    //
    // Setup: reset chrome state, clear sidebar-collapsed from view 20,
    // rewind pager from view 22's final-KP state back to KP 0 via a
    // waitForFunction-gated prev-loop (gates the 720ms animation lock so
    // iterations aren't burned on no-op clicks).
    //
    // failRatio CALIBRATED: 3 baseline runs all measured 0.000% noise
    // (the screenshot at KP 2 is fully settled — settle:'lesson' fires
    // font rasterization + MathJax typesetting before capture). Default
    // would be 0.500%; we tighten to 0.100% — comfortably above the
    // 0.061% lesson-AA noise floor recorded for views 06-08 (in case
    // future Chromium drift surfaces AA jitter on this view too) but
    // 5x tighter than default so a real KP-render regression surfaces.
    { name: '26-kp-pager-advance', page: 'A', failRatio: 0.001,
      setup: async (page) => {
        await resetLessonChromeState(page);
        await page.evaluate(() => {
            document.querySelector('.app')?.classList.remove('sidebar-collapsed');
            document.getElementById('leftSidebar')?.classList.remove('collapsed');
            // Defensive: clear any stale stash from a hypothetical prior
            // run of view 26 on the same shared Page A. Page A persists
            // across all views per pageMap cache; step 1's assert is the
            // only writer today, but if step 1 ever early-returns without
            // writing (e.g. transient empty framePage on a B4 regression),
            // step 2 could otherwise compare against a stale value.
            try { delete window.__ftutorFlowKp1Page; } catch (_) {}
        });
        // Rewind to KP 0. Mirrors advanceLessonUntil's pattern: capture
        // current data-lesson-page, click prev, wait for the value to
        // CHANGE (gates the 720ms learn-page-turn-active animation lock
        // — a 150ms waitForTimeout undershoots the lock and burns
        // iterations on no-op clicks). Bounded to 25 iterations.
        for (let i = 0; i < 25; i++) {
            const prevPage = await page.evaluate(() =>
                document.querySelector('#learnExplainContent .lesson-page-frame')
                    ?.getAttribute('data-lesson-page') || '');
            const clicked = await page.evaluate(() => {
                const btn = document.querySelector('#learnKpPrevBtn:not([disabled])');
                if (!btn) return false;
                btn.click();
                return true;
            });
            if (!clicked) break;
            await page.waitForFunction(
                ({ prev }) => {
                    const cur = document.querySelector('#learnExplainContent .lesson-page-frame')
                        ?.getAttribute('data-lesson-page');
                    return Boolean(cur) && cur !== prev;
                },
                { prev: prevPage },
                { timeout: 2000 },
            ).catch(() => {});
        }
        // Wait for the LAST rewind animation to clear before the flow
        // begins. Without this, step 0's settle:'rAF' lets step 1's
        // click fire while isLearnPageTurning is still true (animation
        // clears at +540ms after the rewind's last click) — the click
        // silently no-ops and step 1's assert times out.
        await page.waitForFunction(
            () => !document.querySelector('#learnExplainContent.learn-page-turn-active'),
            null,
            { timeout: 2000 },
        ).catch(() => {});
      },
      flow: { steps: [
        // Step 0 — assert pager is at KP 0 BEFORE any flow click. prev
        // disabled / next enabled is the canonical first-page contract
        // emitted by renderCurrentKnowledgePoint (app.js L2172-2173).
        {
            name: 'assert-pager-at-kp-0',
            action: async () => {},
            assert: async (p) => p.evaluate(() => {
                const prev = document.getElementById('learnKpPrevBtn');
                const next = document.getElementById('learnKpNextBtn');
                return prev?.disabled === true && next?.disabled === false;
            }),
            settle: 'rAF',
            timeoutMs: 3000,
        },
        // Step 1 — first KP advance. Asserts (a) prev enabled (KP-state
        // write fired) AND (b) stashes KP 1's data-lesson-page so step 2
        // can prove the frame VALUE changes (not just exists). Without
        // the stash, a B4 regression that leaves KP 1's frame in DOM but
        // doesn't re-emit a new one would pass step 2.
        {
            name: 'click-next-advance-from-kp-0',
            action: async (p) => {
                const ok = await p.evaluate(() => {
                    const btn = document.querySelector('#learnKpNextBtn:not([disabled])');
                    if (!btn) return false;
                    btn.click();
                    return true;
                });
                if (!ok) throw new Error('next button unexpectedly disabled at KP 0');
            },
            assert: async (p) => p.evaluate(() => {
                const prev = document.getElementById('learnKpPrevBtn');
                const frame = document.querySelector('#learnExplainContent .lesson-page-frame');
                const framePage = frame?.getAttribute('data-lesson-page');
                if (prev?.disabled !== false || !framePage) return false;
                window.__ftutorFlowKp1Page = framePage;
                return true;
            }),
            settle: 'lesson',
            timeoutMs: 4000,
        },
        // Step 2 — second KP advance. Asserts (a) prev enabled, (b)
        // data-lesson-page DIFFERS from step 1's stash (proves
        // renderCurrentKnowledgePoint re-emitted a NEW frame, not just
        // left the old one in DOM). Bounds B4 §11 page-turn AND the
        // KP-render write-through.
        //
        // The action waits for step 1's page-turn animation to clear
        // before clicking — moveLearnKnowledgePoint (app.js L2429)
        // early-returns while isLearnPageTurning is true, so a click
        // mid-animation is a silent no-op and the stale-frame assert
        // would never pass. The wait is bounded to 2s (lock clears at
        // +540ms after a click).
        {
            name: 'click-next-advance-from-kp-1',
            action: async (p) => {
                await p.waitForFunction(
                    () => !document.querySelector('#learnExplainContent.learn-page-turn-active'),
                    null,
                    { timeout: 2000 },
                ).catch((err) => {
                    // Don't throw — let the downstream stale-frame assert
                    // surface the failure. But log so a B4 regression in
                    // clearLearnPageTurnClasses (which fires the 720ms
                    // timeout at app.js L2334+) is debuggable without
                    // chasing the KP-render path first.
                    console.warn(`[flow:26-kp-pager-advance] learn-page-turn-active never cleared within 2000ms: ${err?.message || err}`);
                });
                const ok = await p.evaluate(() => {
                    const btn = document.querySelector('#learnKpNextBtn:not([disabled])');
                    if (!btn) return false;
                    btn.click();
                    return true;
                });
                if (!ok) throw new Error('next button unexpectedly disabled at KP 1');
            },
            assert: async (p) => p.evaluate(() => {
                const prev = document.getElementById('learnKpPrevBtn');
                const frame = document.querySelector('#learnExplainContent .lesson-page-frame');
                const framePage = frame?.getAttribute('data-lesson-page');
                const kp1Page = window.__ftutorFlowKp1Page;
                return prev?.disabled === false
                    && Boolean(framePage)
                    && (!kp1Page || framePage !== kp1Page);
            }),
            settle: 'lesson',
            timeoutMs: 4000,
        },
      ] },
    },
    // View 23 — Page A — show `#textbookFocusModal` + add body class
    // `textbook-focus-active`. The TEXTBOOK FOCUS GLASS LOCK cluster at
    // style.css L42981+ uses `#textbookFocusModal#textbookFocusModal`
    // doubled-ID selectors gated by the modal's `:not(.hidden)` state, not
    // the body class — the body class is only needed by L3110-3111 to hide
    // the floating learn-chat-fab. Both are set so the captured frame
    // mirrors the production state. §1.1-1 has no `#learnBookOverlay`
    // images registered, so openTextbookFocusMode (textbook-focus.js) can't run;
    // inject a single 1×1 placeholder so the dialog's scroll body isn't
    // empty (MASK_CSS hides the raster).
    { name: '23-textbook-focus', page: 'A', setup: async (page) => {
        await page.evaluate(() => {
            const modal = document.getElementById('textbookFocusModal');
            const content = document.getElementById('textbookFocusContent');
            const indicator = document.getElementById('textbookFocusPageIndicator');
            if (!modal || !content) return;
            document.body.classList.add('textbook-focus-active');
            modal.classList.remove('hidden');
            // 1×1 transparent PNG keeps the <img> a valid resource (no broken-
            // image glyph) while MASK_CSS hides the rendered pixels.
            const placeholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFBAJ/wlseKgAAAABJRU5ErkJggg==';
            content.innerHTML = `
                <div class="textbook-focus-scroll">
                    <div class="textbook-focus-scroll-page">
                        <img class="textbook-focus-single-page" src="${placeholder}" alt="mock page">
                    </div>
                </div>
            `;
            if (indicator) indicator.textContent = '1 / 1';
        });
    } },
    // ----- Page B continued (Home Ask overlays) -----
    // View 24 — Page B — show `#answerScreen` (class `.answer hidden`) with
    // stubbed `#answerContent` so the ANSWER WORKSPACE LIQUID GLASS cluster
    // at L41934+ is exercised without making an LLM call. Mirrors showAnswer
    // (app.js L6080) including the topbar.classList.remove('hidden') flip
    // so the captured frame matches the production Glass surface (topbar
    // sits above the answer panel in real use). destroyLoginScene() is
    // skipped because Page B never entered the login flow. Close the sibling
    // panels that showAnswer also hides before exposing the answer workspace.
    { name: '24-answer-workspace', page: 'B', setup: async (page) => {
        // Defensive mouse park (Phase 3.5 v4 §3b.iv harness expansion finding):
        // make view 24 self-defensive about mouse position so its baseline is
        // robust against any upstream Page B view that leaves the cursor over
        // a hoverable element. Park at (0, 0) before changing panel visibility.
        await page.mouse.move(0, 0);
        await page.evaluate(() => {
            document.getElementById('preferenceView')?.classList.add('hidden');
            document.getElementById('courseTrackerView')?.classList.add('hidden');
            document.getElementById('mistakeNotebookView')?.classList.add('hidden');
            document.getElementById('settingsView')?.classList.add('hidden');
            document.getElementById('learnView')?.classList.add('hidden');
            document.getElementById('welcomeScreen')?.classList.add('hidden');
            const topbar = document.getElementById('topbar');
            topbar?.classList.remove('hidden');
            const ans = document.getElementById('answerScreen');
            const content = document.getElementById('answerContent');
            if (content) {
                content.innerHTML = `
                    <div class="kc-summary"><p>Phase 3.5 v2 harness placeholder.</p>
                    <p>Glass workspace pixel-diff target.</p></div>
                `;
            }
            ans?.classList.remove('hidden');
        });
    } },
    // View 25 — Page B — force `#quizOverlay` to display:flex per
    // index.html L1388 (inline style="display:none"). Covers TRUE EOF
    // QUICK SETUP GLASS MODAL at L40258+. The chrome (card, title, backdrop
    // blur) is captured; the per-step option-chip descendants rendered by
    // renderQuizStep (app.js L271) are NOT — see docs/phase3_deferred.md
    // §7d.12 for the deferred follow-up. Previous view 24 left
    // #answerScreen visible — the overlay's full-viewport backdrop covers
    // it so cascade noise from beneath is not a concern.
    { name: '25-quick-setup-modal', page: 'B', setup: async (page) => {
        await page.evaluate(() => {
            const overlay = document.getElementById('quizOverlay');
            if (overlay) overlay.style.display = 'flex';
        });
        await page.waitForSelector('#quizOverlay', { timeout: 3000, state: 'visible' });
    } },
    // View 29 — Page B — RECENT-CONVERSATIONS RESTORE flow gate.
    // Seeds a fake learn-origin session into localStorage's
    // `tutorRecentSessions` (recent-conversations.js L262) and calls the
    // exposed `window.loadHistoricalSession(timestamp)` (L539) to restore
    // it. Bounds the cross-module restore surface that B4 lesson-render.js
    // extraction will rely on: `setLearnLessonContent` + `renderLearnPages`
    // are external callers of the moved engine (B4 plan §"External callers").
    //
    // Why Page B (not Page A): per HARNESS_INTERACTIVE_PLAN.md
    // §"Deferred sibling flow views", Page A is sticky on 1.1-1 and a
    // restore-then-reopen flow would conflict with view 26's KP cursor.
    //
    // Placement: AFTER view 25 (the last Page B view today, quizOverlay).
    // View 29's setup defensively hides every sibling view before triggering
    // the restore so no upstream Page B chrome bleeds into the screenshot.
    // After view 29, Page B is left in learn-view state; view 03b is Page A
    // (different page) so the bleed-forward concern doesn't apply. The setup
    // tail ALSO removes the seeded `tutorRecentSessions` key — a future
    // Page B view appended after 29 would otherwise inherit the seeded
    // session in the sidebar's recent-conversations list.
    //
    // Assertion strategy (resolves the HARNESS_INTERACTIVE_PLAN.md blocker
    // for this view): text content is masked by MASK_CSS, so we gate on
    // STRUCTURAL markers — #learnView un-hidden AND #learnExplainContent
    // has rendered HTML. The seeded markdown is intentionally MathJax-free
    // (no $...$, no $$) and demo-free (no ```interactive ... ```) so the
    // rendered DOM settles synchronously after markdownToHtml.
    //
    // Settle order:
    //   1. structural gate (#learnView + #learnExplainContent)
    //   2. document.fonts loaded
    //   3. fixed 300ms beyond renderCurrentKnowledgePoint's 60ms setTimeout
    //      tail (app.js: MathJax typeset + buildTocFromContent + scroll
    //      reset) so the sidebar TOC is finalized before the screenshot
    //
    // failRatio 0.001 (CALIBRATED: 3 baseline runs all measured 0.000%
    // noise). Held above the 0.061% lesson-AA floor in case future
    // Chromium AA drift surfaces on this view; 5x tighter than the
    // 0.500% default so a real restore regression surfaces.
    //
    // Source-of-truth for the seeded session shape: the `currentSession`
    // object literal inside `saveCurrentLearnSession` in
    // app/recent-conversations.js (around L509). If that schema gains a
    // required field, the seed below must add it.
    { name: '29-recent-conversations-restore', page: 'B', failRatio: 0.001, setup: async (page) => {
        await page.mouse.move(0, 0);
        // Single round-trip: clear sibling chrome AND seed AND trigger the
        // restore. Keeps the setup atomic (no microtask interleaving between
        // chrome-hide and the seed visible to the page).
        await page.evaluate(() => {
            const overlay = document.getElementById('quizOverlay');
            if (overlay) overlay.style.display = 'none';
            ['answerScreen','preferenceView','courseTrackerView',
             'mistakeNotebookView','settingsView','welcomeScreen','loginView']
                .forEach(id => document.getElementById(id)?.classList.add('hidden'));
            const SEEDED_TS = 1700000000000;
            // Synthetic sectionId — chosen so no current or future regex
            // (e.g. forceB8TextbookOnlyLesson's `\bB\.8\b(?!-\d)` or any
            // future section-range gate) can accidentally match and
            // replace the seeded markdown.
            const SEEDED_SECTION = 'harness-probe-29';
            const SEEDED_TITLE = 'Harness Restore Probe';
            const SEEDED_MD = '# Harness Restore Probe\n\nThis lesson is seeded by view 29 to exercise the recent-conversations restore path (recent-conversations.js loadHistoricalSession at L539). The harness asserts the learn view becomes visible and #learnExplainContent receives the rendered markdown.\n\n## Second section\n\nA second paragraph for a stable two-block layout — no MathJax, no interactive demos, so the rendered DOM settles synchronously.';
            const session = {
                id: `${SEEDED_SECTION}-${SEEDED_TS}`,
                origin: 'learn',
                title: SEEDED_TITLE,
                summaryTitle: SEEDED_TITLE,
                customTitle: '',
                starred: false,
                timestamp: SEEDED_TS,
                sectionId: SEEDED_SECTION,
                sectionTitle: SEEDED_TITLE,
                lessonMarkdown: SEEDED_MD,
                bookPages: [],
                webSources: [],
                attachments: [],
                history: [],
            };
            localStorage.setItem('tutorRecentSessions', JSON.stringify([session]));
            window.loadHistoricalSession(SEEDED_TS);
        });
        // Structural gate (see header note re: assertion strategy).
        await page.waitForFunction(
            () => {
                const v = document.getElementById('learnView');
                const c = document.getElementById('learnExplainContent');
                return Boolean(v) && !v.classList.contains('hidden')
                    && Boolean(c) && c.innerHTML.trim().length > 0;
            },
            null,
            { timeout: 5000 },
        );
        await page.waitForFunction(
            () => document.fonts && document.fonts.status === 'loaded',
            null,
            { timeout: 3000 },
        ).catch(() => {});
        // Cover renderCurrentKnowledgePoint's 60ms setTimeout tail
        // (MathJax typeset no-op for our markdown + buildTocFromContent
        // + scroll reset). 300ms is comfortably past that tail.
        await page.waitForTimeout(300);
        // Clear the seeded key so any future Page B view appended after
        // view 29 doesn't inherit the probe session.
        await page.evaluate(() => {
            try { localStorage.removeItem('tutorRecentSessions'); } catch (_) {}
        });
    } },
    // ----- Phase 3.5 v3 — late-Page-A state-variant captures -----
    // View 03b — Page A — OPENED mistake-case workspace (Phase 3.5 v3 §9c
    // gap 1). Seeds localStorage with a fixture mistake and navigates back
    // to mistake-notebook so mistakeDetailContent unhides and
    // .mistake-workspace renders.
    //
    // SCHEDULING (LAST on Page A schedule, not adjacent to view 03):
    // Root cause traced — view 04-recent-conversations' setup tries to
    // close mistake-notebook via #mistakeNotebookCloseBtn, but that button
    // is hidden by the doubled-ID rule at style.css L34394
    // (display/visibility/width all forced to 0 via !important). The click
    // silently times out (.catch consumes the error) and view 04 captures
    // mistake-notebook IN WHATEVER STATE IT WAS LEFT IN, plus the sidebar
    // recent-accordion open. With view 03 preceding view 04, mistake-notebook
    // is empty (#mistakeEmptyPanel) — that's the baseline. If view 03b
    // preceded view 04, mistake-notebook would be populated (.mistake-workspace
    // with #mistakeDetailContent unhidden), causing a ~4.2% pixel diff on
    // view 04's "mistake-notebook empty + recent panel open" baseline.
    // Running 03b AFTER all other Page A views means no Page A view inherits
    // the populated state. View 04's broken close-button click is documented
    // there (kept as-is — fixing it would shift the baseline significantly
    // and is out of scope for the harness expansion track).
    //
    // Naming kept as 03b (not 26 or higher) per the NN[a-z] convention —
    // the suffix communicates "state-variant of 03" regardless of schedule
    // position. The schedule-position decision is documented here so a
    // future contributor doesn't naively move it back adjacent to 03.
    //
    // INVARIANT for future contributors adding any view that seeds
    // aquariusMistakeNotebook.v1:
    //   1. MUST clear the key in own setup() prologue (defensive)
    //   2. MUST run AFTER view 04 (so view 04's broken-close-button
    //      capture sees empty mistake-notebook, not populated)
    //   3. SAFEST: append to the END of the Page A schedule. Mid-schedule
    //      placement requires AUDIT of every subsequent Page A view's
    //      assumptions about mistake-notebook state.
    //
    // Retroactively pixel-verifies PR #65's `.mistake-workspace`
    // (display + grid-template-columns) and `.mistake-note-columns`
    // (min-height + height + grid-template-rows) deletions. The
    // `.mistake-ai-instruction min-height: 94px` deletion in PR #65 is
    // an orphan selector (no DOM ever matches `.mistake-ai-instruction`
    // — verified by grep against index.html + app.js + mistake-notebook.js)
    // and cannot be pixel-validated by any harness coverage.
    { name: '03b-mistake-notebook-open-case', page: 'A', setup: async (page) => {
        // Page A teardown for prior-view state. Uses the shared
        // resetLessonChromeState helper (clears learnBody.dataset.panelFocus
        // from views 08/09, chapter-overview* classes from views 15/16)
        // PLUS the textbook-focus + sidebar-collapsed flips that views 23
        // and 20 leave around. resetLessonChromeState alone is not enough —
        // it doesn't touch textbook-focus or sidebar-collapsed (those are
        // owned by setWorkspaceSidebarCollapsed + openTextbookFocusMode,
        // not the lesson-chrome subsystem).
        await resetLessonChromeState(page);
        await page.evaluate(() => {
            document.body.classList.remove('textbook-focus-active');
            document.getElementById('textbookFocusModal')?.classList.add('hidden');
            document.querySelector('.app')?.classList.remove('sidebar-collapsed');
            document.getElementById('leftSidebar')?.classList.remove('collapsed');
        });
        // Seed mistake fixture + re-open notebook from the lesson surface
        // we landed on after view 22. navMistakeNotebookBtn → showMistakeNotebookView.
        await page.evaluate(() => {
            const fixture = [{
                id: 'mistake_fixture_01',
                title: 'Fixture mistake for opened-case capture',
                tags: 'fixture, harness, opened-case',
                notes: 'User notes for the fixture problem. Length chosen to wrap roughly two lines so .mistake-notes-input height behavior is exercised.',
                noteImages: [],
                aiDraftNotes: '',
                aiAnswer: '',
                imageDataUrl: '',
                problemText: 'Fixture problem text — renders into #mistakeTextPreview because imageDataUrl is empty (mistake-notebook.js L272-274).',
                createdAt: '2024-01-15T10:30:00Z',
                updatedAt: '2024-01-15T10:30:00Z',
            }];
            localStorage.setItem('aquariusMistakeNotebook.v1', JSON.stringify(fixture));
        });
        await page.click('#navMistakeNotebookBtn');
        await page.waitForSelector('#mistakeNotebookView:not(.hidden)', { timeout: 5000 });
        await page.waitForSelector('#mistakeDetailContent:not(.hidden)', { timeout: 3000 });
        await page.waitForSelector('.mistake-list-item.active', { timeout: 2000 });
        // Confirm the rendered workspace shape: 1 list-item active, workspace
        // visible, text-preview unhidden (imageDataUrl empty path), image hidden.
        const shape = await page.evaluate(() => ({
            activeItems: document.querySelectorAll('.mistake-list-item.active').length,
            workspace: !!document.querySelector('.mistake-workspace'),
            noteColumns: !!document.querySelector('.mistake-note-columns'),
            textPreviewVisible: !document.getElementById('mistakeTextPreview')?.classList.contains('hidden'),
            imageHidden: document.getElementById('mistakeImagePreview')?.classList.contains('hidden'),
        }));
        assertOrThrow(
            shape.activeItems === 1 && shape.workspace && shape.noteColumns
                && shape.textPreviewVisible && shape.imageHidden,
            `view 03b: workspace shape mismatch: ${JSON.stringify(shape)}`,
        );
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.waitForTimeout(300);
    } },
];

// ---------- helpers (visual-diff-specific) ----------
// Helpers below are visual-diff-specific. General-purpose Playwright helpers
// shared with smoke.js / other tools belong in tools/test-utils.js.

function readPng(p) {
    return PNG.sync.read(fs.readFileSync(p));
}

function comparePng(baselinePath, currentPath, diffPath) {
    const a = readPng(baselinePath);
    const b = readPng(currentPath);
    if (a.width !== b.width || a.height !== b.height) {
        return { mismatch: a.width * a.height, ratio: 1, total: a.width * a.height,
                 error: `size mismatch: baseline ${a.width}x${a.height} vs current ${b.width}x${b.height}` };
    }
    // First pass: count only. pixelmatch accepts `null` for the output buffer
    // and skips all per-pixel writes. On a clean run (all 18 at 0.000%) this
    // saves ~8 MB allocation × 18 views vs. unconditionally constructing a
    // PNG diff buffer up front.
    const mismatch = pixelmatch(a.data, b.data, null, a.width, a.height,
        { threshold: PIXELMATCH_THRESHOLD });
    const total = a.width * a.height;
    if (mismatch > 0) {
        // Re-run with a real diff buffer so we can write the visual diff PNG.
        const diff = new PNG({ width: a.width, height: a.height });
        pixelmatch(a.data, b.data, diff.data, a.width, a.height,
            { threshold: PIXELMATCH_THRESHOLD });
        fs.writeFileSync(diffPath, PNG.sync.write(diff));
    }
    return { mismatch, ratio: mismatch / total, total };
}

// Returns the Set<sectionId> of Page C candidates whose cache files exist.
// Single source of truth for cache presence — view 17/18 setups consult this
// set instead of re-resolving paths inside their candidate loops.
function preFlightCacheCheck(repoRoot) {
    const present = new Set();
    const missing = [];
    for (const view of PAGE_C_VIEWS) {
        for (const candidate of view.candidates) {
            const resolved = resolveLessonCachePath(repoRoot, candidate.sectionId);
            if (resolved) present.add(candidate.sectionId);
            else missing.push(`${view.viewName} candidate ${candidate.sectionId}`);
        }
    }
    const total = PAGE_C_VIEWS.reduce((n, v) => n + v.candidates.length, 0);
    if (missing.length === total) {
        throw new Error('cache missing for ALL Page C candidates — run pregen or sync workspace/materials/lesson-cache/ before --baseline or --check');
    }
    if (missing.length > 0) {
        console.warn(`[visual-diff] cache missing for some candidates (will be skipped during fallback): ${missing.join(', ')}`);
    }
    return present;
}

// Clear guest-mode session state (sessionStorage `guestUid` +
// `aquarius-auth-return-intent`) and re-enter guest mode from the intro
// screen. Needed by Page C views because: a) the bootstrap calls
// enterGuestMode once and we need to swap lessons between candidates, and
// b) on plain reload the app skips the intro (`aquarius-auth-return-intent`
// triggers hasPendingAuthReturnIntent → shouldShowIntroLanding returns false).
//
// localStorage is also wiped because view 17 may have called the section
// completion path (`__ftutorMarkCompleted` → `aquariusCompletedSubsections.v1`
// at app/app.js L8985), and that state would bleed into view 18's syllabus
// render. Today `closeSyllabusForCapture` hides the syllabus surface entirely
// so the bleed doesn't show up under diff, but any future Page C view that
// captures with the syllabus open would diff.
async function clearGuestSessionAndReenter(page) {
    await page.evaluate(() => {
        try { localStorage.clear(); } catch (_) {}
        try { sessionStorage.clear(); } catch (_) {}
    });
    await enterGuestMode(page, BASE);
}

// Collapse the syllabus panel before a Page C capture. openSubtopic leaves
// the syllabus open with the chosen chapter + sibling chapters expanded; on
// re-runs the sibling expansion state can drift (e.g. §4.12 chevron-open vs
// chevron-closed) which leaks into the diff. Closing the panel removes the
// syllabus surface entirely so only lesson chrome remains under pixel diff.
async function closeSyllabusForCapture(page) {
    const isOpen = await page.evaluate(() =>
        document.getElementById('sidebarSyllabusPanel')?.classList.contains('is-open') || false
    );
    if (!isOpen) return;
    await page.click('#navSyllabusBtn');
    // Wait until the panel no longer has .is-open / .is-animating in its
    // classList. Use evaluate-poll (not waitForSelector) because the panel
    // gets `.hidden` after close and Playwright's default visibility check
    // would time out on the now-display:none element. We're checking
    // class state, not visibility.
    await page.waitForFunction(() => {
        const el = document.getElementById('sidebarSyllabusPanel');
        if (!el) return true;
        return !el.classList.contains('is-open') && !el.classList.contains('is-animating');
    }, null, { timeout: 3000 });
    await page.waitForTimeout(200);
}

// Walk every knowledge-point page in the currently-loaded lesson, accumulate
// the set of inferred families for hydrated `.kc-interactive-demo` nodes that
// also have a child <canvas> or <svg> (proof a family-specific renderer
// painted, not the brief-fallback). Throws on cache-miss or empty hydration.
//
// `earlyExitOn` (optional family string): break the pager walk as soon as
// that family has been seen. Saves 20-40s on --check runs where view 17/18
// only need to confirm one family is reachable.
async function collectLessonFamilies(page, { earlyExitOn } = {}) {
    const text = await page.locator('#learnExplainContent').innerText().catch(() => '');
    if (text.includes('This section has not been prepared yet')) {
        throw new Error('cache miss — lesson rendered the "section not prepared" banner');
    }

    const families = new Set();
    const seenKpKeys = new Set();
    // Largest real lesson ≈ 10 KPs; cap at 15 to fail fast on broken pagers.
    const maxIters = 15;
    for (let i = 0; i < maxIters; i++) {
        await settleLesson(page);
        // hydrateInteractiveDemos sets dataset.hydrated='1' synchronously
        // but the family-specific renderers paint their <canvas>/<svg>
        // children via rAF/setTimeout. Wait briefly for at least one
        // .kc-interactive-demo to grow a canvas/svg child; tolerate the
        // no-demo case (some KPs have no interactive demo at all).
        await page.waitForFunction(
            () => {
                const nodes = document.querySelectorAll('.kc-interactive-demo');
                if (!nodes.length) return true; // no demos on this KP — proceed
                return Array.from(nodes).some((n) => n.dataset.hydrated === '1' && n.querySelector('canvas, svg'));
            },
            null,
            { timeout: 2000 }
        ).catch(() => {}); // best-effort — collect what's there
        // Collect families on the current KP page + read priorKey in one
        // round-trip. priorKey: article.lesson-page-frame's data-lesson-page
        // attribute (set in buildLessonPageFrameHtml at app/app.js L3308 =
        // `${currentKnowledgePointIndex + 1}`).
        // NOTE: clicking next-btn is deliberately kept in a second evaluate
        // below, AFTER the early-exit / loop-back checks. Merging the click
        // into this read would advance the pager one step past the early-
        // exit KP, leaving a different lesson page on screen at screenshot
        // time and breaking the pixel-neutral contract.
        const { families: pageFamilies, priorKey } = await page.evaluate(() => {
            if (typeof window.inferInteractiveDemoFamily !== 'function') {
                throw new Error('window.inferInteractiveDemoFamily missing — app.js export removed?');
            }
            if (typeof window.parseBase64JsonAttr !== 'function') {
                throw new Error('window.parseBase64JsonAttr missing — app.js export removed?');
            }
            const out = [];
            document.querySelectorAll('.kc-interactive-demo').forEach((n) => {
                if (n.dataset.hydrated !== '1') return;
                if (!n.querySelector('canvas, svg')) return;
                const b64 = n.dataset.demoB64 || n.getAttribute('data-demo-b64');
                const demo = window.parseBase64JsonAttr(b64);
                if (!demo) return;
                out.push(window.inferInteractiveDemoFamily(demo));
            });
            const frame = document.querySelector('#learnExplainContent .lesson-page-frame');
            const key = frame ? frame.getAttribute('data-lesson-page') : null;
            return { families: out, priorKey: key };
        });
        pageFamilies.forEach((f) => families.add(f));

        if (earlyExitOn && families.has(earlyExitOn)) break;
        if (priorKey && seenKpKeys.has(priorKey)) break; // pager looped back
        if (priorKey) seenKpKeys.add(priorKey);

        // Try to advance to the next KP. If pager is at-end, the button is
        // disabled — bail. `learnKpNextBtn` lives inside the lesson shell
        // but `moveLearnKnowledgePoint` early-returns when
        // `isLearnPageTurning` is true; the 150ms tail after each successful
        // turn below + settleLesson at loop top keep the lock clear.
        const advanced = await page.evaluate(() => {
            const btn = document.querySelector('#learnKpNextBtn:not([disabled])');
            if (!btn) return false;
            btn.click();
            return true;
        });
        if (!advanced) break;
        // Confirm the pager actually advanced. If `data-lesson-page` never
        // changes within 3s, treat that as end-of-pager (the click was a
        // no-op — `moveLearnKnowledgePoint` returns false when nextIndex
        // equals the current one). The original code relied on the disabled
        // attribute alone for this; we keep the soft-break behavior so a
        // race between "button enabled" + "single-KP lesson committed" still
        // terminates instead of throwing. seenKpKeys catches the "looped"
        // pathological case on the next iteration.
        if (priorKey) {
            const changed = await page.waitForFunction(
                (prior) => {
                    const frame = document.querySelector('#learnExplainContent .lesson-page-frame');
                    return frame && frame.getAttribute('data-lesson-page') !== prior;
                },
                priorKey,
                { timeout: 3000 }
            ).then(() => true).catch(() => false);
            if (!changed) break;
        }
        // Brief settle slack after the page-turn animation so the next
        // iteration's hydration wait fires against a stable DOM. 300ms
        // matches the pre-Phase-3.5 timing (eca09ad) — shorter values
        // intermittently raced the convolution-lab canvas paint.
        await page.waitForTimeout(300);
    }
    return families;
}

// Run a Page C view: iterate candidates, re-entering guest mode between
// attempts (skipping re-enter on the very first time this Page is seen,
// since the Page C bootstrap already did it). On the first candidate whose
// hydrated demos include the expected family, record coverage, close the
// syllabus, and return. Throws if no candidate routes to the expected
// family.
//
// pageCSeeded tracks which Page objects have already had at least one
// lesson opened on them. This replaces the previous `isFirstPageCView`
// caller-passed flag — the contract is now derivable from page identity,
// so view-ordering changes can't silently break it.
const pageCSeeded = new WeakSet();
async function runPageCView(page, viewName) {
    const view = PAGE_C_VIEWS.find(v => v.viewName === viewName);
    assertOrThrow(view, `${viewName} missing from PAGE_C_VIEWS`);
    let lastErr;
    let firstAttempt = !pageCSeeded.has(page);
    pageCSeeded.add(page);
    for (const candidate of view.candidates) {
        if (!cachePresent.has(candidate.sectionId)) continue;
        try {
            if (!firstAttempt) {
                await clearGuestSessionAndReenter(page);
            }
            firstAttempt = false;
            await openSubtopic(page, {
                chapter: candidate.chapter,
                section: candidate.section,
                title: candidate.title,
            });
            // openSubtopic returns when content text is non-trivial, but
            // the pager next-button state lags briefly — wait for the KP
            // count to stabilize so collectLessonFamilies' first iteration
            // doesn't race a single-KP transitional state and bail early.
            await page.waitForFunction(
                () => {
                    const next = document.querySelector('#learnKpNextBtn');
                    const frame = document.querySelector('#learnExplainContent .lesson-page-frame');
                    return next && frame; // both rendered
                },
                null,
                { timeout: 5000 }
            ).catch(() => {});
            // Empirical: dropping this 400ms slack caused view 18 to fail
            // with families=[] (the kc-interactive-demo hydration race
            // outran collectLessonFamilies' internal 2s waitForFunction).
            // settleLesson's MathJax/font/rAF guarantees don't cover demo
            // canvas/svg paint. Keep the wait until pole_zero_roc_lab's
            // hydration is restructured to be observable via a stronger
            // signal than dataset.hydrated + querySelector('canvas, svg').
            await page.waitForTimeout(400);
            const families = await collectLessonFamilies(page, { earlyExitOn: candidate.expected });
            if (!families.has(candidate.expected)) {
                lastErr = new Error(`expected ${candidate.expected}, got [${Array.from(families).join(',')}]`);
                continue;
            }
            global.__pageCResults.push({
                viewName: view.viewName,
                sectionId: candidate.sectionId,
                expected: candidate.expected,
                families: Array.from(families),
            });
            await closeSyllabusForCapture(page);
            return; // success
        } catch (err) {
            lastErr = err;
        }
    }
    throw new Error(`${viewName} exhausted candidates: ${lastErr && lastErr.message}`);
}

// Populated by preFlightCacheCheck before the runner enters its view loop.
// Module-scope so runPageCView (called from setup closures) can consult it
// without threading through captureView's signature.
let cachePresent = new Set();

// ---------- runner ----------
// Signal-handler cleanup for the spawned bridge subprocess. The IIFE finally
// block stops it on normal exit and caught exceptions; SIGINT/SIGTERM
// short-circuit that path.
//
// PR #69 review finding #9: the original signal handler called process.exit
// without killing the bridge subprocess, orphaning ws-bridge on port :9125
// and breaking subsequent runs with EADDRINUSE. The bridge handle is now
// tracked at module scope (bridgeProcess) so the signal handler can SIGTERM
// it before exiting. signalHandled prevents re-entry if two signals arrive
// (e.g. impatient double ctrl-C).
let bridgeProcess = null;
let signalHandled = false;
function signalCleanup(signal) {
    if (signalHandled) return;
    signalHandled = true;
    if (bridgeProcess && !bridgeProcess.killed) {
        try { bridgeProcess.kill('SIGTERM'); } catch (_) {}
    }
    // process.exit is synchronous — the bridge gets the SIGTERM signal but
    // doesn't get a tick to clean up its listening socket before this
    // process dies. Bridge typically takes <100ms to release :9125; if a
    // subsequent run hits EADDRINUSE the operator can pkill manually.
    // exitCode 130 = standard SIGINT (128+2); 143 = SIGTERM (128+15).
    process.exit(signal === 'SIGTERM' ? 143 : 130);
}
process.once('SIGINT', () => signalCleanup('SIGINT'));
process.once('SIGTERM', () => signalCleanup('SIGTERM'));

(async () => {
    const repoRoot = path.resolve(__dirname, '..');
    cachePresent = preFlightCacheCheck(repoRoot);

    // Collector for Page C family-routing assertions. Hoisted via `global`
    // so view setups (closures) can push without threading the array through
    // captureView's signature. Read by the report-writer at the bottom of
    // this IIFE.
    const __pageCResults = [];
    global.__pageCResults = __pageCResults;
    const outDir = MODE === 'baseline' ? BASELINE_DIR : CURRENT_DIR;
    fs.mkdirSync(outDir, { recursive: true });
    if (MODE === 'check') fs.mkdirSync(DIFF_DIR, { recursive: true });

    console.log(`[visual-diff] mode=${MODE} → ${outDir}`);
    console.log(`[visual-diff] starting bridge on :${PORT}`);
    const server = spawnBridge(repoRoot, PORT);
    bridgeProcess = server; // expose to signal handler — see signalCleanup

    let exitCode = 0;
    const results = [];

    try {
        await waitForHealth(BASE);
        const browser = await chromium.launch();
        const captureView = async (view, page) => {
            const dest = path.join(outDir, `${view.name}.png`);
            let flowResult = null;
            try {
                await view.setup(page);
                // Optional flow runner — drives interactive steps after setup,
                // before the screenshot. The FINAL DOM state is still pixel-
                // diffed via the existing screenshot path, so per-view
                // STRICT_FAIL_RATIO continues to bound regression. A failed
                // step throws (caught below) and leaves a per-step PNG in
                // DIFF_DIR for AFK debug.
                //
                // NO TEARDOWN CONTRACT: pages are cached per pageKey (L1711+)
                // and reused across every view sharing that key. A flow
                // step that mutates persistent DOM state (open dialog,
                // typed-in input, scroll offset, localStorage) WILL leak
                // into the next view on the same pageKey. Flow-using views
                // MUST either (a) put themselves last in their pageKey's
                // view order, (b) restore the chrome state inside their own
                // view.setup (parallel to resetLessonChromeState in views
                // 15/16), or (c) declare a dedicated pageKey. There is no
                // per-flow teardown hook in PR-1; PR-2 may add view.flow.
                // teardown if the B4 views surface a need.
                if (view.flow && Array.isArray(view.flow.steps)) {
                    flowResult = await runFlow(page, view.flow.steps, {
                        traceLabel: view.name,
                        artifactDir: DIFF_DIR,
                    });
                    if (!flowResult.passed) {
                        const stepName = view.flow.steps[flowResult.failedAt]?.name
                            || `step ${flowResult.failedAt}`;
                        throw new Error(
                            `[flow:${view.name}] failed at step ${flowResult.failedAt}` +
                            ` (${stepName}): ${flowResult.error?.message || 'unknown'}`
                        );
                    }
                }
                // Page C views call settleLesson inside collectLessonFamilies
                // (per KP) + a 200ms slack via closeSyllabusForCapture, so
                // they skip the redundant ~300-400ms settle here. Derived
                // from view.page rather than a per-view flag.
                if (view.page !== 'C') {
                    await settleLesson(page);
                }
                await page.screenshot({ path: dest, fullPage: false });
                console.log(`  ✓ ${view.name}`);
                if (MODE === 'check') {
                    const baselinePath = path.join(BASELINE_DIR, `${view.name}.png`);
                    if (!fs.existsSync(baselinePath)) {
                        results.push({ view: view.name, status: 'no-baseline',
                                       stepLog: flowResult?.stepLog?.length ? flowResult.stepLog : null });
                        return;
                    }
                    const diffPath = path.join(DIFF_DIR, `${view.name}.png`);
                    const cmp = comparePng(baselinePath, dest, diffPath);
                    const threshold = view.failRatio ?? FAIL_RATIO;
                    const pass = !cmp.error && cmp.ratio <= threshold;
                    results.push({ view: view.name, status: pass ? 'pass' : 'fail',
                                   mismatch: cmp.mismatch, total: cmp.total,
                                   ratio: cmp.ratio, threshold, error: cmp.error,
                                   stepLog: flowResult?.stepLog?.length ? flowResult.stepLog : null });
                    if (!pass) exitCode = 1;
                }
            } catch (err) {
                console.log(`  ✗ ${view.name}: ${err.message}`);
                results.push({ view: view.name, status: 'error', error: err.message,
                               stepLog: flowResult?.stepLog?.length ? flowResult.stepLog : null });
                exitCode = 1;
            }
        };

        // One BrowserContext owns the MASK_CSS via addInitScript so every page
        // derived from the context inherits the mask before first paint.
        // addInitScript runs immediately after document creation (BEFORE the
        // app's <link rel=stylesheet>); the mask CSS leans on `!important` +
        // selector specificity to win the cascade regardless of order.
        //
        // Pin timezone and locale so any date or locale-sensitive rendering
        // stays byte-identical across developer machines and CI.
        const context = await browser.newContext({
            viewport: VIEWPORT,
            timezoneId: 'UTC',
            locale: 'en-US',
        });
        await injectMaskInitScript(context);

        // Lazy per-page bootstraps. Each pageKey is bootstrapped on first
        // request and reused for subsequent views with the same key. A/B/C
        // bootstrap into guest mode; D stops at the login surface (no guest
        // entry) so the FINAL LOGIN LIQUID GLASS cluster can be captured.
        // Adding a fourth key here requires a matching branch below — silent
        // fall-through would re-enter guest mode and never reach the new
        // surface.
        const VALID_PAGE_KEYS = new Set(['A', 'B', 'C', 'D']);
        const bootstrapPage = async (key) => {
            const p = await context.newPage();
            if (key === 'D') {
                await enterLoginView(p, BASE);
            } else {
                await enterGuestMode(p, BASE);
            }
            return p;
        };
        const pageMap = new Map();
        const getPage = async (key) => {
            if (pageMap.has(key)) return pageMap.get(key);
            if (!VALID_PAGE_KEYS.has(key)) throw new Error(`unknown page key "${key}"`);
            const p = await bootstrapPage(key);
            pageMap.set(key, p);
            return p;
        };

        // Pre-warm all four pages concurrently — each enterGuestMode (and
        // enterLoginView) is ~5s, so parallelizing saves ~15s/run. Subsequent
        // getPage() calls inside the view loop hit the Map cache as no-op
        // reads. If this ever surfaces a bridge race (parallel /api/section
        // + /api/ask serialization), revert this Promise.all to a sequential
        // pair and add a // TODO: parallel bootstrap deferred — <reason>.
        await Promise.all(Array.from(VALID_PAGE_KEYS).map((k) => getPage(k)));

        for (const view of sharedViews) {
            const pageKey = view.page || 'A';
            const page = await getPage(pageKey);
            await captureView(view, page);
        }

        for (const p of pageMap.values()) {
            await p.close().catch(() => {});
        }
        await context.close().catch(() => {});
        await browser.close();
    } catch (err) {
        console.error('[visual-diff] FATAL', err);
        exitCode = 1;
    } finally {
        // Attach the exit listener BEFORE sending SIGTERM so a fast-exiting
        // bridge can't race the listener; race against a 2s timeout and warn
        // if it hits so "real exit" and "never exited" don't look identical.
        await stopBridge(server, { label: 'visual-diff' });
    }

    if (MODE === 'check') {
        const strictList = sharedViews
            .filter(v => v.failRatio != null)
            .map(v => `${v.name}=${(v.failRatio * 100).toFixed(3)}%`)
            .join(', ') || 'none';
        // Optional Steps column — present only when at least one view used
        // view.flow. Existing 35-view reports keep their byte-identical
        // column layout when no flow view is present.
        const anyFlow = results.some(r => Array.isArray(r.stepLog));
        const header = anyFlow
            ? '| View | Status | Mismatch | Ratio | Threshold | Steps | Note |'
            : '| View | Status | Mismatch | Ratio | Threshold | Note |';
        const sep = anyFlow
            ? '|---|---|---|---|---|---|---|'
            : '|---|---|---|---|---|---|';
        const lines = ['# Visual-diff report', '',
            `Default threshold: ≤${(FAIL_RATIO * 100).toFixed(2)}% mismatched pixels per view`,
            `Strict-threshold overrides: ${strictList}`,
            '', header, sep];
        const stepsCell = (log) => {
            if (!Array.isArray(log) || log.length === 0) return '—';
            const okCount = log.filter(s => s.ok).length;
            const failIdx = log.findIndex(s => !s.ok);
            return failIdx >= 0
                ? `${okCount}/${log.length} fail@${failIdx}`
                : `${okCount}/${log.length} ok`;
        };
        for (const r of results) {
            const ratio = r.ratio != null ? (r.ratio * 100).toFixed(3) + '%' : '—';
            const mismatch = r.mismatch != null ? `${r.mismatch}/${r.total}` : '—';
            const threshold = r.threshold != null ? (r.threshold * 100).toFixed(3) + '%' : '—';
            if (anyFlow) {
                lines.push(`| ${r.view} | ${r.status} | ${mismatch} | ${ratio} | ${threshold} | ${stepsCell(r.stepLog)} | ${r.error || ''} |`);
            } else {
                lines.push(`| ${r.view} | ${r.status} | ${mismatch} | ${ratio} | ${threshold} | ${r.error || ''} |`);
            }
        }
        fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n');

        // Dispatcher coverage summary — separate from the main table to keep
        // the per-view list dense rather than 16 empty cells.
        const coverageLines = ['', '## Dispatcher coverage', '',
            'Family-table renderer routing confirmed for the following Chapter 2+ views',
            '(early-exit on first matching family — additional families on later KPs',
            'are not enumerated):',
            ''];
        if (global.__pageCResults && global.__pageCResults.length) {
            for (const r of global.__pageCResults) {
                coverageLines.push(`- **${r.viewName}** → sectionId \`${r.sectionId}\`, families seen \`[${r.families.join(', ')}]\`, asserted \`${r.expected}\` ✓`);
            }
        } else {
            coverageLines.push('- (no Page C views ran or all errored)');
        }
        fs.appendFileSync(REPORT_PATH, coverageLines.join('\n') + '\n');

        // Persist machine-readable coverage so a future regression run that
        // picks a different candidate is visible in `git diff`. No timestamp,
        // no mode field: re-running --check shouldn't dirty the working tree
        // beyond the candidate-rotation diff that's the actual signal.
        const coverage = {
            entries: global.__pageCResults || [],
        };
        fs.writeFileSync(COVERAGE_REPORT_PATH, JSON.stringify(coverage, null, 2) + '\n');

        console.log(`\n[visual-diff] report → ${REPORT_PATH}`);
    }
    process.exit(exitCode);
})();
