'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(repoRoot, 'app', 'convolution-exit-check.js'), 'utf8');
const context = { window: {}, console, CustomEvent: class CustomEvent {} };
vm.runInNewContext(source, context, { filename: 'convolution-exit-check.js' });
const api = context.window.__ftutorConvolutionExitCheck;
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

try {
  assert.ok(api && typeof api.evaluate === 'function');
  assert.strictEqual(JSON.stringify(api.evaluate('order', ['flip', 'slide', 'multiply', 'integrate'])), JSON.stringify({
    ok: true,
    field: '',
    message: 'Correct. Flip and slide create the moving signal before multiplication and integration.',
  }));
  assert.strictEqual(api.evaluate('support', { start: -1, end: 4 }).ok, true);
  assert.strictEqual(api.evaluate('overlap', { start: 0, end: 1.5 }).ok, true);
  record('exact Exit Check answers are accepted', true);

  assert.strictEqual(api.evaluate('support', { start: 0, end: 4 }).ok, false);
  assert.strictEqual(api.evaluate('overlap', { start: 0, end: 1.4 }).ok, false);
  record('incorrect boundaries are rejected without tolerance', true);

  assert.strictEqual(api.feedbackLevel(1), 'highlight');
  assert.strictEqual(api.feedbackLevel(2), 'direction');
  assert.strictEqual(api.feedbackLevel(3), 'demonstration');
  record('feedback escalates through highlight, direction, and demonstration', true);

  const html = api.buildHtml();
  assert.match(html, /data-convolution-exit-check/);
  assert.strictEqual((html.match(/data-exit-progress=/g) || []).length, 3);
  assert.strictEqual((html.match(/data-exit-question=/g) || []).length, 1);
  record('buildHtml renders one question and three progress dots', true);

  const indexHtml = fs.readFileSync(path.join(repoRoot, 'app', 'index.html'), 'utf8');
  assert.ok(indexHtml.indexOf('convolution-practice.js') < indexHtml.indexOf('convolution-exit-check.js'));
  assert.ok(indexHtml.indexOf('convolution-exit-check.js') < indexHtml.indexOf('lesson-render.js'));
  record('Exit Check script loads before lesson renderer', true);
} catch (error) {
  record('Exit Check contract', false, error.message);
}

const failed = results.filter(result => !result.ok);
console.log(`\n[convolution-exit-check] ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
