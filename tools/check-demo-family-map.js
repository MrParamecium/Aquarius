'use strict';
// §2b family-key consistency check (static, deterministic, no browser).
//
// The interactive-demo dispatcher has TWO independent sources of family-name
// truth: the string literals returned by inferInteractiveDemoFamily() and the
// keys of INTERACTIVE_DEMO_FAMILY_RENDERERS. If a renderer-table key is typo'd
// (or a return literal drifts), a demo silently falls through to
// renderBriefDemoFallback and every pixel-diff view stays green (phase3_deferred
// §2b, REFACTOR_DONE §4.4). The Chapter-1 short-circuit means the 9-view set
// never exercises the table, so this class is otherwise unguarded.
//
// This check cross-validates the two literal sets by parsing the source (it does
// NOT introspect the built object, whose duplicate keys JS would have already
// collapsed). Runs in `npm run check`.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'interactive-demos', 'dispatcher.js'),
  'utf8'
);

function fail(msg) {
  console.error(`[demo-family-map] FAIL — ${msg}`);
  process.exit(1);
}

// 1. Map keys from the INTERACTIVE_DEMO_FAMILY_RENDERERS object literal.
const mapBlock = SRC.match(/INTERACTIVE_DEMO_FAMILY_RENDERERS\s*=\s*\{([\s\S]*?)\};/);
if (!mapBlock) fail('could not locate INTERACTIVE_DEMO_FAMILY_RENDERERS object literal');
const mapEntries = [...mapBlock[1].matchAll(/^\s*([a-z_][a-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*,?/gm)];
const mapKeys = mapEntries.map((m) => m[1]);
const rendererNames = mapEntries.map((m) => m[2]);

// duplicate map keys (JS would silently collapse them before any Object.keys).
const dupKey = mapKeys.find((k, i) => mapKeys.indexOf(k) !== i);
if (dupKey) fail(`duplicate renderer-table key "${dupKey}" (JS collapses these silently)`);

// 2. Return literals inside inferInteractiveDemoFamily() only (bounded to that fn).
const fnStart = SRC.indexOf('function inferInteractiveDemoFamily');
if (fnStart < 0) fail('could not locate inferInteractiveDemoFamily');
// Bound the function by the next TOP-LEVEL declaration rather than brace-walking
// (the body's many regex literals contain unbalanced `{`/`}` that fool a naive
// brace counter). Inner arrow-fns / consts are indented, so `\nfunction `,
// `\nconst ` etc. only match the next top-level statement (the family-renderer
// map), which is exactly where inferInteractiveDemoFamily ends.
const bodyStart = SRC.indexOf('{', SRC.indexOf(')', fnStart));
const after = SRC.slice(bodyStart);
const bodyEnd = bodyStart + Math.min(
  ...[/\nfunction /, /\nconst /, /\nlet /, /\nvar /, /\nwindow\./]
    .map((re) => { const m = after.slice(1).match(re); return m ? m.index + 1 : Infinity; })
);
if (!Number.isFinite(bodyEnd)) fail('could not bound inferInteractiveDemoFamily body');
const fnBody = SRC.slice(bodyStart, bodyEnd);
const returnLiterals = [...new Set([...fnBody.matchAll(/return\s+'([a-z_][a-z0-9_]*)'/g)].map((m) => m[1]))];

// 3. Families that are handled by hand-rolled dispatch branches / fallbacks and
//    therefore INTENTIONALLY have no family-table entry.
const EXCLUDED = new Set([
  'complex_plane',        // isComplexPlaneDemo branch -> renderComplexPlaneDemo
  'sinusoid',             // isSinusoidDemo branch -> renderSinusoidPhasorDemo
  'opposite_rotations',   // isOppositeRotationDemo branch -> renderOppositeRotationsDemo
  'matrix_conformability', // isMatrixDemo special case -> renderMatrixConformabilityDemo
  'brief',                // renderBriefDemoFallback
  'algebra_brief',        // renderBriefDemoFallback
]);

const tableRouted = returnLiterals.filter((f) => !EXCLUDED.has(f)).sort();
const keysSorted = [...mapKeys].sort();

// 4a. Every non-excluded family the inferer can produce MUST have a table entry
//     (else it silently falls to renderBriefDemoFallback).
const missingFromTable = tableRouted.filter((f) => !mapKeys.includes(f));
if (missingFromTable.length) {
  fail(`inferInteractiveDemoFamily can return ${JSON.stringify(missingFromTable)} but the renderer table has no such key — those demos silently hit renderBriefDemoFallback`);
}
// 4b. Every table key MUST be producible by the inferer (else it is dead / a typo).
const unreachableKeys = mapKeys.filter((k) => !returnLiterals.includes(k));
if (unreachableKeys.length) {
  fail(`renderer-table key(s) ${JSON.stringify(unreachableKeys)} are never returned by inferInteractiveDemoFamily (dead entry or key typo)`);
}

// 5. Every renderer referenced by the table must be a defined function somewhere
//    in interactive-demos/*.js (a name typo would ReferenceError only at runtime).
const demoDir = path.join(__dirname, '..', 'app', 'interactive-demos');
const allSrc = fs.readdirSync(demoDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(demoDir, f), 'utf8'))
  .join('\n');
const undefinedRenderers = rendererNames.filter((name) => {
  const defRe = new RegExp(`function\\s+${name}\\b|(?:const|let|var)\\s+${name}\\s*=`);
  return !defRe.test(allSrc);
});
if (undefinedRenderers.length) {
  fail(`renderer function(s) ${JSON.stringify(undefinedRenderers)} referenced by the table are not defined in interactive-demos/*.js`);
}

console.log(`[demo-family-map] OK — ${mapKeys.length} table keys ⇄ ${tableRouted.length} table-routed families consistent; ${rendererNames.length} renderer fns defined`);
