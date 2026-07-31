/*
 * Lesson cache reader/writer (extracted from ws-bridge.js in Phase 1 #7).
 *
 * Hard Invariant: this module owns the LESSON_CACHE_VERSION string
 * `aquarius_visual_latex_v2`. Renaming this string invalidates every
 * cached lesson file on disk (~hundreds of files, days of LLM cost to
 * regenerate). See CLAUDE.md "Hard Constraints".
 *
 * On-disk layout under TUTOR_MATERIALS_DIR/lesson-cache/:
 *   <normalized-section-id>/<key>.aquarius_visual_latex_v2.en.md
 *   where key = `<bookSource>[__<cacheVariant>]__aquarius_visual_latex_v2`
 *   and normalized-section-id = lowercase, dots replaced with underscores
 *   (e.g. 'B.1-2 Complex Numbers' -> 'b_1-2')
 *
 * Cache-miss returns null (caller surfaces LESSON_CACHE_MISS_MESSAGE);
 * the bridge does NOT generate live on miss — owner regenerates via
 * pregen scripts.
 *
 * Factory pattern follows Phase 1 #4-#6. Bridge injects the materials dir
 * and the lesson-format helpers (those stay in ws-bridge.js because they
 * are used outside the cache path too, notably during live generation).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const LESSON_CACHE_VERSION = 'aquarius_visual_latex_v2';
const LESSON_CACHE_MISS_MESSAGE = 'This section has not been prepared yet.';

/**
 * @param {{
 *   tutorMaterialsDir: string,
 *   prepareLessonForCache: (sectionId: string, lesson: string) => string,
 *   collectLessonFormatIssues: (markdown: string) => string[],
 *   assertLessonFormatClean: (sectionId: string, lesson: string, phase?: string) => void,
 * }} deps
 */
module.exports = function createLessonCache(deps) {
    const tutorMaterialsDir = deps && deps.tutorMaterialsDir;
    const prepareLessonForCache = deps && deps.prepareLessonForCache;
    const collectLessonFormatIssues = deps && deps.collectLessonFormatIssues;
    const assertLessonFormatClean = deps && deps.assertLessonFormatClean;
    if (typeof tutorMaterialsDir !== 'string' || !tutorMaterialsDir
        || typeof prepareLessonForCache !== 'function'
        || typeof collectLessonFormatIssues !== 'function'
        || typeof assertLessonFormatClean !== 'function') {
        throw new Error('lesson-cache: missing required deps {tutorMaterialsDir, prepareLessonForCache, collectLessonFormatIssues, assertLessonFormatClean}');
    }

    const LESSON_CACHE_DIR = path.join(tutorMaterialsDir, 'lesson-cache');
    try { if (!fs.existsSync(LESSON_CACHE_DIR)) fs.mkdirSync(LESSON_CACHE_DIR, { recursive: true }); } catch (_) {}

    /**
     * Normalize sectionId to a consistent cache directory name.
     * 'B.1-2 Algebra of Complex Numbers' → 'b_1-2'
     * 'b.1-2' → 'b_1-2'
     * '1.2-3 Time Reversal' → '1_2-3'
     */
    function normalizeSectionId(raw) {
        const m = String(raw || '').match(/^([A-Za-z]?[0-9]*(?:[.\-][0-9]+)*)/);
        const code = m ? m[1] : raw;
        return code.toLowerCase().replace(/\./g, '_');
    }

    function buildLessonCacheKey(bookSource = 'new', cacheVariant = 'lesson') {
        const sourceKey = bookSource === 'new' ? 'new' : 'old';
        const variantKey = cacheVariant && cacheVariant !== 'lesson' ? `__${cacheVariant}` : '';
        return `${sourceKey}${variantKey}__${LESSON_CACHE_VERSION}`;
    }

    function hasLessonCacheFile(sectionId, bookSource = 'new', cacheVariant = 'lesson') {
        const key = buildLessonCacheKey(bookSource, cacheVariant);
        if (!key) return false;
        const normId = normalizeSectionId(sectionId);
        const file = path.join(LESSON_CACHE_DIR, normId, `${key}.${LESSON_CACHE_VERSION}.en.md`);
        return fs.existsSync(file);
    }

    function readLessonCache(sectionId, bookSource = 'new', cacheVariant = 'lesson') {
        const key = buildLessonCacheKey(bookSource, cacheVariant);
        if (!key) return null;
        const normId = normalizeSectionId(sectionId);
        const dir = path.join(LESSON_CACHE_DIR, normId);
        const file = path.join(dir, `${key}.${LESSON_CACHE_VERSION}.en.md`);
        console.log(`[LessonCache] lookup: ${sectionId} → ${normId} / ${key} / ${LESSON_CACHE_VERSION}`);
        if (!fs.existsSync(file)) return null;
        try {
            const content = fs.readFileSync(file, 'utf8');
            console.log(`[LessonCache] HIT: ${normId} / ${key}`);
            const normalized = prepareLessonForCache(sectionId, content);
            const issues = collectLessonFormatIssues(normalized);
            if (issues.length) {
                console.warn(`[LessonCache] HIT but invalid format: ${normId} / ${key}: ${issues.join(', ')}`);
                return null;
            }
            return normalized;
        } catch (_) { return null; }
    }

    function writeLessonCache(sectionId, lesson, bookSource = 'new', cacheVariant = 'lesson') {
        const key = buildLessonCacheKey(bookSource, cacheVariant);
        if (!key) return;
        const normId = normalizeSectionId(sectionId);
        const dir = path.join(LESSON_CACHE_DIR, normId);
        try {
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, `${key}.${LESSON_CACHE_VERSION}.en.md`);
            const normalized = prepareLessonForCache(sectionId, lesson);
            assertLessonFormatClean(sectionId, normalized, 'write-cache');
            fs.writeFileSync(file, normalized, 'utf8');
            console.log(`[LessonCache] SAVED: ${normId} / ${key} / ${LESSON_CACHE_VERSION}`);
        } catch (e) {
            console.error('[LessonCache] write error:', e.message);
            throw e;
        }
    }

    return {
        LESSON_CACHE_VERSION,
        LESSON_CACHE_MISS_MESSAGE,
        hasLessonCacheFile,
        readLessonCache,
        writeLessonCache,
    };
};
