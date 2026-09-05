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
const evidenceDir = process.env.TUTOR_CONVOLUTION_LAYOUT_EVIDENCE_DIR || '';
const SUBTOPIC = {
  chapter: 'Chapter 2',
  section: '2.4 System Response to External Input: The Zero-State Response',
  title: '2.4-2 Graphical Understanding of Convolution Operation',
};
const LESSON_TITLES = [
  'What Does Graphical Convolution Show?',
  'What Do t and τ Mean?',
  'Why Use a Graphical View?',
  'Why Does the Overlap Create the Output?',
  'The Five-Step Map',
  'Figure 2.7 Guided Graphical Convolution Lab',
  'Same Convolution, New View',
  'One Signal, Two Segments',
  'Build the Two Output Cases',
  'Find the Contact Points',
  'Build the Integration Limits',
  'Assemble the Piecewise Output',
  'Same Result, Easier Route',
  'When Causal Meets Anticausal',
  'When Opposite Shifts Cancel',
  'The Graphical Convolution Checklist',
  'Exit Check',
  'You Can Now',
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

async function captureEvidence(page, filename) {
  if (!evidenceDir) return;
  await page.screenshot({ path: path.join(evidenceDir, filename), fullPage: false });
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
  await page.waitForTimeout(520);
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
  if (position === 4) {
    await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll(
        '.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-analogy-image, '
        + '.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-past-effects-image'
      ));
      images.forEach((image) => { image.loading = 'eager'; });
      await Promise.all(images.map(image => image.decode()));
    });
    await page.waitForFunction(() => Array.from(document.querySelectorAll(
      '.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-analogy-image, '
      + '.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-past-effects-image'
    )).every(image => image.complete && image.naturalWidth > 0), null, { timeout: 10000 });
  }
  return page.evaluate((expectedTitle) => {
    const frame = document.querySelector('.lesson-page-frame[data-lesson-section="2.4-2"]');
    const content = frame?.querySelector('.lesson-page-content');
    const nav = frame?.querySelector('.convolution-stage-nav');
    const teachingBlock = content?.querySelector('.convolution-teaching-card');
    const title = frame?.querySelector('.lesson-page-heading h2')?.textContent.trim() || '';
    const computed = content ? getComputedStyle(content) : null;
    const teachingStyle = teachingBlock ? getComputedStyle(teachingBlock) : null;
    const phase = frame?.querySelector('.convolution-phase-progress');
    const heading = frame?.querySelector('.lesson-page-heading');
    const headingTitle = heading?.querySelector('h2');
    const frameRect = frame?.getBoundingClientRect();
    const frameStyle = frame ? getComputedStyle(frame) : null;
    const navRect = nav?.getBoundingClientRect();
    const phaseRect = phase?.getBoundingClientRect();
    const headingTitleRect = headingTitle?.getBoundingClientRect();
    const frameContentWidth = frameRect && frameStyle
      ? frameRect.width - parseFloat(frameStyle.paddingLeft || '0') - parseFloat(frameStyle.paddingRight || '0')
      : 0;
    const tabRects = Array.from(nav?.querySelectorAll('.convolution-stage-tab') || [])
      .map(tab => tab.getBoundingClientRect());
    const nestedSurfaces = Array.from(content?.querySelectorAll(
      '.convolution-teaching-card, .convolution-exit-check, .geogebra-demo-shell'
    ) || []).map(node => {
      const style = getComputedStyle(node);
      return {
        className: node.className,
        background: style.backgroundColor,
        borderTopWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        backdrop: style.backdropFilter || style.webkitBackdropFilter || '',
      };
    });
    const images = Array.from(content?.querySelectorAll('.convolution-analogy-image, .convolution-past-effects-image') || []).map(image => ({
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
      contentWidth: content?.getBoundingClientRect().width || 0,
      teachingBackground: teachingStyle?.backgroundColor || '',
      teachingBorderTopWidth: teachingStyle?.borderTopWidth || '',
      teachingBoxShadow: teachingStyle?.boxShadow || '',
      teachingBackdrop: teachingStyle?.backdropFilter || teachingStyle?.webkitBackdropFilter || '',
      nestedSurfaces,
      template: frame?.dataset.convolutionTemplate || '',
      readingSurfaceCount: frame?.querySelectorAll('.convolution-reading-surface').length || 0,
      phaseInsideHeading: Boolean(phase && heading?.contains(phase)),
      phaseBelowTitle: Boolean(phaseRect && headingTitleRect && phaseRect.top >= headingTitleRect.bottom - 1),
      navWidthCoverage: frameContentWidth > 0 && navRect ? navRect.width / frameContentWidth : 0,
      stageTabWidthDelta: tabRects.length === 3
        ? Math.max(...tabRects.map(rect => rect.width)) - Math.min(...tabRects.map(rect => rect.width))
        : 999,
      demoCount: content?.querySelectorAll('.kc-interactive-demo').length || 0,
      demos: Array.from(content?.querySelectorAll('.kc-interactive-demo') || []).map(demo => ({
        task: demo.dataset.convolutionTask || '',
        preset: demo.dataset.convolutionPreset || demo.dataset.practicePreset || '',
        title: demo.querySelector('.geogebra-demo-title')?.textContent.trim() || '',
      })),
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
    const intro = frame?.querySelector('.convolution-stage-intro');
    const columns = Array.from(frame?.querySelectorAll('.convolution-overview-columns > div') || []);
    const frameStyle = frame ? getComputedStyle(frame) : null;
    const contentStyle = content ? getComputedStyle(content) : null;
    const navStyle = nav ? getComputedStyle(nav) : null;
    const introRect = intro?.getBoundingClientRect();
    return {
      frameBackground: frameStyle?.backgroundColor || '',
      frameBackgroundImage: frameStyle?.backgroundImage || '',
      contentBackground: contentStyle?.backgroundColor || '',
      contentBackgroundImage: contentStyle?.backgroundImage || '',
      contentColor: contentStyle?.color || '',
      navBackground: navStyle?.backgroundColor || '',
      navBackdrop: navStyle?.backdropFilter || navStyle?.webkitBackdropFilter || '',
      pageOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      intro: introRect ? {
        left: introRect.left,
        right: introRect.right,
        width: introRect.width,
      } : null,
      columns: columns.map(column => {
        const rect = column.getBoundingClientRect();
        return {
          heading: column.querySelector('h3')?.textContent.trim() || '',
          bullets: Array.from(column.querySelectorAll('li')).map(item => item.textContent.trim()),
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
        };
      }),
    };
  });
}

async function inspectPracticeSurface(page) {
  return page.evaluate(() => {
    const frame = document.querySelector('.lesson-page-frame[data-lesson-section="2.4-2"]');
    const content = frame?.querySelector('.convolution-reading-surface');
    const root = content?.querySelector('.convolution-practice-stage');
    const stepRow = root?.querySelector('.convolution-practice-step-row');
    const columns = root?.querySelector('.convolution-practice-columns');
    const builder = root?.querySelector('.convolution-practice-builder');
    const panel = root?.querySelector('[data-practice-panel]');
    const demo = root?.querySelector('[data-practice-demo-host]');
    const contentStyle = content ? getComputedStyle(content) : null;
    const rootStyle = root ? getComputedStyle(root) : null;
    const columnsStyle = columns ? getComputedStyle(columns) : null;
    const builderStyle = builder ? getComputedStyle(builder) : null;
    const stepRect = stepRow?.getBoundingClientRect();
    const panelRect = panel?.getBoundingClientRect();
    const builderRect = builder?.getBoundingClientRect();
    const demoRect = demo?.getBoundingClientRect();
    return {
      contentBackground: contentStyle?.backgroundColor || '',
      contentColor: contentStyle?.color || '',
      contentBackgroundImage: contentStyle?.backgroundImage || '',
      rootBackground: rootStyle?.backgroundColor || '',
      rootBorderTopWidth: rootStyle?.borderTopWidth || '',
      rootBoxShadow: rootStyle?.boxShadow || '',
      rootBackdrop: rootStyle?.backdropFilter || rootStyle?.webkitBackdropFilter || '',
      rootWidth: root?.getBoundingClientRect().width || 0,
      stepCount: root?.querySelectorAll('[data-practice-step-chip]').length || 0,
      activeStepCount: root?.querySelectorAll('[data-practice-step-chip][aria-current="step"]').length || 0,
      panelCount: root?.querySelectorAll('[data-practice-panel]').length || 0,
      stepAbovePanel: Boolean(stepRect && panelRect && stepRect.bottom <= panelRect.top + 1),
      stepOverflow: stepRow ? Math.max(0, stepRow.scrollWidth - stepRow.clientWidth) : 999,
      columnsTemplate: columnsStyle?.gridTemplateColumns || '',
      builderTemplate: builderStyle?.gridTemplateColumns || '',
      builderWidth: builderRect?.width || 0,
      demoWidth: demoRect?.width || 0,
      demoBesideBuilder: Boolean(builderRect && demoRect && demoRect.left >= builderRect.right - 1),
      demoBelowBuilder: Boolean(builderRect && demoRect && demoRect.top >= builderRect.bottom - 1),
      pageOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
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
    const app = document.querySelector('.app');
    const appStyle = app ? getComputedStyle(app) : null;
    const chat = document.getElementById('learnChatCol');
    const chatStyle = chat ? getComputedStyle(chat) : null;
    const bodyInner = document.querySelector('#learnBody .learn-body-inner');
    const bodyInnerStyle = bodyInner ? getComputedStyle(bodyInner) : null;
    const explain = document.getElementById('learnExplainCol');
    const explainStyle = explain ? getComputedStyle(explain) : null;
    const resizer = document.getElementById('learnResizer');
    const demoPage = document.querySelector('.lesson-page-frame.convolution-demo-page');
    const demoContent = demoPage?.querySelector('.lesson-page-content');
    const demoStyle = demoContent ? getComputedStyle(demoContent) : null;
    const teaching = demoContent?.querySelector('.convolution-teaching-card')?.getBoundingClientRect();
    const demo = demoContent?.querySelector('.kc-interactive-demo')?.getBoundingClientRect();
    const demoFeedback = demoContent?.querySelector('.geogebra-demo-feedback')?.getBoundingClientRect();
    const stageNav = demoPage?.querySelector('.convolution-stage-nav')?.getBoundingClientRect();
    const lessonProgress = demoPage?.querySelector('.convolution-lesson-progress')?.getBoundingClientRect();
    const lessonHeading = demoPage?.querySelector('.lesson-page-heading')?.getBoundingClientRect();
    const lessonHeadingTitle = demoPage?.querySelector('.lesson-page-heading h2');
    const lessonHeadingTitleRect = lessonHeadingTitle?.getBoundingClientRect();
    const lessonHeadingStyle = lessonHeadingTitle ? getComputedStyle(lessonHeadingTitle) : null;
    const fallbackRetry = demoContent?.querySelector('[data-geogebra-retry]')?.getBoundingClientRect();
    const demoStage = demoContent?.querySelector('.geogebra-demo-stage')?.getBoundingClientRect();
    const redMotionArrowCount = demoContent?.querySelectorAll('[data-geogebra-motion-arrow], .geogebra-motion-arrow').length || 0;
    const pager = document.getElementById('learnExplainPager')?.getBoundingClientRect();
    const explainScroll = document.getElementById('learnExplainScroll');
    const sidebarControls = Array.from(document.querySelectorAll(
      '#sidebarLogoExpandBtn, #sidebarPrimaryNav > .sidebar-link, #sidebarSettingsBtn'
    )).map(element => ({
      id: element.id,
      visible: visible(element),
      ...rect(`#${element.id}`),
    }));
    return {
      appFocus: document.querySelector('.app')?.classList.contains('convolution-focus-workspace-active') || false,
      appSidebarCollapsed: app?.classList.contains('sidebar-collapsed') || false,
      bodyFocus: document.getElementById('learnBody')?.classList.contains('convolution-focus-workspace-active') || false,
      chatCollapsed: document.getElementById('learnBody')?.classList.contains('chat-collapsed') || false,
      appColumns: appStyle?.gridTemplateColumns || '',
      sidebar: rect('#leftSidebar'),
      sidebarCollapsed: sidebar?.classList.contains('collapsed') || false,
      sidebarControls,
      sidebarPosition: sidebarStyle?.position || '',
      navTouchOpen: document.querySelector('.app')?.classList.contains('convolution-focus-nav-touch-open') || false,
      main: rect('#mainContent'),
      explain: rect('#learnExplainCol'),
      explainContainerName: explainStyle?.containerName || '',
      explainContainerType: explainStyle?.containerType || '',
      chat: rect('#learnChatCol'),
      chatDisplay: chatStyle?.display || '',
      chatVisibility: chatStyle?.visibility || '',
      chatOpacity: chatStyle?.opacity || '',
      chatWidth: chatStyle?.width || '',
      chatMaxWidth: chatStyle?.maxWidth || '',
      chatFlexBasis: chatStyle?.flexBasis || '',
      chatGridColumn: chatStyle?.gridColumn || '',
      innerColumns: bodyInnerStyle?.gridTemplateColumns || '',
      innerCustomSplit: bodyInner?.dataset.customSplit || '',
      resizerDisplay: resizer ? getComputedStyle(resizer).display : '',
      fabVisible: visible(document.getElementById('learnChatFab')),
      fabTitle: document.getElementById('learnChatFab')?.title || '',
      fabAriaLabel: document.getElementById('learnChatFab')?.getAttribute('aria-label') || '',
      fabExpanded: document.getElementById('learnChatFab')?.getAttribute('aria-expanded') || '',
      tutorMarkVisible: visible(document.querySelector('#learnChatFab .tutor-agent-mark')),
      tutorBadge: document.querySelector('#learnChatFab .tutor-agent-ai-badge')?.textContent.trim() || '',
      tutorTooltip: document.querySelector('#learnChatFab .tutor-agent-tooltip')?.textContent.trim() || '',
      topbarTitle: rect('#learnTitle'),
      touchMenu: rect('#floatToggleBtn'),
      touchMenuVisible: visible(document.getElementById('floatToggleBtn')),
      menuToggleVisible: visible(document.getElementById('menuToggleBtn')),
      minimizeVisible: visible(document.getElementById('learnTutorMinimizeBtn')),
      minimizeTitle: document.getElementById('learnTutorMinimizeBtn')?.title || '',
      minimizeAriaLabel: document.getElementById('learnTutorMinimizeBtn')?.getAttribute('aria-label') || '',
      minimizeExpanded: document.getElementById('learnTutorMinimizeBtn')?.getAttribute('aria-expanded') || '',
      demoPage: Boolean(demoPage),
      demoColumns: demoStyle?.gridTemplateColumns || '',
      demoTeachingTop: teaching?.top || 0,
      demoTeachingBottom: teaching?.bottom || 0,
      demoTeachingWidth: teaching?.width || 0,
      demoTop: demo?.top || 0,
      demoBottom: demo?.bottom || 0,
      demoWidth: demo?.width || 0,
      demoFeedbackBottom: demoFeedback?.bottom || 0,
      stageNavBottom: stageNav?.bottom || 0,
      lessonProgressBottom: lessonProgress?.bottom || 0,
      lessonHeadingTop: lessonHeading?.top || 0,
      lessonHeadingBottom: lessonHeading?.bottom || 0,
      lessonHeadingTitleTop: lessonHeadingTitleRect?.top || 0,
      lessonHeadingTitleBottom: lessonHeadingTitleRect?.bottom || 0,
      lessonHeadingFontSize: lessonHeadingStyle?.fontSize || '',
      lessonHeadingLineHeight: lessonHeadingStyle?.lineHeight || '',
      lessonHeadingPaddingTop: lessonHeadingStyle?.paddingTop || '',
      lessonHeadingPaddingBottom: lessonHeadingStyle?.paddingBottom || '',
      fallbackRetryTop: fallbackRetry?.top || 0,
      fallbackRetryBottom: fallbackRetry?.bottom || 0,
      demoStageTop: demoStage?.top || 0,
      demoStageBottom: demoStage?.bottom || 0,
      demoStageWidth: demoStage?.width || 0,
      demoStageHeight: demoStage?.height || 0,
      redMotionArrowCount,
      pagerTop: pager?.top || window.innerHeight,
      viewportHeight: window.innerHeight,
      explainScrollOverflow: explainScroll ? Math.max(0, explainScroll.scrollHeight - explainScroll.clientHeight) : 999,
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
      const frameRect = frame?.getBoundingClientRect();
      const frameStyle = frame ? getComputedStyle(frame) : null;
      const navRect = nav?.getBoundingClientRect();
      const frameContentWidth = frameRect && frameStyle
        ? frameRect.width - parseFloat(frameStyle.paddingLeft || '0') - parseFloat(frameStyle.paddingRight || '0')
        : 0;
      const tabRects = Array.from(nav?.querySelectorAll('.convolution-stage-tab') || [])
        .map(tab => tab.getBoundingClientRect());
      return {
        pointCount: Array.isArray(learnKnowledgePoints) ? learnKnowledgePoints.length : 0,
        state: window.getConvolutionLessonStageState?.() || null,
        labels: tabs.map(tab => tab.textContent.replace(/\s+/g, ' ').trim()),
        activeCount: tabs.filter(tab => tab.getAttribute('aria-current') === 'step').length,
        keyboardReady: tabs.every(tab => tab.tagName === 'BUTTON' && tab.tabIndex >= 0),
        sticky: navStyle?.position === 'sticky',
        title: frame?.querySelector('.convolution-stage-intro h2')?.textContent.trim() || '',
        groups: Array.from(frame?.querySelectorAll('.convolution-overview-columns > div') || []).map(group => ({
          heading: group.querySelector('h3')?.textContent.trim() || '',
          bullets: Array.from(group.querySelectorAll('li')).map(item => item.textContent.trim()),
        })),
        starts: frame?.querySelectorAll('[data-convolution-intro-start]').length || 0,
        pagerHidden: !pager || pager.hidden || getComputedStyle(pager).display === 'none',
        boxedNumbers: frame?.querySelectorAll('.convolution-intro-number, .convolution-page-marker, [data-convolution-number]').length || 0,
        template: frame?.dataset.convolutionTemplate || '',
        readingSurfaceCount: frame?.querySelectorAll('.convolution-reading-surface').length || 0,
        phaseCount: frame?.querySelectorAll('.convolution-phase-progress').length || 0,
        navWidthCoverage: frameContentWidth > 0 && navRect ? navRect.width / frameContentWidth : 0,
        stageTabWidthDelta: tabRects.length === 3
          ? Math.max(...tabRects.map(rect => rect.width)) - Math.min(...tabRects.map(rect => rect.width))
          : 999,
      };
    });
    record('application maps to one overview, eighteen lessons, and one practice page',
      intro.pointCount === 20
        && intro.state?.stage === 'intro'
        && intro.state?.total === 1
        && intro.state?.map?.lessonIndices?.length === 18,
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
    record('overview hands off from the previous section with two concise bullet groups',
      intro.title === 'From the Previous Section'
        && intro.groups.map(group => group.heading).join(',') === 'You already know,In this section'
        && intro.groups.every(group => group.bullets.length === 3)
        && intro.groups[0].bullets.includes('The convolution integral')
        && intro.groups[1].bullets.includes('Build the output piece by piece')
        && intro.starts === 1
        && intro.pagerHidden
        && intro.boxedNumbers === 0,
      JSON.stringify(intro));
    record('overview uses the restored full-width shell without a phase row',
      intro.template === 'overview'
        && intro.readingSurfaceCount === 1
        && intro.phaseCount === 0
        && intro.navWidthCoverage >= 0.95
        && intro.stageTabWidthDelta <= 2,
      JSON.stringify({
        template: intro.template,
        readingSurfaceCount: intro.readingSurfaceCount,
        phaseCount: intro.phaseCount,
        navWidthCoverage: intro.navWidthCoverage,
        stageTabWidthDelta: intro.stageTabWidthDelta,
      }));

    const overviewDesktop = await inspectOverviewSurface(page);
    record('overview uses a clean readable surface without horizontal overflow',
      overviewDesktop.frameBackground === 'rgb(234, 241, 242)'
        && overviewDesktop.frameBackgroundImage === 'none'
        && overviewDesktop.contentBackground === 'rgb(251, 252, 252)'
        && overviewDesktop.contentBackgroundImage === 'none'
        && overviewDesktop.columns.map(column => column.heading).join(',') === 'You already know,In this section'
        && overviewDesktop.columns.every(column => column.bullets.length === 3)
        && overviewDesktop.pageOverflow <= 1,
      JSON.stringify(overviewDesktop));
    record('overview text and glass navigation remain readable',
      contrastRatio(overviewDesktop.contentColor, overviewDesktop.contentBackground) >= 4.5
        && parseRgb(overviewDesktop.navBackground)?.a >= 0.72
        && /blur\((?:18|19|20|21|22)px\)/.test(overviewDesktop.navBackdrop),
      JSON.stringify({
        contentContrast: contrastRatio(overviewDesktop.contentColor, overviewDesktop.contentBackground),
        navBackground: overviewDesktop.navBackground,
        navBackdrop: overviewDesktop.navBackdrop,
      }));

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
    const mobileGroupsAreVertical = overviewMobile.columns.every((column, index, columns) => (
      index === 0 || column.top >= columns[index - 1].bottom - 1
    ));
    record('390px overview keeps both bullet groups ordered without overflow',
      overviewMobile.columns.map(column => column.heading).join(',') === 'You already know,In this section'
        && mobileGroupsAreVertical
        && overviewMobile.columns.every(column => column.width <= 390)
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
        && contrastRatio(overviewDark.contentColor, overviewDark.contentBackground) >= 4.5,
      JSON.stringify({
        contentBackground: overviewDark.contentBackground,
        contentContrast: contrastRatio(overviewDark.contentColor, overviewDark.contentBackground),
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
    record('Start Lesson enters Lesson 1 of 18',
      lessonStart.state?.stage === 'lesson'
        && lessonStart.state.position === 1
        && lessonStart.state.total === 18
        && lessonStart.pager === 'Lesson 1 / 18',
      JSON.stringify(lessonStart));

    const lessonPhaseStart = await page.evaluate(() => ({
      chips: Array.from(document.querySelectorAll('[data-convolution-phase-chip]')).map(chip => ({
        id: chip.dataset.convolutionPhaseChip,
        active: chip.getAttribute('aria-current') === 'step',
      })),
      phase: window.getConvolutionLessonPhase?.(1)?.id || '',
      phaseInsideHeading: Boolean(document.querySelector('.lesson-page-heading .convolution-phase-progress')),
    }));
    record('lesson exposes one active WHAT/WHY/HOW phase chip',
      lessonPhaseStart.chips.map(chip => chip.id).join(',') === 'what,why,how'
        && lessonPhaseStart.chips.filter(chip => chip.active).map(chip => chip.id).join(',') === 'what'
        && lessonPhaseStart.phase === 'what'
        && lessonPhaseStart.phaseInsideHeading,
      JSON.stringify(lessonPhaseStart));

    await page.evaluate(() => window.jumpToConvolutionLessonPosition?.(3));
    await waitForLayout(page);
    const whyPhase = await page.evaluate(() => ({
      state: window.getConvolutionLessonStageState?.(),
      active: document.querySelector('[data-convolution-phase-chip][aria-current="step"]')?.dataset.convolutionPhaseChip || '',
    }));
    record('jumping to Lesson 3 switches the active phase to WHY',
      whyPhase.state?.stage === 'lesson'
        && whyPhase.state.position === 3
        && whyPhase.active === 'why',
      JSON.stringify(whyPhase));

    await page.evaluate(() => window.jumpToConvolutionLessonPosition?.(5));
    await waitForLayout(page);
    const howPhase = await page.evaluate(() => ({
      state: window.getConvolutionLessonStageState?.(),
      active: document.querySelector('[data-convolution-phase-chip][aria-current="step"]')?.dataset.convolutionPhaseChip || '',
    }));
    record('jumping to Lesson 5 switches the active phase to HOW',
      howPhase.state?.stage === 'lesson'
        && howPhase.state.position === 5
        && howPhase.active === 'how',
      JSON.stringify(howPhase));

    await page.evaluate(() => window.jumpToConvolutionLessonPosition?.(1));
    await waitForLayout(page);
    const stateIsolation = await page.evaluate(() => {
      const key = 'ftutor:convolution-lesson:v6';
      const before = localStorage.getItem(key);
      localStorage.setItem('ftutor:convolution-lesson:v5', JSON.stringify({ version: 5, lastLessonPosition: 18 }));
      localStorage.setItem(key, JSON.stringify({ version: 5, lastLessonPosition: 18 }));
      const fresh = window.getConvolutionFigure27State?.();
      localStorage.setItem(key, before || '');
      return { fresh, current: window.getConvolutionLessonStageState?.() };
    });
    record('v5 or malformed state falls back to a fresh v6 lesson state',
      stateIsolation.fresh?.step === 1
        && stateIsolation.fresh?.t === -4
        && stateIsolation.current?.position === 1,
      JSON.stringify(stateIsolation));

    const lessonFocus = await inspectFocusWorkspace(page);
    record('lesson enters the focus workspace with a persistent 68px icon rail and Tutor orb',
      lessonFocus.appFocus
        && lessonFocus.bodyFocus
        && lessonFocus.chatCollapsed
        && lessonFocus.sidebarPosition !== 'fixed'
        && lessonFocus.sidebar?.left >= -1
        && lessonFocus.sidebar.left <= 1
        && lessonFocus.sidebar.width >= 67
        && lessonFocus.sidebar.width <= 69
        && lessonFocus.sidebarControls.length >= 8
        && lessonFocus.sidebarControls.every(control => control.visible
          && control.left >= -1
          && control.right <= lessonFocus.sidebar.right + 1)
        && lessonFocus.main?.left >= 67
        && lessonFocus.main.left <= 69
        && lessonFocus.fabVisible
        && lessonFocus.fabTitle === 'Open Tutor'
        && lessonFocus.fabAriaLabel === 'Open Tutor'
        && lessonFocus.fabExpanded === 'false'
        && lessonFocus.tutorMarkVisible
        && lessonFocus.tutorBadge === 'AI'
        && lessonFocus.tutorTooltip === 'Tutor Agent'
        && lessonFocus.chatDisplay === 'flex'
        && lessonFocus.chatVisibility === 'hidden'
        && Number(lessonFocus.chatOpacity) === 0
        && lessonFocus.chat?.width <= 1
        && lessonFocus.resizerDisplay === 'none'
        && lessonFocus.fullscreenControls === 0,
      JSON.stringify(lessonFocus));

    const workspaceBeforeRailInteraction = lessonFocus;
    await page.mouse.move(38, 420);
    await page.waitForTimeout(300);
    const railHovered = await inspectFocusWorkspace(page);
    await page.mouse.move(640, 420);
    await page.waitForTimeout(300);
    const railAfterHover = await inspectFocusWorkspace(page);
    record('desktop icon rail stays compact and does not cover or shift the lesson on hover',
      railHovered.sidebar?.width >= 67
        && railHovered.sidebar.width <= 69
        && railAfterHover.sidebar?.width >= 67
        && railAfterHover.sidebar.width <= 69
        && Math.abs((railHovered.main?.left || 0) - (workspaceBeforeRailInteraction.main?.left || 0)) <= 1
        && Math.abs((railAfterHover.main?.left || 0) - (workspaceBeforeRailInteraction.main?.left || 0)) <= 1,
      JSON.stringify({ workspaceBeforeRailInteraction, railHovered, railAfterHover }));

    await page.focus('#navHomeBtn');
    await page.waitForTimeout(260);
    const railFocused = await inspectFocusWorkspace(page);
    await page.focus('[data-convolution-stage-target="lesson"]');
    await page.waitForTimeout(260);
    const railBlurred = await inspectFocusWorkspace(page);
    record('keyboard focus remains visible without expanding the compact icon rail',
      railFocused.sidebar?.left >= -1
        && railFocused.sidebar.left <= 1
        && railFocused.sidebar?.width >= 67
        && railFocused.sidebar.width <= 69
        && railBlurred.sidebar?.left >= -1
        && railBlurred.sidebar.left <= 1
        && railBlurred.sidebar?.width >= 67
        && railBlurred.sidebar.width <= 69,
      JSON.stringify({ railFocused, railBlurred }));

    await page.evaluate(() => document.getElementById('learnChatFab')?.click());
    await page.waitForTimeout(520);
    const tutorOpen = await inspectFocusWorkspace(page);
    record('Tutor orb opens the existing panel at an approximately 2:1 lesson-to-Tutor ratio',
      !tutorOpen.chatCollapsed
        && tutorOpen.chat?.width >= 320
        && tutorOpen.explain?.width / tutorOpen.chat.width >= 1.95
        && tutorOpen.explain.width / tutorOpen.chat.width <= 2.05
        && tutorOpen.chatDisplay !== 'none'
        && tutorOpen.minimizeVisible
        && tutorOpen.minimizeTitle === 'Collapse Tutor'
        && tutorOpen.minimizeAriaLabel === 'Collapse Tutor'
        && tutorOpen.minimizeExpanded === 'true'
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
        && tutorAfterPage.explain?.width / tutorAfterPage.chat?.width >= 1.95
        && tutorAfterPage.explain.width / tutorAfterPage.chat.width <= 2.05
        && !tutorPractice.chatCollapsed
        && tutorPractice.explain?.width / tutorPractice.chat?.width >= 1.95
        && tutorPractice.explain.width / tutorPractice.chat.width <= 2.05,
      JSON.stringify({ tutorAfterPage, tutorPractice }));

    await clickStage(page, 'intro', 1);
    const overviewReset = await inspectFocusWorkspace(page);
    await clickStage(page, 'lesson', 2);
    const lessonReset = await inspectFocusWorkspace(page);
    record('returning to overview restores ordinary Q&A and re-entering lesson resets to the orb',
      !overviewReset.appFocus
        && !overviewReset.appSidebarCollapsed
        && !overviewReset.bodyFocus
        && !overviewReset.chatCollapsed
        && !overviewReset.sidebarCollapsed
        && overviewReset.sidebar?.width >= 220
        && overviewReset.menuToggleVisible
        && overviewReset.chatDisplay !== 'none'
        && lessonReset.appFocus
        && lessonReset.bodyFocus
        && lessonReset.chatCollapsed
        && lessonReset.fabVisible,
      JSON.stringify({ overviewReset, lessonReset }));

    await page.setViewportSize({ width: 1280, height: 720 });
    await goToLessonPage(page, 6);
    const demoWorkspace = await inspectFocusWorkspace(page);
    record('GeoGebra lesson uses the approved 43/57 horizontal workspace on desktop',
      demoWorkspace.demoPage
        && demoWorkspace.demoTeachingWidth > 0
        && demoWorkspace.demoWidth > demoWorkspace.demoTeachingWidth
        && demoWorkspace.demoWidth / demoWorkspace.demoTeachingWidth >= 1.25
        && demoWorkspace.demoWidth / demoWorkspace.demoTeachingWidth <= 1.40
        && demoWorkspace.demoWidth <= 640
        && demoWorkspace.horizontalOverflow <= 1,
      JSON.stringify(demoWorkspace));
    record('1280x720 keeps an equal-scale-ready Demo safely scrollable instead of flattening it',
      demoWorkspace.demoFeedbackBottom > 0
        && demoWorkspace.demoStageWidth >= 360
        && demoWorkspace.demoStageWidth <= 640
        && demoWorkspace.demoStageHeight >= 360
        && demoWorkspace.demoStageHeight <= 560
        && demoWorkspace.explainScrollOverflow > 0
        && demoWorkspace.horizontalOverflow <= 1
        && demoWorkspace.redMotionArrowCount === 0
        && demoWorkspace.lessonHeadingTitleTop >= demoWorkspace.lessonHeadingTop - 1
        && demoWorkspace.lessonHeadingTitleBottom <= demoWorkspace.lessonHeadingBottom + 1
        && (!demoWorkspace.fallbackRetryBottom
          || (demoWorkspace.fallbackRetryTop >= demoWorkspace.demoStageTop
            && demoWorkspace.fallbackRetryBottom <= demoWorkspace.demoStageBottom)),
      JSON.stringify(demoWorkspace));
    await captureEvidence(page, 'focus-1280x720.png');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => document.getElementById('learnChatFab')?.click());
    await page.waitForTimeout(520);
    const demoWithTutor = await inspectFocusWorkspace(page);
    record('opening Tutor reflows the Demo without overlapping or rebuilding its layout shell',
      demoWithTutor.demoPage
        && demoWithTutor.chat?.width >= 320
        && demoWithTutor.explain?.width / demoWithTutor.chat.width >= 1.95
        && demoWithTutor.explain.width / demoWithTutor.chat.width <= 2.05
        && demoWithTutor.explain?.right <= demoWithTutor.chat?.left + 1
        && demoWithTutor.horizontalOverflow <= 1,
      JSON.stringify(demoWithTutor));
    record('1440x900 keeps the compact Demo near-square with Tutor open',
      demoWithTutor.demoFeedbackBottom > 0
        && demoWithTutor.demoStageHeight >= 360
        && demoWithTutor.demoStageHeight <= 560
        && Math.abs(demoWithTutor.demoStageWidth - demoWithTutor.demoStageHeight) <= 3
        && demoWithTutor.horizontalOverflow <= 1
        && demoWithTutor.redMotionArrowCount === 0
        && demoWithTutor.demoTeachingBottom <= demoWithTutor.pagerTop - 8
        && demoWithTutor.lessonHeadingTitleTop >= demoWithTutor.lessonHeadingTop - 1
        && demoWithTutor.lessonHeadingTitleBottom <= demoWithTutor.lessonHeadingBottom + 1
        && (!demoWithTutor.fallbackRetryBottom
          || (demoWithTutor.fallbackRetryTop >= demoWithTutor.demoStageTop
            && demoWithTutor.fallbackRetryBottom <= demoWithTutor.demoStageBottom)),
      JSON.stringify(demoWithTutor));
    await captureEvidence(page, 'focus-1440x900-tutor.png');

    await page.evaluate(() => document.getElementById('learnTutorMinimizeBtn')?.click());
    await page.waitForTimeout(520);
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
      template: document.querySelector('.lesson-page-frame[data-lesson-section="2.4-2"]')?.dataset.convolutionTemplate || '',
      readingSurfaceCount: document.querySelectorAll('.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-reading-surface').length,
      phaseCount: document.querySelectorAll('.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-phase-progress').length,
      pager: document.getElementById('learnPagerPosition')?.textContent.trim() || '',
      steps: Array.from(document.querySelectorAll('[data-practice-step-chip]'))
        .map(chip => chip.textContent.replace(/^\d+\.\s*/, '').trim())
        .join(','),
      panels: document.querySelectorAll('[data-practice-panel]').length,
      demoPreset: document.querySelector('[data-practice-demo-host]')?.dataset.practicePreset || '',
      genericQuickCheck: Boolean(document.querySelector('#startTestBtn')),
    }));
    record('practice contains the approved five-step builder instead of the generic Quick Check',
      practice.state?.stage === 'practice'
        && practice.template === 'practice'
        && practice.readingSurfaceCount === 1
        && practice.phaseCount === 0
        && practice.pager === 'Practice'
        && practice.steps === 'Predict,Plan,Build,Calculate,Sketch'
        && practice.panels === 1
        && practice.demoPreset === 'practice-rectangle-triangle'
        && !practice.genericQuickCheck,
      JSON.stringify(practice));

    const practiceDesktop = await inspectPracticeSurface(page);
    record('practice uses one reading plane with a transparent root and ordered five-step workspace',
      practiceDesktop.rootBackground === 'rgba(0, 0, 0, 0)'
        && practiceDesktop.rootBorderTopWidth === '0px'
        && practiceDesktop.rootBoxShadow === 'none'
        && practiceDesktop.rootBackdrop === 'none'
        && practiceDesktop.stepCount === 5
        && practiceDesktop.activeStepCount === 1
        && practiceDesktop.panelCount === 1
        && practiceDesktop.stepAbovePanel
        && practiceDesktop.pageOverflow <= 1,
      JSON.stringify(practiceDesktop));
    record('practice keeps a 43/57 builder-to-demo split without the legacy nested builder grid',
      practiceDesktop.demoBesideBuilder
        && practiceDesktop.demoWidth / practiceDesktop.builderWidth >= 1.25
        && practiceDesktop.demoWidth / practiceDesktop.builderWidth <= 1.40
        && practiceDesktop.builderTemplate.trim().split(/\s+/).length === 1,
      JSON.stringify(practiceDesktop));

    const practiceTheme = await page.evaluate(() => document.documentElement.dataset.theme || '');
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await waitForLayout(page);
    const practiceDark = await inspectPracticeSurface(page);
    record('dark Practice keeps an opaque high-contrast reading surface',
      practiceDark.contentBackgroundImage === 'none'
        && parseRgb(practiceDark.contentBackground)?.a === 1
        && contrastRatio(practiceDark.contentColor, practiceDark.contentBackground) >= 4.5
        && practiceDark.rootBackground === 'rgba(0, 0, 0, 0)'
        && practiceDark.rootBackdrop === 'none',
      JSON.stringify({
        contentBackground: practiceDark.contentBackground,
        contentContrast: contrastRatio(practiceDark.contentColor, practiceDark.contentBackground),
        rootBackground: practiceDark.rootBackground,
        rootBackdrop: practiceDark.rootBackdrop,
      }));
    await page.evaluate((theme) => {
      if (theme) document.documentElement.dataset.theme = theme;
      else document.documentElement.removeAttribute('data-theme');
    }, practiceTheme);
    await waitForLayout(page);

    await clickStage(page, 'lesson', 7);
    const remembered = await page.evaluate(() => window.getConvolutionLessonStageState?.());
    record('returning from practice restores Lesson 7 of 18', remembered?.stage === 'lesson' && remembered.position === 7, JSON.stringify(remembered));

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
    const expectedTemplates = [
      ...Array(5).fill('reading'),
      ...Array(10).fill('demo'),
      ...Array(3).fill('finish'),
    ];
    record('all lesson pages expose the approved shell template and one reading surface',
      desktop.every((item, index) => item.template === expectedTemplates[index]
        && item.readingSurfaceCount === 1
        && item.phaseInsideHeading
        && item.navWidthCoverage >= 0.95
        && item.stageTabWidthDelta <= 2),
      JSON.stringify(desktop.map((item, index) => ({
        page: index + 1,
        expected: expectedTemplates[index],
        template: item.template,
        readingSurfaceCount: item.readingSurfaceCount,
        phaseInsideHeading: item.phaseInsideHeading,
        navWidthCoverage: item.navWidthCoverage,
        stageTabWidthDelta: item.stageTabWidthDelta,
      }))));
    record('all lesson pages use one opaque reading surface without nested glass cards',
      desktop.every((item, index) => parseRgb(item.contentBackground)?.a === 1
        && item.contentBackgroundImage === 'none'
        && (expectedTemplates[index] === 'demo' || item.contentWidth <= 900)
        && item.nestedSurfaces.length >= 1
        && item.nestedSurfaces.every(surface => surface.background === 'rgba(0, 0, 0, 0)'
          && surface.borderTopWidth === '0px'
          && surface.boxShadow === 'none'
          && surface.backdrop === 'none')),
      JSON.stringify(desktop.map((item, index) => ({
        page: index + 1,
        template: expectedTemplates[index],
        contentBackground: item.contentBackground,
        contentWidth: item.contentWidth,
        nestedSurfaces: item.nestedSurfaces,
      }))));
    record('all eighteen desktop lesson pages use approved titles without boxed numbers or overflow',
      desktop.every((item, index) => item.titleCorrect
        && item.stage === 'lesson'
        && item.position === index + 1
        && item.total === 18
        && item.boxedNumbers === 0
        && item.contentOverflow <= 1
        && item.pageOverflow <= 1
        && item.navOverflow <= 1
        && item.contentBackground === 'rgb(251, 252, 252)'
        && item.contentBackgroundImage === 'none'
        && item.fontSize >= 18
        && item.lineHeight >= item.fontSize * 1.6),
      JSON.stringify(desktop.map((item, index) => ({ page: index + 1, title: item.title, font: item.fontSize, overflow: item.pageOverflow }))));
    record('approved visuals and controlled demos appear on the intended pages',
      desktop[3].images.some(image => image.src.endsWith('/convolution-ink-memory-v2.png') && image.complete && image.width === 1153)
        && desktop[3].images.some(image => image.src.endsWith('/convolution-sprinkler-procedure-v2.png') && image.complete && image.width === 1153)
        && desktop[3].images.some(image => image.src.endsWith('/convolution-past-effects-v1.png') && image.complete && image.width === 1153)
        && desktop.slice(5, 15).every(item => item.demoCount === 1)
        && desktop.slice(0, 5).every(item => item.demoCount === 0)
        && desktop.slice(15).every(item => item.demoCount === 0),
      JSON.stringify(desktop.map((item, index) => ({ page: index + 1, demos: item.demos, visuals: item.visualKinds, images: item.images.map(image => image.src) }))));

    for (const viewport of [[390, 844], [430, 932]]) {
      const snapshot = await collectViewport(page, viewport[0], viewport[1]);
      record(`${viewport[0]}px keeps all eighteen pages readable and inside the viewport`,
        snapshot.every(item => item.fontSize >= 16
          && item.contentOverflow <= 1
          && item.pageOverflow <= 1
          && item.navOverflow <= 1
          && item.boxedNumbers === 0),
        JSON.stringify(snapshot.map((item, index) => ({ page: index + 1, font: item.fontSize, overflow: item.pageOverflow }))));

      await goToLessonPage(page, 6);
      const mobileFocus = await inspectFocusWorkspace(page);
      record(`${viewport[0]}px uses the touch menu, hides the Tutor orb, and stacks the Demo`,
        mobileFocus.appFocus
          && mobileFocus.bodyFocus
          && mobileFocus.touchMenuVisible
          && mobileFocus.touchMenu?.right <= mobileFocus.topbarTitle?.left - 8
          && !mobileFocus.fabVisible
          && !mobileFocus.minimizeVisible
          && mobileFocus.demoPage
          && mobileFocus.demoTop >= mobileFocus.demoTeachingBottom - 1
          && mobileFocus.horizontalOverflow <= 1,
        JSON.stringify(mobileFocus));
      await captureEvidence(page, `focus-${viewport[0]}x${viewport[1]}.png`);

      const mobileLesson = await inspectLessonPage(page, 6);
      record(`${viewport[0]}px moves the lesson phase below its title without horizontal overflow`,
        mobileLesson.phaseBelowTitle
          && mobileLesson.navOverflow <= 1
          && mobileLesson.pageOverflow <= 1,
        JSON.stringify({
          phaseBelowTitle: mobileLesson.phaseBelowTitle,
          navOverflow: mobileLesson.navOverflow,
          pageOverflow: mobileLesson.pageOverflow,
        }));

      await clickStage(page, 'practice', 1);
      const mobilePractice = await inspectPracticeSurface(page);
      record(`${viewport[0]}px stacks Practice below the builder and keeps all five steps in view`,
        mobilePractice.demoBelowBuilder
          && !mobilePractice.demoBesideBuilder
          && mobilePractice.stepOverflow <= 1
          && mobilePractice.pageOverflow <= 1,
        JSON.stringify(mobilePractice));

      await page.evaluate(() => document.getElementById('floatToggleBtn')?.click());
      await page.waitForTimeout(260);
      const mobileRailOpen = await inspectFocusWorkspace(page);
      await page.evaluate(() => document.getElementById('menuToggleBtn')?.click());
      await page.waitForTimeout(260);
      const mobileRailClosed = await inspectFocusWorkspace(page);
      record(`${viewport[0]}px touch menu opens and closes the icon rail without moving the lesson`,
        mobileRailOpen.navTouchOpen
          && mobileRailOpen.sidebar?.left >= -1
          && mobileRailOpen.sidebar.left <= 1
          && !mobileRailOpen.touchMenuVisible
          && !mobileRailClosed.navTouchOpen
          && mobileRailClosed.sidebar?.right <= 1
          && mobileRailClosed.touchMenuVisible
          && Math.abs((mobileRailOpen.explain?.left || 0) - (mobileRailClosed.explain?.left || 0)) <= 1,
        JSON.stringify({ mobileRailOpen, mobileRailClosed }));
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await waitForLayout(page);
    await page.locator('#navHomeBtn').click();
    await page.waitForFunction(() => document.getElementById('learnView')?.classList.contains('hidden'), null, { timeout: 5000 });
    await waitForLayout(page);
    const afterBack = await inspectFocusWorkspace(page);
    record('Home exits focus and restores the ordinary sidebar workspace',
      !afterBack.appFocus
        && !afterBack.bodyFocus
        && !afterBack.appSidebarCollapsed
        && !afterBack.sidebarCollapsed
        && afterBack.sidebar?.width >= 220
        && afterBack.menuToggleVisible
        && afterBack.sidebarControls.every(control => control.visible
          && control.left >= -1
          && control.right <= afterBack.sidebar.right + 1),
      JSON.stringify(afterBack));

    await openSubtopic(page, SUBTOPIC);
    await page.waitForFunction(() => {
      const state = window.getConvolutionLessonStageState?.();
      return state?.stage === 'intro' && state.map?.lessonIndices?.length === 18;
    }, null, { timeout: 25000 });
    await goToLessonPage(page, 1);
    await page.waitForFunction(() => window.getConvolutionLessonStageState?.()?.stage === 'lesson', null, { timeout: 5000 });
    await waitForLayout(page);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('learnView')?.classList.contains('hidden'), null, { timeout: 5000 });
    await waitForLayout(page);
    const afterEscape = await inspectFocusWorkspace(page);
    record('Escape exits focus and restores the ordinary sidebar workspace',
      !afterEscape.appFocus
        && !afterEscape.bodyFocus
        && !afterEscape.appSidebarCollapsed
        && !afterEscape.sidebarCollapsed
        && afterEscape.sidebar?.width >= 220
        && afterEscape.menuToggleVisible,
      JSON.stringify(afterEscape));

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
