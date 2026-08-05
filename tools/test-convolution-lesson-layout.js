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

function parseRgb(color) {
  const channels = String(color).match(/[\d.]+/g)?.map(Number) || [];
  if (channels.length < 3) return null;
  return { r: channels[0], g: channels[1], b: channels[2], a: channels[3] ?? 1 };
}

function relativeLuminance(color) {
  const rgb = parseRgb(color);
  if (!rgb) return 0;
  const linear = [rgb.r, rgb.g, rgb.b].map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

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
    const teachingBlock = content?.querySelector('.convolution-teaching-block');
    const title = frame?.querySelector('.lesson-page-heading h2')?.textContent.trim() || '';
    const computed = content ? getComputedStyle(content) : null;
    const teachingStyle = teachingBlock ? getComputedStyle(teachingBlock) : null;
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
      contentBackground: computed?.backgroundColor || '',
      contentBackgroundImage: computed?.backgroundImage || '',
      teachingBackground: teachingStyle?.backgroundColor || '',
      teachingBorderTopWidth: teachingStyle?.borderTopWidth || '',
      demoCount: content?.querySelectorAll('.kc-interactive-demo').length || 0,
      visualKinds: Array.from(content?.querySelectorAll('[data-convolution-visual]') || []).map(node => node.dataset.convolutionVisual),
      images,
    };
  }, LESSON_TITLES[position - 1]);
}

async function inspectOverviewSurface(page) {
  return page.evaluate(() => {
    const frame = document.querySelector('.lesson-page-frame[data-lesson-section="2.4-2"]');
    const content = frame?.querySelector('.lesson-page-content');
    const nav = frame?.querySelector('.convolution-stage-nav');
    const formula = frame?.querySelector('.convolution-overview-formula');
    const actions = Array.from(frame?.querySelectorAll('[data-convolution-core-action]') || []);
    const frameStyle = frame ? getComputedStyle(frame) : null;
    const contentStyle = content ? getComputedStyle(content) : null;
    const navStyle = nav ? getComputedStyle(nav) : null;
    const formulaStyle = formula ? getComputedStyle(formula) : null;
    return {
      frameBackground: frameStyle?.backgroundColor || '',
      frameBackgroundImage: frameStyle?.backgroundImage || '',
      contentBackground: contentStyle?.backgroundColor || '',
      contentBackgroundImage: contentStyle?.backgroundImage || '',
      contentColor: contentStyle?.color || '',
      formulaBackground: formulaStyle?.backgroundColor || '',
      formulaColor: formulaStyle?.color || '',
      navBackground: navStyle?.backgroundColor || '',
      navBackdrop: navStyle?.backdropFilter || navStyle?.webkitBackdropFilter || '',
      pageOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      actions: actions.map(action => {
        const rect = action.getBoundingClientRect();
        const style = getComputedStyle(action);
        return {
          index: action.querySelector('.convolution-core-action-index')?.textContent.trim() || '',
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          background: style.backgroundColor,
          borderTopWidth: style.borderTopWidth,
          indexColor: getComputedStyle(action.querySelector('.convolution-core-action-index')).color,
        };
      }),
    };
  });
}

async function inspectFocusWorkspace(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) > 0
        && rect.width > 0
        && rect.height > 0;
    };
    const rect = (selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      } : null;
    };
    const sidebar = document.getElementById('leftSidebar');
    const sidebarStyle = sidebar ? getComputedStyle(sidebar) : null;
    const chat = document.getElementById('learnChatCol');
    const chatStyle = chat ? getComputedStyle(chat) : null;
    const resizer = document.getElementById('learnResizer');
    const demoPage = document.querySelector('.lesson-page-frame.convolution-demo-page');
    const demoContent = demoPage?.querySelector('.lesson-page-content');
    const demoStyle = demoContent ? getComputedStyle(demoContent) : null;
    const teaching = demoContent?.querySelector('.convolution-teaching-block')?.getBoundingClientRect();
    const demo = demoContent?.querySelector('.kc-interactive-demo')?.getBoundingClientRect();
    return {
      appFocus: document.querySelector('.app')?.classList.contains('convolution-focus-workspace-active') || false,
      bodyFocus: document.getElementById('learnBody')?.classList.contains('convolution-focus-workspace-active') || false,
      chatCollapsed: document.getElementById('learnBody')?.classList.contains('chat-collapsed') || false,
      sidebar: rect('#leftSidebar'),
      sidebarPosition: sidebarStyle?.position || '',
      explain: rect('#learnExplainCol'),
      chat: rect('#learnChatCol'),
      chatDisplay: chatStyle?.display || '',
      resizerDisplay: resizer ? getComputedStyle(resizer).display : '',
      fabVisible: visible(document.getElementById('learnChatFab')),
      fabTitle: document.getElementById('learnChatFab')?.title || '',
      minimizeVisible: visible(document.getElementById('learnTutorMinimizeBtn')),
      minimizeTitle: document.getElementById('learnTutorMinimizeBtn')?.title || '',
      demoPage: Boolean(demoPage),
      demoColumns: demoStyle?.gridTemplateColumns || '',
      demoTeachingWidth: teaching?.width || 0,
      demoWidth: demo?.width || 0,
      fullscreenControls: document.querySelectorAll('[data-convolution-fullscreen], #convolutionFullscreenBtn, #convolutionExitFullscreenBtn').length,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    };
  });
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
    const overviewWorkspace = await inspectFocusWorkspace(page);
    record('section overview stays in the ordinary workspace without fullscreen controls',
      !overviewWorkspace.appFocus
        && !overviewWorkspace.bodyFocus
        && overviewWorkspace.fullscreenControls === 0,
      JSON.stringify(overviewWorkspace));
    record('overview shows the approved objective, formula, actions, and one start button without bottom pager',
      intro.objective === 'Interpret and compute continuous-time convolution graphically.'
        && /x\(τ\).*g\(t−?τ\)/.test(intro.formula)
        && intro.actions === 3
        && intro.starts === 1
        && intro.pagerHidden
        && intro.boxedNumbers === 0,
      JSON.stringify(intro));

    const overviewDesktop = await inspectOverviewSurface(page);
    const desktopRowsAreVertical = overviewDesktop.actions.every((action, index, actions) => (
      index === 0 || action.top >= actions[index - 1].bottom - 1
    ));
    record('overview uses a clean reading surface and ordered vertical 01/02/03 actions',
      overviewDesktop.frameBackground === 'rgb(234, 241, 242)'
        && overviewDesktop.frameBackgroundImage === 'none'
        && overviewDesktop.contentBackground === 'rgb(251, 252, 252)'
        && overviewDesktop.contentBackgroundImage === 'none'
        && overviewDesktop.formulaBackground === 'rgb(245, 247, 248)'
        && overviewDesktop.actions.map(action => action.index).join(',') === '01,02,03'
        && overviewDesktop.actions.every(action => action.borderTopWidth !== '4px')
        && desktopRowsAreVertical
        && overviewDesktop.pageOverflow <= 1,
      JSON.stringify(overviewDesktop));
    record('overview text, formula, and glass navigation remain readable',
      contrastRatio(overviewDesktop.contentColor, overviewDesktop.contentBackground) >= 4.5
        && contrastRatio(overviewDesktop.formulaColor, overviewDesktop.formulaBackground) >= 4.5
        && parseRgb(overviewDesktop.navBackground)?.a >= 0.72
        && /blur\((?:18|19|20|21|22)px\)/.test(overviewDesktop.navBackdrop),
      JSON.stringify({
        contentContrast: contrastRatio(overviewDesktop.contentColor, overviewDesktop.contentBackground),
        formulaContrast: contrastRatio(overviewDesktop.formulaColor, overviewDesktop.formulaBackground),
        navBackground: overviewDesktop.navBackground,
        navBackdrop: overviewDesktop.navBackdrop,
      }));
    record('overview action colors preserve meaning and WCAG AA contrast',
      overviewDesktop.actions.map(action => action.indexColor).join(',')
          === 'rgb(112, 66, 184),rgb(22, 123, 100),rgb(182, 83, 29)'
        && overviewDesktop.actions.every(action => (
          contrastRatio(action.indexColor, overviewDesktop.contentBackground) >= 4.5
        )),
      JSON.stringify(overviewDesktop.actions.map(action => ({
        index: action.index,
        color: action.indexColor,
        contrast: contrastRatio(action.indexColor, overviewDesktop.contentBackground),
      }))));

    const noBackdropOverride = await page.addStyleTag({ content: `
      .lesson-page-frame[data-lesson-section="2.4-2"] .convolution-stage-nav {
        background: var(--convolution-nav-fallback) !important;
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
      }
    ` });
    await waitForLayout(page);
    const overviewNoBackdrop = await inspectOverviewSurface(page);
    record('navigation keeps an opaque readable fallback without backdrop-filter',
      overviewNoBackdrop.navBackground === 'rgb(245, 249, 250)'
        && overviewNoBackdrop.navBackdrop === 'none'
        && overviewNoBackdrop.contentBackground === 'rgb(251, 252, 252)'
        && contrastRatio(overviewNoBackdrop.contentColor, overviewNoBackdrop.contentBackground) >= 4.5,
      JSON.stringify(overviewNoBackdrop));
    await noBackdropOverride.evaluate(node => node.remove());
    await waitForLayout(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await waitForLayout(page);
    const overviewMobile = await inspectOverviewSurface(page);
    const mobileRowsAreVertical = overviewMobile.actions.every((action, index, actions) => (
      index === 0 || action.top >= actions[index - 1].bottom - 1
    ));
    record('390px overview keeps the numbered action rows ordered without overflow',
      overviewMobile.actions.map(action => action.index).join(',') === '01,02,03'
        && mobileRowsAreVertical
        && overviewMobile.actions.every(action => action.width <= 390)
        && overviewMobile.pageOverflow <= 1,
      JSON.stringify(overviewMobile));

    await page.setViewportSize({ width: 1280, height: 900 });
    const documentTheme = await page.evaluate(() => document.documentElement.dataset.theme || '');
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await waitForLayout(page);
    const overviewDark = await inspectOverviewSurface(page);
    record('dark theme keeps the overview on stable high-contrast reading surfaces',
      overviewDark.frameBackgroundImage === 'none'
        && overviewDark.contentBackgroundImage === 'none'
        && parseRgb(overviewDark.contentBackground)?.a === 1
        && parseRgb(overviewDark.formulaBackground)?.a === 1
        && contrastRatio(overviewDark.contentColor, overviewDark.contentBackground) >= 4.5
        && contrastRatio(overviewDark.formulaColor, overviewDark.formulaBackground) >= 4.5,
      JSON.stringify({
        contentBackground: overviewDark.contentBackground,
        contentContrast: contrastRatio(overviewDark.contentColor, overviewDark.contentBackground),
        formulaBackground: overviewDark.formulaBackground,
        formulaContrast: contrastRatio(overviewDark.formulaColor, overviewDark.formulaBackground),
      }));
    await page.evaluate((theme) => {
      if (theme) document.documentElement.dataset.theme = theme;
      else document.documentElement.removeAttribute('data-theme');
    }, documentTheme);
    await waitForLayout(page);

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

    const lessonFocus = await inspectFocusWorkspace(page);
    record('lesson enters the focus workspace with a hidden icon rail and Tutor orb',
      lessonFocus.appFocus
        && lessonFocus.bodyFocus
        && lessonFocus.chatCollapsed
        && lessonFocus.sidebarPosition === 'fixed'
        && lessonFocus.sidebar?.width >= 88
        && lessonFocus.sidebar.width <= 96
        && lessonFocus.sidebar.right >= 8
        && lessonFocus.sidebar.right <= 12
        && lessonFocus.fabVisible
        && lessonFocus.fabTitle === 'Ask Tutor'
        && lessonFocus.chatDisplay === 'none'
        && lessonFocus.resizerDisplay === 'none'
        && lessonFocus.fullscreenControls === 0,
      JSON.stringify(lessonFocus));

    const explainBeforeRail = lessonFocus.explain;
    await page.mouse.move(4, 420);
    await page.waitForTimeout(260);
    const railOpen = await inspectFocusWorkspace(page);
    await page.mouse.move(640, 420);
    await page.waitForTimeout(120);
    const railDelay = await inspectFocusWorkspace(page);
    await page.waitForTimeout(420);
    const railClosed = await inspectFocusWorkspace(page);
    record('left edge reveals an overlay icon rail and closes after a stable delay',
      railOpen.sidebar?.left >= -1
        && railOpen.sidebar.left <= 1
        && Math.abs((railOpen.explain?.left || 0) - (explainBeforeRail?.left || 0)) <= 1
        && railDelay.sidebar?.left >= -1
        && railDelay.sidebar.left <= 1
        && railClosed.sidebar?.right >= 8
        && railClosed.sidebar.right <= 12,
      JSON.stringify({ explainBeforeRail, railOpen, railDelay, railClosed }));

    await page.focus('#navHomeBtn');
    await page.waitForTimeout(260);
    const railFocused = await inspectFocusWorkspace(page);
    await page.focus('[data-convolution-stage-target="lesson"]');
    await page.waitForTimeout(420);
    const railBlurred = await inspectFocusWorkspace(page);
    record('keyboard focus opens the icon rail and releases it after focus leaves',
      railFocused.sidebar?.left >= -1
        && railFocused.sidebar.left <= 1
        && railBlurred.sidebar?.right >= 8
        && railBlurred.sidebar.right <= 12,
      JSON.stringify({ railFocused, railBlurred }));

    await page.evaluate(() => document.getElementById('learnChatFab')?.click());
    await page.waitForTimeout(160);
    const tutorOpen = await inspectFocusWorkspace(page);
    record('Tutor orb opens the existing fixed 320px panel with a minimize control',
      !tutorOpen.chatCollapsed
        && tutorOpen.chat?.width >= 318
        && tutorOpen.chat.width <= 322
        && tutorOpen.chatDisplay !== 'none'
        && tutorOpen.minimizeVisible
        && tutorOpen.minimizeTitle === 'Minimize Tutor'
        && !tutorOpen.fabVisible
        && tutorOpen.resizerDisplay === 'none'
        && tutorOpen.horizontalOverflow <= 1,
      JSON.stringify(tutorOpen));

    await goToLessonPage(page, 2);
    const tutorAfterPage = await inspectFocusWorkspace(page);
    await clickStage(page, 'practice', 1);
    const tutorPractice = await inspectFocusWorkspace(page);
    record('Tutor panel state survives lesson pages and the transition to practice',
      !tutorAfterPage.chatCollapsed
        && tutorAfterPage.chat?.width >= 318
        && !tutorPractice.chatCollapsed
        && tutorPractice.chat?.width >= 318,
      JSON.stringify({ tutorAfterPage, tutorPractice }));

    await clickStage(page, 'intro', 1);
    const overviewReset = await inspectFocusWorkspace(page);
    await clickStage(page, 'lesson', 2);
    const lessonReset = await inspectFocusWorkspace(page);
    record('returning to overview restores ordinary Q&A and re-entering lesson resets to the orb',
      !overviewReset.appFocus
        && !overviewReset.bodyFocus
        && !overviewReset.chatCollapsed
        && overviewReset.chatDisplay !== 'none'
        && lessonReset.appFocus
        && lessonReset.bodyFocus
        && lessonReset.chatCollapsed
        && lessonReset.fabVisible,
      JSON.stringify({ overviewReset, lessonReset }));

    await goToLessonPage(page, 5);
    const demoWorkspace = await inspectFocusWorkspace(page);
    record('GeoGebra lesson uses a 40/60 horizontal workspace on desktop',
      demoWorkspace.demoPage
        && demoWorkspace.demoTeachingWidth > 0
        && demoWorkspace.demoWidth > demoWorkspace.demoTeachingWidth
        && demoWorkspace.demoWidth / demoWorkspace.demoTeachingWidth >= 1.35
        && demoWorkspace.demoWidth / demoWorkspace.demoTeachingWidth <= 1.65
        && demoWorkspace.horizontalOverflow <= 1,
      JSON.stringify(demoWorkspace));

    await page.evaluate(() => document.getElementById('learnChatFab')?.click());
    await page.waitForTimeout(160);
    const demoWithTutor = await inspectFocusWorkspace(page);
    record('opening Tutor reflows the Demo without overlapping or rebuilding its layout shell',
      demoWithTutor.demoPage
        && demoWithTutor.chat?.width >= 318
        && demoWithTutor.explain?.right <= demoWithTutor.chat?.left + 1
        && demoWithTutor.horizontalOverflow <= 1,
      JSON.stringify(demoWithTutor));

    await page.evaluate(() => document.getElementById('learnTutorMinimizeBtn')?.click());
    await page.waitForTimeout(160);
    const tutorMinimized = await inspectFocusWorkspace(page);
    record('Tutor minimize control returns focus workspace to the orb',
      tutorMinimized.chatCollapsed
        && tutorMinimized.fabVisible
        && !tutorMinimized.minimizeVisible,
      JSON.stringify(tutorMinimized));

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
        && item.contentBackground === 'rgb(251, 252, 252)'
        && item.contentBackgroundImage === 'none'
        && item.teachingBackground === 'rgba(0, 0, 0, 0)'
        && item.teachingBorderTopWidth === '0px'
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
