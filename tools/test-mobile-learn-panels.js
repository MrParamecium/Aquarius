'use strict';

const path = require('path');
const { chromium } = require('playwright');
const {
  spawnBridge,
  stopBridge,
  waitForHealth,
  injectMaskInitScript,
  enterGuestMode,
  ensureSyllabusOpen,
} = require('./test-utils.js');

const PORT = Number(process.env.TUTOR_MOBILE_LEARN_PANELS_PORT || 9152);
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

async function installFakeGeoGebra(context) {
  await context.addInitScript(() => {
    const metrics = {
      constructorCount: 0,
      injectCount: 0,
      removeCount: 0,
      resizeCount: 0,
    };
    window.__fakeGeoGebra = metrics;

    function makeApi(mount) {
      const values = { t: -4 };
      const listeners = new Set();
      return {
        evalCommand(command) {
          const tMatch = String(command).match(/^t=(-?\d+(?:\.\d+)?)$/);
          if (tMatch) values.t = Number(tMatch[1]);
          return true;
        },
        setErrorDialogsActive() {},
        setSliderMin() {},
        setSliderMax() {},
        setSliderIncrement() {},
        setVisible() {},
        setColor() {},
        setLineThickness() {},
        setLabelVisible() {},
        setLineStyle() {},
        setFilling() {},
        setCaption() {},
        setCoordSystem() {},
        setAxesVisible() {},
        setGridVisible() {},
        setPointSize() {},
        setValue(name, value) {
          values[name] = Number(value);
          listeners.forEach((listenerName) => window[listenerName]?.());
        },
        getValue(name) {
          const t = values.t;
          if (name === 't') return t;
          if (name === 'overlapArea' || name === 'outputValue') {
            return t < -3 ? 0 : 1 - Math.exp(-(t + 3));
          }
          return values[name] || 0;
        },
        registerUpdateListener(listenerName) { listeners.add(listenerName); },
        unregisterUpdateListener(listenerName) { listeners.delete(listenerName); },
        setSize(width, height) {
          metrics.resizeCount += 1;
          mount.querySelectorAll('canvas').forEach((canvas) => {
            canvas.width = Math.max(1, Math.round(width));
            canvas.height = Math.max(1, Math.round(height / 2));
          });
        },
        remove() {
          metrics.removeCount += 1;
          mount.replaceChildren();
        },
      };
    }

    window.GGBApplet = function FakeGGBApplet(params) {
      metrics.constructorCount += 1;
      this.setHTML5Codebase = () => {};
      this.inject = (mountId) => {
        metrics.injectCount += 1;
        const mount = document.getElementById(mountId);
        ['upper', 'lower'].forEach((view) => {
          const canvas = document.createElement('canvas');
          canvas.width = 760;
          canvas.height = 310;
          canvas.dataset.fakeGeoGebraView = view;
          mount?.appendChild(canvas);
        });
        queueMicrotask(() => params.appletOnLoad(makeApi(mount)));
      };
    };
  });
}

async function waitForLayout(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  await page.waitForTimeout(80);
}

async function goToLessonPage(page, targetPage) {
  const initialPosition = await page.locator('#learnPagerPosition').textContent();
  const totalPages = Number(String(initialPosition || '').match(/\/\s*(\d+)/)?.[1]);
  if (!Number.isFinite(totalPages) || totalPages < targetPage) {
    throw new Error(`lesson pager reported an invalid total: ${initialPosition}`);
  }
  for (let current = 1; current < targetPage; current += 1) {
    await page.waitForFunction(() => typeof isLearnPageTurning === 'undefined' || !isLearnPageTurning, null, {
      timeout: 5000,
    });
    const moved = await page.evaluate(() => moveLearnKnowledgePoint(1));
    if (!moved) throw new Error(`lesson state refused to advance from page ${current}`);
    try {
      await page.waitForFunction(
        ({ nextPage, total }) => {
          const body = document.getElementById('learnBody');
          const position = document.getElementById('learnPagerPosition');
          return position?.textContent.trim() === `${nextPage} / ${total}`
            && !body?.classList.contains('learn-page-turn-active');
        },
        { nextPage: current + 1, total: totalPages },
        { timeout: 8000 }
      );
    } catch (error) {
      const state = await page.evaluate(() => ({
        position: document.getElementById('learnPagerPosition')?.textContent.trim(),
        bodyClasses: document.getElementById('learnBody')?.className,
        index: typeof currentKnowledgePointIndex === 'number' ? currentKnowledgePointIndex : null,
        pointCount: Array.isArray(learnKnowledgePoints) ? learnKnowledgePoints.length : null,
        isTurning: typeof isLearnPageTurning === 'boolean' ? isLearnPageTurning : null,
        nextDisabled: document.getElementById('learnPagerNextBtn')?.disabled,
      }));
      throw new Error(`pager did not settle on ${current + 1} / ${totalPages}: ${JSON.stringify(state)} (${error.message})`);
    }
  }
  return totalPages;
}

async function prepareSubtopicCard(page) {
  await ensureSyllabusOpen(page);
  const chapter = page.locator('#courseSyllabus .syllabus-chapter', { hasText: SUBTOPIC.chapter });
  const chapterCount = await chapter.count();
  if (chapterCount !== 1) {
    throw new Error(`ambiguous chapter selector ('${SUBTOPIC.chapter}' matched ${chapterCount} rows)`);
  }
  await chapter.first().click();
  await page.click(`#courseSyllabus .syllabus-section[data-section="${SUBTOPIC.section}"]`);
  const card = page.locator(`.chapter-overview-subcard[data-sublesson-title="${SUBTOPIC.title}"]`);
  await card.waitFor({ state: 'visible', timeout: 10000 });
  return card;
}

async function openPreparedSubtopic(page, card) {
  await card.evaluate(element => element.click());
  await page.waitForFunction(() => {
    const content = document.getElementById('learnExplainContent')?.innerText || '';
    return content.length > 80 && !content.includes('Preparing lesson...');
  }, null, { timeout: 25000 });
}

async function panelSnapshot(page) {
  return page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };
    const body = document.getElementById('learnBody');
    const explain = rect('#learnExplainCol');
    const chat = rect('#learnChatCol');
    const showQa = rect('#learnChatRestoreBtn');
    const showLecture = rect('#learnExplainRestoreBtn');
    return {
      classes: body?.className || '',
      explainWidth: explain?.width || 0,
      chatWidth: chat?.width || 0,
      showQaVisible: visible('#learnChatRestoreBtn'),
      showQaHeight: showQa?.height || 0,
      showLectureVisible: visible('#learnExplainRestoreBtn'),
      showLectureHeight: showLecture?.height || 0,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

async function main() {
  const server = spawnBridge(repoRoot, PORT);
  let browser;
  try {
    await waitForHealth(BASE);
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await injectMaskInitScript(context);
    await installFakeGeoGebra(context);
    const page = await context.newPage();

    await enterGuestMode(page, BASE);
    const preparedCard = await prepareSubtopicCard(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openPreparedSubtopic(page, preparedCard);
    await page.waitForFunction(() => Array.isArray(learnKnowledgePoints) && learnKnowledgePoints.length >= 4, null, {
      timeout: 5000,
    });
    await page.waitForFunction(() => /\/\s*[4-9]\d*$/.test(
      document.getElementById('learnPagerPosition')?.textContent.trim() || ''
    ), null, { timeout: 5000 });
    await page.waitForFunction(() => document.getElementById('learnBody')?.classList.contains('chat-collapsed'), null, {
      timeout: 5000,
    });
    await waitForLayout(page);
    const directMobile = await panelSnapshot(page);
    record('opening a lesson directly on mobile starts with the full-width lecture',
      directMobile.explainWidth >= 350
        && directMobile.chatWidth === 0
        && directMobile.showQaVisible
        && directMobile.showQaHeight >= 44
        && !directMobile.showLectureVisible
        && directMobile.horizontalOverflow <= 1,
      JSON.stringify(directMobile));

    await page.setViewportSize({ width: 1280, height: 800 });
    await waitForLayout(page);
    const totalPages = await goToLessonPage(page, 4);
    await page.waitForFunction(() => {
      const stage = document.querySelector('.geogebra-demo-stage');
      return stage?.dataset.state === 'ready';
    }, null, { timeout: 5000 });

    const prepared = await page.evaluate(() => {
      const node = document.querySelector('.kc-interactive-demo .geogebra-demo-shell')?.closest('.kc-interactive-demo');
      node?.querySelector('[data-geogebra-step="3"]')?.click();
      const range = node?.querySelector('[data-geogebra-time]');
      if (range) {
        range.value = '-2';
        range.dispatchEvent(new Event('input', { bubbles: true }));
      }
      window.__mobilePanelCanvasRefs = node ? Array.from(node.querySelectorAll('canvas')) : [];
      return {
        pager: document.getElementById('learnPagerPosition')?.textContent.trim(),
        step: node?.querySelector('[data-geogebra-step].is-active')?.dataset.geogebraStep,
        t: node?.__geoGebraDiagnostics?.getState()?.t,
        canvasCount: window.__mobilePanelCanvasRefs.length,
        constructorCount: window.__fakeGeoGebra?.constructorCount,
      };
    });
    record('real 2.4-2 page 4 mounts one continuous two-view Applet',
      prepared.pager === `4 / ${totalPages}`
        && prepared.step === '3'
        && prepared.t === -2
        && prepared.canvasCount === 2
        && prepared.constructorCount === 1,
      JSON.stringify(prepared));

    await page.setViewportSize({ width: 390, height: 844 });
    await waitForLayout(page);
    const mobileLecture = await panelSnapshot(page);
    record('mobile defaults to a full-width lecture with a usable Q&A switch',
      mobileLecture.explainWidth >= 350
        && mobileLecture.chatWidth === 0
        && mobileLecture.showQaVisible
        && mobileLecture.showQaHeight >= 44
        && mobileLecture.horizontalOverflow <= 1,
      JSON.stringify(mobileLecture));

    if (mobileLecture.showQaVisible) {
      await page.click('#learnChatRestoreBtn');
      await waitForLayout(page);
    }
    const mobileQa = await panelSnapshot(page);
    record('mobile Q&A switch exposes one full-width Q&A panel and lecture return',
      mobileLecture.showQaVisible
        && mobileQa.explainWidth === 0
        && mobileQa.chatWidth >= 350
        && mobileQa.showLectureVisible
        && mobileQa.showLectureHeight >= 44
        && mobileQa.horizontalOverflow <= 1,
      JSON.stringify(mobileQa));

    await page.setViewportSize({ width: 430, height: 844 });
    await waitForLayout(page);
    const resizedMobileQa = await panelSnapshot(page);
    record('resizing inside the mobile breakpoint preserves the selected panel',
      resizedMobileQa.explainWidth === 0
        && resizedMobileQa.chatWidth >= 350
        && resizedMobileQa.showLectureVisible
        && !resizedMobileQa.showQaVisible
        && resizedMobileQa.horizontalOverflow <= 1,
      JSON.stringify(resizedMobileQa));

    if (resizedMobileQa.showLectureVisible) {
      await page.click('#learnExplainRestoreBtn');
      await waitForLayout(page);
    }
    const returned = await page.evaluate(() => {
      const node = document.querySelector('.kc-interactive-demo .geogebra-demo-shell')?.closest('.kc-interactive-demo');
      const canvases = node ? Array.from(node.querySelectorAll('canvas')) : [];
      const references = window.__mobilePanelCanvasRefs || [];
      return {
        panel: {
          explainWidth: document.getElementById('learnExplainCol')?.getBoundingClientRect().width || 0,
          chatWidth: document.getElementById('learnChatCol')?.getBoundingClientRect().width || 0,
        },
        constructorCount: window.__fakeGeoGebra?.constructorCount,
        injectCount: window.__fakeGeoGebra?.injectCount,
        removeCount: window.__fakeGeoGebra?.removeCount,
        canvasCount: canvases.length,
        sameCanvasNodes: canvases.length === references.length
          && canvases.every((canvas, index) => canvas === references[index]),
        step: node?.querySelector('[data-geogebra-step].is-active')?.dataset.geogebraStep,
        t: node?.__geoGebraDiagnostics?.getState()?.t,
      };
    });
    record('returning to lecture preserves the GeoGebra instance, step, and t',
      resizedMobileQa.showLectureVisible
        && returned.panel.explainWidth >= 390
        && returned.panel.chatWidth === 0
        && returned.constructorCount === 1
        && returned.injectCount === 1
        && returned.removeCount === 0
        && returned.canvasCount === 2
        && returned.sameCanvasNodes
        && returned.step === '3'
        && returned.t === -2,
      JSON.stringify(returned));

    await page.setViewportSize({ width: 1280, height: 800 });
    await waitForLayout(page);
    const desktop = await panelSnapshot(page);
    record('returning to desktop restores the existing two-column layout',
      desktop.explainWidth > 0
        && desktop.chatWidth > 0
        && !desktop.showQaVisible
        && !desktop.showLectureVisible
        && desktop.horizontalOverflow <= 1,
      JSON.stringify(desktop));

    await context.close();
  } catch (error) {
    console.error(error && error.stack || error);
    record('test harness completed', false, error.message);
  } finally {
    if (browser) await browser.close();
    await stopBridge(server, { label: 'mobile-learn-panels' });
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n[mobile-learn-panels] ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main();
