#!/usr/bin/env node
/**
 * _extract-view-important.js — TEMP scratch (Phase 3.6 task 2).
 * Pull every !important declaration whose selector chain contains a target
 * view ID, so the courseTracker/preference !important-strip works from an
 * exact candidate list (not the planning-grade 342/381 inventory estimate).
 *
 * Reuses parseDeclarations from the hardened scanner — same lexical core that
 * proved render-neutral on the redecl sweeps, so selector/context/important
 * attribution is trustworthy.
 *
 * Per-surface scratch: set VIEWS (below) to the view currently under strip, then
 * run this BEFORE the cascade probe — it (re)writes the gitignored
 * _view-important.json that _view-cascade-probe.js reads to build PROP_LIST.
 * VIEWS is left at the last surface worked (not a shipped config).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { parseDeclarations } = require('./find-dead-redeclarations.js');

const FILE = path.join(__dirname, '..', 'app', 'style.css');
const css = fs.readFileSync(FILE, 'utf8');
const decls = parseDeclarations(css);

const VIEWS = ['.sidebar'];  // ← set to surfaces currently under strip (see header)

for (const view of VIEWS) {
  // !important decls whose selector mentions this view ID
  const imp = decls.filter((d) => d.important && d.selector.includes(view));
  // For competitor awareness: ALL decls (any importance) under this view, by prop.
  const all = decls.filter((d) => d.selector.includes(view));

  // group important by property
  const byProp = {};
  for (const d of imp) (byProp[d.prop] ||= []).push(d);

  // how many of these important decls sit inside an @-context (media/container/supports)?
  const inAt = imp.filter((d) => d.context && d.context.length > 0);
  const topLevel = imp.filter((d) => !d.context || d.context.length === 0);

  console.log(`\n========================================================`);
  console.log(`${view}: ${imp.length} !important decls  (${all.length} total decls under view)`);
  console.log(`  top-level: ${topLevel.length}   inside @media/@container/@supports: ${inAt.length}`);
  console.log(`  distinct properties carrying !important: ${Object.keys(byProp).length}`);
  console.log(`  props: ${Object.keys(byProp).sort().join(', ')}`);
}

// Emit machine-readable artifact for the classification workflow.
const out = {};
for (const view of VIEWS) {
  out[view] = decls
    .filter((d) => d.important && d.selector.includes(view))
    .map((d) => ({ line: d.line, selector: d.selector, prop: d.prop, context: d.context, raw: d.raw }));
}
const dest = path.join(__dirname, '_view-important.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(`\n→ wrote ${dest} (${Object.entries(out).map(([k, v]) => `${k}:${v.length}`).join(', ')})`);
