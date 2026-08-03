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

const PORT = Number(process.env.TUTOR_CONVOLUTION_LAYOUT_PORT || 9154);
const BASE = `http://127.0.0.1:${PORT}`;
const repoRoot = path.resolve(__dirname, '..');
const SUBTOPIC = {
  chapter: 'Chapter 2',
  section: '2.4 System Response to External Input: The Zero-State Response',
  title: '2.4-2 Graphical Understanding of Convolution Operation',
};
const LESSON_TITLES = [
  'What Is Convolution?',
  'Why Do We Need It?',
  'Understanding t and τ',
  'The Five-Step Method',
  'Change the Variable',
  'Flip',
  'Slide',
  'Multiply and Find the Overlap',
  'Integrate and Trace the Output',
  'Worked Example 1',
  'Worked Example 2',
  'Worked Example 3',
];
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function waitForLayout(page) {
  await settleLesson(page);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function waitForTurn(page) {
  await page.waitForFunction(() => typeof isLearnPageTurning === 'undefined' || !isLearnPageTurning, null, { timeout: 5000 });
  await waitForLayout(page);
}

async function clickStage(page, stage, position) {
  await page.locator(`[data-convolution-stage-target="${stage}"]`).click();
  await page.waitForFunction(
    ({ expectedStage, expectedPosition }) => {
      const state = window.getConvolutionLessonStageState?.();
      return state?.stage === expectedStage
        && (expectedPosition == null || state.position === expectedPosition)
        && !window.isLearnPageTurning;
    },
    { expectedStage: stage, expectedPosition: position },
    { timeout: 5000 }
  );
  await waitForLayout(page);
}

async function goToLessonPage(page, lessonPosition) {
  await page.evaluate((position) => {
    const state = window.getConvolutionLessonStageState?.();
    const index = state?.map?.lessonIndices?.[position - 1];
    if (!Number.isInteger(index)) throw new Error(`missing lesson position ${position}`);
    currentKnowledgePointIndex = index;
    renderCurrentKnowledgePoint();
  }, lessonPosition);
  await waitForLayout(page);
}

async function inspectLessonPage(page, position) {
  await goToLessonPage(page, position);
  return page.evaluate((expectedTitle) => {
    const frame = document.querySelector('.lesson-page-frame[data-lesson-section="2.4-2"]');
    const content = frame?.querySelector('.lesson-page-content');
    const nav = frame?.querySelector('.convolution-stage-nav');
    const title = frame?.querySelector('.lesson-page-heading h2')?.textContent.trim() || '';
    const computed = content ? getComputedStyle(content) : null;
    const images = Array.from(content?.querySelectorAll('.convolution-analogy-image') || []).map(image => ({
      src: new URL(image.src).pathname,
      complete: image.complete,
      width: image.naturalWidth,
      renderedWidth: image.getBoundingClientRect().width,
    }));
    return {
      title,
      titleCorrect: title === expectedTitle,
      stage: frame?.dataset.lessonStage || '',
      position: Number(frame?.dataset.stagePosition || 0),
      total: Number(frame?.dataset.stageTotal || 0),
      boxedNumbers: content?.querySelectorAll('.convolution-page-marker, .convolution-intro-number, [data-convolution-number]').length || 0,
      fontSize: parseFloat(computed?.fontSize || '0'),
      lineHeight: parseFloat(computed?.lineHeight || '0'),
      contentOverflow: content ? Math.max(0, content.scrollWidth - content.clientWidth) : 999,
      pageOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      navOverflow: nav ? Math.max(0, nav.scrollWidth - nav.clientWidth) : 999,
      demoCount: content?.querySelectorAll('.kc-interactive-demo').length || 0,
      visualKinds: Array.from(content?.querySelectorAll('[data-convolution-visual]') || []).map(node => node.dataset.convolutionVisual),
      images,
    };
  }, LESSON_TITLES[position - 1]);
}

async function collectViewport(page, width, height) {
  await page.setViewportSize({ width, height });
  await waitForLayout(page);
  const pages = [];
  for (let position = 1; position <= LESSON_TITLES.length; position += 1) {
    pages.push(await inspectLessonPage(page, position));
  }
  return pages;
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

    const intro = await page.evaluate(() => {
      const frame = document.querySelector('.lesson-page-frame[data-lesson-section="2.4-2"]');
      const tabs = Array.from(frame?.querySelectorAll('[data-convolution-stage-target]') || []);
      const pager = document.getElementById('learnExplainPager');
      const nav = frame?.querySelector('.convolution-stage-nav');
      const navStyle = nav ? getComputedStyle(nav) : null;
      return {
        pointCount: Array.isArray(learnKnowledgePoints) ? learnKnowledgePoints.length : 0,
        state: window.getConvolutionLessonStageState?.() || null,
        labels: tabs.map(tab => tab.textContent.replace(/\s+/g, ' ').trim()),
        activeCount: tabs.filter(tab => tab.getAttribute('aria-current') === 'step').length,
        keyboardReady: tabs.every(tab => tab.tagName === 'BUTTON' && tab.tabIndex >= 0),
        sticky: navStyle?.position === 'sticky',
        objective: frame?.querySelector('.convolution-overview-objective')?.textContent.trim() || '',
        formula: frame?.querySelector('[data-convolution-overview-formula]')?.textContent.replace(/\s+/g, '') || '',
        actions: frame?.querySelectorAll('[data-convolution-core-action]').length || 0,
        starts: frame?.querySelectorAll('[data-convolution-intro-start]').length || 0,
        pagerHidden: !pager || pager.hidden || getComputedStyle(pager).display === 'none',
        boxedNumbers: frame?.querySelectorAll('.convolution-intro-number, .convolution-page-marker, [data-convolution-number]').length || 0,
      };
    });
    record('application maps to one overview, twelve lessons, and one practice page',
      intro.pointCount === 14
        && intro.state?.stage === 'intro'
        && intro.state?.total === 1
        && intro.state?.map?.lessonIndices?.length === 12,
      JSON.stringify({ pointCount: intro.pointCount, state: intro.state }));
    record('overview keeps the three English stage tabs sticky and keyboard operable',
      intro.labels.length === 3
        && intro.labels.every((label, index) => label.includes(['Section Overview', 'Lesson', 'Practice'][index]))
        && intro.activeCount === 1
        && intro.keyboardReady
        && intro.sticky,
      JSON.stringify({ labels: intro.labels, sticky: intro.sticky }));
    record('overview shows the approved objective, formula, actions, and one start button without bottom pager',
      intro.objective === 'Interpret and compute continuous-time convolution graphically.'
        && /x\(τ\).*g\(t−?τ\)/.test(intro.formula)
        && intro.actions === 3
        && intro.starts === 1
        && intro.pagerHidden
        && intro.boxedNumbers === 0,
      JSON.stringify(intro));

    await clickStage(page, 'lesson', 1);
    const lessonStart = await page.evaluate(() => ({
      state: window.getConvolutionLessonStageState?.(),
      pager: document.getElementById('learnPagerPosition')?.textContent.trim() || '',
    }));
    record('Start Lesson enters Lesson 1 of 12',
      lessonStart.state?.stage === 'lesson'
        && lessonStart.state.position === 1
        && lessonStart.state.total === 12
        && lessonStart.pager === 'Lesson 1 / 12',
      JSON.stringify(lessonStart));

    await goToLessonPage(page, 7);
    await clickStage(page, 'practice', 1);
    const practice = await page.evaluate(() => ({
      state: window.getConvolutionLessonStageState?.(),
      pager: document.getElementById('learnPagerPosition')?.textContent.trim() || '',
      drills: document.querySelectorAll('[data-practice-drill]').length,
      genericQuickCheck: Boolean(document.querySelector('#startTestBtn')),
    }));
    record('practice contains the four textbook drills instead of the generic Quick Check',
      practice.state?.stage === 'practice'
        && practice.pager === 'Practice'
        && practice.drills === 4
        && !practice.genericQuickCheck,
      JSON.stringify(practice));

    await clickStage(page, 'lesson', 7);
    const remembered = await page.evaluate(() => window.getConvolutionLessonStageState?.());
    record('returning from practice restores Lesson 7 of 12', remembered?.stage === 'lesson' && remembered.position === 7, JSON.stringify(remembered));

    const timing = await page.evaluate(() => window.getConvolutionLessonTurnTiming?.());
    const before = await page.evaluate(() => currentKnowledgePointIndex);
    const turnStarted = Date.now();
    const moved = await page.evaluate(() => moveLearnKnowledgePoint(1));
    await page.waitForFunction(() => typeof isLearnPageTurning === 'undefined' || !isLearnPageTurning, null, { timeout: 5000 });
    const elapsed = Date.now() - turnStarted;
    await waitForLayout(page);
    const after = await page.evaluate(() => currentKnowledgePointIndex);
    record('lesson uses the approved 180ms fade without paper curl',
      moved
        && after === before + 1
        && timing?.totalMs === 180
        && elapsed < 350,
      JSON.stringify({ timing, elapsed, before, after }));

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await page.evaluate(() => {
      const previous = currentKnowledgePointIndex;
      const result = moveLearnKnowledgePoint(-1);
      return { previous, current: currentKnowledgePointIndex, result, turning: isLearnPageTurning };
    });
    record('reduced motion commits immediately', reduced.result && reduced.current === reduced.previous - 1 && !reduced.turning, JSON.stringify(reduced));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await waitForLayout(page);

    const desktop = await collectViewport(page, 1280, 900);
    record('all twelve desktop lesson pages use approved titles without boxed numbers or overflow',
      desktop.every((item, index) => item.titleCorrect
        && item.stage === 'lesson'
        && item.position === index + 1
        && item.total === 12
        && item.boxedNumbers === 0
        && item.contentOverflow <= 1
        && item.pageOverflow <= 1
        && item.navOverflow <= 1
        && item.fontSize >= 18
        && item.lineHeight >= item.fontSize * 1.6),
      JSON.stringify(desktop.map((item, index) => ({ page: index + 1, title: item.title, font: item.fontSize, overflow: item.pageOverflow }))));
    record('approved visuals and controlled demos appear on the intended pages',
      desktop[0].images.some(image => image.src.endsWith('/convolution-ink-memory-v2.png') && image.complete && image.width === 1153)
        && desktop[1].visualKinds.includes('past-weighting')
        && desktop[3].visualKinds.includes('five-steps')
        && desktop[6].images.some(image => image.src.endsWith('/convolution-sprinkler-procedure-v2.png') && image.complete && image.width === 1153)
        && desktop.slice(4).every(item => item.demoCount === 1),
      JSON.stringify(desktop.map((item, index) => ({ page: index + 1, demos: item.demoCount, visuals: item.visualKinds, images: item.images.map(image => image.src) }))));

    for (const viewport of [[390, 844], [430, 844]]) {
      const snapshot = await collectViewport(page, viewport[0], viewport[1]);
      record(`${viewport[0]}px keeps all twelve pages readable and inside the viewport`,
        snapshot.every(item => item.fontSize >= 16
          && item.contentOverflow <= 1
          && item.pageOverflow <= 1
          && item.navOverflow <= 1
          && item.boxedNumbers === 0),
        JSON.stringify(snapshot.map((item, index) => ({ page: index + 1, font: item.fontSize, overflow: item.pageOverflow }))));
    }

    record('lesson layout test produced no JavaScript page errors', pageErrors.length === 0, JSON.stringify(pageErrors));
    await context.close();
  } catch (error) {
    console.error(error && error.stack || error);
    record('test harness completed', false, error.message);
  } finally {
    if (browser) await browser.close();
    await stopBridge(server, { label: 'convolution-lesson-layout' });
  }

  const failed = results.filter(result => !result.ok);
  console.log(`\n[convolution-lesson-layout] ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main();
