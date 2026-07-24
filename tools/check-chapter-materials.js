'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = 'tools/chapter-4-5-materials.manifest.json';
const CHAPTER_RE = /^[45](?:\.|$)/;
const PAGE_RE = /^page-(\d{3})$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ALLOWED_FORMULA_STATUSES = new Set(['verified', 'draft_pdf_latex']);
const MATERIAL_DIRS = [
    'workspace/materials/new-book-pages',
    'workspace/materials/new-book-ocr',
    'workspace/materials/new-book-section-ocr',
    'workspace/materials/formula-catalog'
];
const MAP_PATHS = [
    'app/section-page-map-new.json',
    'app/section-page-map-display-new.json',
    'app/section-page-anchor-new.json'
];
const EXPECTED_COUNTS = {
    sections: 83,
    pages: 226,
    pageImages: 226,
    pageOcrFiles: 452,
    sectionOcrFiles: 166,
    formulaCatalogs: 32,
    formulas: 85,
    verifiedCatalogs: 27,
    draftCatalogs: 5,
    verifiedFormulas: 76,
    draftFormulas: 9,
    materialFiles: 876
};

const errors = [];

function relativePath(...parts) {
    return parts.join('/');
}

function absolutePath(relative) {
    return path.join(REPO_ROOT, ...relative.split('/'));
}

function addError(relative, message) {
    errors.push(`${relative}: ${message}`);
}

function naturalCompare(left, right) {
    const leftParts = String(left).match(/\d+|\D+/g) || [];
    const rightParts = String(right).match(/\d+|\D+/g) || [];
    const count = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < count; index += 1) {
        const leftPart = leftParts[index];
        const rightPart = rightParts[index];
        if (leftPart === undefined) return -1;
        if (rightPart === undefined) return 1;
        if (leftPart === rightPart) continue;

        const leftIsNumber = /^\d+$/.test(leftPart);
        const rightIsNumber = /^\d+$/.test(rightPart);
        if (leftIsNumber && rightIsNumber) {
            const difference = Number(leftPart) - Number(rightPart);
            if (difference !== 0) return difference;
        }
        return leftPart < rightPart ? -1 : 1;
    }
    return 0;
}

function sorted(values) {
    return [...values].sort(naturalCompare);
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readBuffer(relative) {
    try {
        return fs.readFileSync(absolutePath(relative));
    } catch (error) {
        addError(relative, `cannot read file (${error.code || error.message})`);
        return null;
    }
}

function readText(relative) {
    const buffer = readBuffer(relative);
    return buffer === null ? null : buffer.toString('utf8');
}

function readJson(relative) {
    const text = readText(relative);
    if (text === null) return null;
    try {
        return JSON.parse(text);
    } catch (error) {
        addError(relative, `invalid JSON (${error.message})`);
        return null;
    }
}

function valuesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function validateExactList(actual, expected, label) {
    if (!Array.isArray(actual)) {
        addError(MANIFEST_PATH, `${label} must be an array`);
        return;
    }

    const unique = new Set(actual);
    if (unique.size !== actual.length) {
        addError(MANIFEST_PATH, `${label} contains duplicate values`);
    }

    const expectedSet = new Set(expected);
    for (const value of expected) {
        if (!unique.has(value)) addError(MANIFEST_PATH, `${label} is missing ${value}`);
    }
    for (const value of actual) {
        if (!expectedSet.has(value)) addError(MANIFEST_PATH, `${label} contains unexpected ${value}`);
    }
    if (!valuesEqual(actual, expected)) {
        addError(MANIFEST_PATH, `${label} is not in deterministic natural order`);
    }
}

function chapterEntries(map, relative) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) {
        addError(relative, 'top-level value must be an object');
        return [];
    }
    return Object.entries(map).filter(([sectionId]) => CHAPTER_RE.test(sectionId));
}

function deriveChapterScope(sectionMap) {
    const entries = chapterEntries(sectionMap, MAP_PATHS[0]);
    const sections = sorted(entries.map(([sectionId]) => sectionId));
    const pageSet = new Set();

    for (const [sectionId, pages] of entries) {
        if (!Array.isArray(pages) || pages.length === 0) {
            addError(MAP_PATHS[0], `${sectionId} must map to a non-empty page array`);
            continue;
        }
        for (const pageId of pages) {
            if (typeof pageId !== 'string' || !PAGE_RE.test(pageId)) {
                addError(MAP_PATHS[0], `${sectionId} has invalid page ID ${JSON.stringify(pageId)}`);
                continue;
            }
            pageSet.add(pageId);
        }
    }

    return { entries, sections, pages: sorted(pageSet) };
}

function validateMaps(sectionMap, displayMap, anchorMap, scope, manifest) {
    if (scope.sections.length !== EXPECTED_COUNTS.sections) {
        addError(MAP_PATHS[0], `expected ${EXPECTED_COUNTS.sections} Chapter 4-5 sections, found ${scope.sections.length}`);
    }
    if (scope.pages.length !== EXPECTED_COUNTS.pages) {
        addError(MAP_PATHS[0], `expected ${EXPECTED_COUNTS.pages} unique Chapter 4-5 pages, found ${scope.pages.length}`);
    }

    const displaySections = sorted(chapterEntries(displayMap, MAP_PATHS[1]).map(([sectionId]) => sectionId));
    const anchorSections = sorted(chapterEntries(anchorMap, MAP_PATHS[2]).map(([sectionId]) => sectionId));
    if (!valuesEqual(displaySections, scope.sections)) {
        addError(MAP_PATHS[1], 'Chapter 4-5 section IDs differ from the primary map');
    }
    if (!valuesEqual(anchorSections, scope.sections)) {
        addError(MAP_PATHS[2], 'Chapter 4-5 section IDs differ from the primary map');
    }

    for (const sectionId of scope.sections) {
        const expectedPages = sectionMap[sectionId];
        if (!valuesEqual(displayMap && displayMap[sectionId], expectedPages)) {
            addError(MAP_PATHS[1], `${sectionId} differs from the primary map`);
        }

        const anchor = anchorMap && anchorMap[sectionId];
        if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) {
            addError(MAP_PATHS[2], `${sectionId} is missing a valid anchor object`);
            continue;
        }
        if (!expectedPages.includes(anchor.page)) {
            addError(MAP_PATHS[2], `${sectionId} anchor page ${JSON.stringify(anchor.page)} is outside its mapped pages`);
        }
        if (typeof anchor.startRatio !== 'number' || !Number.isFinite(anchor.startRatio)
            || anchor.startRatio < 0 || anchor.startRatio > 1) {
            addError(MAP_PATHS[2], `${sectionId} startRatio must be within [0, 1]`);
        }
    }

    if (!manifest || typeof manifest.mapHashes !== 'object' || Array.isArray(manifest.mapHashes)) {
        addError(MANIFEST_PATH, 'mapHashes must be an object');
        return;
    }
    for (const relative of MAP_PATHS) {
        const buffer = readBuffer(relative);
        if (buffer && manifest.mapHashes[relative] !== sha256(buffer)) {
            addError(relative, 'SHA-256 differs from manifest mapHashes');
        }
    }
}

function expectedMaterialPaths(scope, formulaCatalogs) {
    const paths = [];
    for (const pageId of scope.pages) {
        paths.push(relativePath('workspace/materials/new-book-pages', `${pageId}.png`));
        paths.push(relativePath('workspace/materials/new-book-ocr', `${pageId}.txt`));
        paths.push(relativePath('workspace/materials/new-book-ocr', `${pageId}.meta.json`));
    }
    for (const sectionId of scope.sections) {
        paths.push(relativePath('workspace/materials/new-book-section-ocr', `${sectionId}.txt`));
        paths.push(relativePath('workspace/materials/new-book-section-ocr', `${sectionId}.meta.json`));
    }
    for (const filename of formulaCatalogs) {
        paths.push(relativePath('workspace/materials/formula-catalog', filename));
    }
    return sorted(paths);
}

function validateManifest(manifest, scope) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return { entries: [], expectedPaths: [] };
    if (manifest.schemaVersion !== 1) addError(MANIFEST_PATH, 'schemaVersion must be 1');
    if (!valuesEqual(manifest.chapters, [4, 5])) addError(MANIFEST_PATH, 'chapters must equal [4, 5]');

    validateExactList(manifest.sections, scope.sections, 'sections');
    validateExactList(manifest.pages, scope.pages, 'pages');

    const formulaCatalogs = Array.isArray(manifest.formulaCatalogs) ? manifest.formulaCatalogs : [];
    if (!Array.isArray(manifest.formulaCatalogs)) {
        addError(MANIFEST_PATH, 'formulaCatalogs must be an array');
    } else {
        const formulaPattern = /^[45](?:\.|$).+\.formulas\.json$/;
        for (const filename of formulaCatalogs) {
            if (typeof filename !== 'string' || !formulaPattern.test(filename) || filename.includes(' 2')) {
                addError(MANIFEST_PATH, `invalid formula catalog filename ${JSON.stringify(filename)}`);
            }
        }
        if (new Set(formulaCatalogs).size !== formulaCatalogs.length) {
            addError(MANIFEST_PATH, 'formulaCatalogs contains duplicates');
        }
        if (!valuesEqual(formulaCatalogs, sorted(formulaCatalogs))) {
            addError(MANIFEST_PATH, 'formulaCatalogs is not in deterministic natural order');
        }
        if (formulaCatalogs.length !== EXPECTED_COUNTS.formulaCatalogs) {
            addError(MANIFEST_PATH, `expected ${EXPECTED_COUNTS.formulaCatalogs} formula catalogs, found ${formulaCatalogs.length}`);
        }
    }

    if (!manifest.counts || typeof manifest.counts !== 'object' || Array.isArray(manifest.counts)) {
        addError(MANIFEST_PATH, 'counts must be an object');
    } else {
        for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
            if (manifest.counts[key] !== expected) {
                addError(MANIFEST_PATH, `counts.${key} must be ${expected}, found ${JSON.stringify(manifest.counts[key])}`);
            }
        }
    }

    const expectedPaths = expectedMaterialPaths(scope, formulaCatalogs);
    if (expectedPaths.length !== EXPECTED_COUNTS.materialFiles) {
        addError(MANIFEST_PATH, `derived material file count is ${expectedPaths.length}, expected ${EXPECTED_COUNTS.materialFiles}`);
    }

    const entries = Array.isArray(manifest.files) ? manifest.files : [];
    if (!Array.isArray(manifest.files)) addError(MANIFEST_PATH, 'files must be an array');
    const entryPaths = [];
    for (const [index, entry] of entries.entries()) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            addError(MANIFEST_PATH, `files[${index}] must be an object`);
            continue;
        }
        entryPaths.push(entry.path);
        if (typeof entry.path !== 'string' || entry.path.includes('\\') || entry.path.startsWith('/')
            || entry.path.split('/').includes('..')) {
            addError(MANIFEST_PATH, `files[${index}].path is not a safe repository-relative path`);
        }
        if (!Number.isInteger(entry.size) || entry.size <= 0) {
            addError(MANIFEST_PATH, `files[${index}].size must be a positive integer`);
        }
        if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
            addError(MANIFEST_PATH, `files[${index}].sha256 must be a lowercase SHA-256`);
        }
    }
    validateExactList(entryPaths, expectedPaths, 'files paths');
    return { entries, expectedPaths };
}

function validateManifestFiles(entries, expectedPaths) {
    const expectedSet = new Set(expectedPaths);
    for (const entry of entries) {
        if (!entry || typeof entry.path !== 'string' || !expectedSet.has(entry.path)) continue;
        let stat;
        try {
            stat = fs.lstatSync(absolutePath(entry.path));
        } catch (error) {
            addError(entry.path, `missing manifest file (${error.code || error.message})`);
            continue;
        }
        if (!stat.isFile() || stat.isSymbolicLink()) {
            addError(entry.path, 'must be a regular non-symlink file');
            continue;
        }
        if (stat.size !== entry.size) {
            addError(entry.path, `size is ${stat.size}, manifest requires ${entry.size}`);
        }
        const buffer = readBuffer(entry.path);
        if (buffer && sha256(buffer) !== entry.sha256) {
            addError(entry.path, 'SHA-256 differs from manifest');
        }
    }
}

function walkFiles(relativeDir) {
    const found = [];
    const pending = [relativeDir];
    while (pending.length) {
        const current = pending.pop();
        let entries;
        try {
            entries = fs.readdirSync(absolutePath(current), { withFileTypes: true });
        } catch (error) {
            addError(current, `cannot scan directory (${error.code || error.message})`);
            continue;
        }
        for (const entry of entries) {
            const relative = relativePath(current, entry.name);
            if (entry.isDirectory()) pending.push(relative);
            else found.push(relative);
        }
    }
    return sorted(found);
}

function hasBannedPath(relative) {
    return relative.split('/').some(component => (
        /(^|[._ -])(backup|debug|__pycache__)([._ -]|$)/i.test(component)
        || / 2(?:\.|$)/.test(component)
    ));
}

function isChapterCandidate(relativeDir, relative) {
    const filename = path.basename(relative);
    if (relativeDir.endsWith('new-book-pages') || relativeDir.endsWith('new-book-ocr')) {
        const match = filename.match(/^page-(\d+)/);
        if (!match) return false;
        const pageNumber = Number(match[1]);
        return pageNumber >= 330 && pageNumber <= 575;
    }
    return /^[45](?:[. -]|$)/.test(filename);
}

function validateUnexpectedFiles(expectedPaths) {
    const expectedSet = new Set(expectedPaths);
    for (const relativeDir of MATERIAL_DIRS) {
        for (const relative of walkFiles(relativeDir)) {
            if (hasBannedPath(relative)) {
                addError(relative, 'backup/debug/cache or duplicate-suffix file is forbidden');
                continue;
            }
            if (isChapterCandidate(relativeDir, relative) && !expectedSet.has(relative)) {
                addError(relative, 'Chapter 4-5 material is not present in the manifest allowlist');
            }
        }
    }
}

function validatePageMaterials(scope) {
    for (const pageId of scope.pages) {
        const imagePath = relativePath('workspace/materials/new-book-pages', `${pageId}.png`);
        const image = readBuffer(imagePath);
        if (image && (image.length < PNG_SIGNATURE.length
            || !image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE))) {
            addError(imagePath, 'invalid PNG signature');
        }

        const textPath = relativePath('workspace/materials/new-book-ocr', `${pageId}.txt`);
        const text = readText(textPath);
        if (text !== null && !text.trim()) addError(textPath, 'OCR text is empty');

        const metaPath = relativePath('workspace/materials/new-book-ocr', `${pageId}.meta.json`);
        const meta = readJson(metaPath);
        if (!meta || typeof meta !== 'object' || Array.isArray(meta)) continue;
        if (meta.book_page !== pageId) {
            addError(metaPath, `book_page must be ${pageId}, found ${JSON.stringify(meta.book_page)}`);
        }
        if (meta.chapter !== '4' && meta.chapter !== '5') {
            addError(metaPath, `chapter must be "4" or "5", found ${JSON.stringify(meta.chapter)}`);
        }
    }
}

function validateSectionMaterials(sectionMap, scope) {
    for (const sectionId of scope.sections) {
        const textPath = relativePath('workspace/materials/new-book-section-ocr', `${sectionId}.txt`);
        const text = readText(textPath);
        if (text !== null && !text.trim()) addError(textPath, 'section OCR text is empty');

        const metaPath = relativePath('workspace/materials/new-book-section-ocr', `${sectionId}.meta.json`);
        const meta = readJson(metaPath);
        if (!meta || typeof meta !== 'object' || Array.isArray(meta)) continue;
        if (meta.sectionId !== sectionId) {
            addError(metaPath, `sectionId must be ${sectionId}, found ${JSON.stringify(meta.sectionId)}`);
        }
        if (!valuesEqual(meta.sourcePages, sectionMap[sectionId])) {
            addError(metaPath, 'sourcePages differs from the primary section map');
        }
        if (!valuesEqual(meta.usedPages, sectionMap[sectionId])) {
            addError(metaPath, 'usedPages differs from the primary section map');
        }
        if (!Array.isArray(meta.missingPages) || meta.missingPages.length !== 0) {
            addError(metaPath, 'missingPages must be an empty array');
        }
    }
}

function increment(counter, key) {
    counter[key] = (counter[key] || 0) + 1;
}

function validateFormulaCatalogs(formulaCatalogs, scope) {
    const allowedPages = new Set(scope.pages);
    const allowedSections = new Set(scope.sections);
    const catalogStatuses = {};
    const formulaStatuses = {};
    let formulaCount = 0;

    for (const filename of formulaCatalogs) {
        const relative = relativePath('workspace/materials/formula-catalog', filename);
        const catalog = readJson(relative);
        if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) continue;
        const expectedSectionId = filename.replace(/\.formulas\.json$/, '');
        if (catalog.sectionId !== expectedSectionId) {
            addError(relative, `sectionId must be ${expectedSectionId}, found ${JSON.stringify(catalog.sectionId)}`);
        }
        if (!allowedSections.has(catalog.sectionId)) {
            addError(relative, `sectionId ${JSON.stringify(catalog.sectionId)} is outside the Chapter 4-5 map`);
        }
        if (typeof catalog.sectionTitle !== 'string' || !catalog.sectionTitle.trim()) {
            addError(relative, 'sectionTitle must be a non-empty string');
        }
        if (catalog.bookSource !== 'new') addError(relative, 'bookSource must be "new"');
        if (!ALLOWED_FORMULA_STATUSES.has(catalog.status)) {
            addError(relative, `unsupported catalog status ${JSON.stringify(catalog.status)}`);
        } else {
            increment(catalogStatuses, catalog.status);
        }

        const verificationPages = catalog.verification && catalog.verification.sourcePages;
        if (!Array.isArray(verificationPages) || verificationPages.length === 0) {
            addError(relative, 'verification.sourcePages must be a non-empty array');
        } else {
            for (const pageId of verificationPages) {
                if (!allowedPages.has(pageId)) {
                    addError(relative, `verification sourcePage ${JSON.stringify(pageId)} is outside the page allowlist`);
                }
            }
        }

        if (!Array.isArray(catalog.formulas) || catalog.formulas.length === 0) {
            addError(relative, 'formulas must be a non-empty array');
            continue;
        }
        for (const [index, formula] of catalog.formulas.entries()) {
            formulaCount += 1;
            const label = `${relative}#formulas[${index}]`;
            if (!formula || typeof formula !== 'object' || Array.isArray(formula)) {
                addError(label, 'formula must be an object');
                continue;
            }
            if (typeof formula.label !== 'string') {
                addError(label, 'label must be a string; use an empty string for an unnumbered formula');
            }
            for (const key of ['name', 'latex', 'sourcePage', 'role']) {
                if (typeof formula[key] !== 'string' || !formula[key].trim()) {
                    addError(label, `${key} must be a non-empty string`);
                }
            }
            if (!ALLOWED_FORMULA_STATUSES.has(formula.status)) {
                addError(label, `unsupported status ${JSON.stringify(formula.status)}`);
            } else {
                increment(formulaStatuses, formula.status);
            }
            if (!allowedPages.has(formula.sourcePage)) {
                addError(label, `sourcePage ${JSON.stringify(formula.sourcePage)} is outside the page allowlist`);
            }
        }
    }

    const actual = {
        formulas: formulaCount,
        verifiedCatalogs: catalogStatuses.verified || 0,
        draftCatalogs: catalogStatuses.draft_pdf_latex || 0,
        verifiedFormulas: formulaStatuses.verified || 0,
        draftFormulas: formulaStatuses.draft_pdf_latex || 0
    };
    for (const [key, value] of Object.entries(actual)) {
        if (value !== EXPECTED_COUNTS[key]) {
            addError('workspace/materials/formula-catalog', `${key} count is ${value}, expected ${EXPECTED_COUNTS[key]}`);
        }
    }
}

function main() {
    const manifest = readJson(MANIFEST_PATH);
    const sectionMap = readJson(MAP_PATHS[0]);
    const displayMap = readJson(MAP_PATHS[1]);
    const anchorMap = readJson(MAP_PATHS[2]);
    if (!manifest || !sectionMap || !displayMap || !anchorMap) {
        report();
        return;
    }

    const scope = deriveChapterScope(sectionMap);
    validateMaps(sectionMap, displayMap, anchorMap, scope, manifest);
    const { entries, expectedPaths } = validateManifest(manifest, scope);
    validateManifestFiles(entries, expectedPaths);
    validateUnexpectedFiles(expectedPaths);
    validatePageMaterials(scope);
    validateSectionMaterials(sectionMap, scope);
    validateFormulaCatalogs(manifest.formulaCatalogs || [], scope);
    report();
}

function report() {
    if (errors.length) {
        console.error(`[chapter-materials] FAIL - ${errors.length} error(s)`);
        for (const error of errors) console.error(`  - ${error}`);
        process.exitCode = 1;
        return;
    }
    console.log('[chapter-materials] PASS');
    console.log('  sections: 83 (Chapter 4: 49, Chapter 5: 34)');
    console.log('  pages: 226');
    console.log('  material files: 876');
    console.log('  formula catalogs: 32 (27 verified, 5 draft_pdf_latex)');
    console.log('  formulas: 85 (76 verified, 9 draft_pdf_latex)');
}

try {
    main();
} catch (error) {
    console.error(`[chapter-materials] FAIL - unexpected validator error: ${error.stack || error.message}`);
    process.exitCode = 1;
}
