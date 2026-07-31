#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const cacheRoot = path.join(repoRoot, 'workspace', 'materials', 'lesson-cache');
const syllabusPath = path.join(repoRoot, 'app', 'data', 'syllabus-data.js');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'unified-lesson-cache-migration.json'), 'utf8'));
const {
    collectLessonFormatIssues,
    prepareLessonForCache,
    assertLessonFormatClean,
} = require(path.join(repoRoot, 'app', 'ws-bridge.js'));
const lessonCache = require(path.join(repoRoot, 'app', 'lesson-cache.js'))({
    tutorMaterialsDir: path.join(repoRoot, 'workspace', 'materials'),
    collectLessonFormatIssues,
    prepareLessonForCache,
    assertLessonFormatClean,
});
const version = manifest.cacheVersion;
const lessonFile = `new__${version}.${version}.en.md`;
const preludeFile = `new__parent_prelude__${version}.${version}.en.md`;

function normalizeSectionId(raw) {
    const match = String(raw || '').match(/^([A-Za-z]?[0-9]*(?:[.\-][0-9]+)*)/);
    const code = match ? match[1] : raw;
    return String(code).toLowerCase().replace(/\./g, '_');
}

function loadSyllabus() {
    const source = fs.readFileSync(syllabusPath, 'utf8') + '\n;globalThis.__syllabus = syllabusDataNew;';
    const context = { globalThis: {} };
    vm.runInNewContext(source, context, { filename: syllabusPath });
    return context.globalThis.__syllabus;
}

function buildOpenableMap(syllabus) {
    const map = new Map();
    for (const chapter of syllabus || []) {
        for (const rawSection of chapter.sections || []) {
            const section = typeof rawSection === 'string' ? { title: rawSection, subsections: [] } : rawSection;
            const subsections = Array.isArray(section.subsections) ? section.subsections : [];
            // The UI opens every top-level section through overview mode, even
            // when it has no child subsections. A top-level section may also
            // retain a directly openable lesson cache.
            map.set(normalizeSectionId(section.title), { sectionId: section.title, kind: 'parent' });
            for (const subsection of subsections) {
                map.set(normalizeSectionId(subsection), { sectionId: subsection, kind: 'subsection' });
            }
        }
    }
    return map;
}

function collectInventory() {
    const rows = [];
    for (const dirent of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
        if (!dirent.isDirectory()) continue;
        const dir = dirent.name;
        const files = fs.readdirSync(path.join(cacheRoot, dir)).filter(file => file.endsWith('.md'));
        rows.push({
            dir,
            files,
            lesson: files.includes(lessonFile),
            prelude: files.includes(preludeFile),
            legacy: files.filter(file => file !== lessonFile && file !== preludeFile)
        });
    }
    return rows;
}

function reportList(label, items) {
    if (!items.length) return;
    console.error(`${label} (${items.length}):`);
    for (const item of items) console.error(`- ${item}`);
}

function main() {
    const syllabusMap = buildOpenableMap(loadSyllabus());
    const inventory = collectInventory();
    const manifestTargets = new Set(manifest.entries.map(entry => entry.target));
    const activeTargets = new Set();
    const missingTargets = [];
    const invalidTargets = [];
    const formatFailures = [];

    for (const row of inventory) {
        if (row.lesson) activeTargets.add(`${row.dir}/${lessonFile}`);
        if (row.prelude) activeTargets.add(`${row.dir}/${preludeFile}`);
    }

    for (const entry of manifest.entries) {
        if (!activeTargets.has(entry.target)) missingTargets.push(entry.target);
    }

    for (const target of activeTargets) {
        const [dir, file] = target.split('/');
        const syllabusEntry = syllabusMap.get(dir);
        if (file === preludeFile && syllabusEntry && syllabusEntry.kind !== 'parent') {
            invalidTargets.push(`${target}: parent_prelude is only valid for parent sections`);
        }
        const sectionId = syllabusEntry ? syllabusEntry.sectionId : dir.replace(/_/g, '.');
        const variant = file === preludeFile ? 'parent_prelude' : 'lesson';
        const content = fs.readFileSync(path.join(cacheRoot, target), 'utf8');
        const normalized = prepareLessonForCache(sectionId, content);
        const issues = collectLessonFormatIssues(normalized);
        if (issues.length) formatFailures.push(`${target}: ${issues.join(', ')}`);
        const runtimeContent = lessonCache.readLessonCache(sectionId, 'new', variant);
        if (!runtimeContent || !runtimeContent.trim()) formatFailures.push(`${target}: runtime reader returned empty content`);
    }

    const legacyOnly = inventory.filter(row => !row.lesson && row.legacy.length > 0);
    const unexplainedLegacyOnly = legacyOnly.filter(row => {
        const target = `${row.dir}/${lessonFile}`;
        const syllabusEntry = syllabusMap.get(row.dir);
        return !manifestTargets.has(target) && !(row.prelude && syllabusEntry && syllabusEntry.kind === 'parent');
    });

    reportList('Missing unified lesson targets', missingTargets);
    reportList('Variant and UI open-rule conflicts', invalidTargets);
    reportList('Production format or read failures', formatFailures);
    reportList('Legacy-only cache directories without a manifest or parent-prelude explanation', unexplainedLegacyOnly.map(row => row.dir));

    const expectedUnifiedLessons = manifest.expectedBeforeMigration.unifiedLessons + manifest.entries.length;
    const expectedPreludes = manifest.expectedBeforeMigration.parentPreludes;
    const lessonCount = inventory.filter(row => row.lesson).length;
    const preludeCount = inventory.filter(row => row.prelude).length;
    const legacyCount = inventory.reduce((count, row) => count + row.legacy.length, 0);
    if (lessonCount !== expectedUnifiedLessons) {
        console.error(`Unified lesson count mismatch: got ${lessonCount}, expected ${expectedUnifiedLessons}`);
    }
    if (preludeCount !== expectedPreludes) {
        console.error(`Parent-prelude count mismatch: got ${preludeCount}, expected ${expectedPreludes}`);
    }
    if (legacyCount !== 0) {
        console.error(`Legacy tier/profile caches remain: ${legacyCount}; expected 0`);
    }

    const failed = missingTargets.length || invalidTargets.length || formatFailures.length || unexplainedLegacyOnly.length
        || lessonCount !== expectedUnifiedLessons || preludeCount !== expectedPreludes || legacyCount !== 0;
    if (failed) process.exit(1);
    console.log(`Unified lesson cache check passed: ${lessonCount} lessons, ${preludeCount} parent preludes, no missing targets or invalid variants.`);
}

try {
    main();
} catch (error) {
    console.error(`Unified lesson cache check failed: ${error.message}`);
    process.exit(1);
}
