#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const cacheRoot = path.join(repoRoot, 'workspace', 'materials', 'lesson-cache');
const manifestPath = path.join(__dirname, 'unified-lesson-cache-migration.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const apply = process.argv.slice(2).includes('--apply');
const unexpectedArgs = process.argv.slice(2).filter(arg => arg !== '--apply' && arg !== '--dry-run');

if (unexpectedArgs.length || (process.argv.includes('--apply') && process.argv.includes('--dry-run'))) {
    console.error('Usage: node tools/migrate-unified-lesson-cache.js [--dry-run|--apply]');
    process.exit(2);
}

function walkMarkdown(root) {
    const files = [];
    for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
        const absolute = path.join(root, dirent.name);
        if (dirent.isDirectory()) files.push(...walkMarkdown(absolute));
        else if (dirent.isFile() && dirent.name.endsWith('.md')) files.push(absolute);
    }
    return files;
}

function inventory() {
    const files = walkMarkdown(cacheRoot);
    const version = manifest.cacheVersion;
    const lessonSuffix = `new__${version}.${version}.en.md`;
    const preludeSuffix = `new__parent_prelude__${version}.${version}.en.md`;
    const unifiedLessons = files.filter(file => file.endsWith(path.sep + lessonSuffix)).length;
    const parentPreludes = files.filter(file => file.endsWith(path.sep + preludeSuffix)).length;
    return {
        totalMarkdown: files.length,
        unifiedLessons,
        parentPreludes,
        legacyMarkdown: files.length - unifiedLessons - parentPreludes
    };
}

function stripLegacyGeneratedImageBlocks(markdown) {
    let source = String(markdown || '');
    source = source.replace(
        /\n*%%KC_BLOCK%%<div class="kc-visual-meta"[^>]*data-visual-kind="generate_image"[\s\S]*?%%KC_END%%\s*(?:\n\*🎨[^\n]*\*)?\s*\n!\[[^\]]*\]\(\/generated\/gptimage2-[^)]+\)\s*/gi,
        '\n\n'
    );
    source = source.replace(/\/generated\/gptimage2-[^) \n"']+/gi, '');
    return source.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function hash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function validateManifest(entries) {
    if (!Array.isArray(entries) || entries.length !== 14) {
        throw new Error(`Migration manifest must contain exactly 14 entries; got ${Array.isArray(entries) ? entries.length : 'invalid value'}`);
    }
    const sources = new Set();
    const targets = new Set();
    for (const entry of entries) {
        if (!entry || entry.cacheVariant !== 'lesson' || !entry.source || !entry.target || !entry.sectionId || !entry.reason) {
            throw new Error('Migration manifest contains missing fields or a non-lesson entry');
        }
        if (sources.has(entry.source)) throw new Error(`Duplicate source: ${entry.source}`);
        if (targets.has(entry.target)) throw new Error(`Duplicate target: ${entry.target}`);
        sources.add(entry.source);
        targets.add(entry.target);
        const expectedTarget = `new__${manifest.cacheVersion}.${manifest.cacheVersion}.en.md`;
        if (path.basename(entry.target) !== expectedTarget) throw new Error(`Invalid target filename: ${entry.target}`);
        if (path.dirname(entry.source) !== path.dirname(entry.target)) throw new Error(`Source and target are in different lesson directories: ${entry.sectionId}`);
        if (path.isAbsolute(entry.source) || path.isAbsolute(entry.target) || entry.source.includes('..') || entry.target.includes('..')) {
            throw new Error(`Manifest paths must stay inside the lesson-cache directory: ${entry.sectionId}`);
        }
    }
}

function sameInventory(left, right) {
    return Object.keys(right).every(key => left[key] === right[key]);
}

function main() {
    validateManifest(manifest.entries);
    const before = inventory();
    const expected = manifest.expectedBeforeMigration;
    const migrated = {
        totalMarkdown: expected.totalMarkdown + manifest.entries.length,
        unifiedLessons: expected.unifiedLessons + manifest.entries.length,
        parentPreludes: expected.parentPreludes,
        legacyMarkdown: expected.legacyMarkdown
    };
    const finalized = {
        totalMarkdown: migrated.unifiedLessons + migrated.parentPreludes,
        unifiedLessons: migrated.unifiedLessons,
        parentPreludes: migrated.parentPreludes,
        legacyMarkdown: 0
    };
    if (!sameInventory(before, expected) && !sameInventory(before, migrated) && !sameInventory(before, finalized)) {
        throw new Error(`Cache baseline mismatch: got ${JSON.stringify(before)}; expected pre-migration, migrated, or finalized state`);
    }
    if (sameInventory(before, finalized)) {
        const missing = manifest.entries.filter(entry => !fs.existsSync(path.join(cacheRoot, entry.target)));
        if (missing.length) throw new Error(`Finalized state is missing ${missing.length} migration targets`);
        console.log('Unified lesson cache migration is already complete; 389 legacy caches have been removed.');
        return;
    }

    const planned = [];
    for (const entry of manifest.entries) {
        const sourcePath = path.join(cacheRoot, entry.source);
        const targetPath = path.join(cacheRoot, entry.target);
        if (!fs.existsSync(sourcePath)) throw new Error(`Migration source does not exist: ${entry.source}`);
        const content = stripLegacyGeneratedImageBlocks(fs.readFileSync(sourcePath, 'utf8'));
        if (!content.trim()) throw new Error(`Migration source is empty after cleanup: ${entry.source}`);
        const digest = hash(content);
        if (fs.existsSync(targetPath)) {
            const existingHash = hash(fs.readFileSync(targetPath));
            if (existingHash !== digest) throw new Error(`Target exists with conflicting content: ${entry.target}`);
            planned.push({ ...entry, digest, status: 'migrated' });
        } else {
            planned.push({ ...entry, digest, content, targetPath, status: apply ? 'to write' : 'planned' });
        }
    }

    console.log(`${apply ? 'Applying' : 'Previewing'} unified lesson cache migration (${planned.length} entries):`);
    for (const item of planned) {
        console.log(`- ${item.sectionId}: ${item.status} ${item.source} -> ${item.target} sha256=${item.digest.slice(0, 12)}`);
    }

    if (!apply) {
        console.log(`Preview complete: ${planned.filter(item => item.status === 'planned').length} files would be written; no files changed.`);
        return;
    }

    const created = [];
    try {
        for (const item of planned) {
            if (!item.content) continue;
            fs.writeFileSync(item.targetPath, item.content, { encoding: 'utf8', flag: 'wx' });
            created.push(item.targetPath);
            if (hash(fs.readFileSync(item.targetPath)) !== item.digest) throw new Error(`Hash mismatch after write: ${item.target}`);
        }
    } catch (error) {
        for (const file of created.reverse()) {
            try { fs.unlinkSync(file); } catch (_) {}
        }
        throw error;
    }

    const after = inventory();
    if (!sameInventory(after, migrated)) {
        for (const file of created.reverse()) {
            try { fs.unlinkSync(file); } catch (_) {}
        }
        throw new Error(`Post-migration inventory check failed and was rolled back: ${JSON.stringify(after)}`);
    }
    console.log(`Migration complete: created ${created.length}; ${after.unifiedLessons} unified lessons, ${after.parentPreludes} parent preludes, ${after.legacyMarkdown} legacy files remain.`);
}

try {
    main();
} catch (error) {
    console.error(`Unified lesson cache migration failed: ${error.message}`);
    process.exit(1);
}
