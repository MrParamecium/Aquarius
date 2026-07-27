#!/usr/bin/env node
/**
 * UI Friction Fix Pack v1.2.3 smoke test.
 *
 * Verifies the v1.2.3 surface area, then enters a real cached lesson to
 * exercise the single lesson-pager contract:
 *   - Pager bar HTML is present.
 *   - Legacy page-corner controls are absent.
 *   - Zero/single knowledge-point lessons hide the pager; segmented lessons
 *     show it with the correct first/last-page button states.
 *   - The pager exposes the approved glass surface and keyboard focus rule.
 *   - Window-level helpers (__ftutorMarkCompleted, __ftutorAdvanceSubsection,
 *     __ftutorIsCompleted, __ftutorApplyCompletionIndicators,
 *     __ftutorPeekNextSubsection, __ftutorRefreshPager) are wired.
 *   - Syllabus chapter buttons have the `data-ftutorChapterHook='1'` marker.
 *   - Marking a subsection complete propagates to localStorage AND adds the
 *     `is-completed` class to the matching DOM button.
 *   - Quick Check CSS overrides survive (font-size >= 16px on .kc-option-btn).
 *
 * Existing bridge expected at TUTOR_TEST_PORT (defaults to 9123).
 * Exits 0 if every assertion succeeds; exits 1 with a diff report otherwise.
 */
const { chromium } = require('playwright');
const { enterGuestMode, openSubtopic, settleLesson } = require('./test-utils.js');

const PORT = Number(process.env.TUTOR_TEST_PORT || 9123);
const BASE = `http://127.0.0.1:${PORT}`;
const SUBTOPIC = {
    id: '1_1-1',
    title: '1.1-1 Signal Energy',
    chapter: 'Chapter 1: Signals and Systems',
    section: '1.1 Size of a Signal'
};

function fail(stage, info) {
    console.error(`FAIL [${stage}]`, JSON.stringify(info, null, 2));
    process.exit(1);
}

async function main() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push('pageerror: ' + e.message));
    page.on('console', msg => {
        if (msg.type() === 'error') pageErrors.push('console.error: ' + msg.text());
    });

    try {
        await page.goto(BASE + '/', { waitUntil: 'commit', timeout: 20000 });
        // Wait until both the IIFE marker AND the deferred indicator pass have run
        // (the IIFE schedules a setTimeout(250ms) that finishes patchChapterClicks).
        await page.waitForFunction(() => {
            if (typeof window.__ftutorMarkCompleted !== 'function') return false;
            const syl = document.getElementById('courseSyllabus');
            if (!syl) return false;
            const chs = syl.querySelectorAll('.syllabus-chapter');
            if (!chs.length) return false;
            // chapter hook applied
            return Array.from(chs).every(b => b.dataset.ftutorChapterHook === '1');
        }, null, { timeout: 25000 });

        const snapshot = await page.evaluate(() => {
            const helpers = [
                '__ftutorMarkCompleted',
                '__ftutorIsCompleted',
                '__ftutorApplyCompletionIndicators',
                '__ftutorAdvanceSubsection',
                '__ftutorRetreatSubsection',
                '__ftutorPeekNextSubsection',
                '__ftutorRefreshPager'
            ];
            const helperState = Object.fromEntries(helpers.map(n => [n, typeof window[n]]));

            const pagerEl = document.getElementById('learnExplainPager');
            const pagerPrev = document.getElementById('learnPagerPrevBtn');
            const pagerNext = document.getElementById('learnPagerNextBtn');
            const pageCorners = document.querySelectorAll(
                '#lecturePrevOverlayBtn, #lectureNextOverlayBtn, .lecture-page-corner, .page-turner'
            );

            const syl = document.getElementById('courseSyllabus');
            const chapters = syl ? Array.from(syl.querySelectorAll('.syllabus-chapter')) : [];
            const hookedChapters = chapters.filter(b => b.dataset.ftutorChapterHook === '1').length;
            const subsections = syl ? Array.from(syl.querySelectorAll('.syllabus-subsection')) : [];

            // Pick a subsection to mark and verify completion plumbing.
            const sample = subsections[0];
            const sampleTitle = sample ? sample.getAttribute('data-subsection') : '';
            let postMarkCompleted = 0;
            let storedCount = 0;
            let sampleHasCompletedClass = false;
            try {
                if (sample && sampleTitle) {
                    window.__ftutorMarkCompleted(sampleTitle, sampleTitle);
                    window.__ftutorApplyCompletionIndicators();
                    postMarkCompleted = document.querySelectorAll('#courseSyllabus .syllabus-subsection.is-completed').length;
                    sampleHasCompletedClass = sample.classList.contains('is-completed');
                    const stored = JSON.parse(localStorage.getItem('aquariusCompletedSubsections.v1') || '[]');
                    storedCount = stored.length;
                    localStorage.removeItem('aquariusCompletedSubsections.v1');
                    sample.classList.remove('is-completed');
                }
            } catch (e) {
                return { helperState, error: String(e && e.message) };
            }

            // Issue 7 CSS reality check: when kcModal is hidden the rules still
            // apply to .kc-option-btn via the !important override. We sniff the
            // active stylesheet for the selector.
            const cssRule = (() => {
                for (const sheet of Array.from(document.styleSheets)) {
                    let rules;
                    try { rules = sheet.cssRules; } catch (_) { continue; }
                    if (!rules) continue;
                    for (const rule of Array.from(rules)) {
                        if (!rule.selectorText) continue;
                        if (rule.selectorText.includes('kc-option-btn')) {
                            return { selector: rule.selectorText, cssText: rule.cssText.slice(0, 220) };
                        }
                    }
                }
                return null;
            })();

            const pagerCssRule = (() => {
                for (const sheet of Array.from(document.styleSheets)) {
                    let rules;
                    try { rules = sheet.cssRules; } catch (_) { continue; }
                    if (!rules) continue;
                    for (const rule of Array.from(rules)) {
                        if (!rule.selectorText) continue;
                        if (rule.selectorText === '#learnExplainPager') {
                            return rule.cssText.slice(0, 220);
                        }
                    }
                }
                return null;
            })();

            return {
                helperState,
                pagerHtmlPresent: !!pagerEl,
                pagerPrevPresent: !!pagerPrev,
                pagerNextPresent: !!pagerNext,
                pagerCount: document.querySelectorAll('#learnExplainPager').length,
                pageCornerCount: pageCorners.length,
                pagerCssRule,
                chCount: chapters.length,
                hookedChapters,
                subCount: subsections.length,
                sampleTitle,
                postMarkCompleted,
                sampleHasCompletedClass,
                storedCount,
                quickCheckRule: cssRule
            };
        });

        console.log(JSON.stringify(snapshot, null, 2));

        await enterGuestMode(page, BASE);
        await openSubtopic(page, SUBTOPIC);
        await settleLesson(page);

        const pagerContract = await page.evaluate(async () => {
            const pager = document.getElementById('learnExplainPager');
            const prev = document.getElementById('learnPagerPrevBtn');
            const next = document.getElementById('learnPagerNextBtn');
            const position = document.getElementById('learnPagerPosition');
            const nextLabel = document.getElementById('learnPagerNextLabel');
            if (!pager || !prev || !next || !position || !nextLabel) {
                return { error: 'pager DOM incomplete' };
            }

            const originalPoints = learnKnowledgePoints;
            const originalIndex = currentKnowledgePointIndex;

            async function settlePager() {
                window.__ftutorRefreshPager();
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }

            async function capture(points, index) {
                learnKnowledgePoints = points;
                currentKnowledgePointIndex = index;
                await settlePager();
                return {
                    hidden: pager.classList.contains('hidden'),
                    position: position.textContent,
                    prevDisabled: prev.disabled,
                    nextDisabled: next.disabled,
                    nextLabel: nextLabel.textContent,
                    nextTopic: next.classList.contains('is-next-topic')
                };
            }

            const zero = await capture([], 0);
            const singleton = await capture([{ title: 'Only point' }], 0);
            const first = await capture([{ title: 'First' }, { title: 'Second' }], 0);
            const last = await capture([{ title: 'First' }, { title: 'Second' }], 1);

            learnKnowledgePoints = originalPoints;
            currentKnowledgePointIndex = originalIndex;
            await settlePager();

            const pagerStyle = getComputedStyle(pager);
            const buttonStyle = getComputedStyle(next);
            let hasFocusVisibleRule = false;
            function scanRules(rules) {
                for (const rule of Array.from(rules || [])) {
                    if (rule.selectorText && rule.selectorText.includes('#learnExplainPager')
                        && rule.selectorText.includes(':focus-visible')) {
                        hasFocusVisibleRule = true;
                    }
                    if (rule.cssRules) scanRules(rule.cssRules);
                }
            }
            for (const sheet of Array.from(document.styleSheets)) {
                try { scanRules(sheet.cssRules); } catch (_) {}
            }

            return {
                zero,
                singleton,
                first,
                last,
                glass: {
                    backgroundColor: pagerStyle.backgroundColor,
                    backdropFilter: pagerStyle.backdropFilter || pagerStyle.webkitBackdropFilter || 'none',
                    borderTopWidth: pagerStyle.borderTopWidth,
                    boxShadow: pagerStyle.boxShadow,
                    buttonMinHeight: buttonStyle.minHeight,
                    letterSpacing: buttonStyle.letterSpacing,
                    hasFocusVisibleRule
                }
            };
        });

        const startNavigation = await page.evaluate(() => ({
            index: currentKnowledgePointIndex,
            total: Array.isArray(learnKnowledgePoints) ? learnKnowledgePoints.length : 0
        }));
        const navigationDelta = startNavigation.index < startNavigation.total - 1 ? 1 : -1;
        const forwardButton = navigationDelta > 0 ? '#learnPagerNextBtn' : '#learnPagerPrevBtn';
        const reverseButton = navigationDelta > 0 ? '#learnPagerPrevBtn' : '#learnPagerNextBtn';
        await page.click(forwardButton);
        await page.waitForFunction(
            expected => currentKnowledgePointIndex === expected,
            startNavigation.index + navigationDelta,
            { timeout: 3000 }
        );
        const afterForwardIndex = await page.evaluate(() => currentKnowledgePointIndex);
        await page.waitForFunction(
            () => typeof isLearnPageTurning === 'undefined' || !isLearnPageTurning,
            null,
            { timeout: 3000 }
        );
        await page.click(reverseButton);
        await page.waitForFunction(
            expected => currentKnowledgePointIndex === expected,
            startNavigation.index,
            { timeout: 3000 }
        );
        const pagerNavigationContract = {
            startIndex: startNavigation.index,
            afterForwardIndex,
            returnedIndex: await page.evaluate(() => currentKnowledgePointIndex),
            delta: navigationDelta
        };

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(250);
        const narrowPanelContract = await page.evaluate(() => {
            const pager = document.getElementById('learnExplainPager');
            const lecture = document.getElementById('learnExplainCol');
            const qa = document.getElementById('learnChatCol');
            const showQa = document.getElementById('learnChatRestoreBtn');
            const showLecture = document.getElementById('learnExplainRestoreBtn');
            const isVisible = element => {
                if (!element) return false;
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && rect.width > 0
                    && rect.height > 0;
            };
            return {
                lectureWidth: lecture?.getBoundingClientRect().width || 0,
                qaWidth: qa?.getBoundingClientRect().width || 0,
                pagerDisplay: pager ? getComputedStyle(pager).display : null,
                showQaVisible: isVisible(showQa),
                showQaHeight: showQa?.getBoundingClientRect().height || 0,
                showLectureVisible: isVisible(showLecture),
                pageCornerCount: document.querySelectorAll(
                    '#lecturePrevOverlayBtn, #lectureNextOverlayBtn, .lecture-page-corner, .page-turner'
                ).length
            };
        });

        console.log(JSON.stringify({ pagerContract, pagerNavigationContract, narrowPanelContract }, null, 2));

        // Assertions
        const failures = [];
        Object.entries(snapshot.helperState).forEach(([k, v]) => {
            if (v !== 'function') failures.push(`helper ${k} = ${v}`);
        });
        if (!snapshot.pagerHtmlPresent) failures.push('learnExplainPager missing in DOM');
        if (!snapshot.pagerPrevPresent || !snapshot.pagerNextPresent) failures.push('pager buttons missing');
        if (snapshot.pagerCount !== 1) failures.push(`pager count = ${snapshot.pagerCount}`);
        if (snapshot.pageCornerCount !== 0) failures.push(`legacy page-corner controls = ${snapshot.pageCornerCount}`);
        if (!snapshot.pagerCssRule) failures.push('pager CSS rule not found');
        if (snapshot.chCount < 1) failures.push('no syllabus chapters');
        if (snapshot.hookedChapters !== snapshot.chCount) failures.push(`chapter hooks: ${snapshot.hookedChapters}/${snapshot.chCount}`);
        if (snapshot.subCount < 1) failures.push('no subsections rendered');
        if (snapshot.storedCount < 1) failures.push('completion mark did not persist');
        if (!snapshot.sampleHasCompletedClass) failures.push('is-completed class not applied to sample subsection');
        if (!snapshot.quickCheckRule) failures.push('Quick Check CSS override missing');
        if (pagerContract.error) failures.push(pagerContract.error);
        if (!pagerContract.zero?.hidden) failures.push('zero-point lesson pager is visible');
        if (!pagerContract.singleton?.hidden) failures.push('single-point lesson pager is visible');
        if (pagerContract.first?.hidden) failures.push('segmented lesson pager is hidden');
        if (pagerContract.first?.position !== '1 / 2') failures.push(`first-page position = ${pagerContract.first?.position}`);
        if (!pagerContract.first?.prevDisabled || pagerContract.first?.nextDisabled) {
            failures.push('first-page button state is incorrect');
        }
        if (pagerContract.last?.hidden) failures.push('last-page pager is hidden');
        if (pagerContract.last?.position !== '2 / 2') failures.push(`last-page position = ${pagerContract.last?.position}`);
        if (pagerContract.last?.prevDisabled) failures.push('last-page Prev is disabled');
        if (!['Next topic', 'End'].includes(pagerContract.last?.nextLabel)) {
            failures.push(`last-page label = ${pagerContract.last?.nextLabel}`);
        }
        if (pagerContract.glass?.backgroundColor === 'rgb(255, 255, 255)') failures.push('pager background is opaque white');
        if (!pagerContract.glass?.backdropFilter || pagerContract.glass.backdropFilter === 'none') {
            failures.push('pager backdrop-filter is missing');
        }
        if (pagerContract.glass?.borderTopWidth !== '1px') {
            failures.push(`pager border width = ${pagerContract.glass?.borderTopWidth}`);
        }
        const buttonMinHeight = parseFloat(pagerContract.glass?.buttonMinHeight || '');
        if (!Number.isFinite(buttonMinHeight) || buttonMinHeight < 44) {
            failures.push(`pager button min-height = ${pagerContract.glass?.buttonMinHeight}`);
        }
        if (!['0px', 'normal'].includes(pagerContract.glass?.letterSpacing)) {
            failures.push(`pager button letter-spacing = ${pagerContract.glass?.letterSpacing}`);
        }
        if (!pagerContract.glass?.hasFocusVisibleRule) failures.push('pager :focus-visible rule missing');
        if (pagerNavigationContract.afterForwardIndex !== pagerNavigationContract.startIndex + pagerNavigationContract.delta) {
            failures.push(`bottom pager moved by ${pagerNavigationContract.afterForwardIndex - pagerNavigationContract.startIndex}`);
        }
        if (pagerNavigationContract.returnedIndex !== pagerNavigationContract.startIndex) {
            failures.push(`bottom pager did not return to index ${pagerNavigationContract.startIndex}`);
        }
        if (narrowPanelContract.lectureWidth < 350 || narrowPanelContract.qaWidth !== 0) {
            failures.push(`narrow viewport panels = lecture ${narrowPanelContract.lectureWidth}px, Q&A ${narrowPanelContract.qaWidth}px`);
        }
        if (narrowPanelContract.pagerDisplay === 'none') {
            failures.push(`narrow lecture pager display = ${narrowPanelContract.pagerDisplay}`);
        }
        if (!narrowPanelContract.showQaVisible || narrowPanelContract.showQaHeight < 44) {
            failures.push(`narrow Q&A switch = visible ${narrowPanelContract.showQaVisible}, height ${narrowPanelContract.showQaHeight}px`);
        }
        if (narrowPanelContract.showLectureVisible) {
            failures.push('narrow lecture switch is visible while lecture is already open');
        }
        if (narrowPanelContract.pageCornerCount !== 0) {
            failures.push(`narrow viewport legacy page-corner controls = ${narrowPanelContract.pageCornerCount}`);
        }

        const fatalErrors = pageErrors.filter(e => !/MathJax|Failed to load resource|tex-mml-chtml|cdn.tailwindcss|font/i.test(e));
        if (fatalErrors.length) failures.push('console errors: ' + JSON.stringify(fatalErrors.slice(0, 5)));

        if (failures.length) {
            fail('assertions', failures);
        }
        console.log('PASS');
    } finally {
        await browser.close();
    }
}

main().catch(e => {
    console.error('TEST_THREW', e && (e.stack || e.message) || e);
    process.exit(1);
});
