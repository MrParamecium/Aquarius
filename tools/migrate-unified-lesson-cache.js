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
    console.error('用法：node tools/migrate-unified-lesson-cache.js [--dry-run|--apply]');
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
        throw new Error(`迁移清单必须恰好包含 14 项，当前为 ${Array.isArray(entries) ? entries.length : '无效值'}`);
    }
    const sources = new Set();
    const targets = new Set();
    for (const entry of entries) {
        if (!entry || entry.cacheVariant !== 'lesson' || !entry.source || !entry.target || !entry.sectionId || !entry.reason) {
            throw new Error('迁移清单存在缺失字段或非 lesson 项');
        }
        if (sources.has(entry.source)) throw new Error(`重复源：${entry.source}`);
        if (targets.has(entry.target)) throw new Error(`重复目标：${entry.target}`);
        sources.add(entry.source);
        targets.add(entry.target);
        const expectedTarget = `new__${manifest.cacheVersion}.${manifest.cacheVersion}.en.md`;
        if (path.basename(entry.target) !== expectedTarget) throw new Error(`目标文件名不规范：${entry.target}`);
        if (path.dirname(entry.source) !== path.dirname(entry.target)) throw new Error(`源和目标不在同一课程目录：${entry.sectionId}`);
        if (path.isAbsolute(entry.source) || path.isAbsolute(entry.target) || entry.source.includes('..') || entry.target.includes('..')) {
            throw new Error(`清单路径必须位于缓存目录内：${entry.sectionId}`);
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
        throw new Error(`缓存基线不符：实际 ${JSON.stringify(before)}，预期迁移前、迁移后或已清理状态`);
    }
    if (sameInventory(before, finalized)) {
        const missing = manifest.entries.filter(entry => !fs.existsSync(path.join(cacheRoot, entry.target)));
        if (missing.length) throw new Error(`已清理状态缺少 ${missing.length} 个迁移目标`);
        console.log('统一课程缓存迁移已完成，389 份旧缓存也已清理，无需再次迁移。');
        return;
    }

    const planned = [];
    for (const entry of manifest.entries) {
        const sourcePath = path.join(cacheRoot, entry.source);
        const targetPath = path.join(cacheRoot, entry.target);
        if (!fs.existsSync(sourcePath)) throw new Error(`迁移源不存在：${entry.source}`);
        const content = stripLegacyGeneratedImageBlocks(fs.readFileSync(sourcePath, 'utf8'));
        if (!content.trim()) throw new Error(`迁移源清理后为空：${entry.source}`);
        const digest = hash(content);
        if (fs.existsSync(targetPath)) {
            const existingHash = hash(fs.readFileSync(targetPath));
            if (existingHash !== digest) throw new Error(`目标已存在但内容冲突：${entry.target}`);
            planned.push({ ...entry, digest, status: '已迁移' });
        } else {
            planned.push({ ...entry, digest, content, targetPath, status: apply ? '待写入' : '将写入' });
        }
    }

    console.log(`${apply ? '执行' : '预览'}统一课程缓存迁移，共 ${planned.length} 项：`);
    for (const item of planned) {
        console.log(`- ${item.sectionId}: ${item.status} ${item.source} -> ${item.target} sha256=${item.digest.slice(0, 12)}`);
    }

    if (!apply) {
        console.log(`预览完成：${planned.filter(item => item.status === '将写入').length} 项待写入，未修改文件。`);
        return;
    }

    const created = [];
    try {
        for (const item of planned) {
            if (!item.content) continue;
            fs.writeFileSync(item.targetPath, item.content, { encoding: 'utf8', flag: 'wx' });
            created.push(item.targetPath);
            if (hash(fs.readFileSync(item.targetPath)) !== item.digest) throw new Error(`写入后哈希不一致：${item.target}`);
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
        throw new Error(`迁移后数量校验失败并已回滚：${JSON.stringify(after)}`);
    }
    console.log(`迁移完成：新增 ${created.length} 项；统一普通缓存 ${after.unifiedLessons}，父级概览 ${after.parentPreludes}，旧缓存仍保留 ${after.legacyMarkdown}。`);
}

try {
    main();
} catch (error) {
    console.error(`统一课程缓存迁移失败：${error.message}`);
    process.exit(1);
}
