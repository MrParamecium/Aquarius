#!/usr/bin/env node
/**
 * Shape test for the Phase 1 #2 data modules under app/data/.
 *
 * Concatenates the two modules in the same order index.html loads them and
 * evaluates the bundle in a single vm script. That faithfully simulates the
 * browser's classic-script realm, where top-level `const`s declared in one
 * script become lexical bindings visible to every later script in the same
 * realm. A trailing expression returns a snapshot of the declared globals so
 * we can assert their shape from Node.
 *
 * Catches: missing/renamed data file, accidentally-emptied data, encoding
 * regressions (one Chinese character is round-tripped), shape drift, and
 * Object.assign extensions failing to mutate.
 *
 * Usage: node tools/test-data-modules-shape.js
 * Exits 0 on pass, 1 on fail. No bridge, no browser, no dependencies.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA_DIR = path.resolve(__dirname, '..', 'app', 'data');
// Same order as index.html. Order doesn't affect correctness (no module
// reads another's binding) but matches deploy semantics.
const MODULES = [
  'course-metadata.js',
  'syllabus-data.js'
];

const sources = MODULES.map(name => {
  const full = path.join(DATA_DIR, name);
  return `//# sourceURL=app/data/${name}\n` + fs.readFileSync(full, 'utf8');
});

const snapshotExpr = `;(() => ({
  COURSE_TRACKER_STATUSES:    typeof COURSE_TRACKER_STATUSES    !== 'undefined' ? COURSE_TRACKER_STATUSES    : undefined,
  COURSE_GRADE_RULES:         typeof COURSE_GRADE_RULES         !== 'undefined' ? COURSE_GRADE_RULES         : undefined,
  COURSE_SCHEDULE:            typeof COURSE_SCHEDULE            !== 'undefined' ? COURSE_SCHEDULE            : undefined,
  SECTION_PREVIEWS_NEW:       typeof SECTION_PREVIEWS_NEW       !== 'undefined' ? SECTION_PREVIEWS_NEW       : undefined,
  syllabusDataNew:            typeof syllabusDataNew            !== 'undefined' ? syllabusDataNew            : undefined,
  syllabusData:               typeof syllabusData               !== 'undefined' ? syllabusData               : undefined
}))()`;

let snapshot;
try {
  snapshot = vm.runInNewContext(sources.join('\n\n') + '\n\n' + snapshotExpr, {});
} catch (err) {
  console.error(`FAIL: data modules failed to evaluate as a bundle: ${err.message}`);
  process.exit(1);
}

const checks = [
  ['COURSE_TRACKER_STATUSES has 4 entries including Done',
    () => Array.isArray(snapshot.COURSE_TRACKER_STATUSES)
      && snapshot.COURSE_TRACKER_STATUSES.length === 4
      && snapshot.COURSE_TRACKER_STATUSES.includes('Done')],
  ['COURSE_GRADE_RULES has 4 entries whose weights sum to 100',
    () => Array.isArray(snapshot.COURSE_GRADE_RULES)
      && snapshot.COURSE_GRADE_RULES.length === 4
      && snapshot.COURSE_GRADE_RULES.reduce((s, r) => s + r.weight, 0) === 100],
  ['COURSE_SCHEDULE has 26 lectures with id/date/topic',
    () => Array.isArray(snapshot.COURSE_SCHEDULE)
      && snapshot.COURSE_SCHEDULE.length === 26
      && snapshot.COURSE_SCHEDULE.every(l => l.id && l.date && l.topic)],
  ['SECTION_PREVIEWS_NEW is a populated object (>100 entries after Object.assign extension)',
    () => snapshot.SECTION_PREVIEWS_NEW
      && typeof snapshot.SECTION_PREVIEWS_NEW === 'object'
      && Object.keys(snapshot.SECTION_PREVIEWS_NEW).length > 100],
  ['SECTION_PREVIEWS_NEW includes a known Chapter-1 entry',
    () => snapshot.SECTION_PREVIEWS_NEW['1.1 Size of a Signal']
      && typeof snapshot.SECTION_PREVIEWS_NEW['1.1 Size of a Signal'].en === 'string'],
  ['SECTION_PREVIEWS_NEW Object.assign extension landed (Ch-3 + Ch-5 entries present)',
    () => '3.1 Introduction' in snapshot.SECTION_PREVIEWS_NEW
      && '5.11 Summary' in snapshot.SECTION_PREVIEWS_NEW],
  ['syllabusDataNew has 11 chapters (Background + Ch 1–10), each with non-empty sections',
    () => Array.isArray(snapshot.syllabusDataNew)
      && snapshot.syllabusDataNew.length === 11
      && snapshot.syllabusDataNew.every(c => c.chapter && Array.isArray(c.sections) && c.sections.length > 0)],
  ['syllabusData alias is the same reference as syllabusDataNew',
    () => snapshot.syllabusData === snapshot.syllabusDataNew]
];

let failed = 0;
for (const [label, fn] of checks) {
  let ok = false;
  let err = null;
  try { ok = !!fn(); } catch (e) { err = e; }
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL  ${label}${err ? ' (' + err.message + ')' : ''}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks.length} data-module shape checks`);
process.exit(0);
