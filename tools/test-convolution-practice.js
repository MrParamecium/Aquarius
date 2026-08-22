'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(repoRoot, 'app', 'convolution-practice.js'), 'utf8');
const context = { window: {}, localStorage: { getItem: () => null, setItem: () => {} }, document: {} };
vm.runInNewContext(source, context, { filename: 'convolution-practice.js' });
const api = context.window.__ftutorConvolutionPractice;
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

try {
  assert.ok(api && typeof api.evaluateStep === 'function');
  assert.strictEqual(api.evaluateStep('predict', { start: 0, end: 3, intervals: 3 }).ok, true);
  assert.strictEqual(api.evaluateStep('plan', { flip: 'x', breakpoints: [0, 1, 2, 3] }).ok, true);
  assert.strictEqual(api.evaluateStep('build', { ranges: ['[0,t]', '[0,1]', '[t-2,1]'] }).ok, true);
  assert.strictEqual(api.evaluateStep('calculate', { expressions: ['int_0_t_tau', 'int_0_1_tau', 'int_t-2_1_tau'] }).ok, true);
  assert.strictEqual(api.evaluateStep('sketch', { shapes: ['increasing', 'constant', 'decreasing'], points: [[0, 0], [1, 0.5], [2, 0.5], [3, 0]] }).ok, true);
  record('all five Practice steps accept the approved answer model', true);

  assert.strictEqual(api.evaluateStep('predict', { start: 0, end: 2, intervals: 3 }).ok, false);
  assert.strictEqual(api.evaluateStep('sketch', { shapes: ['constant'], points: [] }).ok, false);
  record('Practice rejects incomplete or incorrect structures', true);

  const html = api.buildHtml();
  assert.match(html, /Predict/);
  assert.match(html, /Plan/);
  assert.match(html, /Build/);
  assert.match(html, /Calculate/);
  assert.match(html, /Sketch/);
  assert.match(html, /practice-rectangle-triangle/);
  record('Practice shell contains five chips and the trusted demo preset', true);
} catch (error) {
  record('Practice contract', false, error.message);
}

const failed = results.filter(result => !result.ok);
console.log(`\n[convolution-practice] ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
