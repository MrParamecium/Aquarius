'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CACHE_FILE = path.join(
  ROOT,
  'workspace',
  'materials',
  'lesson-cache',
  '2_4-2',
  'new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md'
);
const FIGURE_MAP_FILE = path.join(ROOT, 'app', 'section-figure-map-new.json');
const DISPATCHER_FILE = path.join(ROOT, 'app', 'interactive-demos', 'dispatcher.js');
const REQUIRED_RUNTIME_FILES = [
  'app/interactive-demos/geogebra-runtime.js',
  'app/interactive-demos/geogebra-demo.js',
  'app/interactive-demos/geogebra-convolution-figure-2-7.js',
];

const failures = [];
const fail = (message) => failures.push(message);

function readRequired(relativeOrAbsolutePath) {
  const file = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(ROOT, relativeOrAbsolutePath);
  if (!fs.existsSync(file)) {
    fail(`missing required file: ${path.relative(ROOT, file)}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function decodeDemoBlocks(markdown) {
  const blocks = [];
  const matches = markdown.matchAll(/data-demo-b64="([A-Za-z0-9+/=]+)"/g);
  for (const match of matches) {
    try {
      blocks.push(JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')));
    } catch (err) {
      fail(`invalid data-demo-b64 JSON: ${err.message}`);
    }
  }
  return blocks;
}

function collectForbiddenCommandKeys(value, at = 'demo') {
  if (!value || typeof value !== 'object') return [];
  const found = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${at}.${key}`;
    if (/^(?:commands?|eval_command|ggb_base64|ggbbase64|xml|filename|material_id)$/i.test(key)) {
      found.push(childPath);
    }
    found.push(...collectForbiddenCommandKeys(child, childPath));
  }
  return found;
}

const cache = readRequired(CACHE_FILE);
const figureMapSource = readRequired(FIGURE_MAP_FILE);
const dispatcher = readRequired(DISPATCHER_FILE);
REQUIRED_RUNTIME_FILES.forEach(readRequired);

if (cache) {
  const demos = decodeDemoBlocks(cache);
  if (demos.length !== 1) fail(`expected exactly 1 demo block, found ${demos.length}`);
  const demo = demos[0] || {};
  const spec = demo.spec || demo.demo_spec || {};
  const expected = {
    type: 'interactive_demo',
    framework: 'geogebra',
    scene: 'convolution_figure_2_7',
    initial_step: 1,
    initial_t: -4,
    t_min: -4,
    t_max: 3,
    t_step: 0.05,
    target_t: -3,
    target_tolerance: 0.08,
    fallback_figure: '/figures/page-179-figure_2_7.png',
  };
  if (demo.type !== expected.type) fail(`demo.type must be ${expected.type}`);
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (key === 'type') continue;
    if (spec[key] !== expectedValue) {
      fail(`spec.${key} must be ${JSON.stringify(expectedValue)}, got ${JSON.stringify(spec[key])}`);
    }
  }
  const forbidden = collectForbiddenCommandKeys(demo);
  if (forbidden.length) fail(`cache may not inject GeoGebra commands: ${forbidden.join(', ')}`);
  if (/continuous_graphic_convolution/.test(cache)) {
    fail('old continuous_graphic_convolution demo blocks must not be copied into the pilot cache');
  }
  if (!cache.includes('/figures/page-179-figure_2_7.png')) {
    fail('pilot cache must cite the local Figure 2.7 asset');
  }
}

if (figureMapSource) {
  try {
    const figureMap = JSON.parse(figureMapSource);
    if (!Array.isArray(figureMap['2.4-2']) || !figureMap['2.4-2'].includes('page-179-figure_2_7.png')) {
      fail('section figure map must allow page-179-figure_2_7.png for 2.4-2');
    }
  } catch (err) {
    fail(`invalid section figure map JSON: ${err.message}`);
  }
}

if (dispatcher) {
  if (!/framework\s*===?\s*['"]geogebra['"]|frame\s*===?\s*['"]geogebra['"]/.test(dispatcher)) {
    fail('dispatcher must explicitly route framework=geogebra');
  }
  if (!/geogebra\s*:\s*renderGeoGebraDemo/.test(dispatcher)) {
    fail('dispatcher renderer table must register geogebra: renderGeoGebraDemo');
  }
}

if (failures.length) {
  console.error(`[geogebra-pilot] FAIL - ${failures.length} error(s)`);
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log('[geogebra-pilot] OK - cache, route, scene and trusted-data contracts verified');
