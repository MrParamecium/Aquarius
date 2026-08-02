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

const APPROVED_IMAGES = [
  {
    filename: 'convolution-ink-memory-v2.png',
    url: '/lesson-illustrations/2_4-2/convolution-ink-memory-v2.png',
  },
  {
    filename: 'convolution-sprinkler-procedure-v2.png',
    url: '/lesson-illustrations/2_4-2/convolution-sprinkler-procedure-v2.png',
  },
];
const REQUIRED_HEADINGS = [
  '## 1. What Is Convolution?',
  '## 2. Why Use Graphical Convolution?',
  '## 3. How to Flip and Slide',
  '## 4. How to Multiply and Measure Area',
  '## 5. Figure 2.7 in GeoGebra',
  '## 6. Where Convolution Fits in the Book',
];
const EXPECTED_BLOCK_LAYOUTS = [
  ['editorial', 'editorial', 'editorial'],
  ['editorial', 'editorial'],
  ['editorial', 'timeline'],
  ['timeline'],
  ['editorial', 'editorial', 'editorial'],
  ['editorial', 'editorial', 'editorial', 'editorial'],
];
const REQUIRED_VISUALS = ['tau-scan', 'five-steps', 'book-map'];
const SEMANTIC_TOKENS = {
  '--convolution-input': '#2563eb',
  '--convolution-response': '#7c3aed',
  '--convolution-action': '#16876a',
  '--convolution-output': '#b45309',
  '--convolution-warning': '#dc2626',
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

function getSectionSource(markdown, pageNumber) {
  const start = markdown.indexOf(REQUIRED_HEADINGS[pageNumber - 1]);
  if (start < 0) return '';
  const nextHeading = REQUIRED_HEADINGS[pageNumber];
  const end = nextHeading ? markdown.indexOf(nextHeading, start + 1) : markdown.length;
  return markdown.slice(start, end < 0 ? markdown.length : end);
}

function getTeachingBlocks(source) {
  return Array.from(source.matchAll(
    /<section\b([^>]*\bdata-convolution-block="([^"]+)"[^>]*)>([\s\S]*?)<\/section>/g
  ), match => ({ attrs: match[1], id: match[2], body: match[3] }));
}

const cache = readRequired(CACHE_PATH);
const staticRoutes = readRequired(STATIC_ROUTES_PATH);
const styles = readRequired(STYLE_PATH);
const renderer = readRequired(RENDER_PATH);

if (cache) {
  if (!/data-convolution-stage-intro="true"/.test(cache)) {
    fail('lesson must contain the dedicated fourth-version stage intro');
  }
  if (/Section objective:|Concepts in this section:/i.test(cache)) {
    fail('lesson intro must not retain the old Objective/Concepts card source');
  }
  for (const phrase of ['You already know', 'This section answers', 'Learning route']) {
    if (!cache.includes(phrase)) fail(`stage intro is missing: ${phrase}`);
  }

  let previousIndex = -1;
  for (const heading of REQUIRED_HEADINGS) {
    const index = cache.indexOf(heading);
    if (index < 0) fail(`lesson is missing required heading: ${heading}`);
    if (index >= 0 && index <= previousIndex) fail(`lesson heading is out of order: ${heading}`);
    if (index >= 0) previousIndex = index;
  }

  EXPECTED_BLOCK_LAYOUTS.forEach((expectedLayouts, index) => {
    const pageNumber = index + 1;
    const source = getSectionSource(cache, pageNumber);
    const blocks = getTeachingBlocks(source);
    const layouts = blocks.map(block => block.attrs.match(/data-convolution-layout="([^"]+)"/)?.[1] || '');
    if (JSON.stringify(layouts) !== JSON.stringify(expectedLayouts)) {
      fail(`page ${pageNumber} block layouts must be ${JSON.stringify(expectedLayouts)}, found ${JSON.stringify(layouts)}`);
      return;
    }
    blocks.forEach((block, blockIndex) => {
      const expectedNumber = String(blockIndex + 1).padStart(2, '0');
      const page = block.attrs.match(/data-convolution-page="([^"]+)"/)?.[1];
      const number = block.attrs.match(/data-convolution-number="([^"]+)"/)?.[1];
      if (page !== String(pageNumber)) fail(`${block.id} must belong to page ${pageNumber}, found ${page || 'none'}`);
      if (number !== expectedNumber) fail(`${block.id} must use page-local number ${expectedNumber}, found ${number || 'none'}`);
      if (/<section\b/i.test(block.body)) fail(`${block.id} must not contain a nested section/card`);
      const highlights = (block.body.match(/class="[^"]*\bconvolution-key\b/g) || []).length;
      if (highlights > 5) fail(`${block.id} may highlight at most 5 items, found ${highlights}`);
    });
  });

  if (/convolution-island-number/.test(cache)) {
    fail('the old large island number markup must not remain in the lesson cache');
  }
  if ((cache.match(/data-convolution-layout="timeline"/g) || []).length !== 2) {
    fail('only the two true procedure pages may use timeline blocks');
  }
  if ((cache.match(/data-convolution-step="\d{2}"/g) || []).length !== 5) {
    fail('five-step timeline must contain exactly five numbered steps');
  }

  const demoCount = (cache.match(/data-demo-b64="/g) || []).length;
  if (demoCount !== 1) fail(`lesson must keep exactly 1 GeoGebra demo, found ${demoCount}`);

  const lessonImageUrls = Array.from(cache.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g), match => match[1]);
  const expectedUrls = APPROVED_IMAGES.map(image => image.url);
  if (JSON.stringify(lessonImageUrls) !== JSON.stringify(expectedUrls)) {
    fail(`lesson images must be exactly the two approved V2 assets, found ${JSON.stringify(lessonImageUrls)}`);
  }
  if (/convolution-(?:ink-memory|sprinkler-procedure)\.png/.test(cache)) {
    fail('lesson must not reference the superseded non-V2 illustrations');
  }
  if ((cache.match(/class="[^"]*\bconvolution-analogy-block\b/g) || []).length !== 2) {
    fail('lesson must contain exactly 2 convolution analogy blocks');
  }
  if (!/alt="[^"]*ink[^"]*"/i.test(cache)) fail('ink illustration must have meaningful alt text');
  if (!/alt="[^"]*sprinkler[^"]*"/i.test(cache)) fail('sprinkler illustration must have meaningful alt text');

  const visuals = Array.from(cache.matchAll(/data-convolution-visual="([^"]+)"/g), match => match[1]);
  if (JSON.stringify(visuals) !== JSON.stringify(REQUIRED_VISUALS)) {
    fail(`lesson visuals must be exactly ${JSON.stringify(REQUIRED_VISUALS)}, found ${JSON.stringify(visuals)}`);
  }
  if ((cache.match(/<svg\b[^>]*class="[^"]*\bconvolution-diagram\b[^>]*role="img"/g) || []).length !== 3) {
    fail('each code-native diagram must use one accessible role=img SVG');
  }
  if ((cache.match(/<title\s+id="convolution-[^"]+-title">/g) || []).length !== 3) {
    fail('each code-native diagram must contain a stable accessible title');
  }
  if ((cache.match(/data-convolution-flow="[^"]+"/g) || []).length !== 3) {
    fail('book map must contain exactly three independent textbook flows');
  }
  if (!/t=-3|t\s*=\s*-3/.test(cache) || !/1\.2642/.test(cache) || !/1\.9004/.test(cache)) {
    fail('Figure 2.7 first contact and two approved numeric checks must remain');
  }
  if (/<(?:canvas|script)\b/i.test(cache)) fail('code-native lesson diagrams must not add canvas or script elements');
}

for (const image of APPROVED_IMAGES) {
  const size = readPngSize(path.join(ILLUSTRATION_DIR, image.filename));
  if (size && (size.width !== 1153 || size.height !== 2048)) {
    fail(`${image.filename} must remain 1153x2048, found ${size.width}x${size.height}`);
  }
}

if (staticRoutes) {
  if (!staticRoutes.includes("pathname.startsWith('/lesson-illustrations/')")) {
    fail('static routes must expose /lesson-illustrations/*');
  }
  if (!/lesson-illustrations[\s\S]*isUnder\(/.test(staticRoutes)) {
    fail('lesson illustration route must use the existing isUnder() boundary check');
  }
}

if (renderer) {
  for (const token of [
    'getConvolutionLessonStageState',
    'jumpToConvolutionLessonStage',
    'data-convolution-stage-target',
    'convolution-guided-flow-active',
  ]) {
    if (!renderer.includes(token)) fail(`lesson renderer is missing fourth-version stage token: ${token}`);
  }
}

if (styles) {
  for (const selector of [
    '.convolution-stage-nav',
    '.convolution-stage-tab',
    '.convolution-stage-intro',
    '.convolution-editorial-block',
    '.convolution-process-timeline',
    '.convolution-page-marker',
    '.convolution-key-input',
    '.convolution-key-response',
    '.convolution-key-action',
    '.convolution-key-output',
    '.convolution-key-warning',
    '.convolution-analogy-image',
    '.convolution-tau-scan',
    '.convolution-step-timeline',
    '.convolution-book-map',
  ]) {
    if (!styles.includes(selector)) fail(`missing lesson-specific selector: ${selector}`);
  }
  for (const [token, value] of Object.entries(SEMANTIC_TOKENS)) {
    const pattern = new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value}`, 'i');
    if (!pattern.test(styles)) fail(`missing semantic token ${token}: ${value}`);
  }
  if (!/convolution-guided-flow-active[\s\S]*learn-page-turn-active::before[^{]*\{[^}]*display:\s*none/s.test(styles)) {
    fail('guided flow must disable the paper-turn pseudo element');
  }
  if (!/@media\s*\(max-width:\s*760px\)[\s\S]*\.convolution-stage-nav/s.test(styles)) {
    fail('stage navigation must have a 760px mobile rule');
  }
}

if (failures.length) {
  console.error(`[convolution-lesson-visuals] FAIL - ${failures.length} error(s)`);
  failures.forEach(message => console.error(`  - ${message}`));
  process.exit(1);
}

console.log('[convolution-lesson-visuals] OK - v4 stages, editorial/timeline layouts and retained visual contracts verified');
