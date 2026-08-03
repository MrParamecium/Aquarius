'use strict';

const path = require('path');
const { chromium } = require('playwright');
const {
  spawnBridge,
  stopBridge,
  waitForHealth,
  injectMaskInitScript,
  enterGuestMode,
  openSubtopic,
  settleLesson,
} = require('./test-utils.js');

const PORT = Number(process.env.TUTOR_CONVOLUTION_PRACTICE_PORT || 9157);
const BASE = `http://127.0.0.1:${PORT}`;
const repoRoot = path.resolve(__dirname, '..');
const SUBTOPIC = {
  chapter: 'Chapter 2',
  section: '2.4 System Response to External Input: The Zero-State Response',
  title: '2.4-2 Graphical Understanding of Convolution Operation',
};
const CORRECT_ANSWERS = Object.freeze({
  '2.10': { flip: 'x', supportStart: '-inf', supportEnd: 'inf', breakpoints: [0], segments: ['falling', 'rising'] },
  '2.11': { flip: 'g', supportStart: '0', supportEnd: 'inf', breakpoints: [0], segments: ['rising'] },
  '2.12': { flip: 'g', supportStart: '-inf', supportEnd: 'inf', breakpoints: [0], segments: ['constant', 'falling'] },
  '2.13': { flip: 'g', supportStart: '0', supportEnd: 'inf', breakpoints: [0], segments: ['rising'] },
});
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function waitForLayout(page) {
  await settleLesson(page);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function openPractice(page) {
  await page.locator('[data-convolution-stage-target="practice"]').click();
  await page.waitForFunction(() => window.getConvolutionLessonStageState?.()?.stage === 'practice' && !window.isLearnPageTurning, null, { timeout: 5000 });
  await waitForLayout(page);
  await page.waitForSelector('[data-convolution-practice]', { timeout: 5000 });
}

async function main() {
  const server = spawnBridge(repoRoot, PORT);
  let browser;
  try {
    await waitForHealth(BASE);
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await injectMaskInitScript(context);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await enterGuestMode(page, BASE);
    await openSubtopic(page, SUBTOPIC);
    await page.waitForSelector('.lesson-page-frame[data-lesson-section="2.4-2"]', { timeout: 5000 });
    await waitForLayout(page);
    await openPractice(page);

    const initial = await page.evaluate(() => {
      const api = window.__ftutorConvolutionPractice;
      const root = document.querySelector('[data-convolution-practice]');
      const drills = Array.from(root?.querySelectorAll('[data-practice-drill]') || []);
      const hint = root?.querySelector('[data-practice-hint]');
      const feedback = root?.querySelector('[data-practice-feedback]');
      return {
        apiReady: Boolean(api && typeof api.evaluate === 'function'),
        drillIds: drills.map(drill => drill.dataset.practiceDrill),
        statuses: drills.map(drill => drill.querySelector('[data-practice-status]')?.textContent.trim() || ''),
        hintDisabled: Boolean(hint?.disabled),
        feedbackLive: feedback?.getAttribute('aria-live') || '',
        genericQuickCheck: Boolean(document.querySelector('#startTestBtn')),
        nextDisabled: Boolean(document.getElementById('learnPagerNextBtn')?.disabled),
        nextLabel: document.getElementById('learnPagerNextLabel')?.textContent.trim() || '',
      };
    });
    record('practice opens with four textbook drills and no generic Quick Check',
      initial.apiReady
        && JSON.stringify(initial.drillIds) === JSON.stringify(['2.10', '2.11', '2.12', '2.13'])
        && initial.statuses.every(status => status === 'Not Started')
        && initial.hintDisabled
        && initial.feedbackLive === 'polite'
        && !initial.genericQuickCheck
        && initial.nextDisabled
        && initial.nextLabel === 'Complete practice',
      JSON.stringify(initial));

    const semantics = await page.evaluate((answers) => {
      const api = window.__ftutorConvolutionPractice;
      return Object.fromEntries(Object.entries(answers).map(([drillId, answer]) => {
        const correct = api.evaluate(drillId, answer);
        const wrong = api.evaluate(drillId, { ...answer, supportStart: '99' });
        const reversed = drillId === '2.10' ? null : api.evaluate(drillId, { ...answer, flip: 'x' });
        return [drillId, { correct, wrong, reversed }];
      }));
    }, CORRECT_ANSWERS);
    record('semantic evaluator accepts all four textbook answers and identifies the wrong field',
      Object.values(semantics).every(result => result.correct?.ok === true
        && result.wrong?.ok === false
        && result.wrong?.field === 'support')
        && Object.entries(semantics).filter(([drillId]) => drillId !== '2.10').every(([, result]) => result.reversed?.ok === true),
      JSON.stringify(semantics));

    const firstAttempt = await page.evaluate(() => {
      const root = document.querySelector('[data-convolution-practice]');
      root.querySelector('[data-practice-submit]').click();
      return {
        hintDisabled: root.querySelector('[data-practice-hint]').disabled,
        feedback: root.querySelector('[data-practice-feedback]').textContent.trim(),
        status: root.querySelector('[data-practice-drill="2.10"] [data-practice-status]').textContent.trim(),
      };
    });
    record('first incomplete attempt unlocks a specific hint and marks the drill in progress',
      !firstAttempt.hintDisabled
        && /flip|signal/i.test(firstAttempt.feedback)
        && firstAttempt.status === 'In Progress',
      JSON.stringify(firstAttempt));

    await page.locator('[data-practice-drill="2.11"]').click();
    await page.locator('[data-practice-flip][value="g"]').check();
    await page.locator('[data-practice-support-start]').fill('0');
    await page.locator('[data-practice-support-end]').fill('inf');
    await page.locator('[data-practice-breakpoint="0"]').click();
    await page.locator('[data-practice-curve-segment="0"]').selectOption('rising');
    await page.locator('[data-practice-submit]').click();
    const mastered = await page.evaluate(() => ({
      status: document.querySelector('[data-practice-drill="2.11"] [data-practice-status]')?.textContent.trim() || '',
      feedback: document.querySelector('[data-practice-feedback]')?.textContent.trim() || '',
      state: window.__ftutorConvolutionPractice?.getState?.(),
    }));
    record('constructing the Drill 2.11 curve marks it mastered with positive feedback',
      mastered.status === 'Mastered'
        && /correct|mastered/i.test(mastered.feedback)
        && mastered.state?.drills?.['2.11']?.status === 'Mastered',
      JSON.stringify(mastered));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#navSyllabusBtn', { timeout: 10000 });
    await openSubtopic(page, SUBTOPIC);
    await page.waitForSelector('.lesson-page-frame[data-lesson-section="2.4-2"]', { timeout: 5000 });
    await waitForLayout(page);
    await openPractice(page);
    const restored = await page.evaluate(() => ({
      status: document.querySelector('[data-practice-drill="2.11"] [data-practice-status]')?.textContent.trim() || '',
      stage: window.getConvolutionLessonStageState?.()?.stage || '',
      overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    }));
    record('practice mastery survives refresh without horizontal overflow',
      restored.status === 'Mastered' && restored.stage === 'practice' && restored.overflow <= 1,
      JSON.stringify(restored));

    await page.setViewportSize({ width: 390, height: 844 });
    await waitForLayout(page);
    const mobile = await page.evaluate(() => {
      const root = document.querySelector('[data-convolution-practice]');
      const targets = Array.from(root?.querySelectorAll('button, input, select') || [])
        .filter(control => !control.disabled && getComputedStyle(control).display !== 'none')
        .map(control => control.getBoundingClientRect());
      return {
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        controlsFit: targets.every(rect => rect.left >= -1 && rect.right <= window.innerWidth + 1),
      };
    });
    record('390px practice controls stay inside the viewport', mobile.overflow <= 1 && mobile.controlsFit, JSON.stringify(mobile));
    record('practice test produced no JavaScript page errors', pageErrors.length === 0, JSON.stringify(pageErrors));

    await context.close();
  } catch (error) {
    console.error(error && error.stack || error);
    record('test harness completed', false, error.message);
  } finally {
    if (browser) await browser.close();
    await stopBridge(server, { label: 'convolution-practice' });
  }

  const failed = results.filter(result => !result.ok);
  console.log(`\n[convolution-practice] ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main();
