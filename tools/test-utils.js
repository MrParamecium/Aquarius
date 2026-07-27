'use strict';
/**
 * Shared Playwright test utilities for tools/visual-diff.js and tools/smoke.js.
 *
 * Previously each caller redefined enterGuestMode / openSubtopic / etc.;
 * keeping them in sync required a 2-place edit on every selector change.
 * Centralized here per docs/superpowers/specs/2026-06-22-harness-expansion-design.md.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// CSS masking non-deterministic regions before screenshot. Add selectors here
// whenever a new always-animating or text-drifting element shows up.
// Injected at BrowserContext level (addInitScript) by visual-diff.js so every
// page derived from the context inherits the mask before first paint —
// callers must not need to remember to re-inject.
const MASK_CSS = `
    /* Phase 3.5 v2 view 19: freeze decorative login motion so the Glass card
       chrome stays diffable across runs. */
    #loginView .login-card.tilt-element {
        transform: none !important;
        transition: none !important;
        animation: none !important;
    }
    #loginView .login-doodle,
    #loginView .login-map-card,
    #loginView .login-scrap-note,
    #loginView .login-practice-log,
    #loginView .login-sticky-note,
    #loginView .login-mini-ticket {
        animation: none !important;
        transition: none !important;
    }
    /* Phase 3.5 v2 view 23: textbook focus dialog injects raster page images.
       Hide the image content (still keeps the Glass card chrome) so a missing
       textbook page doesn't fail the capture. */
    #textbookFocusDialog .textbook-focus-single-page,
    #textbookFocusDialog .textbook-focus-scroll-page img { visibility: hidden !important; }
    /* in-flight panel transitions */
    .is-animating { transition: none !important; animation: none !important; }
    /* relative timestamps in Recent Conversations drift between runs */
    .sidebar-recent-list .recent-timestamp,
    .sidebar-recent-list time { visibility: hidden !important; }
    /* input caret blink in focused-composer view. Scoped to input surfaces. */
    input, textarea, [contenteditable="true"] { caret-color: transparent !important; }
    /* home-mode menu transitions during forced .show flip */
    .home-mode-menu.show { transition: none !important; animation: none !important; }
    /* Settings → Account card UID line. startGuestMode() generates a fresh
       Math.random() UID per session (clerk-auth.js startGuestMode); without
       this mask view 05 drifts every run at 0.013%. .settings-user-meta is
       a dedicated leaf node that holds ONLY the "UID: XXXXXX" line, so
       masking it preserves the rest of the Account card.
       !important + 2-ID specificity beats both the inline
       style="color:#94a3b8" and the L33281 author rule, regardless of
       cascade order. */
    html #settingsView .settings-user-meta { color: transparent !important; text-shadow: none !important; }
`;

function waitForHealth(base, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const tryOnce = () => {
            fetch(`${base}/health`).then(r => r.ok ? resolve() : retry()).catch(retry);
        };
        const retry = () => {
            if (Date.now() > deadline) return reject(new Error('bridge /health never came up'));
            setTimeout(tryOnce, 300);
        };
        tryOnce();
    });
}

// §13a de-dup (docs/phase3_deferred.md §13, deferred D1): spawn the ws-bridge
// subprocess the exact way both tools/visual-diff.js and tools/css-probe.js
// did independently — `node app/ws-bridge.js` with PORT overridden via env,
// stdout swallowed, stderr forwarded with a `[bridge-err]` prefix so a crash
// during a harness run is still visible on the console. `port` is the
// caller's already-resolved port number (each harness picks its own env var
// to source it from — TUTOR_VDIFF_PORT vs TUTOR_CSSPROBE_PORT — so that
// selection stays in the caller); the child process env var name is always
// `PORT`, matching what ws-bridge.js reads.
function spawnBridge(repoRoot, port) {
    const server = spawn('node', ['app/ws-bridge.js'], {
        cwd: repoRoot,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', () => {});
    server.stderr.on('data', d => process.stderr.write(`  [bridge-err] ${d}`));
    return server;
}

// §13a de-dup: SIGTERM the spawned bridge and race its exit against a
// timeout, warning (not failing) if it doesn't exit in time. Attaches the
// exit listener BEFORE sending SIGTERM so a fast-exiting bridge can't race
// past the listener. `label` prefixes the console warning so the caller's
// existing `[visual-diff]` / `[css-probe]` log tags are preserved verbatim.
function stopBridge(server, opts = {}) {
    const { timeoutMs = 2000, label = 'test-utils' } = opts;
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill('SIGTERM');
    return Promise.race([
        exited,
        new Promise((resolve) => setTimeout(() => {
            // Text form matches the two call sites' pre-hoist literals verbatim
            // (`bridge did not exit within 2s after SIGTERM`) at the default
            // timeoutMs=2000; kept as a formula so a caller-supplied timeoutMs
            // stays consistent instead of lying about the actual wait.
            console.warn(`[${label}] bridge did not exit within ${timeoutMs / 1000}s after SIGTERM`);
            resolve();
        }, timeoutMs)),
    ]);
}

// §13a de-dup: inject the shared MASK_CSS at BrowserContext level so every
// page derived from the context inherits the mask before first paint.
// addInitScript runs immediately after document creation (before the app's
// <link rel=stylesheet>); the mask CSS leans on `!important` + selector
// specificity to win the cascade regardless of order.
function injectMaskInitScript(context) {
    return context.addInitScript(({ css }) => {
        const inject = () => {
            const s = document.createElement('style');
            s.textContent = css;
            document.head.appendChild(s);
        };
        if (document.head) inject();
        else document.addEventListener('DOMContentLoaded', inject);
    }, { css: MASK_CSS });
}

// Shared first step for enterGuestMode + enterLoginView: navigate to BASE
// and click through the intro landing. Both bootstraps diverge after this
// point. Centralizing the `#introGetStartedBtn` selector here so a rename
// only needs one update — previously this pair was a silent drift channel
// per docs/phase3_deferred.md §8d.
async function dismissIntro(page, base) {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const getStarted = page.locator('#introGetStartedBtn');
    await getStarted.waitFor({ state: 'visible', timeout: 25000 });
    await getStarted.evaluate(button => button.click());
}

async function enterGuestMode(page, base) {
    await dismissIntro(page, base);
    await page.click('#guestModeBtnLogin[data-bound-guest-mode="1"]', { timeout: 25000 });
    await page.click('#quizCloseBtn');
    await page.waitForSelector('#navSyllabusBtn', { timeout: 10000 });
}

// Page D bootstrap (Phase 3.5 v2): navigate to BASE and dismiss the intro
// landing so the login Glass surface (FINAL LOGIN LIQUID GLASS L43321+) is
// visible. Does NOT enter guest mode — clicking `#guestModeBtnLogin` would
// transition into the workspace. After this returns the page sits on the
// login card with decorative motion frozen by MASK_CSS.
async function enterLoginView(page, base) {
    await dismissIntro(page, base);
    await page.waitForSelector('#loginView:not(.hidden)[data-bound-login-experience="1"]', { timeout: 10000 });
    const passwordToggleWorks = await page.evaluate(() => {
        const input = document.getElementById('loginPasswordInput');
        const toggle = document.getElementById('loginPasswordToggleBtn');
        if (!input || !toggle || input.type !== 'password') return false;
        toggle.click();
        const revealed = input.type === 'text';
        toggle.click();
        return revealed && input.type === 'password';
    });
    if (!passwordToggleWorks) throw new Error('login password visibility control was not bound');
    // Wait for the bound-guest-mode attribute as proof clerk-auth.js
    // initLoginExperience() ran — the same readiness signal enterGuestMode
    // uses one click later. Without it, the login card buttons may still be
    // mid-bind on slow runs.
    await page.waitForSelector('#guestModeBtnLogin[data-bound-guest-mode="1"]', { timeout: 25000 });
}

async function ensureSyllabusOpen(page) {
    for (let attempt = 0; attempt < 4; attempt++) {
        const stable = await page.locator('#sidebarSyllabusPanel.is-open:not(.is-animating)').count();
        if (stable > 0) return;
        await page.click('#navSyllabusBtn').catch(() => {});
        try {
            await page.waitForSelector('#sidebarSyllabusPanel.is-open:not(.is-animating)', { timeout: 2500 });
            return;
        } catch (_) { /* try again */ }
    }
    throw new Error('could not open syllabus panel after 4 attempts');
}

async function openSubtopic(page, sub, waitMs = 25000) {
    await ensureSyllabusOpen(page);
    // Substring match; count!==1 guard below catches ambiguity (e.g.
    // "Chapter 1" prefix-matching a future "Chapter 14").
    const chapter = page.locator('#courseSyllabus .syllabus-chapter', { hasText: sub.chapter });
    const chapterCount = await chapter.count();
    if (chapterCount !== 1) {
        throw new Error(`ambiguous chapter selector ('${sub.chapter}' matched ${chapterCount} rows)`);
    }
    await chapter.first().click();
    await page.click(`#courseSyllabus .syllabus-section[data-section="${sub.section}"]`);
    const card = page.locator(`.chapter-overview-subcard[data-sublesson-title="${sub.title}"]`);
    await card.waitFor({ state: 'visible', timeout: 10000 });

    let entered = false;
    const sawOpenLog = { value: false };
    const listener = m => { if (/\[openLearnMode\]/.test(m.text())) sawOpenLog.value = true; };
    page.on('console', listener);
    try {
        for (let i = 0; i < 5 && !entered; i++) {
            await card.click();
            const t0 = Date.now();
            while (Date.now() - t0 < 2000) {
                if (sawOpenLog.value) { entered = true; break; }
                await page.waitForTimeout(100);
            }
        }
    } finally {
        page.off('console', listener);
    }
    if (!entered) throw new Error(`subtopic "${sub.title}" click never fired openLearnMode`);

    const content = page.locator('#learnExplainContent');
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
        const text = (await content.innerText().catch(() => '')) || '';
        if (text && !text.includes('Preparing lesson...') && text.length > 80) return text;
        await page.waitForTimeout(300);
    }
    throw new Error(`subtopic "${sub.title}" never rendered within ${waitMs}ms`);
}

// Remove the expanded syllabus accordion in the left sidebar from layout
// with `display: none` so its non-deterministic row layout drift (~1-2px
// per row, accumulating to 12k+ px / ~1.2% across 9 lesson views) stops
// contaminating those views' pixel diffs. `visibility: hidden` was not
// enough — it preserves layout, so a panel that animates to a slightly
// different settled height still shifts every sidebar nav button below
// it. Use on Page A AFTER view 02 (which captures the syllabus tree
// intentionally) — once active, the mask persists on the Page A page
// through every subsequent view in the schedule, including 03b.
// Idempotent (re-injecting on subsequent views is a no-op via id-keyed
// guard). See docs/phase3_deferred.md §11 (Option A) for discovery story.
async function maskLessonSidebar(page) {
    await page.evaluate(() => {
        if (document.getElementById('__ftutor-lesson-sidebar-mask')) return;
        const s = document.createElement('style');
        s.id = '__ftutor-lesson-sidebar-mask';
        s.textContent = '#sidebarSyllabusPanel { display: none !important; }';
        document.head.appendChild(s);
    });
}

// Close any visible feature-popover help bubbles. Several Page A/B views
// open with a `.feature-close-btn` element rendered into the page; click
// every one that is currently in the layout (offsetParent !== null) so
// transient highlight chrome doesn't leak into the screenshot.
async function closeFeaturePopovers(page) {
    await page.evaluate(() => {
        document.querySelectorAll('.feature-close-btn').forEach(b => {
            if (b.offsetParent !== null) b.click();
        });
    });
}

// Reset Home/sidebar chrome state left over from a previous Page B view
// (e.g. view 11 forced `#homeModeMenu.show` + `aria-expanded='true'` on the
// toggle button). View 12+ navigation strips `.show` but inherits the stale
// `aria-expanded`; no current selector keys off it, but the harness should
// not be silently order-dependent. Parallel to resetLessonChromeState.
async function resetHomeChromeState(page) {
    await page.evaluate(() => {
        const menu = document.getElementById('homeModeMenu');
        const toggle = document.getElementById('homeModeToggleBtn');
        menu?.classList.remove('show');
        toggle?.setAttribute('aria-expanded', 'false');
    });
}

// Reset lesson chrome state left over from a previous view on the same page.
// Used by views 15/16 (which run after view 09's qa-full state) and by Page C
// when reopening a second lesson on a sticky Page A.
async function resetLessonChromeState(page) {
    await page.evaluate(() => {
        const body = document.getElementById('learnBody');
        if (!body) return;
        delete body.dataset.panelFocus;
        body.classList.remove('chapter-overview-active', 'chapter-overview-split-active');
        // C2 (REFACTOR_DONE §C2): also clear the collapse classes so a sticky
        // chat-/explain-collapsed state from a prior view cannot leak into the next
        // state's DOM. The app drops these in lockstep with panelFocus via
        // applyLearnPanelFocusState(); the floor between probe states must mirror it.
        body.classList.remove('chat-collapsed', 'explain-collapsed');
        // A4 S14 witness (task 06-29-a4-s14-tall-witness): tear down the combined
        // overview+textbook state the tall-witness views inject, so a sticky
        // learn-textbook-active / textbook-mode / un-hidden #learnBookOverlay cannot
        // leak into a later Page A view's DOM. resetLessonChromeState is the single
        // floor between visual-diff views; NO pre-existing view sets these (only
        // css-probe S13, which uses its own resetLearnChrome), so clearing them here
        // is a no-op for every committed baseline and only recovers from the witness.
        body.classList.remove('learn-textbook-active');
        const _scroll = document.getElementById('learnExplainScroll');
        if (_scroll) _scroll.classList.remove('textbook-mode');
        const _overlay = document.getElementById('learnBookOverlay');
        if (_overlay) {
            _overlay.classList.add('hidden');
            _overlay.style.display = '';   // drop the inline block; .hidden hides it
            _overlay.innerHTML = '';
        }
        const _explain = document.getElementById('learnExplainContent');
        if (_explain) _explain.style.display = '';
        // Force any pager refresh observer to recompute against the reset state.
        if (typeof window.__ftutorRefreshPager === 'function') {
            window.__ftutorRefreshPager();
        }
        window.dispatchEvent(new Event('resize'));
    });
    // One rAF + small slack for layout to settle.
    await settleRaf(page);
    await page.waitForTimeout(100);
}

// Wait for one full layout-flush cycle by chaining two requestAnimationFrame
// callbacks inside an in-page Promise. Two frames is the established floor
// for letting browser layout, MathJax mid-typeset, and inline style
// mutations propagate before a screenshot. Extracted here because the same
// pattern appears in resetLessonChromeState, settleLesson, and runFlow —
// a future tuning patch (triple-rAF for late-decoding images, swap to
// document.timeline.currentTime, etc.) should land in one place.
async function settleRaf(page) {
    await page.evaluate(
        () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    );
}

// Fast-forward any in-flight CSS transitions/animations to their end state so a
// screenshot cannot land mid-tween. getAnimations() returns only the animations
// running right now, so .finish() is a no-op wherever nothing is animating; the
// try/catch swallows the rare "cannot finish an infinite animation" throw.
// Extracted here (like settleRaf) because the identical one-liner is repeated
// across the visual harnesses — a future tuning patch (scope to a root element,
// change the catch behavior) should then land in one place.
async function finishAnimations(page) {
    await page.evaluate(
        () => document.getAnimations().forEach((a) => { try { a.finish(); } catch (_) {} })
    );
}

// Wait until MathJax typesetting + font loading + 2x rAF have all settled,
// so canvas-based interactive demos paint against a stable layout. Used by
// captureView before every screenshot.
async function settleLesson(page) {
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    // Force chromium to materialize the system fallback fonts before screenshot.
    // document.fonts.ready resolves on font *load*; this forces *rasterization*
    // so a cold font cache run does not leak into pixel diffs. Once a page
    // has rasterized them, the cache is sticky for the page lifetime — gate
    // on a per-page sentinel so second-and-later settles skip this 50-150ms
    // round-trip. MathJax typesetting + rAFs + the 150ms slack below still
    // run on every call.
    if (!page.__ftutorFontsRasterized) {
        await page.evaluate(async () => {
            if (document.fonts && typeof document.fonts.load === 'function') {
                try {
                    await Promise.all([
                        document.fonts.load('1em sans-serif'),
                        document.fonts.load('400 1em sans-serif'),
                        document.fonts.load('400 1em serif'),
                        document.fonts.load('400 1em monospace'),
                    ]);
                } catch (_) {}
            }
        });
        page.__ftutorFontsRasterized = true;
    }
    await page.evaluate(async () => {
        if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
            try { await window.MathJax.startup.promise; } catch (_) {}
        }
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            try { await window.MathJax.typesetPromise(); } catch (_) {}
        }
    });
    // §11 lesson-settle sentinel: gate on the app's own layout-stable signal.
    // dataset.lessonLayoutStable is '0' while a lesson render is in flight, '1'
    // once it settles (MathJax + idle + 2×rAF), and absent on non-lesson pages
    // (or before any lesson renders). Wait only while it is exactly '0', so a
    // non-lesson capture is never delayed; fall through on timeout so a stuck
    // render can't hang the run.
    await page.waitForFunction(
        () => document.documentElement.dataset.lessonLayoutStable !== '0',
        null, { timeout: 3000 }
    ).catch(() => {});
    await settleRaf(page);
    await page.waitForTimeout(150);
}

// A4 S14 witness (task 06-29-a4-s14-tall-witness). Drive #learnBody into the
// combined `chapter-overview-active.learn-textbook-active` (Band-2) state with a
// SYNTHETIC, fixed-height `.textbook-pages-flow` injected into #learnBookOverlay,
// so the two at-risk Band-2 doubled-ID decls become observable:
//   (a) #learnExplainScroll height:100%  (style.css L24577)  — needs OVERFLOW
//   (b) .textbook-pages-flow min-height:100% + padding-bottom (L24598-24599)
// Pure-synthetic (no production fn, no /api/section prelude, no real-scan decode,
// no scroll-reset timers) for determinism — mirrors the view-15/16 class-flip
// philosophy. The lesson layout (opened by view 06) already bounds
// #learnExplainScroll (.learn-explain-scroll flex scroll container, style.css
// L12097), so Band-2 height:100% resolves against a bounded parent → tall content
// overflows. Fixed-height cards (inline style beats the stylesheet) remove all
// image-decode non-determinism; the 1x1 transparent GIF keeps the production
// `.textbook-page-card > img` structure without a network fetch.
//
// variant 'tall' (default): content >> container → witnesses (a) + padding-bottom.
// variant 'fill': content < container → tests whether min-height:100% does work.
// Returns the geometry probe so a caller can record it. Throws (fail-closed) if
// the combined classes aren't set, Band-2 isn't the live cascade winner, or the
// overflow/fill precondition for the variant isn't met (a vacuous use-value-
// collapse would otherwise pass the witness for the wrong reason).
const _S14_CARD_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
async function enterTextbookOverflowState(page, opts = {}) {
    const variant = opts.variant === 'fill' ? 'fill' : 'tall';
    const cards = opts.cards ?? (variant === 'fill' ? 1 : 4);
    const cardHeight = opts.cardHeight ?? (variant === 'fill' ? 220 : 1400);
    await resetLessonChromeState(page);
    const result = await page.evaluate(({ cards, cardHeight, img }) => {
        const body = document.getElementById('learnBody');
        const scroll = document.getElementById('learnExplainScroll');
        const explain = document.getElementById('learnExplainContent');
        const overlay = document.getElementById('learnBookOverlay');
        if (!body || !scroll || !overlay) {
            return { ok: false, reason: 'missing #learnBody / #learnExplainScroll / #learnBookOverlay' };
        }
        body.classList.add('chapter-overview-active', 'learn-textbook-active');
        scroll.classList.add('textbook-mode');
        if (explain) explain.style.display = 'none';     // mirror _setLearnMode (Band-2 L24603 is inline-masked anyway)
        overlay.classList.remove('hidden');
        overlay.style.display = 'block';
        const card = `<div class="textbook-page-card" style="width:680px;height:${cardHeight}px;background:#9aa4b2;border-radius:8px;flex:0 0 auto;">`
            + `<img src="${img}" alt="" style="display:block;width:100%;height:100%;"></div>`;
        overlay.innerHTML = `<div class="textbook-pages-flow">${card.repeat(cards)}</div>`;
        void overlay.offsetHeight;                        // force synchronous layout
        const flow = overlay.querySelector('.textbook-pages-flow');
        return {
            ok: true,
            hasBothClasses: body.classList.contains('chapter-overview-active')
                && body.classList.contains('learn-textbook-active'),
            paddingBottom: flow ? getComputedStyle(flow).paddingBottom : '__no-flow__',
            scrollHeight: scroll.scrollHeight,
            clientHeight: scroll.clientHeight,
        };
    }, { cards, cardHeight, img: _S14_CARD_IMG });

    assertOrThrow(result.ok, `enterTextbookOverflowState: ${result.reason || 'core textbook DOM missing'}`);
    assertOrThrow(result.hasBothClasses,
        'enterTextbookOverflowState: combined chapter-overview-active + learn-textbook-active not both set on #learnBody');
    // Band-2 must be the LIVE cascade winner: padding-bottom resolves to the Band-2
    // clamp(48px,8vh,86px) = 64px @800h, NOT the Band-1 clamp(32,5vh,58) = 40px.
    // (Used value — fine for a sentinel at a pinned viewport; this is why the
    // witness is visual-diff+arbiter, not css-probe.)
    // HEIGHT COUPLING: the '64px' literal is 8vh of an 800px-tall viewport. BOTH
    // callers pin height=800 — visual-diff at 1280x800, the arbiter at every
    // VIEWPORTS width with setViewportSize({ height: 800 }) (_view-cascade-probe.js).
    // If a non-800h viewport is ever added to either harness, recompute this literal
    // (8vh of the new height, clamped to [48,86]) or the desktop witness fails-closed
    // here for the wrong reason.
    assertOrThrow(result.paddingBottom === '64px',
        `enterTextbookOverflowState: .textbook-pages-flow padding-bottom is ${result.paddingBottom}, expected 64px `
        + `(Band-2 winner @800h). Band-1's 40px means the doubled-ID Band-2 rule is not winning — witness invalid.`);
    if (variant === 'tall') {
        assertOrThrow(result.scrollHeight > result.clientHeight + 200,
            `enterTextbookOverflowState(tall): not overflowing (scrollHeight ${result.scrollHeight} <= clientHeight `
            + `${result.clientHeight}+200). height:100%/padding-bottom would use-value-collapse → vacuous (fail-open) witness.`);
    } else {
        assertOrThrow(result.scrollHeight <= result.clientHeight + 2,
            `enterTextbookOverflowState(fill): content overflows (scrollHeight ${result.scrollHeight} > clientHeight `
            + `${result.clientHeight}+2). min-height:100% is inert on overflowing content — lower cardHeight.`);
    }
    await settleLesson(page);
    return result;
}

function assertOrThrow(condition, msg) {
    if (!condition) throw new Error(msg);
}

// Wait until the app's IIFE bootstrap has finished — both window.* helpers
// from ui-friction-fixes.js AND the every-chapter-button-hooked invariant
// from the deferred 250ms pass. Lifted verbatim from
// test-ui-friction-v123.js so future Playwright scripts share one ready
// gate instead of forking it. Throws if not ready within timeoutMs (default
// 25000 — same value the v123 test settled on after observing slow boots
// on cold WSL/Render).
async function waitForBoot(page, timeoutMs = 25000) {
    await page.waitForFunction(() => {
        if (typeof window.__ftutorMarkCompleted !== 'function') return false;
        const syl = document.getElementById('courseSyllabus');
        if (!syl) return false;
        const chs = syl.querySelectorAll('.syllabus-chapter');
        if (!chs.length) return false;
        return Array.from(chs).every(b => b.dataset.ftutorChapterHook === '1');
    }, null, { timeout: timeoutMs });
}

// Click a target up to opts.maxTries times, waiting up to opts.perTryMs
// for a console log matching logRegex after each click. Encodes the
// "animation-swallowed-click" workaround from test-lesson-open-no-hang.js
// L100-107 and the inline copy in openSubtopic L142-156 — a card whose
// onclick fires openLearnMode is silently ignored while a 720ms page-turn
// animation is in flight, so we retry up to 5 times against an
// observable side-effect (the [openLearnMode] log).
//
// Returns true on success; throws after exhausting retries so the caller
// can decide whether to halt the surrounding flow.
async function clickUntilLog(page, locatorOrSelector, logRegex, opts = {}) {
    const { maxTries = 5, perTryMs = 2000, pollMs = 100 } = opts;
    const target = typeof locatorOrSelector === 'string'
        ? page.locator(locatorOrSelector)
        : locatorOrSelector;
    const sawLog = { value: false };
    const listener = m => { try { if (logRegex.test(m.text())) sawLog.value = true; } catch (_) {} };
    page.on('console', listener);
    try {
        for (let i = 0; i < maxTries; i++) {
            // Reset sentinel BEFORE each click so a late log from the prior
            // iteration (or any unrelated matching log emitted before this
            // attempt) doesn't falsely confirm the click contract — this
            // helper documents "clicks until a NEW log appears" per iteration,
            // not "any matching log ever seen".
            sawLog.value = false;
            try { await target.click(); } catch (_) { /* tolerate transient detached/disabled */ }
            const t0 = Date.now();
            while (Date.now() - t0 < perTryMs) {
                if (sawLog.value) return true;
                await page.waitForTimeout(pollMs);
            }
        }
    } finally {
        // Detach defensively — page.off itself rarely throws in playwright
        // 1.60, but if the page/context was torn down mid-flight (AFK
        // cleanup race) we must NOT swallow the more informative
        // "click never triggered" error below.
        try { page.off('console', listener); } catch (_) {}
    }
    throw new Error(`click never triggered ${logRegex} after ${maxTries} tries (perTryMs=${perTryMs})`);
}

// FlowStep runner. Drives a sequence of {action, assert} steps against a
// Playwright page. The contract is documented at
// docs/HARNESS_INTERACTIVE_PLAN.md — every wait is a polled assert (no
// page.waitForTimeout inside step bodies) so the runner is deterministic
// in baseline mode.
//
//   steps: Array<{
//     name: string,
//     action: async (page) => void,
//     assert: async (page) => any,     // truthy = step passed
//     settle?: 'lesson'|'rAF'|null,    // default 'rAF'
//     timeoutMs?: number,              // default 5000; cap on assert poll
//   }>
//   opts: {
//     traceLabel?: string,             // used for failure screenshot file
//     artifactDir?: string|null,       // where to dump <label>__step-<i>.png on fail
//   }
//
// Returns { passed, failedAt, error, stepLog }. On failure, leaves a
// per-step PNG in artifactDir (if provided) so AFK debugging can inspect
// the DOM state at the failure point without re-running.
async function runFlow(page, steps, opts = {}) {
    const { traceLabel = 'flow', artifactDir = null } = opts;
    const fs2 = require('fs');
    const path2 = require('path');
    const stepLog = [];
    const dumpArtifact = async (i) => {
        if (!artifactDir) return;
        try {
            fs2.mkdirSync(artifactDir, { recursive: true });
            await page.screenshot({
                path: path2.join(artifactDir, `${traceLabel}__step-${i}.png`),
                fullPage: false,
            });
        } catch (_) { /* artifact dump is best-effort; never mask the real error */ }
    };

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const t0 = Date.now();
        try {
            await step.action(page);
            const settleMode = step.settle === undefined ? 'rAF' : step.settle;
            if (settleMode === 'lesson') {
                await settleLesson(page);
            } else if (settleMode === 'rAF') {
                await settleRaf(page);
            }
            const timeoutMs = typeof step.timeoutMs === 'number' ? step.timeoutMs : 5000;
            const deadline = Date.now() + timeoutMs;
            let ok = false;
            let assertErr = null;
            while (Date.now() < deadline) {
                try {
                    const v = await step.assert(page);
                    if (v) { ok = true; break; }
                } catch (e) {
                    assertErr = e;
                    break;
                }
                await page.waitForTimeout(100);
            }
            const ms = Date.now() - t0;
            stepLog.push({ i, name: step.name, ms, ok });
            if (!ok) {
                const err = assertErr || new Error(
                    `step "${step.name}" assert never became truthy within ${timeoutMs}ms`
                );
                await dumpArtifact(i);
                return { passed: false, failedAt: i, error: err, stepLog };
            }
        } catch (err) {
            stepLog.push({ i, name: step.name, ms: Date.now() - t0, ok: false });
            await dumpArtifact(i);
            return { passed: false, failedAt: i, error: err, stepLog };
        }
    }
    return { passed: true, failedAt: null, error: null, stepLog };
}

// Resolve a lesson-cache file path using the same workspace-preferred fallback
// chain that ws-bridge.js uses. Returns the resolved absolute path or null.
function resolveLessonCachePath(repoRoot, sectionId) {
    const filename = 'new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md';
    const folder = sectionId.replace(/\./g, '_'); // 3.8-1 → 3_8-1
    const candidates = [
        path.join(repoRoot, 'workspace', 'materials', 'lesson-cache', folder, filename),
        path.join(repoRoot, 'materials', 'lesson-cache', folder, filename),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

module.exports = {
    MASK_CSS,
    waitForHealth,
    spawnBridge,
    stopBridge,
    injectMaskInitScript,
    dismissIntro,
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
    waitForBoot,
    clickUntilLog,
    runFlow,
};
