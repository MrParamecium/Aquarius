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
  if ((cache.match(/class="convolution-analogy-block/g) || []).length !== 2) {
    fail('lesson must contain exactly 2 convolution analogy blocks');
  }
  if (!/alt="[^"]*ink[^"]*"/i.test(cache)) fail('ink illustration must have meaningful alt text');
  if (!/alt="[^"]*sprinkler[^"]*"/i.test(cache)) fail('sprinkler illustration must have meaningful alt text');
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
    '.convolution-analogy-block',
    '.convolution-analogy-copy',
    '.convolution-analogy-figure',
    '.convolution-analogy-image',
  ]) {
    if (!styles.includes(selector)) fail(`missing lesson-specific selector: ${selector}`);
  }
  if (!/\.convolution-analogy-block\s*\{[^}]*grid-template-columns:/s.test(styles)) {
    fail('desktop analogy block must define a two-column grid');
  }
  if (!/\.convolution-analogy-image\s*\{[^}]*object-fit:\s*contain/s.test(styles)) {
    fail('analogy images must use object-fit: contain');
  }
  if (!/@media\s*\(max-width:\s*760px\)[\s\S]*\.convolution-analogy-block\s*\{[^}]*grid-template-columns:\s*1fr/s.test(styles)) {
    fail('mobile analogy block must collapse to one column at 760px');
  }
}

if (failures.length) {
  console.error(`[convolution-lesson-visuals] FAIL - ${failures.length} error(s)`);
  failures.forEach(message => console.error(`  - ${message}`));
  process.exit(1);
}

console.log('[convolution-lesson-visuals] OK - overview, approved images, route and responsive layout contracts verified');
