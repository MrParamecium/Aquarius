'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CACHE_PATH = path.join(
  ROOT,
  'workspace',
  'materials',
  'lesson-cache',
  '2_4-2',
  'new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md'
);
const ILLUSTRATION_DIR = path.join(ROOT, 'workspace', 'materials', 'lesson-illustrations', '2_4-2');
const FIGURE_DIR = path.join(ROOT, 'workspace', 'materials', 'new-book-figures');
const STATIC_ROUTES_PATH = path.join(ROOT, 'app', 'static-routes.js');
const STYLE_PATH = path.join(ROOT, 'app', 'style.css');
const RENDER_PATH = path.join(ROOT, 'app', 'lesson-render.js');
const PAGER_PATH = path.join(ROOT, 'app', 'ui-friction-fixes.js');
const PRESET_PATH = path.join(ROOT, 'app', 'interactive-demos', 'geogebra-convolution-presets.js');
const DEMO_PATH = path.join(ROOT, 'app', 'interactive-demos', 'geogebra-demo.js');
const PRACTICE_PATH = path.join(ROOT, 'app', 'convolution-practice.js');

const APPROVED_IMAGES = [
  {
    filename: 'convolution-ink-memory-v2.png',
    url: '/lesson-illustrations/2_4-2/convolution-ink-memory-v2.png',
    page: 4,
    altToken: 'ink',
  },
  {
    filename: 'convolution-sprinkler-procedure-v2.png',
    url: '/lesson-illustrations/2_4-2/convolution-sprinkler-procedure-v2.png',
    page: 4,
    altToken: 'sprinkler',
  },
  {
    filename: 'convolution-past-effects-v1.png',
    url: '/lesson-illustrations/2_4-2/convolution-past-effects-v1.png',
    page: 4,
    altToken: 'past',
  },
];
const EXPECTED_HEADINGS = [
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
const EXPECTED_DEMOS = [
  [6, 'figure-2-7', 'guided-sequence', 'guided'],
  [7, 'example-2-10', 'worked-example', 'full'],
  [8, 'example-2-11', 'segments', 'partial'],
  [9, 'example-2-11', 'cases', 'partial'],
  [10, 'example-2-12', 'contact-points', 'light'],
  [11, 'example-2-12', 'integration-limits', 'light'],
  [12, 'example-2-12', 'piecewise-output', 'light'],
  [13, 'figure-2-11', 'commutativity', 'transfer'],
  [14, 'figure-2-12', 'support-transfer', 'transfer'],
  [15, 'figure-2-13', 'shift-transfer', 'transfer'],
];
const ALLOWED_FALLBACKS = new Set([
  '/figures/page-179-figure_2_7.png',
  '/figures/page-182-figure_2_8.png',
  '/figures/page-184-figure_2_9.png',
  '/figures/page-186-figure_2_10.png',
  '/figures/page-188-figure_2_11.png',
  '/figures/page-188-figure_2_12.png',
  '/figures/page-188-figure_2_13.png',
]);
const NON_ENGLISH_PRODUCT_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const SEMANTIC_TOKENS = {
  '--convolution-input': '#1f64d7',
  '--convolution-response': '#7042b8',
  '--convolution-action': '#167b64',
  '--convolution-overlap': '#167b64',
  '--convolution-output': '#167b64',
  '--convolution-integral': '#b6531d',
  '--convolution-warning': '#b6531d',
};
const SURFACE_TOKENS = {
  '--convolution-environment': '#eaf1f2',
  '--convolution-surface': '#fbfcfc',
  '--convolution-tool-surface': '#f5f7f8',
  '--convolution-copy': '#172033',
  '--convolution-muted': '#58687e',
  '--convolution-line': '#d9e1e5',
};

const failures = [];
const fail = (message) => failures.push(message);

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`missing required file: ${path.relative(ROOT, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function readPngSize(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`missing approved illustration: ${path.relative(ROOT, filePath)}`);
    return null;
  }
  const buffer = fs.readFileSync(filePath);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    fail(`approved illustration is not a valid PNG: ${path.relative(ROOT, filePath)}`);
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function parseLessonPages(markdown) {
  const headings = Array.from(markdown.matchAll(/^## ([1-9]\d*)\. ([^\r\n]+)\r?$/gm));
  if (headings.length !== EXPECTED_HEADINGS.length) {
    fail(`lesson must contain exactly ${EXPECTED_HEADINGS.length} anchored numbered H2 pages, found ${headings.length}`);
  }
  const pages = new Map();
  headings.forEach((match, index) => {
    const pageNumber = Number(match[1]);
    const expectedNumber = index + 1;
    const title = match[2];
    if (pageNumber !== expectedNumber) fail(`lesson H2 ${index + 1} must be numbered ${expectedNumber}, found ${pageNumber}`);
    if (title !== EXPECTED_HEADINGS[index]) {
      fail(`lesson page ${expectedNumber} heading must be "${EXPECTED_HEADINGS[index]}", found "${title}"`);
    }
    if (pages.has(pageNumber)) fail(`lesson page ${pageNumber} heading must occur once`);
    const end = headings[index + 1]?.index ?? markdown.length;
    pages.set(pageNumber, markdown.slice(match.index, end));
  });
  return { pages, firstHeadingIndex: headings[0]?.index ?? markdown.length };
}

function getKcBlocks(source) {
  return Array.from(source.matchAll(/%%KC_BLOCK%%([\s\S]*?)%%KC_END%%/g), match => match[1]);
}

function getOpeningTags(source, attribute, value = null) {
  return Array.from(source.matchAll(/<[a-z][^>]*>/gi), match => match[0]).filter((tag) => {
    const attributePattern = value === null
      ? new RegExp(`\\s${attribute}(?:\\s|=|>)`)
      : new RegExp(`\\s${attribute}="${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
    return attributePattern.test(tag);
  });
}

function isHiddenTag(tag) {
  return /\shidden(?:\s|=|>)/.test(tag);
}

function stripHiddenRevealBlocks(source) {
  return source.replace(/<(div|p|ol|ul)\b(?=[^>]*\sdata-convolution-reveal="[^"]+")(?=[^>]*\shidden(?:\s|=|>))[^>]*>[\s\S]*?<\/\1>/gi, '');
}

function decodeDemos(source, context = 'lesson') {
  return Array.from(source.matchAll(/data-demo-b64="([^"]*)"/g), (match, index) => {
    const encoded = match[1];
    try {
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
        throw new Error('payload is not canonical padded base64');
      }
      const bytes = Buffer.from(encoded, 'base64');
      if (bytes.toString('base64') !== encoded) throw new Error('payload base64 does not round-trip canonically');
      const decoded = bytes.toString('utf8');
      if (!Buffer.from(decoded, 'utf8').equals(bytes)) throw new Error('payload is not valid UTF-8');
      const payload = JSON.parse(decoded);
      if (Buffer.from(JSON.stringify(payload), 'utf8').toString('base64') !== encoded) {
        throw new Error('payload must encode canonical compact JSON');
      }
      return payload;
    } catch (error) {
      fail(`${context} demo ${index + 1} has invalid data-demo-b64: ${error.message}`);
      return null;
    }
  }).filter(Boolean);
}

function validateFallbackFigure(fallbackFigure, context) {
  if (typeof fallbackFigure !== 'string') {
    fail(`${context} fallback_figure must be a string`);
    return;
  }
  const segments = fallbackFigure.split('/');
  const filename = segments.at(-1) || '';
  if (segments.some(segment => segment === '.' || segment === '..')
    || !/^\/figures\/[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(fallbackFigure)) {
    fail(`${context} fallback_figure must be a normalized PNG, JPG, JPEG, or WebP path under /figures/`);
    return;
  }
  if (!ALLOWED_FALLBACKS.has(fallbackFigure)) fail(`${context} fallback_figure is not in the Section 2.4-2 allowlist`);
  if (!fs.existsSync(path.join(FIGURE_DIR, filename))) fail(`${context} fallback_figure does not exist in trusted figure storage`);
}

const cache = readRequired(CACHE_PATH);
const staticRoutes = readRequired(STATIC_ROUTES_PATH);
const styles = readRequired(STYLE_PATH);
const renderer = readRequired(RENDER_PATH);
const pagerSource = readRequired(PAGER_PATH);
const presets = readRequired(PRESET_PATH);
const demoSource = readRequired(DEMO_PATH);
const practiceSource = readRequired(PRACTICE_PATH);

if (cache) {
  if (NON_ENGLISH_PRODUCT_SCRIPT.test(cache)) {
    fail('the English 2.4-2 lesson cache must not contain Han, Hiragana, Katakana, or Hangul product copy');
  }
  const { pages, firstHeadingIndex } = parseLessonPages(cache);
  if ((cache.match(/data-convolution-stage-intro="true"/g) || []).length !== 1) {
    fail('lesson must contain exactly one dedicated stage intro');
  }
  if (/convolution-intro-number|convolution-page-marker|data-convolution-number=|convolution-island-number/.test(cache)) {
    fail('lesson must not output boxed or page-local number markers');
  }

  for (const phrase of [
    'From the Previous Section',
    'You already know',
    'The convolution integral',
    'Basic convolution properties',
    'Analytical computation',
    'In this section',
    'Turn the integral into moving graphs',
    'Track the changing overlap',
    'Build the output piece by piece',
    'Start Lesson',
  ]) {
    if (!cache.includes(phrase)) fail(`stage intro is missing approved copy: ${phrase}`);
  }
  const introSource = cache.slice(0, firstHeadingIndex);
  if ((introSource.match(/<button\b/g) || []).length !== 1 || !/data-convolution-intro-start/.test(introSource)) {
    fail('stage intro must expose only the Start Lesson primary action');
  }
  if (/data-convolution-overview-formula|\\int_|What Is Convolution\?/.test(introSource)) {
    fail('stage intro must bridge from the previous section without reteaching the convolution definition');
  }

  EXPECTED_HEADINGS.forEach((_, index) => {
    const pageNumber = index + 1;
    const pageSource = pages.get(pageNumber) || '';
    if (!pageSource) return;
    const markers = Array.from(pageSource.matchAll(/data-convolution-page="([^"]+)"/g), match => match[1]);
    if (markers.length !== 1 || markers[0] !== String(pageNumber)) {
      fail(`page ${pageNumber} section must contain only its own stable marker, found ${JSON.stringify(markers)}`);
    }
    const expectedPhase = pageNumber <= 2 ? 'what' : pageNumber <= 4 ? 'why' : 'how';
    const phases = Array.from(pageSource.matchAll(/data-convolution-phase="([^"]+)"/g), match => match[1]);
    if (phases.length !== 1 || phases[0] !== expectedPhase) {
      fail(`page ${pageNumber} section must contain only phase ${expectedPhase}, found ${JSON.stringify(phases)}`);
    }
    if ((pageSource.match(/class="[^"]*\bconvolution-learning-goal\b/g) || []).length !== 1) {
      fail(`page ${pageNumber} must contain exactly one learning goal`);
    }
    if ((pageSource.match(/class="[^"]*\bconvolution-can-now\b/g) || []).length !== 1) {
      fail(`page ${pageNumber} must contain exactly one You can now outcome`);
    }
    const highlights = (pageSource.match(/class="[^"]*\bconvolution-key\b/g) || []).length;
    if (highlights > 8) fail(`page ${pageNumber} may highlight at most 8 items, found ${highlights}`);
    const cards = getKcBlocks(pageSource).filter(block => /<section\b[^>]*class="[^"]*\bconvolution-teaching-card\b/.test(block));
    if (cards.length !== 1) {
      fail(`page ${pageNumber} must contain exactly one KC_BLOCK teaching card`);
    } else {
      const bulletCount = (cards[0].match(/<li\b/g) || []).length;
      if (pageNumber === 17) {
        if (bulletCount !== 0) fail('page 17 is an interactive host and must not duplicate Exit Check questions in lesson copy');
      } else if (bulletCount < 3 || bulletCount > 5) {
        fail(`page ${pageNumber} teaching card must contain 3–5 bullet points, found ${bulletCount}`);
      }
    }

    const expectedDemo = EXPECTED_DEMOS.find(([demoPage]) => demoPage === pageNumber);
    const pageDemos = decodeDemos(pageSource, `page ${pageNumber}`);
    const expectedDemoCount = expectedDemo ? 1 : 0;
    if (pageDemos.length !== expectedDemoCount) {
      fail(`page ${pageNumber} must contain ${expectedDemoCount} controlled demo payload(s), found ${pageDemos.length}`);
    }
  });

  for (const image of APPROVED_IMAGES) {
    const pageSource = pages.get(image.page) || '';
    if (!pageSource.includes(`src="${image.url}"`)) fail(`${image.filename} must appear on lesson page ${image.page}`);
    if (!new RegExp(`alt="[^"]*${image.altToken}[^"]*"`, 'i').test(pageSource)) {
      fail(`${image.filename} must have meaningful alt text on page ${image.page}`);
    }
  }
  const lessonImageUrls = Array.from(cache.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g), match => match[1]);
  const analogyUrls = lessonImageUrls.filter(url => url.startsWith('/lesson-illustrations/2_4-2/'));
  if (JSON.stringify(analogyUrls) !== JSON.stringify(APPROVED_IMAGES.map(image => image.url))) {
    fail(`lesson illustrations must be exactly the approved assets, found ${JSON.stringify(analogyUrls)}`);
  }

  const page2 = pages.get(2) || '';
  const page3 = pages.get(3) || '';
  const page4 = pages.get(4) || '';
  for (const token of ['t1', 't2', 't3']) {
    if (!new RegExp(`data-convolution-time-choice="${token}"`).test(page2)) fail(`page 2 is missing the ${token} time choice`);
  }
  for (const hook of ['data-convolution-moving-signal', 'data-convolution-overlap-preview', 'data-convolution-output-dot']) {
    if (!page2.includes(hook)) fail(`page 2 is missing the ${hook} preview hook`);
  }
  for (const token of ['first', 'full', 'last']) {
    if (!new RegExp(`data-convolution-contact-choice="${token}"`).test(page3)) fail(`page 3 is missing the ${token} contact choice`);
    if (!new RegExp(`data-convolution-breakpoint="${token}"`).test(page3)) fail(`page 3 is missing the ${token} breakpoint hook`);
  }
  if (!/data-convolution-contact-diagram/.test(page3)) fail('page 3 is missing the contact diagram hook');
  for (const token of ['ink', 'sprinkler', 'past-effects']) {
    if (!new RegExp(`data-convolution-analogy-choice="${token}"`).test(page4)) fail(`page 4 is missing the ${token} analogy choice`);
    if (!new RegExp(`data-convolution-analogy-panel="${token}"`).test(page4)) fail(`page 4 is missing the ${token} analogy panel`);
  }

  const page5 = pages.get(5) || '';
  for (const [action, icon] of [['change', 'τ'], ['flip', '↔'], ['slide', '→'], ['multiply', '×'], ['integrate', '∫']]) {
    const iconTags = getOpeningTags(page5, 'data-convolution-action-icon', action);
    if (iconTags.length !== 1
      || !/\saria-hidden="true"/.test(iconTags[0])
      || !page5.includes(`${iconTags[0]}${icon}</span>`)) {
      fail(`page 5 ${action} step must expose the aria-hidden ${icon} action icon`);
    }
  }

  const page5Steps = Array.from(page5.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g), match => match[0]);
  [['multiply', 'Multiply and integrate'], ['integrate', 'Trace the output']].forEach(([action, label], offset) => {
    const step = page5Steps[offset + 3] || '';
    if (!step.includes('data-convolution-action-icon="' + action + '"')
      || !step.includes('<strong>' + label + '</strong>')) {
      fail('page 5 step ' + (offset + 4) + ' must use the exact approved label "' + label + '"');
    }
  });

  const page7 = pages.get(7) || '';
  const page7Bridge = 'You solved this example analytically in the previous section. Now find the same result from the moving overlap.';
  if (!page7.includes(page7Bridge)) fail('page 7 is missing the approved analytical-to-graphical bridge sentence');

  const revealContracts = [
    [7, 'example-2-10-answer', 'data-convolution-example-2-10-answer', null],
    [9, 'example-2-11-answer', 'data-convolution-example-2-11-answer', null],
    [10, 'example-2-12-contact-points', 'data-convolution-contact-points-answer', null],
    [11, 'example-2-12-entering', 'data-convolution-integration-answer', 'entering'],
    [11, 'example-2-12-passing', 'data-convolution-integration-answer', 'passing'],
    [11, 'example-2-12-leaving', 'data-convolution-integration-answer', 'leaving'],
    [12, 'example-2-12-piecewise-output', 'data-convolution-piecewise-answer', null],
    [13, 'figure-2-11-answer', 'data-convolution-commutativity-answer', null],
    [14, 'figure-2-12-answer', 'data-convolution-support-answer', null],
    [15, 'figure-2-13-answer', 'data-convolution-shift-answer', null],
  ];
  revealContracts.forEach(([pageNumber, revealId, taskAttribute, taskValue]) => {
    const pageSource = pages.get(pageNumber) || '';
    const revealTags = getOpeningTags(pageSource, 'data-convolution-reveal', revealId);
    const taskPattern = taskValue === null
      ? new RegExp(`\\s${taskAttribute}(?:\\s|=|>)`)
      : new RegExp(`\\s${taskAttribute}="${taskValue}"`);
    if (revealTags.length !== 1 || !isHiddenTag(revealTags[0]) || !taskPattern.test(revealTags[0])) {
      fail(`page ${pageNumber} answer ${revealId} must have hidden plus its task-specific reveal hook`);
    }
  });

  const publicAnswerPatterns = new Map([
    [7, [/e\^\{-t\}-e\^\{-2t\}/, /0\\le\\tau\\le t/, /output is causal/i]],
    [9, [/-e\^\{2t\}/, /1-2e\^\{-t\}/, /0\\le\\tau<\\infty/, /t\\le\\tau<\\infty/]],
    [10, [/t\+1=0/, /t-1=0/, /t\+1=3/, /t-1=3/]],
    [11, [/\[0,t\+1\]/, /\[t-1,t\+1\]/, /\[t-1,3\]/]],
    [12, [/\\frac16\(t\+1\)\^2/, /\\frac23t/, /t\^2-2t-8/]],
    [13, [/c\(t\)=\(1-e\^\{-t\}\)u\(t\)/]],
    [14, [/\\begin\{cases\}1,/, /overlap remains nonzero/i, /overlap decays/i]],
    [15, [/c\(t\)=t\s*u\(t\)/, /the shifts cancel/i, /always begins at/i]],
  ]);
  publicAnswerPatterns.forEach((patterns, pageNumber) => {
    const publicSource = stripHiddenRevealBlocks(pages.get(pageNumber) || '');
    patterns.forEach((pattern) => {
      if (pattern.test(publicSource)) fail(`page ${pageNumber} exposes an answer before its reveal: ${pattern}`);
    });
  });

  const page11 = pages.get(11) || '';
  const intervalCases = getOpeningTags(page11, 'data-convolution-interval-case');
  if (intervalCases.length !== 3 || intervalCases.filter(isHiddenTag).length !== 2) {
    fail('page 11 must render exactly one of its three interval cases at a time');
  }

  const page13 = pages.get(13) || '';
  if (!getOpeningTags(page13, 'data-convolution-integration-range-choice').length
    || !page13.includes('Select the integration range.')) {
    fail('page 13 must expose the integration-range choice task and prompt');
  }

  const demos = decodeDemos(cache, 'lesson');
  if (demos.length !== EXPECTED_DEMOS.length) fail(`lesson must contain ${EXPECTED_DEMOS.length} controlled GeoGebra mounts, found ${demos.length}`);
  EXPECTED_DEMOS.forEach(([page, preset, task, scaffolding]) => {
    const pageDemos = decodeDemos(pages.get(page) || '', `page ${page}`);
    if (pageDemos.length !== 1) {
      fail(`page ${page} must contain exactly one controlled GeoGebra mount`);
      return;
    }
    const spec = pageDemos[0]?.spec || {};
    for (const [key, value] of Object.entries({
      framework: 'geogebra',
      scene: 'convolution_figure_2_7',
      preset,
      task,
      scaffolding,
    })) {
      if (spec[key] !== value) fail(`page ${page} demo ${key} must be ${value}, found ${spec[key] || '(missing)'}`);
    }
    const allowedSpecKeys = ['fallback_figure', 'framework', 'preset', 'scaffolding', 'scene', 'task'];
    const unexpectedSpecKeys = Object.keys(spec).filter(key => !allowedSpecKeys.includes(key));
    if (unexpectedSpecKeys.length) {
      fail(`page ${page} demo spec contains uncontrolled fields: ${unexpectedSpecKeys.join(', ')}`);
    }
    validateFallbackFigure(spec.fallback_figure, `page ${page} demo`);
  });
  const decodedDemoSource = JSON.stringify(demos);
  if (/"(?:commands?|eval_command|xml|base64|ggb_base64|ggbbase64|material_id|filename)"\s*:/i.test(decodedDemoSource)) {
    fail('decoded demo specs must not contain commands, XML, base64, Material IDs, or filenames');
  }
  const expectedFigure27Payload = {
    type: 'interactive_demo',
    demo_type: 'geogebra_convolution',
    title: 'Figure 2.7 Guided Graphical Convolution Lab',
    teaching_role: 'concept_anchor',
    spec: {
      framework: 'geogebra',
      scene: 'convolution_figure_2_7',
      preset: 'figure-2-7',
      task: 'guided-sequence',
      scaffolding: 'guided',
      fallback_figure: '/figures/page-179-figure_2_7.png',
    },
  };
  const page6Demo = decodeDemos(pages.get(6) || '', 'page 6')[0];
  if (JSON.stringify(page6Demo) !== JSON.stringify(expectedFigure27Payload)) {
    fail('page 6 must use the exact controlled Figure 2.7 guided-sequence payload');
  }

  const page17 = pages.get(17) || '';
  if ((page17.match(/data-convolution-exit-check-host/g) || []).length !== 1) {
    fail('page 17 must contain exactly one Exit Check host');
  }
  if (/<(?:ol|ul)\b|<li\b/.test(page17)) fail('page 17 must leave all question copy to the Exit Check host');
  const page18 = pages.get(18) || '';
  if ((page18.match(/<button\b/g) || []).length !== 2
    || !/data-convolution-start-practice/.test(page18)
    || !/data-convolution-review-lesson/.test(page18)
    || /data-convolution-(?:continue|next)/.test(page18)) {
    fail('page 18 must contain only Start Practice and Review the Lesson actions');
  }

  for (const token of [
    'u(t+1)',
    '2e^{-(t+2)}u(t+2)',
    'e^{-t}u(t)',
    'e^{-2t}u(t)',
    '1-2e^{-t}',
    '-e^{2t}',
    'u(t+1)-u(t-1)',
    '\\frac{t}{3}[u(t)-u(t-3)]',
    '[-1,4]',
    'c(t)=(1-e^{-t})u(t)',
    'u(-t)',
    'u(t-T)',
    'u(t+T)',
    'c(t)=tu(t)',
  ]) {
    if (!cache.replace(/\s+/g, '').includes(token.replace(/\s+/g, ''))) fail(`lesson is missing textbook token: ${token}`);
  }
}

for (const image of APPROVED_IMAGES) {
  const size = readPngSize(path.join(ILLUSTRATION_DIR, image.filename));
  if (size && (size.width !== 1153 || size.height !== 2048)) {
    fail(`${image.filename} must remain 1153x2048, found ${size.width}x${size.height}`);
  }
}

if (staticRoutes) {
  if (!staticRoutes.includes("pathname.startsWith('/lesson-illustrations/')")) fail('static routes must expose /lesson-illustrations/*');
  if (!/lesson-illustrations[\s\S]*isUnder\(/.test(staticRoutes)) fail('lesson illustration route must use the existing isUnder() boundary check');
}

if (renderer) {
  for (const token of [
    'CONVOLUTION_LESSON_PAGE_COUNT',
    'CONVOLUTION_STATE_STORAGE_KEY',
    'getConvolutionLessonStageState',
    'jumpToConvolutionLessonStage',
    'getConvolutionLessonTaskState',
    'setConvolutionLessonTaskComplete',
  ]) {
    if (!renderer.includes(token)) fail(`lesson renderer is missing shared convolution infrastructure: ${token}`);
  }
}

if (pagerSource) {
  for (const token of ['Section Overview', 'Lesson ${stageState.position} / ${stageState.total}', 'Practice', 'data-convolution-task-ready']) {
    if (!pagerSource.includes(token)) fail(`lesson pager is missing fifth-version token: ${token}`);
  }
}

for (const [name, source] of [['presets', presets], ['demo', demoSource], ['practice', practiceSource]]) {
  if (source && NON_ENGLISH_PRODUCT_SCRIPT.test(source)) {
    fail(`${name} product source must not contain Han, Hiragana, Katakana, or Hangul copy`);
  }
}

if (presets) {
  for (const token of ['figure-2-7', 'example-2-10', 'example-2-11', 'example-2-12', 'getConvolutionPreset']) {
    if (!presets.includes(token)) fail(`convolution preset registry is missing: ${token}`);
  }
}

if (styles) {
  for (const selector of [
    '.convolution-stage-nav',
    '.convolution-overview-objective',
    '.convolution-core-actions',
    '.convolution-core-action-index',
    '.convolution-lesson-progress',
    '.convolution-demo-stack',
    '.convolution-demo-panel',
    '.convolution-practice-builder',
    '.convolution-curve-segment',
  ]) {
    if (!styles.includes(selector)) fail(`missing fifth-version selector: ${selector}`);
  }
  for (const [token, value] of Object.entries(SEMANTIC_TOKENS)) {
    const pattern = new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value}`, 'i');
    if (!pattern.test(styles)) fail(`missing semantic token ${token}: ${value}`);
  }
  for (const [token, value] of Object.entries(SURFACE_TOKENS)) {
    const pattern = new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value}`, 'i');
    if (!pattern.test(styles)) fail(`missing learning surface token ${token}: ${value}`);
  }
  if (!/convolution-guided-flow-active[\s\S]*learn-page-turn-active::before[^{]*\{[^}]*display:\s*none/s.test(styles)) {
    fail('guided flow must disable the paper-turn pseudo element');
  }
  if (!/convolution-stage-nav\s*\{[^}]*position:\s*sticky/s.test(styles)) fail('stage navigation must be sticky');
  if (!/convolution-stage-nav\s*\{[^}]*background:\s*var\(--convolution-nav-fallback\)/s.test(styles)) {
    fail('stage navigation must define an opaque fallback before the glass enhancement');
  }
  if (!/@supports[^{]*backdrop-filter[\s\S]*convolution-stage-nav\s*\{[^}]*backdrop-filter:\s*blur\((?:18|19|20|21|22)px\)/s.test(styles)) {
    fail('stage navigation glass must be feature-gated with an 18px-22px blur');
  }
}

if (failures.length) {
  console.error(`[convolution-lesson-visuals] FAIL - ${failures.length} error(s)`);
  failures.forEach(message => console.error(`  - ${message}`));
  process.exit(1);
}

console.log('[convolution-lesson-visuals] OK - 18 ordered pages, ten controlled demos, and English-only copy verified');
