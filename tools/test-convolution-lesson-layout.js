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
const EXPECTED_BLOCK_LAYOUTS = [
  ['editorial', 'editorial', 'editorial'],
  ['editorial', 'editorial'],
  ['editorial', 'timeline'],
  ['timeline'],
  ['editorial', 'editorial', 'editorial'],
  ['editorial', 'editorial', 'editorial', 'editorial'],
];
const EXPECTED_VISUALS = ['tau-scan', 'five-steps', 'book-map'];
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
  await page.waitForFunction(() => typeof isLearnPageTurning === 'undefined' || !isLearnPageTurning, null, {
    timeout: 5000,
  });
  await waitForLayout(page);
}

async function getAbsoluteIndex(page) {
  return page.evaluate(() => typeof currentKnowledgePointIndex === 'number' ? currentKnowledgePointIndex : -1);
}

async function goToAbsoluteIndex(page, targetIndex) {
  const total = await page.evaluate(() => Array.isArray(learnKnowledgePoints) ? learnKnowledgePoints.length : 0);
  if (total !== 8 || targetIndex < 0 || targetIndex >= total) {
    throw new Error(`unexpected lesson range: total=${total}, target=${targetIndex}`);
  }

  let current = await getAbsoluteIndex(page);
  while (current !== targetIndex) {
    const direction = targetIndex > current ? 1 : -1;
    await waitForTurn(page);
    const moved = await page.evaluate(delta => moveLearnKnowledgePoint(delta), direction);
    if (!moved) throw new Error(`lesson refused to move from ${current} toward ${targetIndex}`);
    await waitForTurn(page);
    current = await getAbsoluteIndex(page);
  }
}

async function waitForStage(page, stage, position) {
  await page.waitForFunction(
    ({ expectedStage, expectedPosition }) => {
      if (typeof getConvolutionLessonStageState !== 'function') return false;
      const state = getConvolutionLessonStageState();
      return state?.stage === expectedStage
        && (expectedPosition == null || state.position === expectedPosition)
        && (typeof isLearnPageTurning === 'undefined' || !isLearnPageTurning);
    },
    { expectedStage: stage, expectedPosition: position },
    { timeout: 5000 }
  );
  await waitForLayout(page);
}

async function clickStage(page, stage, position) {
  await page.locator(`[data-convolution-stage-target="${stage}"]`).click();
  await waitForStage(page, stage, position);
}

async function inspectKnowledgePage(page, knowledgePage) {
  await goToAbsoluteIndex(page, knowledgePage);
  return page.evaluate(({ expectedPage, expectedLayouts }) => {
    const frame = document.querySelector('.lesson-page-frame[data-lesson-section="2.4-2"]');
    const content = frame?.querySelector('.lesson-page-content');
    const blocks = Array.from(content?.querySelectorAll('[data-convolution-block]') || []);
    const layouts = blocks.map(block => block.dataset.convolutionLayout || '');
    const markers = blocks.map(block => block.querySelector('.convolution-page-marker')).filter(Boolean);
    const numbers = blocks.map(block => block.dataset.convolutionNumber || '');
    const expectedNumbers = blocks.map((_, index) => String(index + 1).padStart(2, '0'));
    const visual = content?.querySelector('[data-convolution-visual]');
    const visualRect = visual?.getBoundingClientRect();
    const stageNav = frame?.querySelector('.convolution-stage-nav');
    const stageState = typeof getConvolutionLessonStageState === 'function'
      ? getConvolutionLessonStageState()
      : null;
    const diagramsAccessible = Array.from(content?.querySelectorAll('svg.convolution-diagram') || [])
      .every(svg => svg.getAttribute('role') === 'img' && Boolean(svg.querySelector('title')));
    const flowsVertical = Array.from(content?.querySelectorAll('[data-convolution-flow]') || []).every(flow => {
      const nodes = Array.from(flow.querySelectorAll('[data-flow-node]'));
      const tops = nodes.map(node => node.getBoundingClientRect().top);
      return nodes.length === 3 && tops.every((top, index) => index === 0 || top > tops[index - 1]);
    });
    const images = Array.from(content?.querySelectorAll('.convolution-analogy-image') || []).map(image => ({
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      objectFit: getComputedStyle(image).objectFit,
      width: image.getBoundingClientRect().width,
      height: image.getBoundingClientRect().height,
    }));

    return {
      page: expectedPage,
      framePage: frame?.dataset.lessonPage || '',
      frameStage: frame?.dataset.lessonStage || '',
      stageState,
      blockCount: blocks.length,
      layouts,
      layoutsCorrect: JSON.stringify(layouts) === JSON.stringify(expectedLayouts),
      blockPagesCorrect: blocks.every(block => block.dataset.convolutionPage === String(expectedPage)),
      numbersCorrect: JSON.stringify(numbers) === JSON.stringify(expectedNumbers),
      markersSmall: markers.length === blocks.length && markers.every(marker => parseFloat(getComputedStyle(marker).fontSize) <= 18),
      blockOverflow: blocks.some(block => block.scrollWidth > block.clientWidth + 1),
      visualKind: visual?.dataset.convolutionVisual || '',
      visualWidth: visualRect?.width || 0,
      visualHeight: visualRect?.height || 0,
      stepCount: content?.querySelectorAll('[data-convolution-step]').length || 0,
      flowCount: content?.querySelectorAll('[data-convolution-flow]').length || 0,
      flowsVertical,
      diagramsAccessible,
      images,
      navOverflow: stageNav ? Math.max(0, stageNav.scrollWidth - stageNav.clientWidth) : 999,
      pageOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    };
  }, { expectedPage: knowledgePage, expectedLayouts: EXPECTED_BLOCK_LAYOUTS[knowledgePage - 1] });
}

async function collectViewport(page, width, height) {
  await page.setViewportSize({ width, height });
  await waitForLayout(page);
  const pages = [];
  for (let knowledgePage = 1; knowledgePage <= 6; knowledgePage += 1) {
    pages.push(await inspectKnowledgePage(page, knowledgePage));
  }
  return { width, height, pages };
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
      const state = typeof getConvolutionLessonStageState === 'function'
        ? getConvolutionLessonStageState()
        : null;
      const tabs = Array.from(document.querySelectorAll('[data-convolution-stage-target]'));
      return {
        pointCount: Array.isArray(learnKnowledgePoints) ? learnKnowledgePoints.length : 0,
        state,
        labels: tabs.map(tab => tab.textContent.replace(/\s+/g, ' ').trim()),
        activeCount: tabs.filter(tab => tab.getAttribute('aria-current') === 'step').length,
        keyboardReady: tabs.every(tab => tab.tagName === 'BUTTON' && tab.tabIndex >= 0),
        pager: document.getElementById('learnPagerPosition')?.textContent.trim() || '',
        introMarker: Boolean(document.querySelector('[data-convolution-stage-intro="true"]')),
      };
    });
    record('existing eight pages map to a dedicated introduction stage',
      intro.pointCount === 8
        && intro.state?.stage === 'intro'
        && intro.state?.position === 1
        && intro.state?.total === 1
        && intro.pager === '章节简介'
        && intro.introMarker,
      JSON.stringify(intro));
    record('three stage tabs are explicit and keyboard operable',
      intro.labels.length === 3
        && intro.labels.every((label, index) => label.includes(['章节简介', '正式讲解', '练习巩固'][index]))
        && intro.activeCount === 1
        && intro.keyboardReady,
      JSON.stringify(intro.labels));

    if (!intro.state || intro.labels.length !== 3) {
      throw new Error('fourth-version stage model is not available');
    }

    await clickStage(page, 'lesson', 1);
    await goToAbsoluteIndex(page, 4);
    const rememberedBefore = await page.evaluate(() => ({
      state: getConvolutionLessonStageState(),
      pager: document.getElementById('learnPagerPosition')?.textContent.trim() || '',
    }));
    record('formal lesson uses stage-local progress',
      rememberedBefore.state?.stage === 'lesson'
        && rememberedBefore.state.position === 4
        && rememberedBefore.state.total === 6
        && rememberedBefore.pager === '讲解 4 / 6',
      JSON.stringify(rememberedBefore));

    await clickStage(page, 'practice', 1);
    const practice = await page.evaluate(() => ({
      state: getConvolutionLessonStageState(),
      pager: document.getElementById('learnPagerPosition')?.textContent.trim() || '',
      quickCheck: Boolean(document.querySelector('#startTestBtn')),
      tasks: document.querySelectorAll('[data-convolution-practice-task]').length,
    }));
    record('practice is a distinct stage with the existing Quick Check entry',
      practice.state?.stage === 'practice'
        && practice.pager === '练习巩固'
        && practice.quickCheck
        && practice.tasks === 3,
      JSON.stringify(practice));

    await clickStage(page, 'lesson', 4);
    const rememberedAfter = await page.evaluate(() => getConvolutionLessonStageState());
    record('returning from practice restores the last formal lesson page',
      rememberedAfter?.stage === 'lesson' && rememberedAfter.position === 4,
      JSON.stringify(rememberedAfter));

    const timingContract = await page.evaluate(() => typeof getConvolutionLessonTurnTiming === 'function'
      ? getConvolutionLessonTurnTiming()
      : null);
    const turnStarted = Date.now();
    const moved = await page.evaluate(() => moveLearnKnowledgePoint(1));
    await page.waitForFunction(() => typeof isLearnPageTurning === 'undefined' || !isLearnPageTurning, null, {
      timeout: 5000,
    });
    const elapsed = Date.now() - turnStarted;
    await waitForLayout(page);
    const turnVisual = await page.evaluate(() => {
      const content = document.getElementById('learnExplainContent');
      const pseudo = content ? getComputedStyle(content, '::before') : null;
      return {
        activeClass: document.getElementById('learnBody')?.classList.contains('convolution-guided-flow-active') || false,
        pseudoDisplay: pseudo?.display || '',
        pseudoAnimation: pseudo?.animationName || '',
      };
    });
    record('guided flow uses the approved fast transition without paper curl',
      moved
        && timingContract?.commitMs >= 60
        && timingContract?.commitMs <= 80
        && timingContract?.totalMs >= 160
        && timingContract?.totalMs <= 180
        && elapsed < 350
        && turnVisual.activeClass
        && (turnVisual.pseudoDisplay === 'none' || turnVisual.pseudoAnimation === 'none'),
      JSON.stringify({ timingContract, elapsed, turnVisual }));

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await page.evaluate(() => {
      const before = currentKnowledgePointIndex;
      const result = moveLearnKnowledgePoint(-1);
      return { before, after: currentKnowledgePointIndex, result, turning: isLearnPageTurning };
    });
    record('reduced motion commits immediately',
      reduced.result && reduced.after === reduced.before - 1 && reduced.turning === false,
      JSON.stringify(reduced));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await waitForLayout(page);

    const desktop = await collectViewport(page, 1280, 900);
    const desktopLayouts = desktop.pages.map(item => item.layouts);
    record('all six formal lesson pages use the approved editorial/timeline layouts',
      desktop.pages.every(item => item.frameStage === 'lesson'
        && item.stageState?.stage === 'lesson'
        && item.layoutsCorrect
        && item.blockPagesCorrect
        && item.numbersCorrect
        && item.markersSmall),
      JSON.stringify(desktopLayouts));

    const desktopVisuals = desktop.pages.map(item => item.visualKind).filter(Boolean);
    record('desktop retains the three approved code-native diagrams',
      JSON.stringify(desktopVisuals) === JSON.stringify(EXPECTED_VISUALS)
        && desktop.pages.every(item => !item.visualKind || (item.visualWidth > 240 && item.visualHeight > 100 && item.diagramsAccessible)),
      JSON.stringify(desktopVisuals));
    record('five-step timeline and book map retain structural teaching cues',
      desktop.pages[3].stepCount === 5
        && desktop.pages[5].flowCount === 3
        && desktop.pages[5].flowsVertical,
      JSON.stringify({ steps: desktop.pages[3].stepCount, flows: desktop.pages[5].flowCount, vertical: desktop.pages[5].flowsVertical }));

    const desktopImages = desktop.pages.flatMap(item => item.images);
    record('both approved V2 analogy images remain complete and contained',
      desktopImages.length === 2
        && desktopImages.every(image => image.complete && image.naturalWidth === 1153 && image.objectFit === 'contain' && image.width > 0 && image.height > 0),
      JSON.stringify(desktopImages));

    for (const viewport of [[390, 844], [430, 844]]) {
      const snapshot = await collectViewport(page, viewport[0], viewport[1]);
      const clean = snapshot.pages.every(item => item.pageOverflow <= 1 && !item.blockOverflow && item.navOverflow <= 1);
      record(`${viewport[0]}px keeps lesson blocks and stage navigation inside the viewport`, clean,
        JSON.stringify(snapshot.pages.map(item => ({ page: item.page, overflow: item.pageOverflow, block: item.blockOverflow, nav: item.navOverflow }))));
      record(`${viewport[0]}px book map remains a top-to-bottom flow`,
        snapshot.pages[5].flowCount === 3 && snapshot.pages[5].flowsVertical,
        JSON.stringify({ flows: snapshot.pages[5].flowCount, vertical: snapshot.pages[5].flowsVertical }));
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
