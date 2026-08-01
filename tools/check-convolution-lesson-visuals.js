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
  '## 1. Why Convolution Adds the Past',
  '## 2. What the Integral Is Saying',
  '## 3. How the Graphical Procedure Works',
  '## 4. Five-Step Checklist',
  '## 5. Figure 2.7 in GeoGebra',
  '## 6. Why This Section Matters in the Book',
];
const EXPECTED_ISLAND_COUNTS = [3, 3, 3, 1, 4, 4];
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

function getIslandBlocks(source) {
  return Array.from(source.matchAll(
    /<section\b([^>]*\bdata-convolution-island="([^"]+)"[^>]*)>([\s\S]*?)<\/section>/g
  ), match => ({ attrs: match[1], id: match[2], body: match[3] }));
}

const cache = readRequired(CACHE_PATH);
const staticRoutes = readRequired(STATIC_ROUTES_PATH);
const styles = readRequired(STYLE_PATH);

if (cache) {
  const objective = cache.match(/^> \*\*Section objective:\*\*\s*(.+)$/m)?.[1]?.trim() || '';
  if (!objective) fail('lesson must contain one Section objective line');
  if (objective.length > 110) fail(`Section objective must be concise (<=110 chars), found ${objective.length}`);

  const conceptsBlock = cache.match(/Concepts in this section:\s*\n([\s\S]*?)(?=\n##\s)/)?.[1] || '';
  const concepts = conceptsBlock.match(/^[-*+]\s+.+$/gm) || [];
  if (concepts.length !== 3) fail(`overview must list exactly 3 primary concepts, found ${concepts.length}`);

  let previousIndex = -1;
  for (const heading of REQUIRED_HEADINGS) {
    const index = cache.indexOf(heading);
    if (index < 0) fail(`lesson is missing required heading: ${heading}`);
    if (index >= 0 && index <= previousIndex) fail(`lesson heading is out of order: ${heading}`);
    if (index >= 0) previousIndex = index;
  }

  EXPECTED_ISLAND_COUNTS.forEach((expectedCount, index) => {
    const pageNumber = index + 1;
    const source = getSectionSource(cache, pageNumber);
    const islands = getIslandBlocks(source);
    if (islands.length !== expectedCount) {
      fail(`page ${pageNumber} must contain ${expectedCount} content island(s), found ${islands.length}`);
      return;
    }
    islands.forEach((island, islandIndex) => {
      const expectedNumber = String(islandIndex + 1).padStart(2, '0');
      const page = island.attrs.match(/data-convolution-page="([^"]+)"/)?.[1];
      const number = island.attrs.match(/data-convolution-number="([^"]+)"/)?.[1];
      if (page !== String(pageNumber)) fail(`${island.id} must belong to page ${pageNumber}, found ${page || 'none'}`);
      if (number !== expectedNumber) fail(`${island.id} must use page-local number ${expectedNumber}, found ${number || 'none'}`);
      if (/<section\b/i.test(island.body)) fail(`${island.id} must not contain a nested section/card`);
      const highlights = (island.body.match(/class="[^"]*\bconvolution-key\b/g) || []).length;
      if (highlights > 4) fail(`${island.id} may highlight at most 4 items, found ${highlights}`);
    });
  });

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
  if ((cache.match(/data-convolution-step="\d{2}"/g) || []).length !== 5) {
    fail('five-step timeline must contain exactly five numbered steps');
  }
  if ((cache.match(/data-convolution-flow="[^"]+"/g) || []).length !== 3) {
    fail('book map must contain exactly three independent textbook flows');
  }
  if (/<(?:canvas|script)\b/i.test(cache)) fail('code-native lesson diagrams must not add canvas or script elements');
  if (/convolution-book-map-horizontal|convolution-three-column-map/.test(cache)) {
    fail('the rejected horizontal three-column book map must not return');
  }
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

if (styles) {
  for (const selector of [
    '.convolution-island',
    '.convolution-island-number',
    '.convolution-key-input',
    '.convolution-key-response',
    '.convolution-key-action',
    '.convolution-key-output',
    '.convolution-key-warning',
    '.convolution-analogy-block',
    '.convolution-analogy-copy',
    '.convolution-analogy-figure',
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
  if (!/\.convolution-analogy-block\s*\{[^}]*grid-template-columns:/s.test(styles)) {
    fail('desktop analogy block must define a multi-column grid');
  }
  if (!/\.convolution-analogy-image\s*\{[^}]*object-fit:\s*contain/s.test(styles)) {
    fail('analogy images must use object-fit: contain');
  }
  if (!/@media\s*\(max-width:\s*760px\)[\s\S]*\.convolution-island[^}]*grid-template-columns:\s*1fr/s.test(styles)) {
    fail('mobile content islands must collapse to one column at 760px');
  }
  if (!/@media\s*\(max-width:\s*760px\)[\s\S]*\.convolution-book-flow[^}]*grid-template-columns:\s*1fr/s.test(styles)) {
    fail('mobile book flows must remain vertical at 760px');
  }
}

if (failures.length) {
  console.error(`[convolution-lesson-visuals] FAIL - ${failures.length} error(s)`);
  failures.forEach(message => console.error(`  - ${message}`));
  process.exit(1);
}

console.log('[convolution-lesson-visuals] OK - v3 islands, semantics, diagrams and retained Loop 02 contracts verified');
