'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CACHE_FILE = path.join(ROOT, 'workspace', 'materials', 'lesson-cache', '2_4-2', 'new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md');
const FIGURE_MAP_FILE = path.join(ROOT, 'app', 'section-figure-map-new.json');
const DISPATCHER_FILE = path.join(ROOT, 'app', 'interactive-demos', 'dispatcher.js');
const PRESET_FILE = path.join(ROOT, 'app', 'interactive-demos', 'geogebra-convolution-presets.js');
const SCENE_FILE = path.join(ROOT, 'app', 'interactive-demos', 'geogebra-convolution-figure-2-7.js');
const DEMO_FILE = path.join(ROOT, 'app', 'interactive-demos', 'geogebra-demo.js');
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
  for (const match of markdown.matchAll(/data-demo-b64="([A-Za-z0-9+/=]+)"/g)) {
    try { blocks.push(JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'))); }
    catch (error) { fail(`invalid data-demo-b64 JSON: ${error.message}`); }
  }
  return blocks;
}

function collectForbiddenCommandKeys(value, at = 'demo') {
  if (!value || typeof value !== 'object') return [];
  const found = [];
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:commands?|eval_command|ggb_base64|ggbbase64|xml|filename|material_id)$/i.test(key)) found.push(`${at}.${key}`);
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
  const demos = decodeDemoBlocks(cache);
  const expected = [
    ['figure-2-7', 'change-variable', 'guided'],
    ['figure-2-7', 'flip', 'guided'],
    ['figure-2-7', 'slide', 'guided'],
    ['figure-2-7', 'multiply', 'guided'],
    ['figure-2-7', 'integrate', 'guided'],
    ['example-2-10', 'worked-example', 'full'],
    ['example-2-11', 'worked-example', 'partial'],
    ['example-2-12', 'worked-example', 'light'],
  ];
  if (demos.length !== expected.length) fail(`expected ${expected.length} demo blocks, found ${demos.length}`);
  expected.forEach(([preset, task, scaffolding], index) => {
    const spec = demos[index]?.spec || {};
    if (spec.framework !== 'geogebra') fail(`demo ${index + 1} must use framework=geogebra`);
    if (spec.scene !== 'convolution_figure_2_7') fail(`demo ${index + 1} must use the shared convolution scene`);
    if (spec.preset !== preset || spec.task !== task || spec.scaffolding !== scaffolding) {
      fail(`demo ${index + 1} has the wrong preset, task, or scaffolding`);
    }
  });
  const forbidden = collectForbiddenCommandKeys(demos);
  if (forbidden.length) fail(`cache may not inject GeoGebra commands: ${forbidden.join(', ')}`);

  const requiredHeadings = [
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
  let previous = -1;
  requiredHeadings.forEach(heading => {
    const current = cache.indexOf(heading);
    if (current < 0) fail(`lesson is missing required heading: ${heading}`);
    if (current >= 0 && current <= previous) fail(`lesson heading is out of order: ${heading}`);
    if (current >= 0) previous = current;
  });
  for (const pattern of [/transparent pool/i, /sprinkler truck/i, /first contact/i, /sampling/i, /filtering/i]) {
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

console.log('[geogebra-pilot] OK - v5 textbook presets, controlled demos, and trusted-data boundaries verified');
