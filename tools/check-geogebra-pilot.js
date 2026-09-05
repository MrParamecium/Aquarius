'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CACHE_FILE = path.join(ROOT, 'workspace', 'materials', 'lesson-cache', '2_4-2', 'new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md');
const FIGURE_DIR = path.join(ROOT, 'workspace', 'materials', 'new-book-figures');
const FIGURE_MAP_FILE = path.join(ROOT, 'app', 'section-figure-map-new.json');
const DISPATCHER_FILE = path.join(ROOT, 'app', 'interactive-demos', 'dispatcher.js');
const PRESET_FILE = path.join(ROOT, 'app', 'interactive-demos', 'geogebra-convolution-presets.js');
const SCENE_FILE = path.join(ROOT, 'app', 'interactive-demos', 'geogebra-convolution-figure-2-7.js');
const DEMO_FILE = path.join(ROOT, 'app', 'interactive-demos', 'geogebra-demo.js');
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
const failures = [];

function fail(message) { failures.push(message); }
function readRequired(file) {
  if (!fs.existsSync(file)) {
    fail(`missing required file: ${path.relative(ROOT, file)}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function decodeDemoBlocks(markdown) {
  const blocks = [];
  let index = 0;
  for (const match of markdown.matchAll(/data-demo-b64="([^"]*)"/g)) {
    index += 1;
    try {
      const encoded = match[1];
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
      blocks.push(payload);
    }
    catch (error) { fail(`demo ${index} has invalid data-demo-b64: ${error.message}`); }
  }
  return blocks;
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

function collectForbiddenCommandKeys(value, at = 'demo') {
  if (!value || typeof value !== 'object') return [];
  const found = [];
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:commands?|eval_command|base64|ggb_base64|ggbbase64|xml|filename|material_id)$/i.test(key)) found.push(`${at}.${key}`);
    found.push(...collectForbiddenCommandKeys(child, `${at}.${key}`));
  }
  return found;
}

const cache = readRequired(CACHE_FILE);
const figureMapSource = readRequired(FIGURE_MAP_FILE);
const dispatcher = readRequired(DISPATCHER_FILE);
const presets = readRequired(PRESET_FILE);
const scene = readRequired(SCENE_FILE);
const demoShell = readRequired(DEMO_FILE);
readRequired(path.join(ROOT, 'app', 'interactive-demos', 'geogebra-runtime.js'));

if (cache) {
  if (NON_ENGLISH_PRODUCT_SCRIPT.test(cache)) {
    fail('lesson cache must not contain Han, Hiragana, Katakana, or Hangul product copy');
  }
  const demos = decodeDemoBlocks(cache);
  const expected = [
    ['figure-2-7', 'guided-sequence', 'guided'],
    ['example-2-10', 'worked-example', 'full'],
    ['example-2-11', 'segments', 'partial'],
    ['example-2-11', 'cases', 'partial'],
    ['example-2-12', 'contact-points', 'light'],
    ['example-2-12', 'integration-limits', 'light'],
    ['example-2-12', 'piecewise-output', 'light'],
    ['figure-2-11', 'commutativity', 'transfer'],
    ['figure-2-12', 'support-transfer', 'transfer'],
    ['figure-2-13', 'shift-transfer', 'transfer'],
  ];
  if (demos.length !== expected.length) fail(`expected ${expected.length} demo blocks, found ${demos.length}`);
  expected.forEach(([preset, task, scaffolding], index) => {
    const spec = demos[index]?.spec || {};
    if (spec.framework !== 'geogebra') fail(`demo ${index + 1} must use framework=geogebra`);
    if (spec.scene !== 'convolution_figure_2_7') fail(`demo ${index + 1} must use the shared convolution scene`);
    if (spec.preset !== preset || spec.task !== task || spec.scaffolding !== scaffolding) {
      fail(`demo ${index + 1} has the wrong preset, task, or scaffolding`);
    }
    const allowedSpecKeys = ['fallback_figure', 'framework', 'preset', 'scaffolding', 'scene', 'task'];
    const unexpectedSpecKeys = Object.keys(spec).filter(key => !allowedSpecKeys.includes(key));
    if (unexpectedSpecKeys.length) fail(`demo ${index + 1} has uncontrolled spec fields: ${unexpectedSpecKeys.join(', ')}`);
    validateFallbackFigure(spec.fallback_figure, `demo ${index + 1}`);
  });
  const forbidden = collectForbiddenCommandKeys(demos);
  if (forbidden.length) fail(`cache may not inject GeoGebra commands: ${forbidden.join(', ')}`);

  const requiredHeadings = [
    '## 1. Why Use Graphical Convolution?',
    '## 2. What Do t and τ Mean?',
    '## 3. Why Use a Graphical View?',
    '## 4. Why Does the Overlap Create the Output?',
    '## 5. The Five-Step Map',
    '## 6. Figure 2.7 Guided Graphical Convolution Lab',
    '## 7. Same Convolution, New View',
    '## 8. One Signal, Two Segments',
    '## 9. Build the Two Output Cases',
    '## 10. Find the Contact Points',
    '## 11. Build the Integration Limits',
    '## 12. Assemble the Piecewise Output',
    '## 13. Same Result, Easier Route',
    '## 14. When Causal Meets Anticausal',
    '## 15. When Opposite Shifts Cancel',
    '## 16. The Graphical Convolution Checklist',
    '## 17. Exit Check',
    '## 18. You Can Now',
  ];
  const actualHeadings = Array.from(cache.matchAll(/^## [1-9]\d*\. [^\r\n]+\r?$/gm), match => match[0].replace(/\r$/, ''));
  if (actualHeadings.length !== requiredHeadings.length) {
    fail(`lesson must contain exactly ${requiredHeadings.length} anchored H2 pages, found ${actualHeadings.length}`);
  }
  requiredHeadings.forEach((heading, index) => {
    if (actualHeadings[index] !== heading) {
      fail(`lesson H2 ${index + 1} must be "${heading}", found "${actualHeadings[index] || '(missing)'}"`);
    }
  });
  for (const pattern of [/moving graphs/i, /first contact/i, /full overlap/i, /last contact/i, /past input/i]) {
    if (!pattern.test(cache)) fail(`lesson is missing approved teaching language: ${pattern}`);
  }
  if (/continuous_graphic_convolution/.test(cache)) fail('legacy generated convolution blocks must not return');
}

if (presets) {
  for (const token of [
    "id: 'figure-2-7'",
    "id: 'example-2-10'",
    "id: 'example-2-11'",
    "id: 'example-2-12'",
    'gSignal(tau)=If(tau>=-2,2*exp(-(tau+2)),0)',
    'gFlipped(tau)=If(tau<=2,2*exp(tau-2),0)',
    'gMoving(tau)=If(tau<=t+2,2*exp(tau-t-2),0)',
    'convolutionOutput(s)=If(s<=-3,0,2*(1-exp(-(s+3))))',
  ]) {
    if (!presets.includes(token)) fail(`preset registry is missing textbook token: ${token}`);
  }
}

if (scene) {
  for (const token of ['presetId', 'productBand', 'currentOutputPoint', 'registerGeoGebraScene']) {
    if (!scene.includes(token)) fail(`shared scene is missing: ${token}`);
  }
}

if (demoShell && !demoShell.includes('2 * (1 - exp(-(t + 3)))')) {
  fail('GeoGebra fallback formula must use the textbook Figure 2.7 amplitude');
}

if (figureMapSource) {
  try {
    const figureMap = JSON.parse(figureMapSource);
    if (!Array.isArray(figureMap['2.4-2']) || !figureMap['2.4-2'].includes('page-179-figure_2_7.png')) {
      fail('section figure map must allow page-179-figure_2_7.png for 2.4-2');
    }
  } catch (error) { fail(`invalid section figure map JSON: ${error.message}`); }
}

if (dispatcher) {
  if (!/framework\s*===?\s*['"]geogebra['"]|frame\s*===?\s*['"]geogebra['"]/.test(dispatcher)) fail('dispatcher must route framework=geogebra');
  if (!/geogebra\s*:\s*renderGeoGebraDemo/.test(dispatcher)) fail('dispatcher must register renderGeoGebraDemo');
}

if (failures.length) {
  console.error(`[geogebra-pilot] FAIL - ${failures.length} error(s)`);
  failures.forEach(message => console.error(`  - ${message}`));
  process.exit(1);
}

console.log('[geogebra-pilot] OK - 18-page lesson demos and trusted-data boundaries verified');
