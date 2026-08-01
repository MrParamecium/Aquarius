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
const EXPECTED_ISLAND_COUNTS = [3, 3, 3, 1, 4, 4];
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function waitForLayout(page) {
  await settleLesson(page);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function goToLessonPosition(page, targetPosition) {
  const positionText = await page.locator('#learnPagerPosition').textContent();
  const match = String(positionText || '').match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) throw new Error(`invalid lesson pager: ${positionText}`);
  let current = Number(match[1]);
  const total = Number(match[2]);
  if (total !== 8 || targetPosition < 1 || targetPosition > total) {
    throw new Error(`unexpected lesson range: ${positionText}, target=${targetPosition}`);
  }

  while (current !== targetPosition) {
    const direction = targetPosition > current ? 1 : -1;
    await page.waitForFunction(() => typeof isLearnPageTurning === 'undefined' || !isLearnPageTurning, null, {
      timeout: 5000,
    });
    const moved = await page.evaluate(delta => moveLearnKnowledgePoint(delta), direction);
    if (!moved) throw new Error(`lesson refused to move from ${current} toward ${targetPosition}`);
    current += direction;
    await page.waitForFunction(
      expected => {
        const body = document.getElementById('learnBody');
        const position = document.getElementById('learnPagerPosition')?.textContent.trim();
        return position === `${expected} / 8` && !body?.classList.contains('learn-page-turn-active');
      },
      current,
      { timeout: 8000 }
    );
    await waitForLayout(page);
  }
  return total;
}

async function inspectKnowledgePage(page, knowledgePage) {
  await goToLessonPosition(page, knowledgePage + 1);
  return page.evaluate(expectedPage => {
    const frame = document.querySelector('.lesson-page-frame[data-lesson-section="2.4-2"]');
    const content = frame?.querySelector('.lesson-page-content');
    const islands = Array.from(content?.querySelectorAll('[data-convolution-island]') || []);
    const visual = content?.querySelector('[data-convolution-visual]');
    const visualRect = visual?.getBoundingClientRect();
    const numbers = islands.map(island => island.dataset.convolutionNumber || '');
    const expectedNumbers = islands.map((_, index) => String(index + 1).padStart(2, '0'));
    const numberSizes = islands.map(island => {
      const number = island.querySelector('.convolution-island-number');
      return number ? parseFloat(getComputedStyle(number).fontSize) : 0;
    });
    const islandOverflow = islands.some(island => island.scrollWidth > island.clientWidth + 1);
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
      islandCount: islands.length,
      islandPagesCorrect: islands.every(island => island.dataset.convolutionPage === String(expectedPage)),
      numbersCorrect: JSON.stringify(numbers) === JSON.stringify(expectedNumbers),
      largeNumbers: numberSizes.every(size => size >= 28),
      visualKind: visual?.dataset.convolutionVisual || '',
      visualWidth: visualRect?.width || 0,
      visualHeight: visualRect?.height || 0,
      stepCount: content?.querySelectorAll('[data-convolution-step]').length || 0,
      flowCount: content?.querySelectorAll('[data-convolution-flow]').length || 0,
      flowsVertical,
      diagramsAccessible,
      images,
      islandOverflow,
      pageOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    };
  }, knowledgePage);
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
    await page.waitForFunction(() => document.getElementById('learnPagerPosition')?.textContent.trim() === '1 / 8', null, {
      timeout: 5000,
    });
    record('lesson retains the approved 8-page application structure', true, 'pager=1 / 8');

    const desktop = await collectViewport(page, 1280, 900);
    const desktopCounts = desktop.pages.map(item => item.islandCount);
    record('all six knowledge pages expose the approved content-island counts',
      JSON.stringify(desktopCounts) === JSON.stringify(EXPECTED_ISLAND_COUNTS)
        && desktop.pages.every(item => item.islandPagesCorrect && item.numbersCorrect && item.largeNumbers),
      JSON.stringify(desktopCounts));

    const desktopVisuals = desktop.pages.map(item => item.visualKind).filter(Boolean);
    record('desktop renders exactly the three approved code-native diagrams',
      JSON.stringify(desktopVisuals) === JSON.stringify(['tau-scan', 'five-steps', 'book-map'])
        && desktop.pages.every(item => !item.visualKind || (item.visualWidth > 240 && item.visualHeight > 100 && item.diagramsAccessible)),
      JSON.stringify(desktopVisuals));

    record('five-step timeline and book map retain their structural teaching cues',
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
      const clean = snapshot.pages.every(item => item.pageOverflow <= 1 && !item.islandOverflow);
      record(`${viewport[0]}px layout keeps all six pages inside the viewport`, clean,
        JSON.stringify(snapshot.pages.map(item => ({ page: item.page, overflow: item.pageOverflow, islandOverflow: item.islandOverflow }))));
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
