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

const PORT = Number(process.env.TUTOR_CONVOLUTION_MICRO_PORT || 9161);
const BASE = `http://127.0.0.1:${PORT}`;
const repoRoot = path.resolve(__dirname, '..');
const SUBTOPIC = {
  chapter: 'Chapter 2',
  section: '2.4 System Response to External Input: The Zero-State Response',
  title: '2.4-2 Graphical Understanding of Convolution Operation',
};
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function waitForLayout(page) {
  await settleLesson(page);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function goTo(page, position) {
  await page.waitForTimeout(700);
  await page.evaluate((next) => window.jumpToConvolutionLessonPosition?.(next), position);
  await page.waitForFunction((next) => window.getConvolutionLessonStageState?.()?.position === next && !window.isLearnPageTurning, position, { timeout: 5000 }).catch(async (error) => {
    const state = await page.evaluate(() => ({ state: window.getConvolutionLessonStageState?.(), turning: window.isLearnPageTurning }));
    error.message += `; observed ${JSON.stringify(state)}`;
    throw error;
  });
  await waitForLayout(page);
}

async function main() {
  const server = spawnBridge(repoRoot, PORT);
  let browser;
  try {
    await waitForHealth(BASE);
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await injectMaskInitScript(context);
    await context.route('https://www.geogebra.org/**', route => route.abort());
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await enterGuestMode(page, BASE);
    await openSubtopic(page, SUBTOPIC);
    await page.waitForSelector('.lesson-page-frame[data-lesson-section="2.4-2"]', { timeout: 5000 });
    await waitForLayout(page);
    await page.locator('[data-convolution-stage-target="lesson"]').click();
    await page.waitForFunction(() => window.getConvolutionLessonStageState?.()?.stage === 'lesson', null, { timeout: 5000 });
    await page.waitForTimeout(700);
    await goTo(page, 2);

    await page.locator('[data-convolution-time-choice="t2"]').click();
    const timeClick = await page.evaluate(() => ({
      pressed: document.querySelector('[data-convolution-time-choice="t2"]')?.getAttribute('aria-pressed'),
      signal: document.querySelector('[data-convolution-moving-signal]')?.dataset.position,
      overlap: document.querySelector('[data-convolution-overlap-preview]')?.dataset.position,
      output: document.querySelector('[data-convolution-output-dot]')?.dataset.outputPoint,
    }));
    record('Page 2 click synchronizes moving signal, overlap, and output point',
      timeClick.pressed === 'true'
        && timeClick.signal === 't2'
        && timeClick.overlap === 't2'
        && timeClick.output === 't2',
      JSON.stringify(timeClick));

    await page.locator('[data-convolution-time-choice="t3"]').focus();
    await page.keyboard.press('Space');
    const timeKeyboard = await page.locator('[data-convolution-moving-signal]').getAttribute('data-position');
    record('Page 2 controls work with Space keyboard activation', timeKeyboard === 't3', `position=${timeKeyboard}`);

    await goTo(page, 3);
    await page.locator('[data-convolution-contact-choice="last"]').press('Enter');
    const contact = await page.evaluate(() => ({
      diagram: document.querySelector('[data-convolution-contact-diagram]')?.dataset.contact,
      breakpoint: document.querySelector('[data-convolution-breakpoint="last"]')?.getAttribute('aria-current'),
      otherCurrent: document.querySelectorAll('[data-convolution-breakpoint][aria-current="true"]').length,
    }));
    record('Page 3 contact selection moves the diagram and one output breakpoint',
      contact.diagram === 'last' && contact.breakpoint === 'true' && contact.otherCurrent === 1,
      JSON.stringify(contact));

    await goTo(page, 4);
    await page.locator('[data-convolution-analogy-choice="sprinkler"]').click();
    const analogy = await page.evaluate(() => ({
      pressed: document.querySelector('[data-convolution-analogy-choice="sprinkler"]')?.getAttribute('aria-pressed'),
      visible: Array.from(document.querySelectorAll('[data-convolution-analogy-panel]')).filter(panel => !panel.hidden).map(panel => panel.dataset.convolutionAnalogyPanel),
    }));
    record('Page 4 shows exactly one selected analogy panel',
      analogy.pressed === 'true' && JSON.stringify(analogy.visible) === JSON.stringify(['sprinkler']),
      JSON.stringify(analogy));

    await page.evaluate(() => window.__ftutorConvolutionLessonInteractions?.mount(document.getElementById('learnExplainContent')));
    await page.locator('[data-convolution-analogy-choice="past-effects"]').click();
    const remount = await page.evaluate(() => ({
      visible: Array.from(document.querySelectorAll('[data-convolution-analogy-panel]')).filter(panel => !panel.hidden).map(panel => panel.dataset.convolutionAnalogyPanel),
      listenerCount: document.querySelectorAll('[data-convolution-analogy-choice][aria-pressed="true"]').length,
    }));
    record('remounting the page keeps one delegated handler and one visible panel',
      JSON.stringify(remount.visible) === JSON.stringify(['past-effects']) && remount.listenerCount === 1,
      JSON.stringify(remount));

    await page.evaluate(() => window.__ftutorConvolutionLessonInteractions?.destroy(document.getElementById('learnExplainContent')));
    await page.locator('[data-convolution-analogy-choice="ink"]').click();
    const destroyed = await page.evaluate(() => ({
      pressed: document.querySelector('[data-convolution-analogy-choice="ink"]')?.getAttribute('aria-pressed'),
      visible: Array.from(document.querySelectorAll('[data-convolution-analogy-panel]')).filter(panel => !panel.hidden).map(panel => panel.dataset.convolutionAnalogyPanel),
    }));
    record('destroy removes the delegated listener before content replacement',
      destroyed.pressed === 'false' && JSON.stringify(destroyed.visible) === JSON.stringify(['past-effects']),
      JSON.stringify(destroyed));
    record('micro-interaction test produced no JavaScript page errors', pageErrors.length === 0, JSON.stringify(pageErrors));
    await context.close();
  } catch (error) {
    console.error(error && error.stack || error);
    record('test harness completed', false, error.message);
  } finally {
    if (browser) await browser.close();
    await stopBridge(server, { label: 'convolution-micro' });
  }

  const failed = results.filter(result => !result.ok);
  console.log(`\n[convolution-micro] ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main();
