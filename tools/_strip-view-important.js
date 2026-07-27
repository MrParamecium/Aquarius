#!/usr/bin/env node
/**
 * _strip-view-important.js — TEMP scratch (Phase 3.6 task 2).
 * Downgrade !important → normal on declarations under #courseTrackerView /
 * #preferenceView, EXCEPT a keep-set of load-bearing lines (those the cascade
 * probe proved a competitor wins once !important is gone).
 *
 * Always strips from the PRISTINE `git show HEAD:app/style.css` so the run is
 * idempotent and re-runnable as the keep-set grows: removing " !important"
 * never deletes a line, so parseDeclarations line numbers are stable across
 * strips and make a reliable keep-set key.
 *
 *   node tools/_strip-view-important.js --view=courseTracker   # strip that view
 *   node tools/_strip-view-important.js --view=preference
 *   node tools/_strip-view-important.js --view=settings
 *   node tools/_strip-view-important.js --view=mistakeNotebook
 *   node tools/_strip-view-important.js --view=both            # every view in VIEW_IDS
 * Reads keep-set from tools/_keep-important.json (array of pristine line numbers).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseDeclarations } = require('./find-dead-redeclarations.js');

const VIEW_IDS = { courseTracker: '#courseTrackerView', preference: '#preferenceView', settings: '#settingsView', mistakeNotebook: '#mistakeNotebookView', sidebar: '.sidebar' };
const viewArg = (process.argv.find((a) => a.startsWith('--view=')) || '--view=both').split('=')[1];
const views = viewArg === 'both' ? Object.values(VIEW_IDS)
  : VIEW_IDS[viewArg] ? [VIEW_IDS[viewArg]] : null;
if (!views) { console.error(`--view must be one of: ${Object.keys(VIEW_IDS).join(' | ')} | both (got "${viewArg}")`); process.exit(2); }

const FILE = path.join(__dirname, '..', 'app', 'style.css');
const KEEP_FILE = path.join(__dirname, '_keep-important.json');
const keep = new Set(fs.existsSync(KEEP_FILE) ? JSON.parse(fs.readFileSync(KEEP_FILE, 'utf8')) : []);

const pristine = execSync('git show HEAD:app/style.css', { cwd: path.resolve(__dirname, '..'), maxBuffer: 1 << 30 }).toString();
const decls = parseDeclarations(pristine);

const targets = decls.filter((d) =>
  d.important && views.some((v) => d.selector.includes(v)) && !keep.has(d.line));

// Apply back-to-front so earlier offsets stay valid.
targets.sort((a, b) => b.start - a.start);
let out = pristine;
let n = 0;
for (const d of targets) {
  const seg = out.slice(d.start, d.end);
  const stripped = seg.replace(/\s*!important/i, '');
  if (stripped === seg) { console.error(`WARN: no !important token in span L${d.line} {${d.prop}} — skipped`); continue; }
  out = out.slice(0, d.start) + stripped + out.slice(d.end);
  n++;
}
fs.writeFileSync(FILE, out);

const keptUnderView = decls.filter((d) => d.important && views.some((v) => d.selector.includes(v)) && keep.has(d.line)).length;
console.log(`view=${viewArg}: stripped ${n} !important, kept ${keptUnderView} load-bearing (keep-set size ${keep.size})`);
// integrity: line count must be unchanged vs pristine
const lp = pristine.split('\n').length, lo = out.split('\n').length;
console.log(`line count ${lp} → ${lo} (${lp === lo ? 'STABLE ✓' : 'CHANGED ✗✗✗'})`);
