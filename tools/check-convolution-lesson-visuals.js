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
    page: 1,
    altToken: 'ink',
  },
  {
    filename: 'convolution-sprinkler-procedure-v2.png',
    url: '/lesson-illustrations/2_4-2/convolution-sprinkler-procedure-v2.png',
    page: 7,
    altToken: 'sprinkler',
  },
];
const REQUIRED_HEADINGS = [
  '## 1. What Is Convolution?',
  '## 2. Why Do We Need It?',
  '## 3. Understanding t and τ',
  '## 4. The Five-Step Method',
  '## 5. Change the Variable',
  '## 6. Flip',
  '## 7. Slide',
  '## 8. Multiply and Find the Overlap',
  '## 9. Integrate and Trace the Output',
  '## 10. Worked Example 1',
  '## 11. Worked Example 2',
  '## 12. Worked Example 3',
];
const EXPECTED_DEMOS = [
  { page: 5, preset: 'figure-2-7', task: 'change-variable', scaffolding: 'guided' },
  { page: 6, preset: 'figure-2-7', task: 'flip', scaffolding: 'guided' },
  { page: 7, preset: 'figure-2-7', task: 'slide', scaffolding: 'guided' },
  { page: 8, preset: 'figure-2-7', task: 'multiply', scaffolding: 'guided' },
  { page: 9, preset: 'figure-2-7', task: 'integrate', scaffolding: 'guided' },
  { page: 10, preset: 'example-2-10', task: 'worked-example', scaffolding: 'full' },
  { page: 11, preset: 'example-2-11', task: 'worked-example', scaffolding: 'partial' },
  { page: 12, preset: 'example-2-12', task: 'worked-example', scaffolding: 'light' },
];
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

function getPageSource(markdown, pageNumber) {
  const start = markdown.indexOf(REQUIRED_HEADINGS[pageNumber - 1]);
  if (start < 0) return '';
  const nextHeading = REQUIRED_HEADINGS[pageNumber];
  const end = nextHeading ? markdown.indexOf(nextHeading, start + 1) : markdown.length;
  return markdown.slice(start, end < 0 ? markdown.length : end);
}

function decodeDemos(source) {
  return Array.from(source.matchAll(/data-demo-b64="([^"]+)"/g), (match) => {
    try {
      return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    } catch (error) {
      fail(`invalid data-demo-b64 payload: ${error.message}`);
      return null;
    }
  }).filter(Boolean);
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
  if (/\p{Script=Han}/u.test(cache)) fail('the English 2.4-2 lesson cache must not contain Chinese product copy');
  if (!/data-convolution-stage-intro="true"/.test(cache)) fail('lesson must contain the dedicated stage intro');
  if (/convolution-intro-number|convolution-page-marker|data-convolution-number=|convolution-island-number/.test(cache)) {
    fail('lesson must not output boxed or page-local number markers');
  }

  for (const phrase of [
    'Interpret and compute continuous-time convolution graphically.',
    'Flip and slide',
    'Multiply',
    'Integrate',
    'Start Lesson',
  ]) {
    if (!cache.includes(phrase)) fail(`stage intro is missing approved copy: ${phrase}`);
  }
  if ((cache.match(/data-convolution-core-action=/g) || []).length !== 3) {
    fail('stage intro must contain exactly three core actions');
  }
  const coreActionIndices = Array.from(
    cache.matchAll(/class="convolution-core-action-index"[^>]*>(0[1-3])<\/span>/g),
    match => match[1]
  );
  if (JSON.stringify(coreActionIndices) !== JSON.stringify(['01', '02', '03'])) {
    fail(`stage intro actions must expose the ordered 01/02/03 labels, found ${JSON.stringify(coreActionIndices)}`);
  }
  if (!/data-convolution-overview-formula/.test(cache) || !/x\(\\tau\)[\s\S]*g\(t-\\tau\)/.test(cache)) {
    fail('stage intro must show the approved continuous-time convolution formula');
  }

  let previousIndex = -1;
  for (const heading of REQUIRED_HEADINGS) {
    const index = cache.indexOf(heading);
    if (index < 0) fail(`lesson is missing required heading: ${heading}`);
    if (index >= 0 && index <= previousIndex) fail(`lesson heading is out of order: ${heading}`);
    if (index >= 0) previousIndex = index;
  }
  if ((cache.match(/^## \d+\./gm) || []).length !== 12) fail('lesson must contain exactly 12 numbered H2 pages');

  REQUIRED_HEADINGS.forEach((_, index) => {
    const pageNumber = index + 1;
    const pageSource = getPageSource(cache, pageNumber);
    if (!pageSource) return;
    if (!new RegExp(`data-convolution-page="${pageNumber}"`).test(pageSource)) {
      fail(`page ${pageNumber} must expose its stable data-convolution-page marker`);
    }
    const highlights = (pageSource.match(/class="[^"]*\bconvolution-key\b/g) || []).length;
    if (highlights > 8) fail(`page ${pageNumber} may highlight at most 8 items, found ${highlights}`);
    if (/<section\b[^>]*>[\s\S]*<section\b/i.test(pageSource)) fail(`page ${pageNumber} must not nest teaching cards`);
  });

  for (const image of APPROVED_IMAGES) {
    const pageSource = getPageSource(cache, image.page);
    if (!pageSource.includes(`src="${image.url}"`)) fail(`${image.filename} must appear on lesson page ${image.page}`);
    if (!new RegExp(`alt="[^"]*${image.altToken}[^"]*"`, 'i').test(pageSource)) {
      fail(`${image.filename} must have meaningful alt text on page ${image.page}`);
    }
  }
  const lessonImageUrls = Array.from(cache.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g), match => match[1]);
  const analogyUrls = lessonImageUrls.filter(url => url.startsWith('/lesson-illustrations/2_4-2/'));
  if (JSON.stringify(analogyUrls) !== JSON.stringify(APPROVED_IMAGES.map(image => image.url))) {
    fail(`lesson analogy images must be exactly the two approved V2 assets, found ${JSON.stringify(analogyUrls)}`);
  }

  const page2 = getPageSource(cache, 2);
  const page4 = getPageSource(cache, 4);
  if (!/data-convolution-visual="past-weighting"/.test(page2) || !/Figure 2\.14/.test(page2)) {
    fail('page 2 must contain the Figure 2.14 past-input weighting diagram');
  }
  if (!/data-convolution-visual="five-steps"/.test(page4)
    || (page4.match(/data-convolution-step="(?:change|flip|slide|multiply|integrate)"/g) || []).length !== 5) {
    fail('page 4 must contain the five approved convolution actions');
  }

  const demos = decodeDemos(cache);
  if (demos.length !== EXPECTED_DEMOS.length) fail(`lesson must contain ${EXPECTED_DEMOS.length} controlled GeoGebra mounts, found ${demos.length}`);
  EXPECTED_DEMOS.forEach((expected) => {
    const pageDemos = decodeDemos(getPageSource(cache, expected.page));
    if (pageDemos.length !== 1) {
      fail(`page ${expected.page} must contain exactly one controlled GeoGebra mount`);
      return;
    }
    const spec = pageDemos[0]?.spec || {};
    for (const [key, value] of Object.entries({
      framework: 'geogebra',
      scene: 'convolution_figure_2_7',
      preset: expected.preset,
      task: expected.task,
      scaffolding: expected.scaffolding,
    })) {
      if (spec[key] !== value) fail(`page ${expected.page} demo ${key} must be ${value}, found ${spec[key] || '(missing)'}`);
    }
  });

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
    'CONVOLUTION_LESSON_PAGE_COUNT = 12',
    'CONVOLUTION_STATE_STORAGE_KEY',
    'getConvolutionLessonStageState',
    'jumpToConvolutionLessonStage',
    'getConvolutionLessonTaskState',
    'setConvolutionLessonTaskComplete',
  ]) {
    if (!renderer.includes(token)) fail(`lesson renderer is missing fifth-version token: ${token}`);
  }
}

if (pagerSource) {
  for (const token of ['Section Overview', 'Lesson ${stageState.position} / ${stageState.total}', 'Practice', 'data-convolution-task-ready']) {
    if (!pagerSource.includes(token)) fail(`lesson pager is missing fifth-version token: ${token}`);
  }
}

for (const [name, source] of [['presets', presets], ['demo', demoSource], ['practice', practiceSource]]) {
  if (source && /\p{Script=Han}/u.test(source)) fail(`${name} product source must not contain Chinese copy`);
}

if (presets) {
  for (const token of ['figure-2-7', 'example-2-10', 'example-2-11', 'example-2-12', 'getConvolutionPreset']) {
    if (!presets.includes(token)) fail(`convolution preset registry is missing: ${token}`);
  }
}

if (practiceSource) {
  for (const token of ['Drill 2.10', 'Drill 2.11', 'Drill 2.12', 'Drill 2.13', 'Not Started', 'In Progress', 'Mastered']) {
    if (!practiceSource.includes(token)) fail(`convolution practice source is missing: ${token}`);
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

console.log('[convolution-lesson-visuals] OK - v5 textbook content, staged demos and practice contracts verified');
