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
const SCENE_FILE = path.join(ROOT, 'app', 'interactive-demos', 'geogebra-convolution-figure-2-7.js');
const DEMO_SHELL_FILE = path.join(ROOT, 'app', 'interactive-demos', 'geogebra-demo.js');
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
const sceneSource = readRequired(SCENE_FILE);
const demoShellSource = readRequired(DEMO_SHELL_FILE);
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
  if (/!\[[^\]]*\]\([^)]+\)/.test(cache)) {
    fail('lesson visuals must use reviewed KC blocks rather than free-form markdown images');
  }

  const requiredHeadings = [
    '## 1. Why Convolution Adds the Past',
    '## 2. What the Integral Is Saying',
    '## 3. How the Graphical Procedure Works',
    '## 4. Five-Step Checklist',
    '## 5. Figure 2.7 in GeoGebra',
    '## 6. Why This Section Matters in the Book',
  ];
  let previousHeading = -1;
  for (const heading of requiredHeadings) {
    const index = cache.indexOf(heading);
    if (index < 0) fail(`lesson is missing required heading: ${heading}`);
    if (index >= 0 && index <= previousHeading) fail(`lesson heading is out of order: ${heading}`);
    if (index >= 0) previousHeading = index;
  }

  const requiredTeachingTerms = [
    ['transparent pool', /transparent pool/i],
    ['sprinkler truck', /sprinkler truck/i],
    ['zero-state response', /zero-state response/i],
    ['RLC', /\bRLC\b/],
    ['sampling', /\bsampling\b/i],
    ['filtering', /\bfiltering\b/i],
    ['cascade', /\bcascade\b/i],
  ];
  for (const [label, pattern] of requiredTeachingTerms) {
    if (!pattern.test(cache)) fail(`lesson must include the approved ${label} connection`);
  }
  if (!cache.includes('g(\\tau)=2e^{-(\\tau+2)}u(\\tau+2)')) {
    fail('lesson must use the textbook amplitude g(tau)=2e^{-(tau+2)}u(tau+2)');
  }
  if (!cache.includes('2\\left(1-e^{-(t+3)}\\right)')) {
    fail('lesson must use the textbook convolution output amplitude 2(1-e^{-(t+3)})');
  }
  if (!/t\s*=\s*-3/.test(cache)) {
    fail('lesson must identify first contact at t = -3');
  }
}

if (sceneSource) {
  const requiredSceneCommands = [
    'gSignal(tau)=If(tau>=-2,2*exp(-(tau+2)),0)',
    'gFlipped(tau)=If(tau<=2,2*exp(tau-2),0)',
    'gMoving(tau)=If(tau<=t+2,2*exp(tau-t-2),0)',
    'overlapArea=If(t<=-3,0,2*(1-exp(-(t+3))))',
    'convolutionOutput(s)=If(s<=-3,0,2*(1-exp(-(s+3))))',
  ];
  for (const command of requiredSceneCommands) {
    if (!sceneSource.includes(command)) fail(`Figure 2.7 scene is missing textbook command: ${command}`);
  }
  if (!/configureView\(2,\s*\{[^}]*yMax:\s*2\.[2-9]/s.test(sceneSource)) {
    fail('Figure 2.7 output view must leave headroom above amplitude 2');
  }
}

if (demoShellSource && !demoShellSource.includes('2 * (1 - exp(-(t + 3)))')) {
  fail('GeoGebra fallback formula must use the textbook amplitude 2');
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
