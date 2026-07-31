#!/usr/bin/env node
/**
 * Tutor Agent Bridge
 *
 * 保留旧接口 /api/tutor
 * 新增学习问答接口 /api/ask
 * 静态书页图片路由 /pages/:filename
 *
 * 约束：仅使用 Node.js 内置模块
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

function loadLocalEnvFile() {
    try {
        const envPath = path.join(__dirname, '.env');
        if (!fs.existsSync(envPath)) return;
        const raw = fs.readFileSync(envPath, 'utf8');
        raw.split(/\r?\n/).forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex === -1) return;
            const key = trimmed.slice(0, eqIndex).trim();
            if (!key || process.env[key]) return;
            let value = trimmed.slice(eqIndex + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        });
    } catch (err) {
        console.warn('[env] failed to load local .env:', err.message);
    }
}

loadLocalEnvFile();

const HTTP_PORT = process.env.PORT || 9000;
const APP_NAME = 'Tutor Agent';
const APP_URL = `http://localhost:${HTTP_PORT}`;
const MAX_JSON_BODY_BYTES = Number(process.env.TUTOR_MAX_JSON_BODY_BYTES || 35 * 1024 * 1024);
const PDF_TEXT_MAX_CHARS = Number(process.env.TUTOR_PDF_TEXT_MAX_CHARS || 120000);
const PDF_VISUAL_PAGE_LIMIT = Number(process.env.TUTOR_PDF_VISUAL_PAGE_LIMIT || 3);

// ── Server-side identity (07-05 user-db-auth-sessions task) ─────────────────
// Route classes and the enforcement model live in
// .trellis/tasks/07-05-user-db-auth-sessions/design.md §2.
//
// TUTOR_REQUIRE_AUTH=1 (Render prod only) makes uid-scoped and LLM-spending
// routes reject tokenless requests with 401. With the flag unset (local dev,
// all test harnesses) nothing is rejected — but guards still verify
// opportunistically: whenever a valid `Authorization: Bearer` token is
// presented, uid comes from the token's `sub` and client-supplied uid
// params/body fields are ignored, in EVERY route class.
const REQUIRE_AUTH = process.env.TUTOR_REQUIRE_AUTH === '1';
// Single source of truth for the Clerk config + allowed-origin list: env
// vars (loaded above) with dev-instance defaults, dependency-injected into
// clerk-verify.js, which itself reads no env and holds no defaults.
const CLERK_AUTHORIZED_PARTIES = String(process.env.CLERK_AUTHORIZED_PARTIES
    || 'https://fourier-tutor.vercel.app,https://aquarius-seven.vercel.app,http://localhost:9000,http://127.0.0.1:9000')
    .split(',').map(s => s.trim()).filter(Boolean);
// Vercel preview deploys get a rotating hostname:
//   https://fourier-<deploy-hash>-mrparameciums-projects.vercel.app
// The <deploy-hash> changes every push, so a preview can never be an exact
// CLERK_AUTHORIZED_PARTIES entry. Anchor on BOTH the project ("fourier-") and
// the team scope ("-mrparameciums-projects") so ONLY our own previews match —
// not arbitrary *.vercel.app sites, nor another team's "fourier" project. This
// lives in code (not the env var) on purpose: previews then work with no Render
// env edit, just a backend redeploy. Branch previews (fourier-git-<branch>-…)
// match the same pattern for free.
const VERCEL_PREVIEW_ORIGIN_RE =
    /^https:\/\/fourier-[a-z0-9-]+-mrparameciums-projects\.vercel\.app$/;
// Single origin gate shared by CORS reflection (setCORSHeaders) and the Clerk
// azp check (injected into clerk-verify.js), so both stay consistent.
const isAllowedOrigin = (origin) =>
    !!origin && (CLERK_AUTHORIZED_PARTIES.includes(origin) || VERCEL_PREVIEW_ORIGIN_RE.test(origin));
const CLERK_JWKS_URL = process.env.CLERK_JWKS_URL
    || 'https://driven-troll-28.clerk.accounts.dev/.well-known/jwks.json';
const CLERK_ISSUER = process.env.CLERK_ISSUER
    || 'https://driven-troll-28.clerk.accounts.dev';
const { verifyClerkToken, warmUp: warmUpClerkVerify } = require('./clerk-verify')({
    httpRequestJson, // function declaration below — hoisted, same pattern as the llm-client require
    jwksUrl: CLERK_JWKS_URL,
    issuer: CLERK_ISSUER,
    isAuthorizedParty: isAllowedOrigin,
});

// Resolves the request's verified identity: {uid, sid} when a valid Bearer
// token is presented, else null. Callers never need to distinguish an
// invalid token from a missing one: both 401 on guarded routes under
// enforcement, and both fall back to legacy uid-param behavior without it.
async function resolveAuth(req) {
    const header = String((req.headers && req.headers['authorization']) || '');
    const m = /^Bearer\s+(.+)$/i.exec(header);
    return m ? verifyClerkToken(m[1]) : null;
}

function send401(res) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
}

function resolveBinary(candidates = []) {
    for (const candidate of candidates) {
        if (!candidate) continue;
        if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
        if (!candidate.includes('/')) return candidate;
    }
    return candidates[0] || '';
}

const PDFTOTEXT_BIN = resolveBinary([
    process.env.PDFTOTEXT_BIN,
    '/opt/homebrew/bin/pdftotext',
    '/usr/local/bin/pdftotext',
    '/usr/bin/pdftotext',
    'pdftotext'
]);
const PDFTOPPM_BIN = resolveBinary([
    process.env.PDFTOPPM_BIN,
    '/opt/homebrew/bin/pdftoppm',
    '/usr/local/bin/pdftoppm',
    '/usr/bin/pdftoppm',
    'pdftoppm'
]);

function resolveExistingDir(candidates, label, validator = null) {
    for (const candidate of candidates) {
        if (!candidate || !fs.existsSync(candidate)) continue;
        if (typeof validator === 'function' && !validator(candidate)) continue;
        return candidate;
    }
    throw new Error(`[PathConfig] Missing ${label}. Tried: ${candidates.join(', ')}`);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TUTOR_MATERIALS_DIR = resolveExistingDir([
    path.join(PROJECT_ROOT, 'workspace', 'materials'),
    path.join(PROJECT_ROOT, 'materials')
], 'materials directory', (candidate) => {
    return fs.existsSync(path.join(candidate, 'new-book-ocr'));
});

const OCR_DIR_NEW = path.join(TUTOR_MATERIALS_DIR, 'new-book-ocr');
const SECTION_OCR_DIR_NEW = path.join(TUTOR_MATERIALS_DIR, 'new-book-section-ocr');
const PAGE_IMAGE_DIR_NEW = path.join(TUTOR_MATERIALS_DIR, 'new-book-pages');
const FIGURE_IMAGE_DIR_NEW = path.join(TUTOR_MATERIALS_DIR, 'new-book-figures');
const PYTHON_BIN = process.env.TUTOR_PYTHON_BIN || '/Library/Frameworks/Python.framework/Versions/3.12/bin/python3';

// Helper: resolve dirs (single-book — 2nd Edition was retired 2026-06-19)
function getBookDirs(_bookSource) {
    return { ocrDir: OCR_DIR_NEW, pageImageDir: PAGE_IMAGE_DIR_NEW };
}

function getPageImageUrl(_bookSource, pageImage) {
    const filename = path.basename(String(pageImage || ''));
    if (!filename) return '';
    return `/new-pages/${filename}`;
}

function resolveHomePath(p) {
    if (!p || typeof p !== 'string') return p;
    if (p === '~') return os.homedir();
    if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
    return p;
}

const SKILL_SCRIPT = resolveHomePath(
    process.env.TUTOR_SKILL_SCRIPT || '~/.agents/skills/image-animation-generation/scripts/gen_image.py'
);
const MATPLOTLIB_GEN = path.join(__dirname, 'matplotlib_gen.py');
const GENERATED_DIR = path.join(__dirname, 'generated');
try { if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true }); } catch (_) {}
const DEBUG_DIR = path.join(__dirname, 'debug');
try { if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true }); } catch (_) {}

const { processEmbeddedPython, normalizePythonCode } = require('./process-python.js');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.txt': 'text/plain; charset=utf-8'
};

const { handleStaticRoute } = require('./static-routes')({
    mimeTypes: MIME_TYPES,
    generatedDir: GENERATED_DIR,
    pageImageDirNew: PAGE_IMAGE_DIR_NEW,
    tutorMaterialsDir: TUTOR_MATERIALS_DIR,
    appDir: __dirname,
});

// CORS is decided per route class (design §2 review M10): /api/* + /health
// reflect an allowlisted Origin (required once requests carry Authorization
// headers — a wildcard would either leak or break them), while public static
// assets keep the permissive wildcard. `Vary: Origin` accompanies every
// reflected response so shared caches never serve one origin's CORS headers
// to another. Requests with no Origin header (same-origin, curl) need no
// ACAO; disallowed origins simply get no ACAO and the browser blocks them.
function setCORSHeaders(res, pathname, requestOrigin) {
    const isApiRoute = String(pathname || '').startsWith('/api/') || pathname === '/health';
    if (!isApiRoute) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return;
    }
    // Vary: Origin on EVERY API response (not just reflected ones) so a
    // shared cache never serves a no-ACAO variant to an allowlisted origin
    // or vice versa.
    res.setHeader('Vary', 'Origin');
    const origin = String(requestOrigin || '');
    if (isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function safeReadJSON(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        console.warn('[Index] Failed to read JSON:', filePath, err.message);
        return null;
    }
}

function titleCase(value) {
    if (!value) return '';
    return String(value)
        .split(/\s+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function writeDebugFile(filename, content) {
    try {
        fs.writeFileSync(path.join(DEBUG_DIR, filename), String(content || ''), 'utf8');
    } catch (err) {
        console.warn('[debug] failed to write debug file:', filename, err.message);
    }
}

function formatAgentABlockForPreview(block, index) {
    if (!block || typeof block !== 'object') return `### Block ${index + 1}\n\nInvalid block\n`;
    const lines = [`### Block ${index + 1}: \`${block.type || 'unknown'}\``];
    const entries = Object.entries(block).filter(([key]) => key !== 'type');
    for (const [key, value] of entries) {
        if (value == null || value === '') continue;
        if (typeof value === 'string') {
            lines.push(`- **${key}**: ${value}`);
            continue;
        }
        lines.push(`- **${key}**:`);
        lines.push('```json');
        lines.push(JSON.stringify(value, null, 2));
        lines.push('```');
    }
    return `${lines.join('\n')}\n`;
}

function buildAgentAPreviewMarkdown(blueprint, raw = '') {
    if (!blueprint || typeof blueprint !== 'object') return raw || '';
    const lines = [
        `# Agent A Preview: ${blueprint.section_id || ''} ${blueprint.section_title || ''}`.trim(),
        '',
        `- Difficulty: ${blueprint.difficulty || 'unknown'}`,
        `- Estimated read minutes: ${blueprint.estimated_read_minutes || 'unknown'}`,
        ''
    ];

    if (Array.isArray(blueprint.learning_objectives) && blueprint.learning_objectives.length) {
        lines.push('## Learning Objectives', '');
        blueprint.learning_objectives.forEach((item) => lines.push(`- ${item}`));
        lines.push('');
    }

    if (blueprint.visualization_need) {
        lines.push('## Visualization Need', '', '```json', JSON.stringify(blueprint.visualization_need, null, 2), '```', '');
    }

    if (blueprint.visual_plan) {
        lines.push('## Visual Plan', '', '```json', JSON.stringify(blueprint.visual_plan, null, 2), '```', '');
    }

    if (Array.isArray(blueprint.blocks) && blueprint.blocks.length) {
        lines.push('## Planned Blocks', '');
        blueprint.blocks.forEach((block, index) => {
            lines.push(formatAgentABlockForPreview(block, index));
        });
    }

    if (raw) {
        lines.push('## Raw JSON', '', '```json', raw, '```', '');
    }

    return lines.join('\n');
}

function hasStudentFacingVisualBlock(blueprint) {
    if (!blueprint || !Array.isArray(blueprint.blocks)) return false;
    return blueprint.blocks.some((block) => {
        const type = String(block && block.type || '');
        return type === 'book_image' || type === 'web_search_image' || type === 'generate_image' || type === 'interactive_demo';
    });
}

function normalizeVisualPurposeKey(value = '') {
    return compactWhitespace(String(value || ''))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function getVisualPurposeKey(block = null) {
    if (!block || typeof block !== 'object') return '';
    const candidates = [
        block.purpose,
        block.reason,
        block.search_query,
        block.prompt,
        block.caption_instruction,
        block.caption,
        block.explanation_instruction,
        block.instruction,
        block.title
    ];
    for (const candidate of candidates) {
        const key = normalizeVisualPurposeKey(candidate);
        if (key) return key;
    }
    return '';
}

function isReadyMadeImageVisualBlock(block = null) {
    const type = String(block && block.type || '');
    return type === 'book_image' || type === 'web_search_image';
}

function buildComplexPlaneInteractiveDemoBlock(sectionId = '', sectionTitle = '') {
    return {
        type: 'interactive_demo',
        title: 'Drag the complex number',
        content: 'Move the real and imaginary components. Watch the same point become rectangular form, magnitude, and angle.',
        explanation: 'This demo links coordinates to polar form and quadrant-safe phase.',
        teaching_role: 'interactive_demo',
        demo_spec: {
            framework: 'react_canvas',
            panels: [
                { id: 'phasor_panel', title: 'Complex plane' },
                { id: 'wave_panel', title: 'Equivalent phase view' }
            ],
            controls: [
                { id: 'slider_a', label: 'a', min: -5, max: 5, step: 0.1, default: 3 },
                { id: 'slider_b', label: 'b', min: -5, max: 5, step: 0.1, default: 4 },
                { id: 'angle_toggle', label: 'angle units', options: ['degrees', 'radians'], default: 'degrees' },
                { id: 'reset_demo', label: 'Reset', action: 'set defaults' }
            ]
        },
        section_id: sectionId,
        section_title: sectionTitle
    };
}

function ensureRequiredInteractiveDemoBlocks(blueprint, sectionId = '', sectionTitle = '') {
    if (!blueprint || !Array.isArray(blueprint.blocks)) return blueprint;
    const sid = compactWhitespace(sectionId || blueprint.section_id || '').toLowerCase();
    const title = compactWhitespace(sectionTitle || blueprint.section_title || '').toLowerCase();
    const needsComplexPlaneDemo = sid === 'b.1-2'
        || /complex numbers|complex plane|polar|exponential form|phasor/.test(title);
    if (!needsComplexPlaneDemo) return blueprint;

    const hasInteractiveDemo = blueprint.blocks.some((block) => String(block && block.type || '') === 'interactive_demo');
    if (hasInteractiveDemo) return blueprint;

    const insertAt = Math.min(blueprint.blocks.length, Math.max(2, blueprint.blocks.findIndex(b => String(b && b.type || '') === 'section_summary')));
    const block = buildComplexPlaneInteractiveDemoBlock(sectionId, sectionTitle);
    if (insertAt >= 2 && insertAt < blueprint.blocks.length) blueprint.blocks.splice(insertAt, 0, block);
    else blueprint.blocks.splice(Math.min(blueprint.blocks.length, 4), 0, block);

    if (!blueprint.visual_plan) blueprint.visual_plan = {};
    blueprint.visual_plan.primary_anchor = blueprint.visual_plan.primary_anchor || 'both';
    blueprint.visual_plan.rationale = blueprint.visual_plan.rationale || 'Use textbook figures and an interactive complex-plane demo so formulas stay tied to geometry.';
    return blueprint;
}

function pruneForbiddenGenerateImageBlocks(blueprint) {
    if (!blueprint || !Array.isArray(blueprint.blocks)) return blueprint;

    const seenReadyMadeImagePurposes = new Set();
    for (const block of blueprint.blocks) {
        if (!isReadyMadeImageVisualBlock(block)) continue;
        const key = getVisualPurposeKey(block);
        if (key) seenReadyMadeImagePurposes.add(key);
    }

    let hasBookImage = blueprint.blocks.some(block => String(block && block.type || '') === 'book_image');
    let hasWebSearchImage = blueprint.blocks.some(block => String(block && block.type || '') === 'web_search_image');

    blueprint.blocks = blueprint.blocks.filter((block) => {
        if (!block || block.type !== 'generate_image') return true;

        const key = getVisualPurposeKey(block);
        const duplicatedPurpose = key && seenReadyMadeImagePurposes.has(key);
        const readyMadeImageAlternativeExists = duplicatedPurpose || hasBookImage || hasWebSearchImage;
        if (!readyMadeImageAlternativeExists) return true;

        console.log(`[Agent A] Pruned forbidden generate_image block for ${blueprint.section_id || 'unknown'} because a ready-made image asset already exists.`);
        return false;
    });

    if (blueprint.visual_plan && blueprint.visual_plan.primary_anchor === 'generated_image') {
        if (hasBookImage) blueprint.visual_plan.primary_anchor = 'book_figure';
        else if (hasWebSearchImage) blueprint.visual_plan.primary_anchor = 'wiki_reference';
    }

    return blueprint;
}

// SYNC: keep identical to app.js compactWhitespace.
// Node/browser split keeps two copies; drift risk is real but tolerated.
function compactWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

const LESSON_GENERATION_RULES_TEXT = `
NON-NEGOTIABLE LESSON RULES:
1. The first lesson page must be minimal. It may contain only:
   - one short "Section Objective"
   - one short concept list for "Concepts In This Section"
   Do NOT add expanded introductory paragraphs, long background explanation, or multiple overview sections on the first page.
   In "Concepts In This Section", list concept names only, not explanations. Good examples: "zero matrix", "diagonal matrix", "identity matrix", "transpose". Bad examples: "diagonal means off-diagonal entries are zero".
2. If a section introduces two distinct concepts that students must not confuse (for example diagonal matrix vs identity matrix), do NOT merge them into one visual explanation block. Split them into separate concept blocks and give each concept its own dedicated visual/example.
3. For abstract definition pages, do not stop at the definition alone. Add one minimal concrete example immediately after the definition, before exam tips or triggers.
4. Keep every page focused on exactly one major knowledge point. One page, one main idea, one clear reading path.
5. Visuals should help distinction, not decoration. When two concepts differ by a subtle condition, the visuals must make that difference explicit.
6. GPTImage2 is a last-resort visual tool only. Prefer, in order:
   - textbook figure when available
   - Wikipedia / Wikimedia reference image when it accurately demonstrates the concept
   - LaTeX / equation-native visual when the concept is best shown through clean symbolic structure
   - interactive demo when the concept depends on manipulation, variation, or parameter change
   Use GPTImage2 only if those options cannot accurately demonstrate the idea.
7. If GPTImage2 is used, one image must teach exactly one knowledge point. Do not combine multiple concepts, multiple subtopics, or a collage of ideas into one teaching image.
8. Whenever a lesson is regenerated or rewritten, regenerate the quiz_plan too. Never keep an old quiz block attached to a newly rewritten lesson body. The assessment must match the latest explanation pages and concept ordering.
9. Never substitute a manually written low-quality draft, shortcut cache edit, or partial fallback as if it were the standard Agent A -> Agent B generated lesson. If the normal generation chain fails, is bypassed, or produces unusable output, report that failure explicitly instead of pretending a hand-written substitute is the proper generated result.
10. If Agent A fails, stop the generation chain immediately and surface the Agent A failure to the user. Do not continue into fallback blueprint synthesis, external blueprint loading, or Agent B execution after an Agent A failure.
11. If a ready-made image asset is available for a knowledge point — textbook figure or Wikipedia/Wikimedia reference image — then GPTImage2 / generate_image is forbidden for that knowledge point. Do not use GPTImage2 as a cleaner remake, stylistic replacement, or duplicated version of an already-available image asset.
12. Every section summary under "📌 Key Takeaways" must include the section's core formulas explicitly. Do not summarize formulas away into prose only. Preserve the key equations, identities, conversions, or symbolic rules that a student would need for review.
13. Do not create a formula dump page. Never group all section formulas at the top and then explain them later. Each key formula must appear concept-local: short context first, then a standalone display LaTeX formula, then symbol meaning / use case / exam trigger / common misuse.
13a. Display formulas must use the B.2-1 lecture-note style: large, centered, one readable equation per display block. Do not output aligned/gathered environments or \\[4pt] chains for ordinary formula lists; split them into separate display blocks so no horizontal scrolling is needed.
14. "Concise" means no filler, not no teaching. Each major knowledge page must still contain enough explanation to learn from: normally 80-160 words of supporting explanation around the formula, plus at least one minimal example, near-miss, or trap when the concept is exam-relevant.
15. Textbook-numbered equations such as "(B.16)" are high-priority formula signals. If OCR shows an equation label like (B.16), treat that equation as a likely key formula: preserve the label when useful, teach it locally, and consider it for the final summary.
16. Key Takeaways must be complete but selective: include all numbered/canonical/exam-trigger formulas and core conceptual conclusions, but exclude worked-example intermediate calculations and low-value algebra steps.
17. When verified_canonical_formulas are provided, they override OCR rendering for those formulas. Use their exact LaTeX and labels, and do not invent conflicting variants from lossy OCR.
`;

const VISUAL_SELECTION_DECISION_LADDER = `
VISUAL SELECTION DECISION LADDER:
A. Use a textbook figure first when the book already contains the canonical diagram, notation, or exam-facing representation the student is expected to recognize.
B. Use Wikipedia / Wikimedia reference images when the concept is best explained by a real canonical static visual reference, such as:
   - standard coordinate-plane illustrations
   - complex-plane / phasor / geometry visuals
   - well-known signal shapes or system diagrams
   - historical / standard scientific diagrams that are already clean and accurate
C. Use LaTeX-native visuals instead of GPTImage2 when the core object is symbolic, structural, or matrix-based, such as:
   - matrix forms (zero, diagonal, identity, symmetric, transpose, equality)
   - equations, transforms, summations, determinants
   - entry-wise comparisons
   - piecewise symbolic structures
   If the student mainly needs to read exact symbols and positions, LaTeX is preferred.
D. Use an interactive demo when understanding depends on changing parameters or testing validity, such as:
   - conformability of matrix multiplication
   - time shift / scaling / reflection
   - parameter-driven geometry or signal changes
   - cases where the student benefits from seeing what changes and what stays invariant
E. Use GPTImage2 only when all other routes are insufficient, for example:
   - a custom pedagogical image is required for one specific concept
   - no accurate textbook / wiki / LaTeX / interactive-demo route can show the concept well
   - if a ready-made textbook / Wikipedia / Wikimedia image is already available, GPTImage2 must not be used
F. Never choose GPTImage2 for a concept that can already be shown more precisely with LaTeX or a simple interactive demo.
G. For paired concepts that are easily confused, prefer separate visuals over one combined visual unless the entire teaching goal is comparison.
H. Never make a GPTImage2 collage, dashboard, or multi-idea poster. One GPTImage2 image = one knowledge point only.
`;

const AGENT_A_RULES_APPENDIX = `
PLANNING OVERRIDES:
- Plan the overview page as a compact outline only.
- When concept pairs are easily confused, allocate separate blocks and separate student-facing visuals.
- If a knowledge point is primarily definitional, reserve room for one minimal worked example in the execution stage.
- If a textbook figure is chosen for a knowledge point, keep that figure on the same page as the explanation it supports. Do not strand the figure on the overview while the real explanation appears later.
- Treat generate_image / GPTImage2 as the weakest visual option. Plan it only when textbook figures, wiki/wikimedia references, LaTeX-native visuals, and interactive demos are not accurate enough for the teaching goal.
- If a textbook figure or wiki/wikimedia reference image is available, do not plan generate_image for the same knowledge point. GPTImage2 is not allowed as a prettier remake of an already-available image asset.
- For matrix definitions and equation-structure concepts, default to LaTeX-native visuals first.
- For parameter-sensitive concepts, default to interactive demos first.
- For canonical static diagrams already well represented in public references, default to textbook or wiki/wikimedia first.
- If generate_image is unavoidable, scope each generated image to one concept only. Never ask one generated image to explain multiple ideas at once.
- If you cannot produce a valid planning result, fail clearly. Do not rely on hidden downstream fallback behavior.
- Plan the final "📌 Key Takeaways" so it includes a compact but explicit list of the section's core formulas, not just verbal summaries.
- Plan formulas in a B.2-1-style lecture-note rhythm: introduce the concept, show the formula as a standalone LaTeX block, explain the symbols and use case, then add a short example or trap. Do not plan a top-of-page formula bank.
- Treat textbook equation labels like (B.16) as "key formula" markers. Prefer including those formulas in math_block pages and in the final summary when they are central to the section.
- Do not over-compress teaching text. Remove filler, but preserve enough words for a student to understand why the formula works and when to use it.
`;

const AGENT_B_RULES_APPENDIX = `
WRITING OVERRIDES:
- Page 1 must stay compact: one short objective + one short concept list only.
- Do not write long introductory prose on the overview page.
- If two concepts are distinct but adjacent, render them as separate sub-blocks with separate visuals/examples.
- For definition-heavy pages, always include one minimal example right after the definition and before any "Exam Trigger" or summary coaching.
- Favor short, exam-relevant wording over long narrative explanation.
- Keep each textbook figure on the same knowledge-point page as the explanation it teaches. If a figure explains a later concept, move it with that concept instead of leaving it near the overview.
- When executing visuals, prefer textbook / wiki / LaTeX / interactive-demo routes first. Use GPTImage2 only as the final fallback when those routes cannot accurately show the concept.
- If a textbook figure or wiki/wikimedia reference image already exists for the same knowledge point, do not execute GPTImage2 for that same image job.
- If the concept is mostly symbolic, choose precision over prettiness.
- If the concept is mostly about change, choose interaction over static illustration.
- If GPTImage2 is used, the prompt must target one concept only. No combined-concept teaching posters, no multi-panel concept bundles, no idea collages.
- In the section summary, preserve the most exam-sensitive symbolic detail from the section when one exists. Do not compress away sign-sensitive facts such as "sqrt(-1) = ±j".
- In every section summary, list the core formulas explicitly as formula bullets. Do not replace the formulas with prose-only paraphrases.
- Never execute a "formula dump" where all formulas appear before the real teaching. Keep each formula next to the concept it teaches.
- Around every important formula, provide enough explanation to be useful: what it means, what the symbols represent, when to use it, one short example or trap if applicable.
- If OCR or the blueprint includes textbook equation labels such as "(B.16)", preserve the important labels when helpful and make sure those labeled formulas are considered for Key Takeaways.
- Key Takeaways should include all key formulas and core concept rules, but should not include every worked-example calculation step.
`;

function escapeHtmlAttr(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeHtmlInline(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function persistDataImageUrl(dataUrl) {
    const match = String(dataUrl || '').match(/^data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!match) return null;

    const rawType = match[1].toLowerCase();
    const base64 = match[2].replace(/\s+/g, '');
    const extMap = {
        'jpeg': 'jpg',
        'jpg': 'jpg',
        'png': 'png',
        'webp': 'webp',
        'gif': 'gif',
        'svg+xml': 'svg'
    };
    const ext = extMap[rawType] || 'png';
    const filename = `gptimage2-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const targetPath = path.join(GENERATED_DIR, filename);
    fs.writeFileSync(targetPath, Buffer.from(base64, 'base64'));
    return `/generated/${filename}`;
}

function extractRenderableImageUrls(output) {
    const text = String(output || '');
    const candidates = [];

    const markdownImageRegex = /!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)\s]+|\/generated\/[^)\s]+)\)/gi;
    let match;
    while ((match = markdownImageRegex.exec(text)) !== null) {
        candidates.push(match[1]);
    }

    const rawHttpRegex = /https?:\/\/[^\s)"']+/gi;
    while ((match = rawHttpRegex.exec(text)) !== null) {
        candidates.push(match[0]);
    }

    const rawDataUrlRegex = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/gi;
    while ((match = rawDataUrlRegex.exec(text)) !== null) {
        candidates.push(match[0]);
    }

    const resolved = [];
    for (const src of candidates) {
        let finalSrc = String(src || '').trim();
        if (!finalSrc) continue;
        if (finalSrc.startsWith('data:image/')) {
            try {
                finalSrc = persistDataImageUrl(finalSrc) || '';
            } catch (err) {
                console.warn('[ImageExtract] Failed to persist data URL image:', err.message);
                finalSrc = '';
            }
        }
        if (!finalSrc) continue;
        if (!resolved.includes(finalSrc)) resolved.push(finalSrc);
    }

    return resolved;
}

function stripDiagramFallbackBlocks(markdown) {
    let text = String(markdown || '');
    if (!text) return text;

    text = text.replace(/```[\s\S]*?[┌┐└┘│─►←↓↑][\s\S]*?```/g, '');
    text = text.replace(/(?:^|\n)##*\s*(?:Teaching|Pipeline|Visual) Diagram[\s\S]*?(?=\n##\s|\n---\n|$)/gi, '\n');
    text = text.replace(/(?:^|\n)\|[^\n]*\|\n\|(?:\s*:?-+:?\s*\|)+\n(?:\|[^\n]*\|\n){1,12}/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return text;
}

function convertLegacyQuickCheckToKcBlocks(markdown) {
    const src = String(markdown || '');
    const quickCheckRegex = /(?:^|\n)---\s*\n\*\*✏️ Quick Check\*\*\s*\n\s*([\s\S]*?)\n\s*<details><summary>Show answer<\/summary>\s*\n\s*\*\*Answer:\*\*\s*([\s\S]*?)\n\s*(?:\*Hint:\s*([\s\S]*?)\*)?\s*\n\s*<\/details>/g;

    return src.replace(quickCheckRegex, (_match, question, answer, hint) => {
        const q = compactWhitespace(question);
        const a = compactWhitespace(answer);
        const h = compactWhitespace(hint || '');
        const kcHtml = `<div class="kc-container" data-question="${escapeHtmlAttr(q)}" data-answer="${escapeHtmlAttr(a)}" data-hint="${escapeHtmlAttr(h)}" style="display:none;"></div>`;
        return `\n---\n%%KC_BLOCK%%${kcHtml}%%KC_END%%\n`;
    });
}

function hasVisualMetadataMarkup(markdown) {
    const src = String(markdown || '');
    return src.includes('kc-visual-plan') || src.includes('kc-visual-meta');
}

function normalizeFigureId(value) {
    return compactWhitespace(value || '')
        .toLowerCase()
        .replace(/[（）()\[\]{}]/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function splitDisplayMathForLectureNotes(inner = '') {
    const raw = String(inner || '').trim();
    if (!raw) return [];

    const stripLineSpacing = (value) => String(value || '')
        .replace(/^(?:\\\\|\\)\s*\[\s*-?\d+(?:\.\d+)?(?:pt|em|ex|mm|cm|in|pc|px)\s*\]\s*/g, '')
        .replace(/\s*(?:\\\\|\\)\s*\[\s*-?\d+(?:\.\d+)?(?:pt|em|ex|mm|cm|in|pc|px)\s*\]$/g, '')
        .trim();

    let body = stripLineSpacing(raw);
    body = body.replace(/\s*\\qquad\s*(\\text\{\([A-Za-z]?\.\d+\)\})/g, ' \\quad $1');

    const hasDisplayLineBreak = /\\\\(?:\[[^\]]+\])?/.test(body);
    const hasSimpleLineEnv = /\\begin\{(?:aligned|gathered)\}/.test(body);
    if (!hasDisplayLineBreak && !hasSimpleLineEnv) {
        const stripParts = body
            .split(/\s*,?\s*\\qquad\s*/g)
            .map(part => stripLineSpacing(part).replace(/&/g, '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        const equationParts = stripParts.filter(part => /(?:=|\\operatorname\{(?:Re|Im)\})/.test(part));
        if (stripParts.length > 1 && equationParts.length >= 1) return stripParts;
        return [body];
    }

    body = body
        .replace(/\\begin\{(?:aligned|gathered)\}/g, '')
        .replace(/\\end\{(?:aligned|gathered)\}/g, '')
        .trim();

    const parts = body
        .split(/\\\\(?:\[[^\]]+\])?/)
        .map(part => stripLineSpacing(part).replace(/&/g, '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    return parts.length ? parts : [raw];
}

function normalizeMathMarkdown(markdown) {
    let src = String(markdown || '');
    if (!src) return src;

    src = src
        .replace(/\\qquad\s*(\\text\{\([A-Za-z]?\.\d+\)\})/g, '\\quad $1')
        .replace(/\\qquad/g, '\\quad')
        .replace(/\\\\\(/g, '\\(')
        .replace(/\\\\\)/g, '\\)')
        .replace(/\\\\\[(?!\s*\d+(?:\.\d+)?(?:pt|em|ex|mm|cm|in|pc|px)\])/g, '\\[')
        .replace(/\\\\\]/g, '\\]')
        .replace(/(^|\n)\s*\\\[\s*([^\n]+?)\s*\\\]\s*(?=\n|$)/g, '$1$$\n$2\n$$')
        .replace(/(^|\n)\s*\\\[\s*(?=\n)/g, '$1$$\n')
        .replace(/(^|\n)\s*\\\]\s*(?=\n|$)/g, '$1$$')
        .replace(/\\[ \t]+\(/g, '\\(')
        .replace(/\\[ \t]+\)/g, '\\)')
        .replace(/\\[ \t]+\[/g, '\\[')
        .replace(/\\[ \t]+\]/g, '\\]');

    src = src.replace(/\$\$([\s\S]*?)\$\$/g, (_match, inner) => {
        const fixedInner = String(inner || '');
        if (/\\begin\{(?:array|cases|matrix|bmatrix|pmatrix|vmatrix|Vmatrix|split|align\*?)\}/.test(fixedInner)) {
            return `$$${fixedInner}$$`;
        }
        const displayLines = splitDisplayMathForLectureNotes(fixedInner);
        return displayLines.map(line => `$$${line}$$`).join('\n\n');
    });

    src = src.replace(/(?<!\$)\$(?!\$)([^\n$]+?)(?<!\$)\$(?!\$)/g, (_m, expr) => {
        const inner = String(expr || '').trim();
        if (!inner) return _m;
        return `\\(${inner}\\)`;
    });

    // Normalize broken model output where display math is emitted as a single "$" line,
    // followed by latex content, then another single "$" line.
    src = src.replace(/(^|\n)\s*\$\s*\n([\s\S]*?)\n\s*\$\s*(?=\n|$)/g, (_m, lead, body) => {
        const inner = String(body || '').trim();
        if (!inner) return `${lead}$$\n$$`;
        return `${lead}$$\n${inner}\n$$`;
    });

    // Repair common malformed inline latex missing the leading backslash after JSON / model cleanup.
    src = src
        .replace(/(^|[^\w\\])theta(?=[^a-zA-Z]|$)/g, '$1\\\\theta')
        .replace(/(^|[^\w\\])lambda(?=[^a-zA-Z]|$)/g, '$1\\\\lambda')
        .replace(/(^|[^\w\\])cos(?=\s*\\theta|\s*\(|[^a-zA-Z]|$)/g, '$1\\\\cos')
        .replace(/(^|[^\w\\])sin(?=\s*\\theta|\s*\(|[^a-zA-Z]|$)/g, '$1\\\\sin')
        .replace(/(^|[^\w\\])tan(?=\s*\\theta|\s*\(|[^a-zA-Z]|$)/g, '$1\\\\tan')
        .replace(/(^|[^\w\\])sqrt(?=\s*\{|\s*\(|[^a-zA-Z]|$)/g, '$1\\\\sqrt')
        .replace(/(^|[^\w\\])quad(?=[^a-zA-Z]|$)/g, '$1\\\\quad')
        .replace(/(^|[^\w\\])operatorname(?=\s*\{)/g, '$1\\\\operatorname');

    return src;
}

function collectLessonFormatIssues(markdown = '') {
    const src = String(markdown || '');
    const issues = [];
    if (!src.trim()) issues.push('empty_lesson');
    const displayDelimiterCount = (src.match(/\$\$/g) || []).length;
    if (displayDelimiterCount % 2 !== 0) issues.push('unbalanced_display_math');
    if (/\\begin\{(?:gathered|aligned)\}/.test(src)) issues.push('packed_formula_environment');
    if (/\\\\\[[^\]]*(?:pt|em|ex|mm|cm|in|pc|px)\]/.test(src)) issues.push('visible_line_spacing_token');
    if (/\\qquad/.test(src)) issues.push('horizontal_formula_strip');
    if (/(^|\n)\s*\\\[[\s\S]*?\\\]\s*(?=\n|$)/.test(src)) issues.push('raw_display_delimiter');
    if (/(^|[^\w\\])(?:sqrt|theta|lambda|operatorname)\s*(?:\{|\\theta|\(|$)/.test(src)) issues.push('bare_latex_command');
    if (/(^|[^\w\\])(?:cos|sin|tan)\s*(?:\\theta|\(|$)/.test(src)) issues.push('bare_trig_command');
    return [...new Set(issues)];
}

function prepareLessonForCache(sectionId = '', lesson = '') {
    let normalized = normalizeMathMarkdown(convertLegacyQuickCheckToKcBlocks(lesson));
    normalized = enforceSectionSpecificLessonPolish(sectionId, normalized);
    normalized = normalizeMathMarkdown(normalized);
    return normalized;
}

function assertLessonFormatClean(sectionId = '', lesson = '', phase = 'lesson') {
    const issues = collectLessonFormatIssues(lesson);
    if (!issues.length) return;
    throw new Error(`[LessonFormat:${phase}] ${sectionId || 'unknown'} failed format validation: ${issues.join(', ')}`);
}

function shouldPreferLatexConceptVisual(query = '', title = '') {
    const text = `${compactWhitespace(query)} ${compactWhitespace(title)}`.toLowerCase();
    return /\b(identity matrix|unit matrix)\b/.test(text)
        || /number system hierarchy|natural integers rational irrational real complex|number system expansion|natural numbers.*complex numbers/.test(text);
}

function buildLatexConceptVisualMarkdown(query = '', language = 'en') {
    const text = `${compactWhitespace(query)}`.toLowerCase();
    if (/number system hierarchy|natural integers rational irrational real complex|number system expansion|natural numbers.*complex numbers/.test(text)) {
        return [
            '$$',
            '1,2,3,\\ldots \\;\\rightarrow\\; \\frac{a}{b} \\;\\rightarrow\\; \\sqrt{2} \\;\\rightarrow\\; -5 \\;\\rightarrow\\; j',
            '$$',
            language === 'zh'
                ? '*这条链不是计算公式，而是历史线索：每当旧数系表达不了有用问题，数系就继续扩张。*'
                : '*This is a historical map, not a calculation formula: each new symbol marks a useful problem older numbers could not express cleanly.*'
        ].join('\n');
    }
    if (/\b(identity matrix|unit matrix)\b/.test(text)) {
        return [
            '$$',
            'I_3 =',
            '\\begin{bmatrix}',
            '1 & 0 & 0 \\\\',
            '0 & 1 & 0 \\\\',
            '0 & 0 & 1',
            '\\end{bmatrix}',
            '$$',
            language === 'zh'
                ? '*这里直接用 LaTeX 展示更清楚：单位矩阵的本质就是“主对角线全是 1，其余全是 0”。*'
                : '*LaTeX is clearer here: an identity matrix is defined by 1s on the main diagonal and 0s everywhere else.*'
        ].join('\n');
    }
    return '';
}

function normalizeLessonVisualPolicy(markdown, language = 'en') {
    let src = normalizeMathMarkdown(String(markdown || ''));
    if (!src) return src;

    const identityVisualBlockRegex = /%%KC_BLOCK%%<div class="kc-visual-meta" data-visual-kind="web_reference_image"[\s\S]*?%%KC_END%%\s*!\[[^\]]*Identity matrix[^\]]*\]\([^)]+\)\s*\*Reference visual from Wikimedia Commons:[^*]+\*\s*<div class="kc-reference-source">[\s\S]*?<\/div>\s*/i;
    if (identityVisualBlockRegex.test(src)) {
        src = src.replace(identityVisualBlockRegex, `${buildLatexConceptVisualMarkdown('identity matrix', language)}\n\n`);
    }

    const numberSystemVisualBlockRegex = /%%KC_BLOCK%%<div class="kc-visual-meta" data-visual-kind="web_reference_image"[\s\S]*?%%KC_END%%\s*!\[[^\]]*(?:Natural number|number system|Reference illustration)[^\]]*\]\([^)]+\)\s*\*The nested hierarchy of number systems:[^*]+\*\s*<div class="kc-reference-source">[\s\S]*?<\/div>\s*/i;
    if (numberSystemVisualBlockRegex.test(src)) {
        src = src.replace(numberSystemVisualBlockRegex, `${buildLatexConceptVisualMarkdown('number system hierarchy natural numbers complex numbers', language)}\n\n`);
    }

    const latexIdentity = '$$I_3 =';
    if (!src.includes(latexIdentity)) {
        const identityAnchorRegex = /(\*The identity matrix \\\(I\\\) is the matrix equivalent of the number \\\(1\\\) in ordinary multiplication\.[\s\S]*?does nothing to the matrix it multiplies\.\*)/i;
        if (identityAnchorRegex.test(src)) {
            src = src.replace(identityAnchorRegex, `$1\n\n${buildLatexConceptVisualMarkdown('identity matrix', language)}`);
        }
    }

    return src;
}

function loadNewBookFigureIndex() {
    try {
        if (!fs.existsSync(FIGURE_IMAGE_DIR_NEW)) return {};
        const index = {};
        const files = fs.readdirSync(FIGURE_IMAGE_DIR_NEW)
            .filter(name => /^page-\d{3}-.+\.(png|jpg|jpeg|webp)$/i.test(name));
        for (const fileName of files) {
            const m = fileName.match(/^(page-\d{3})-/i);
            if (!m) continue;
            const page = m[1].toLowerCase();
            if (!index[page]) index[page] = [];
            index[page].push(fileName);
        }
        Object.values(index).forEach(arr => arr.sort());
        return index;
    } catch (err) {
        console.warn(`[Index] Failed to load new-book figure index: ${err.message}`);
        return {};
    }
}

function getAllowedNewBookFigures(sectionId = '', bookPages = [], bookSource = 'new') {
    if (bookSource !== 'new') return new Set();

    const code = extractSectionCode(sectionId);
    if (!code) return new Set();

    const localBookPages = (Array.isArray(bookPages) ? bookPages : []).filter(page => !(page && page.ragFlow));
    const mapKey = Object.keys(SECTION_FIGURE_MAP_NEW).find(k => k.toLowerCase() === code.toLowerCase());
    if (!mapKey) {
        const fallback = new Set();
        localBookPages.forEach(page => {
            const pageKey = String(page && page.page || '').trim().toLowerCase();
            (NEW_BOOK_FIGURE_INDEX[pageKey] || []).forEach(file => fallback.add(path.basename(String(file || ''))));
        });
        return fallback;
    }

    return new Set((SECTION_FIGURE_MAP_NEW[mapKey] || []).map(file => path.basename(String(file || ''))).filter(Boolean));
}

function findAllowedFigureForBlock(figures, block, allowedFigureFiles) {
    const allowed = allowedFigureFiles instanceof Set ? allowedFigureFiles : new Set();
    const list = Array.isArray(figures) ? figures : [];
    if (!list.length) return null;

    const requestedFigId = normalizeFigureId(block && block.fig_id);
    if (requestedFigId) {
        const matchedById = list.find(fig => {
            const crop = path.basename(String((fig && fig.crop_file) || ''));
            if (!crop || !allowed.has(crop)) return false;
            const normalized = normalizeFigureId(fig && fig.fig_id);
            return normalized === requestedFigId || normalized.includes(requestedFigId) || requestedFigId.includes(normalized);
        });
        if (matchedById) return matchedById;
    }

    const explicitFile = path.basename(String((block && block.file_path) || ''));
    if (explicitFile && allowed.has(explicitFile)) {
        const matchedByFile = list.find(fig => path.basename(String((fig && fig.crop_file) || '')) === explicitFile);
        if (matchedByFile) return matchedByFile;
    }

    return list.find(fig => {
        const crop = path.basename(String((fig && fig.crop_file) || ''));
        return crop && allowed.has(crop);
    }) || null;
}

function hasDisallowedNewBookPageFallback(markdown, sectionId = '', bookPages = [], bookSource = 'new') {
    if (bookSource !== 'new') return false;
    const src = String(markdown || '');
    return /\]\(\/pages\/page-\d+\.png\)/.test(src);
}

function normalizeFormulaCandidate(formula = '') {
    return String(formula || '')
        .replace(/\$+/g, '')
        .replace(/^\s*\\text\{[^}]*\}\s*/g, '')
        .replace(/&/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.;,:]+$/, '');
}

function shouldKeepFormulaCandidate(formula = '') {
    const normalized = normalizeFormulaCandidate(formula);
    if (!normalized) return false;
    if (normalized.length < 5) return false;
    if (/^\\?(?:mathbb|mathrm|text)\{[^}]+\}$/.test(normalized)) return false;
    if (/^(?:[a-zA-Z]|\\[a-zA-Z]+)\s*$/.test(normalized)) return false;
    return /[=<>]|\\(?:sqrt|frac|tan|ln|log|operatorname|angle|cdot|pm|mp|pi|theta|omega|cos|sin|exp|Rightarrow|to)|\||\^|\/|e\^\{j/.test(normalized);
}

function splitDisplayMathIntoFormulas(content = '') {
    const raw = String(content || '').trim();
    if (!raw) return [];
    let cleaned = raw
        .replace(/\\begin\{(?:aligned|gathered|cases|array)\}/g, '')
        .replace(/\\end\{(?:aligned|gathered|cases|array)\}/g, '')
        .trim();
    const parts = cleaned
        .split(/\\\\/)
        .map(part => normalizeFormulaCandidate(part))
        .filter(shouldKeepFormulaCandidate);
    return parts.length ? parts : (shouldKeepFormulaCandidate(cleaned) ? [normalizeFormulaCandidate(cleaned)] : []);
}

function isCoreFormulaBlockContext(nextText = '', prevText = '') {
    const next = compactWhitespace(nextText).toLowerCase();
    const prev = compactWhitespace(prevText).toLowerCase();
    if (/^##\s+/.test(nextText)) return true;
    if (/^(?:###[^a-z]|###\s+(?:when to use|key rule|worked example|representative example|exam trigger|common mistake))/i.test(nextText)) return false;
    if (/^(?:\|.*\|)$/.test(nextText)) return false;
    if (/^(?:for |let |consider |convert |example\b|step \d|calculator |numerator |denominator )/i.test(prevText)) return false;
    if (/(worked example|representative example|example a|example b|step 1|step 2|step 3|common mistake|exam trigger)/i.test(prev)) return false;
    return /^##\s+/.test(nextText) || /^(?:#|##)\s+/.test(nextText);
}

function extractCoreFormulaBullets(markdown = '') {
    const src = String(markdown || '');
    if (!src) return [];

    const stopAtSummary = src.split(/(?:\n---\n)?\*\*📌 Key Takeaways\*\*/)[0] || src;
    const formulas = [];
    const seen = new Set();

    const addFormula = (formula) => {
        const normalized = normalizeFormulaCandidate(formula);
        if (!shouldKeepFormulaCandidate(normalized)) return;
        const key = normalized.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        formulas.push(normalized);
    };

    const displayMatches = [...stopAtSummary.matchAll(/\$\$([\s\S]*?)\$\$/g)];
    displayMatches.forEach((match) => {
        const fullMatch = match[0] || '';
        const start = match.index || 0;
        const end = start + fullMatch.length;
        const before = stopAtSummary.slice(0, start);
        const after = stopAtSummary.slice(end);
        const prevText = before.split('\n').slice(-3).join('\n').trim();
        const nextText = (after.match(/\S.*(?:\n|$)/) || [''])[0].trim();
        if (!isCoreFormulaBlockContext(nextText, prevText)) return;
        splitDisplayMathIntoFormulas(match[1]).forEach(addFormula);
    });

    const specialInlinePatterns = [
        /\\\(j\^2\s*=\s*-1\\\)/g,
        /\\\(\\sqrt\{-1\}\s*=\s*\\pm\s*j\\\)/g,
        /\\\(\\sqrt\{-4\}\s*=\s*\\pm\s*2j\\\)/g
    ];
    specialInlinePatterns.forEach((pattern) => {
        for (const match of stopAtSummary.matchAll(pattern)) {
            addFormula(match[0].replace(/^\\\(/, '').replace(/\\\)$/, ''));
        }
    });

    const preferred = formulas.filter((formula) => !/^[a-z](?:\s*[<>]=?\s*0)?$/i.test(formula));
    if (preferred.length) {
        return preferred.map(formula => `- Core formula: \\(${formula}\\).`);
    }

    return formulas.map(formula => `- Core formula: \\(${formula}\\).`);
}

function mergeCoreFormulaBulletsIntoSummary(markdown = '') {
    const src = String(markdown || '');
    if (!/(\*\*📌 Key Takeaways\*\*|📌 Key Takeaways)/.test(src)) return src;

    const extractedFormulaBullets = extractCoreFormulaBullets(src);
    if (!extractedFormulaBullets.length) return src;

    return src.replace(
        /(\*\*📌 Key Takeaways\*\*[\s\S]*?)(\n\*In the next section)/,
        (_m, summaryStart, nextSection) => {
            let updated = summaryStart;
            extractedFormulaBullets.forEach((bullet) => {
                const formulaBody = bullet.replace(/^- Core formula:\s*/, '').replace(/\.$/, '').trim();
                const formulaKey = normalizeFormulaCandidate(formulaBody).toLowerCase();
                if (formulaKey && updated.toLowerCase().includes(formulaKey)) return;
                updated += `\n${bullet}`;
            });
            updated = updated.replace(/\n{3,}/g, '\n\n');
            return `${updated}${nextSection}`;
        }
    );
}

function enforceSectionSpecificLessonPolish(sectionId = '', markdown = '') {
    let src = mergeCoreFormulaBulletsIntoSummary(markdown);
    const sid = String(sectionId || '').trim().toLowerCase();
    if (!src) return src;

    if (sid === 'b.1-1') {
        if (/(\*\*📌 Key Takeaways\*\*|📌 Key Takeaways)/.test(src)) {
            src = src.replace(
                /(\*\*📌 Key Takeaways\*\*[\s\S]*?)(\n\*In the next section)/,
                (_m, summaryStart, nextSection) => {
                    let updated = summaryStart;
                    updated = updated.replace(/- The symbol \\\(j\\\) satisfies \\\(j\^2 = -1\\\) and handles square roots of negative numbers\./g, '');
                    updated = updated.replace(/- \\?\(j\^2 = -1\\?\).*$/gm, '');
                    updated = updated.replace(/- \\?\(\\sqrt\{-1\} = \\pm j\\?\).*$/gm, '');
                    updated = updated.replace(/- Minimal example: \\?\(\\sqrt\{-4\} = \\pm 2j\\?\).*$/gm, '');
                    updated += '\n- \\(j^2 = -1\\) defines the imaginary unit used in engineering notation.';
                    updated += '\n- \\(\\sqrt{-1} = \\pm j\\), so the square root of a negative number has two imaginary values.';
                    updated += '\n- Minimal example: \\(\\sqrt{-4} = \\pm 2j\\).';
                    updated = updated.replace(/\n{3,}/g, '\n\n');
                    return `${updated}${nextSection}`;
                }
            );
        }
    }

    return src;
}

function hasDisallowedNewBookFigureRefs(markdown, sectionId = '', bookPages = [], bookSource = 'new') {
    if (bookSource !== 'new') return false;
    const src = String(markdown || '');
    const allowed = getAllowedNewBookFigures(sectionId, bookPages, bookSource);
    const refs = [...src.matchAll(/\]\(\/figures\/([^\)]+)\)/g)].map(m => decodeURIComponent(m[1] || ''));
    return refs.some(file => !allowed.has(path.basename(file)));
}

function hasNewBookFigureUnavailablePlaceholder(markdown, bookSource = 'new') {
    if (bookSource !== 'new') return false;
    return /\*\(Figure unavailable:/i.test(String(markdown || ''));
}

function hasIllustrationUnavailablePlaceholder(markdown) {
    return /Illustration unavailable:/i.test(String(markdown || ''));
}

function extractEmbeddedVisualPlan(markdown) {
    const src = String(markdown || '');
    const match = src.match(/data-visual-plan-b64="([^"]+)"/i);
    if (!match) return null;
    try {
        return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    } catch (_) {
        return null;
    }
}

function hasLegacyGeneratedVisualArtifacts(markdown) {
    const src = String(markdown || '');
    if (/\/generated\/(?:fig|chart)-[^)\s"']+/i.test(src)) return true;
    if (/python_matplotlib/i.test(src)) return true;

    const visualPlan = extractEmbeddedVisualPlan(src);
    if (!visualPlan) return false;

    const primaryAnchor = compactWhitespace(visualPlan.primary_anchor || '').toLowerCase();
    if (primaryAnchor === 'matplotlib') return true;

    try {
        const serialized = JSON.stringify(visualPlan).toLowerCase();
        return serialized.includes('matplotlib');
    } catch (_) {
        return false;
    }
}

function inferPageTitle(meta, page) {
    const subsection = compactWhitespace(meta.subsection || '');
    const firstKeyword = Array.isArray(meta.keywords) && meta.keywords.length
        ? titleCase(meta.keywords[0])
        : '';

    if (subsection && firstKeyword) return `${subsection} ${firstKeyword}`;
    if (subsection) return subsection;
    if (firstKeyword) return firstKeyword;
    return page;
}

function loadBookIndexForDir(ocrDir, pagePattern = /^book-\d{3}\.meta\.json$/i) {
    const files = fs.readdirSync(ocrDir)
        .filter(name => pagePattern.test(name))
        .sort();

    const entries = [];

    for (const file of files) {
        const metaPath = path.join(ocrDir, file);
        const meta = safeReadJSON(metaPath);
        if (!meta) continue;

        const page = meta.book_page || file.replace(/\.meta\.json$/i, '');
        const keywords = Array.isArray(meta.keywords) ? meta.keywords.filter(Boolean) : [];
        const summary = compactWhitespace(meta.summary || '');
        const subsection = compactWhitespace(meta.subsection || '');
        const searchBlob = [page, subsection, summary, keywords.join(' ')].join(' ').toLowerCase();

        entries.push({
            page,
            pageImage: `${page}.png`,
            metaPath,
            textPath: path.join(ocrDir, `${page}.txt`),
            subsection,
            summary,
            keywords,
            keywordsLower: keywords.map(v => String(v).toLowerCase()),
            searchBlob,
            title: inferPageTitle(meta, page)
        });
    }

    return entries;
}

const BOOK_INDEX_NEW = loadBookIndexForDir(OCR_DIR_NEW, /^page-\d{3}\.meta\.json$/i);

function getBookIndex(_ocrDir) {
    return BOOK_INDEX_NEW;
}

// section-page-map-*.json: 精确的小节->书页映射（由 OCR 文本扫描生成）
function loadSectionPageMap(filename) {
    const mapPath = path.join(__dirname, filename);
    try {
        return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    } catch (e) {
        console.warn(`[Index] ${filename} not found, falling back to metadata search`);
        return {};
    }
}
const SECTION_PAGE_MAP_NEW = loadSectionPageMap('section-page-map-new.json');
const SECTION_FIGURE_MAP_NEW = loadSectionPageMap('section-figure-map-new.json');
const NEW_BOOK_FIGURE_INDEX = loadNewBookFigureIndex();
console.log(`[Index] Section maps loaded: new=${Object.keys(SECTION_PAGE_MAP_NEW).length}`);
console.log(`[Index] Section figure map loaded: new=${Object.keys(SECTION_FIGURE_MAP_NEW).length}`);
console.log(`[Index] New-book figure index loaded: pages=${Object.keys(NEW_BOOK_FIGURE_INDEX).length}`);

const FORMULA_CATALOG_DIR = path.join(TUTOR_MATERIALS_DIR, 'formula-catalog');
const BLUEPRINT_DIR = path.join(TUTOR_MATERIALS_DIR, '');

const {
    LESSON_CACHE_VERSION,
    LESSON_CACHE_MISS_MESSAGE,
    hasLessonCacheFile,
    readLessonCache,
    writeLessonCache,
} = require('./lesson-cache')({
    tutorMaterialsDir: TUTOR_MATERIALS_DIR,
    prepareLessonForCache,
    collectLessonFormatIssues,
    assertLessonFormatClean,
});

function formulaCatalogFileForSection(sectionId = '') {
    const code = extractSectionCode(sectionId);
    if (!code) return null;
    const safeCode = code.replace(/[^a-z0-9._-]+/gi, '_').toLowerCase();
    return path.join(FORMULA_CATALOG_DIR, `${safeCode}.formulas.json`);
}

function readVerifiedFormulaCatalog(sectionId = '', bookSource = 'new') {
    if (bookSource !== 'new') return null;
    const file = formulaCatalogFileForSection(sectionId);
    if (!file || !fs.existsSync(file)) return null;

    try {
        const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
        const formulas = Array.isArray(catalog.formulas)
            ? catalog.formulas.filter(formula => (
                formula
                && formula.status === 'verified'
                && compactWhitespace(formula.latex)
            ))
            : [];
        if (!formulas.length) return null;
        return {
            ...catalog,
            sourceFile: path.relative(TUTOR_MATERIALS_DIR, file),
            formulas
        };
    } catch (err) {
        console.warn(`[FormulaCatalog] Failed to load ${file}:`, err.message);
        return null;
    }
}

function buildVerifiedFormulaPromptSection(catalog) {
    if (!catalog || !Array.isArray(catalog.formulas) || !catalog.formulas.length) return '';
    const lines = [
        'verified_canonical_formulas:',
        'These formulas were manually verified against the textbook page images. Use the exact LaTeX below when teaching these formulas; do not reconstruct conflicting versions from OCR.',
        `source_file: ${catalog.sourceFile || ''}`,
        `section_id: ${catalog.sectionId || ''}`,
        ''
    ];
    catalog.formulas.forEach((formula, index) => {
        const label = formula.label ? ` ${formula.label}` : '';
        lines.push(`${index + 1}.${label} ${formula.name || 'Formula'}`);
        lines.push(`   latex: ${formula.latex}`);
        if (formula.sourcePage) lines.push(`   source_page: ${formula.sourcePage}`);
        if (formula.role) lines.push(`   role: ${formula.role}`);
    });
    return lines.join('\n');
}

const B8_FORMULA_APPENDIX_MARKDOWN = [
    '## B.8 Appendix: Useful Mathematical Formulas',
    '',
    'This appendix is a compact formula reference. Use it as the lookup sheet for the algebra, series, calculus, and trigonometric identities that appear throughout the earlier background sections.',
    '',
    'Read it by formula family, not from top to bottom like a proof. First identify the kind of move you need: complex-number conversion, summation, Taylor/Maclaurin expansion, power series, trig simplification, derivative, integral, limit rule, or polynomial equation formula.',
    '',
    'The main exam trap is sign and condition copying. Check the plus/minus signs, whether a formula assumes a nonzero denominator, and whether the variable is in radians. For worked examples, connect these formulas back to B.1 complex numbers, B.2 sinusoids, and B.5 partial fractions.',
    '',
    'Switch to the **Textbook** tab for the full appendix pages.'
].join('\n');

function isB8FamilySection(sectionId = '', sectionTitle = '') {
    return /\bB\.8\b/i.test(compactWhitespace(`${sectionId} ${sectionTitle}`));
}

function getB8FormulaAppendix(sectionId = '', sectionTitle = '') {
    const text = compactWhitespace(`${sectionId} ${sectionTitle}`);
    // Parent "B.8 Appendix" only — subtopics (B.8-1..B.8-10) have real cached
    // lessons and must NOT be shadowed by this static reference page.
    if (!/B\.8\b(?!-\d)/i.test(text)) return null;
    return B8_FORMULA_APPENDIX_MARKDOWN;
}

// Keep this require BEFORE the ./user-memory require below: user-memory's
// destructure references callOpenRouterChat as a const binding, which is
// not hoisted. Reordering will throw ReferenceError on bridge boot.
const { callOpenRouterChat, callOpenAIChat, tryParseJsonLoose } = require('./llm-client')({
    httpRequestJson,
    extractTextContent,
    appUrl: APP_URL,
    appName: APP_NAME,
});

// Storage backend: file store by default; Neon Postgres when DATABASE_URL is
// set (07-05 user-db task). All destructured IO functions are async now —
// every callsite below awaits them. TUTOR_USERS_DIR exists so the hermetic
// auth-guard test harness can point the file store at a temp dir.
const {
    init: initUserStore,
    readUserMemory, writeUserMemory, listSessionsForUid, readSessionFile,
    deleteSessionForUid, persistSessionTurn, updateSessionMetadata, buildTeachingInstructionsPrompt,
} = require('./user-memory')({
    usersDir: process.env.TUTOR_USERS_DIR || path.join(__dirname, 'users'),
    databaseUrl: process.env.DATABASE_URL || '',
});


async function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let totalBytes = 0;
        req.on('data', chunk => {
            totalBytes += Buffer.byteLength(chunk);
            if (totalBytes > MAX_JSON_BODY_BYTES) {
                reject(new Error('Request body too large'));
                req.destroy();
                return;
            }
            chunks.push(Buffer.from(chunk));
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

async function readJsonBody(req) {
    const raw = await readRequestBody(req);
    try {
        return JSON.parse(raw || '{}');
    } catch (err) {
        throw new Error('Invalid JSON body');
    }
}

function normalizeUrl(u) {
    return String(u || '').replace(/#.*$/, '').replace(/\/$/, '');
}

function httpRequestJson(targetUrl, options = {}, body = null, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            reject(new Error(`Unsupported protocol: ${parsed.protocol}`));
            return;
        }
        let requestTarget = parsed;
        let requestPath = `${parsed.pathname}${parsed.search}`;
        let requestHeaders = options.headers || {};

        if (options.proxyUrl) {
            const proxy = new URL(options.proxyUrl);
            if (proxy.protocol !== 'http:') {
                reject(new Error(`Unsupported proxy protocol: ${proxy.protocol}`));
                return;
            }
            if (parsed.protocol !== 'http:') {
                reject(new Error(`HTTP proxy is only supported for http targets in this helper: ${parsed.protocol}`));
                return;
            }
            requestTarget = proxy;
            requestPath = targetUrl;
            requestHeaders = { ...requestHeaders, Host: parsed.host };
        }

        const client = requestTarget.protocol === 'http:' ? http : https;
        const req = client.request({
            protocol: requestTarget.protocol,
            hostname: requestTarget.hostname,
            port: requestTarget.port || (requestTarget.protocol === 'http:' ? 80 : 443),
            path: requestPath,
            method: options.method || (body ? 'POST' : 'GET'),
            headers: requestHeaders
        }, (res) => {
            let raw = '';
            res.setEncoding('utf8');
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                const ok = res.statusCode >= 200 && res.statusCode < 300;
                let parsedBody = null;

                try {
                    parsedBody = raw ? JSON.parse(raw) : null;
                } catch (err) {
                    if (!ok) {
                        reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 400)}`));
                        return;
                    }
                    reject(new Error(`Invalid JSON response: ${raw.slice(0, 300)}`));
                    return;
                }

                if (!ok) {
                    const detail = parsedBody && (parsedBody.error?.message || parsedBody.error || parsedBody.message);
                    reject(new Error(`HTTP ${res.statusCode}: ${detail || raw.slice(0, 400)}`));
                    return;
                }

                resolve(parsedBody);
            });
        });

        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error(`Request timeout (${timeoutMs}ms)`));
        });

        req.on('error', reject);

        if (body) req.write(body);
        req.end();
    });
}

const {
    duckDuckGoSearch,
    wikipediaSearch,
    wikimediaCommonsImageSearch,
    wikipediaPageImageSearch,
} = require('./search-helpers')({ httpRequestJson, compactWhitespace, normalizeUrl });

function extractTextContent(content) {
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
        return content
            .map(part => {
                if (typeof part === 'string') return part;
                if (part && typeof part.text === 'string') return part.text;
                return '';
            })
            .join('')
            .trim();
    }
    return '';
}

function runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeoutMs = options.timeoutMs || 20000;
        const spawnOptions = { ...options };
        delete spawnOptions.timeoutMs;
        const child = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            ...spawnOptions
        });
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill('SIGKILL');
            reject(new Error(`${command} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        const stdout = [];
        const stderr = [];
        child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)));
        child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)));
        child.on('error', err => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
        });
        child.on('close', code => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            const out = Buffer.concat(stdout);
            const err = Buffer.concat(stderr).toString('utf8');
            if (code !== 0) {
                reject(new Error(`${command} exited ${code}${err ? `: ${err.slice(0, 400)}` : ''}`));
                return;
            }
            resolve({ stdout: out, stderr: err });
        });
    });
}

function decodeDataUrl(dataUrl = '') {
    const match = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/i);
    if (!match) throw new Error('Invalid attachment data URL');
    const mimeType = match[1] || 'application/octet-stream';
    const isBase64 = Boolean(match[2]);
    const body = match[3] || '';
    return {
        mimeType,
        buffer: isBase64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8')
    };
}

function createTempDir(prefix = 'aquarius-attachment-') {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function extractPdfAttachment(pdf = {}) {
    const result = {
        name: pdf.name || 'attached.pdf',
        text: '',
        pageImages: [],
        error: ''
    };
    if (!pdf.dataUrl) return result;

    const tempDir = createTempDir();
    const pdfPath = path.join(tempDir, 'attachment.pdf');
    const txtPath = path.join(tempDir, 'attachment.txt');
    const imagePrefix = path.join(tempDir, 'page');

    try {
        const decoded = decodeDataUrl(pdf.dataUrl);
        fs.writeFileSync(pdfPath, decoded.buffer);
        try {
            await runCommand(PDFTOTEXT_BIN, ['-layout', '-enc', 'UTF-8', pdfPath, txtPath], { timeoutMs: 30000 });
            if (fs.existsSync(txtPath)) {
                result.text = fs.readFileSync(txtPath, 'utf8')
                    .replace(/\r/g, '')
                    .replace(/\n{4,}/g, '\n\n\n')
                    .trim()
                    .slice(0, PDF_TEXT_MAX_CHARS);
            }
        } catch (err) {
            result.error = `pdftotext failed: ${err.message}`;
            console.warn(`[attachments] pdftotext failed for ${result.name}:`, err.message);
        }

        if (result.text.length < 800 && PDF_VISUAL_PAGE_LIMIT > 0) {
            try {
                await runCommand(PDFTOPPM_BIN, ['-png', '-r', '150', '-f', '1', '-l', String(PDF_VISUAL_PAGE_LIMIT), pdfPath, imagePrefix], { timeoutMs: 45000 });
                const pageFiles = fs.readdirSync(tempDir)
                    .filter(file => /^page-\d+\.png$/.test(file))
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                result.pageImages = pageFiles.slice(0, PDF_VISUAL_PAGE_LIMIT).map(file => {
                    const bytes = fs.readFileSync(path.join(tempDir, file));
                    return `data:image/png;base64,${bytes.toString('base64')}`;
                });
            } catch (err) {
                result.error = result.error || `pdftoppm failed: ${err.message}`;
                console.warn(`[attachments] pdftoppm failed for ${result.name}:`, err.message);
            }
        }
    } catch (err) {
        result.error = err.message || 'PDF extraction failed';
        console.warn(`[attachments] PDF extraction failed for ${result.name}:`, result.error);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    return result;
}

async function prepareAttachmentContext(attachments = []) {
    const pdfAttachments = attachments.filter(a => a && a.type === 'pdf' && a.dataUrl);
    const wordAttachments = attachments.filter(a => a && (a.type === 'document' || a.type === 'word') && compactWhitespace(a.text || ''));
    const extractedPdfs = [];
    for (const pdf of pdfAttachments) {
        extractedPdfs.push(await extractPdfAttachment(pdf));
    }
    const retrievalText = [
        ...extractedPdfs.map(pdf => pdf.text || ''),
        ...wordAttachments.map(doc => String(doc.text || ''))
    ].join('\n\n').slice(0, 50000);
    return { extractedPdfs, retrievalText };
}
function uniqueStrings(values, maxItems = 8) {
    const seen = new Set();
    const result = [];

    for (const value of values || []) {
        const cleaned = compactWhitespace(value);
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(cleaned);
        if (result.length >= maxItems) break;
    }

    return result;
}

function fallbackKeywordExtraction(question) {
    const tokens = [];
    const chinese = String(question).match(/[\u4e00-\u9fff]{2,12}/g) || [];
    const english = String(question).match(/[A-Za-z][A-Za-z0-9\-]{2,}/g) || [];
    tokens.push(question);
    tokens.push(...chinese);
    tokens.push(...english);
    return uniqueStrings(tokens, 8);
}

async function extractKeywords(question) {
    try {
        const text = await callOpenRouterChat({
            model: 'openai/gpt-5.4',
            timeoutMs: 30000,
            temperature: 0,
            maxTokens: 220,
            messages: [
                {
                    role: 'system',
                    content: 'You extract textbook retrieval keywords. Return strict JSON only in the shape {"keywords": ["..."]}. Keep 5-8 concise phrases. Mix Chinese and English only when helpful. No commentary.'
                },
                {
                    role: 'user',
                    content: `Question: ${question}`
                }
            ]
        });

        const parsed = tryParseJsonLoose(text);
        const keywords = uniqueStrings(parsed && parsed.keywords, 8);
        if (keywords.length) return keywords;
    } catch (err) {
        console.warn('[RAG] Keyword extraction fallback:', err.message);
    }

    return fallbackKeywordExtraction(question);
}

/**
 * Context-aware search: uses LLM to understand what user ACTUALLY means
 * given the full conversation context, then returns both:
 *   - resolvedQuery: a single clear search phrase (used by buildSearchPlan)
 *   - searchAngles: 5 diverse queries for different source types
 */
async function generateSearchAngles(question, options = {}) {
    const base = compactWhitespace(question || '');
    const history = Array.isArray(options.history) ? options.history : [];
    const sectionTitle = compactWhitespace(options.sectionTitle || '');
    const lessonContext = compactWhitespace(options.lessonContext || '').slice(0, 2500);
    const userProfilePrompt = compactWhitespace(options.userProfilePrompt || '').slice(0, 1200);
    const examPriorityGuidance = options.examPriorityGuidance || null;
    const examPrioritySearchHint = examPriorityGuidance && examPriorityGuidance.json
        ? [
            `Exam-priority source: ${examPriorityGuidance.source || 'unknown'}`,
            `Relevant homework topic ids: ${((examPriorityGuidance.json.topic_filter || {}).relevant_topic_ids || []).join(', ') || 'none'}`,
            `High-priority problem types: ${(examPriorityGuidance.json.high_priority_problem_types || []).slice(0, 6).join('; ') || 'none'}`,
            `Common traps: ${(examPriorityGuidance.json.common_traps || []).slice(0, 5).join('; ') || 'none'}`
        ].join('\n')
        : '';

    const historyText = history
        .slice(-8)
        .map(msg => {
            const role = msg.role || msg.sender || 'unknown';
            const text = compactWhitespace(typeof msg.content === 'string' ? msg.content : (msg.text || msg.message || ''));
            return text ? `${role}: ${text.slice(0, 300)}` : '';
        })
        .filter(Boolean)
        .join('\n');

    try {
        const text = await callOpenRouterChat({
            model: 'openai/gpt-5.4',
            timeoutMs: 30000,
            temperature: 0.1,
            maxTokens: 500,
            messages: [
                {
                    role: 'system',
                    content: [
                        'You are a search query generator for an educational tutoring agent about Signal Processing and Linear Systems.',
                        'Given the conversation context, section topic, lesson content, and the user\'s latest message, you must:',
                        '1. FIRST: Figure out what the user actually means. "again" might mean "explain sinusoids in terms of exponentials again". "why" might mean "why does Euler\'s formula work". Resolve ALL ambiguity using the conversation history and lesson context.',
                        '2. Output a JSON object with two fields:',
                        '   - "resolvedQuery": a single clear English phrase (5-15 words) describing what the user is actually asking about, suitable as a web search query. This must NEVER be a single vague word.',
                        '   - "angles": an array of exactly 5 short English search queries, diversified across: intuition/visual, tutorial/lecture, worked example, university notes, reference.',
                        'All queries MUST be specific to the educational topic. Never generate queries that could match songs, movies, pop culture, or anything unrelated to the course.',
                        'Return ONLY a JSON object. No markdown.'
                    ].join(' ')
                },
                {
                    role: 'user',
                    content: [
                        `Course: Signal Processing and Linear Systems`,
                        `Current section: ${sectionTitle || 'unknown'}`,
                        userProfilePrompt ? `Student profile: ${userProfilePrompt}` : '',
                        examPrioritySearchHint ? `Homework/exam priority hint (use lightly to disambiguate course-related searches):\n${examPrioritySearchHint}` : '',
                        lessonContext ? `Recent lesson content (excerpt): ${lessonContext}` : '',
                        historyText ? `Recent conversation:\n${historyText}` : '',
                        `\nUser's latest message: "${base}"`
                    ].filter(Boolean).join('\n\n')
                }
            ]
        });

        const parsed = tryParseJsonLoose(text);
        if (parsed && typeof parsed === 'object') {
            const resolved = compactWhitespace(parsed.resolvedQuery || parsed.resolved_query || '');
            const angles = Array.isArray(parsed.angles) ? parsed.angles : (Array.isArray(parsed.queries) ? parsed.queries : []);
            const cleaned = uniqueStrings(angles.map(item => compactWhitespace(String(item || ''))).filter(Boolean), 5);
            if (resolved && cleaned.length) {
                console.log(`[Search] Resolved "${base}" → "${resolved}" with ${cleaned.length} angles`);
                return { resolvedQuery: resolved, angles: cleaned };
            }
            if (cleaned.length) {
                console.log(`[Search] Got ${cleaned.length} angles (no resolved query)`);
                return { resolvedQuery: cleaned[0], angles: cleaned };
            }
        }
    } catch (err) {
        console.warn('[Search] Search-angle LLM fallback:', err.message);
    }

    const fallbackBase = [sectionTitle, base].filter(Boolean).join(' ').trim() || 'signal processing linear systems';
    console.log(`[Search] Using fallback queries based on: "${fallbackBase}"`);
    return {
        resolvedQuery: fallbackBase,
        angles: uniqueStrings([
            `${fallbackBase} intuition`,
            `${fallbackBase} visual explanation`,
            `${fallbackBase} worked example`,
            `${fallbackBase} university notes`,
            `${fallbackBase} reference`
        ], 5)
    };
}

function scoreBookEntry(entry, keywords, question) {
    let score = 0;
    const haystack = entry.searchBlob;

    keywords.forEach((keyword, index) => {
        const kw = String(keyword || '').toLowerCase();
        if (!kw) return;

        if (entry.keywordsLower.some(item => item.includes(kw) || kw.includes(item))) {
            score += 20 - Math.min(index * 2, 10);
        }

        if (haystack.includes(kw)) {
            score += 10 - Math.min(index, 5);
        }

        const parts = kw.split(/\s+/).filter(part => part.length > 2);
        for (const part of parts) {
            if (haystack.includes(part)) score += 2;
        }
    });

    const fallbackParts = fallbackKeywordExtraction(question)
        .map(item => item.toLowerCase())
        .slice(0, 6);

    for (const token of fallbackParts) {
        if (token && haystack.includes(token)) score += 2;
    }

    if (/table of contents/i.test(entry.summary)) score -= 6;

    return score;
}

function selectRelevantBooks(question, keywords, minCount = 3, maxCount = 5, ocrDir = OCR_DIR_NEW) {
    const activeIndex = getBookIndex(ocrDir);
    const ranked = activeIndex
        .map(entry => ({ entry, score: scoreBookEntry(entry, keywords, question) }))
        .sort((a, b) => b.score - a.score);

    const positive = ranked.filter(item => item.score > 0).slice(0, maxCount);
    if (positive.length >= minCount) return positive.map(item => item.entry);

    const fallback = ranked.slice(0, Math.max(minCount, Math.min(maxCount, 4)));
    return fallback.map(item => item.entry);
}

async function selectBooksFromAttachmentText(attachmentText = '', fallbackQuestion = '', ocrDir = OCR_DIR_NEW) {
    const text = compactWhitespace(attachmentText || '').slice(0, 12000);
    const question = compactWhitespace(fallbackQuestion || '');
    if (!text) return [];
    const seed = [
        'Use the user question plus the uploaded attachment text to find the most relevant textbook sections/pages.',
        'The attachment is the material; the user question is the focus. If the question is vague like "this" or "这个", infer the focus from the attachment.',
        '',
        question ? `User question/focus: ${question}` : '',
        '',
        `Uploaded attachment text:\n${text}`
    ].filter(Boolean).join('\n');
    const keywords = await extractKeywords(seed);
    const activeIndex = getBookIndex(ocrDir);
    const scoringText = [question, text].filter(Boolean).join('\n\n');
    const ranked = activeIndex
        .map(entry => ({ entry, score: scoreBookEntry(entry, keywords, scoringText) }))
        .filter(item => item.score >= 12)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    return ranked.map(item => item.entry);
}

function readOCRText(filePath, maxChars = 5000) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return raw.slice(0, maxChars);
    } catch (err) {
        return '';
    }
}

function getSectionOcrPath(sectionId = '', bookSource = 'new') {
    if (bookSource !== 'new') return '';
    const code = extractSectionCode(sectionId);
    if (!code) return '';
    return path.join(SECTION_OCR_DIR_NEW, `${code.replace(/[^a-z0-9._-]+/gi, '_')}.txt`);
}

function readSectionOCRText(sectionId = '', bookSource = 'new', maxChars = 50000) {
    const sectionOcrPath = getSectionOcrPath(sectionId, bookSource);
    if (!sectionOcrPath || !fs.existsSync(sectionOcrPath)) return '';
    return readOCRText(sectionOcrPath, maxChars);
}

function attachSectionOcrToPages(sectionId = '', bookPages = [], bookSource = 'new') {
    if (bookSource !== 'new' || !Array.isArray(bookPages) || !bookPages.length) return bookPages;
    const sectionOcrText = readSectionOCRText(sectionId, bookSource, 50000);
    if (!sectionOcrText) return bookPages;
    return bookPages.map((page, index) => (
        index === 0
            ? { ...page, ocrOverrideText: sectionOcrText, sectionOcrPath: getSectionOcrPath(sectionId, bookSource) }
            : { ...page, ocrOverrideText: '' }
    ));
}

function scoreReferenceImageCandidate(item = {}, query = '') {
    const title = compactWhitespace(item.title || '').toLowerCase();
    const mime = compactWhitespace(item.mime || '').toLowerCase();
    const urlValue = compactWhitespace(item.url || '');
    const q = compactWhitespace(query || '').toLowerCase();
    const qTokens = q.split(/[^a-z0-9]+/i).filter(Boolean);

    let score = 0;
    if (/\.gif$/i.test(urlValue) || mime === 'image/gif') score += 45;
    if (mime === 'image/svg+xml') score += 28;
    if (mime === 'image/png') score += 18;
    if (/diagram|matrix|identity|transpose|fourier|signal|plot|graph|wave|vector|animation/i.test(title)) score += 16;
    if (/icon|logo|nuvola|wiktionary|disambig|audio/i.test(title)) score -= 40;
    const overlap = qTokens.filter(tok => tok.length > 2 && title.includes(tok)).length;
    score += overlap * 8;
    if (q && title.includes(q.split(/\s+/)[0] || '')) score += 8;
    if (q.includes('matrix') && !title.includes('matrix')) score -= 60;
    if (q.includes('identity matrix') && !title.includes('identity matrix')) score -= 40;
    if (q.includes('inverse matrix') && !(/inverse/.test(title) && /matrix/.test(title))) score -= 30;
    if (q.includes('diagonal matrix') && !(/diagonal/.test(title) && /matrix/.test(title))) score -= 30;
    if (q.includes('symmetric matrix') && !(/symmetric/.test(title) && /matrix/.test(title))) score -= 30;
    if (q.includes('rows columns') && !(/matrix|row|column/.test(title))) score -= 30;
    if (/matrix multiplication|row column|dot product|conformability/.test(q) && !(/matrix|multiplication|row|column|dot product|linear algebra/.test(title))) score -= 90;
    if (/feynman|gluon|quark|electron|photon|boson|radiation|particle physics|gamma ray/i.test(title)) score -= 220;
    if (/document|passport|card|biometric|dni|seal/i.test(title)) score -= 120;
    return score;
}

function filterReferenceCandidatesForQuery(candidates = [], query = '') {
    const q = compactWhitespace(query || '').toLowerCase();
    let filtered = Array.isArray(candidates) ? candidates.slice() : [];

    const withTitle = (predicate) => filtered.filter(item => predicate(compactWhitespace(item && item.title || '').toLowerCase()));

    if (/identity matrix/.test(q)) {
        const strict = withTitle(title => title.includes('identity') && title.includes('matrix'));
        if (strict.length) filtered = strict;
    }
    if (/inverse matrix/.test(q)) {
        const strict = withTitle(title => /inverse|invertible/.test(title) && title.includes('matrix'));
        if (strict.length) filtered = strict;
    }
    if (/diagonal matrix/.test(q)) {
        const strict = withTitle(title => title.includes('diagonal') && title.includes('matrix'));
        if (strict.length) filtered = strict;
    }
    if (/symmetric matrix/.test(q)) {
        const strict = withTitle(title => title.includes('symmetric') && title.includes('matrix'));
        if (strict.length) filtered = strict;
    }
    if (/rows columns labeled|matrix notation/.test(q)) {
        const strict = withTitle(title => /matrix|row|column/.test(title));
        if (strict.length) filtered = strict;
    }
    if (/matrix multiplication|row column|dot product|conformability/.test(q)) {
        const strict = withTitle(title =>
            /matrix|multiplication|row|column|dot product|linear algebra/.test(title)
            && !/feynman|gluon|quark|electron|photon|boson|radiation|particle physics|gamma ray/.test(title)
        );
        if (strict.length) {
            filtered = strict;
        } else {
            filtered = [];
        }
    }

    filtered = filtered.filter(item => {
        const title = compactWhitespace(item && item.title || '').toLowerCase();
        return !/feynman|gluon|quark|electron|photon|boson|radiation|particle physics|gamma ray/.test(title);
    });

    return filtered;
}

async function resolveReferenceImageForQuery(query = '', options = {}) {
    const cleanQuery = compactWhitespace(query || '');
    if (!cleanQuery) return null;
    if (shouldPreferLatexConceptVisual(cleanQuery)) return null;
    const preferAnimated = Boolean(options && options.preferAnimated);
    if (/matrix addition/i.test(cleanQuery) && /valid invalid|dimensions/i.test(cleanQuery)) {
        return null;
    }
    const heuristicQueries = [cleanQuery];
    if (/identity matrix/i.test(cleanQuery)) {
        heuristicQueries.unshift('Identity matrix');
    }
    if (/identity matrix inverse matrix/i.test(cleanQuery)) {
        heuristicQueries.unshift('Identity matrix');
        heuristicQueries.push('Invertible matrix');
    }
    if (/symmetric matrix/i.test(cleanQuery)) {
        heuristicQueries.push('Symmetric matrix');
    }
    if (/diagonal matrix/i.test(cleanQuery)) {
        heuristicQueries.push('Diagonal matrix');
    }
    if (/matrix notation|rows columns labeled/i.test(cleanQuery)) {
        heuristicQueries.push('Matrix (mathematics)');
    }
    const candidates = [
        ...(await wikimediaCommonsImageSearch(heuristicQueries[0], 8)),
        ...(await wikipediaPageImageSearch(heuristicQueries[0], 4))
    ];
    for (const extraQuery of heuristicQueries.slice(1)) {
        candidates.push(...(await wikipediaPageImageSearch(extraQuery, 3)));
        candidates.push(...(await wikimediaCommonsImageSearch(extraQuery, 4)));
    }
    if (!candidates.length) return null;
    const narrowed = filterReferenceCandidatesForQuery(candidates, cleanQuery);
    const ranked = narrowed
        .filter(item => item && item.url)
        .sort((a, b) => {
            const aGif = String(a && a.mime || '').toLowerCase().includes('gif') ? 1 : 0;
            const bGif = String(b && b.mime || '').toLowerCase().includes('gif') ? 1 : 0;
            if (preferAnimated && aGif !== bGif) return bGif - aGif;
            return scoreReferenceImageCandidate(b, cleanQuery) - scoreReferenceImageCandidate(a, cleanQuery);
        });
    return ranked[0] || null;
}

async function serperSearch(query, num = 8) {
    const apiKey = process.env.SERPER_API_KEY || '';
    if (!apiKey) return [];
    try {
        const payload = await httpRequestJson('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey
            }
        }, JSON.stringify({ q: query, num }), 15000);
        const organic = Array.isArray(payload && payload.organic) ? payload.organic : [];
        return organic.map(item => ({
            title: item.title || '',
            url: item.link || '',
            snippet: compactWhitespace(item.snippet || '')
        })).filter(item => item.url);
    } catch (err) {
        console.warn('[Search] Serper failed:', query, err.message);
        return [];
    }
}

function classifySourceType(url = '', title = '') {
    const text = `${url} ${title}`.toLowerCase();
    if (/youtube\.com|youtu\.be/.test(text)) return 'video';
    if (/3blue1brown|desmos|geogebra|interactive|visual/.test(text)) return 'visual';
    if (/wikipedia\.org|mathworld|wolfram/.test(text)) return 'reference';
    if (/edu\b|mit|stanford|berkeley|cmu|ox\.ac|cam\.ac|lecture|course|notes|pdf/.test(text)) return 'course';
    if (/insight|betterexplained|brilliant|tutorial|guide|explained/.test(text)) return 'insight';
    if (/medium\.com|substack|blog|towardsdatascience/.test(text)) return 'blog';
    if (/stackexchange|reddit|quora/.test(text)) return 'community';
    return 'web';
}

// SYNC: keep identical to app.js sourceTypeRank.
function sourceTypeRank(type = 'web') {
    return {
        video: 1,
        visual: 2,
        course: 3,
        reference: 4,
        insight: 5,
        blog: 6,
        community: 7,
        web: 8
    }[type] || 99;
}

function enrichSources(sources) {
    return sources.map(item => {
        let domain = '';
        try {
            domain = new URL(item.url).hostname.replace(/^www\./, '');
        } catch (err) {
            domain = '';
        }

        return {
            title: compactWhitespace(item.title),
            url: item.url,
            snippet: compactWhitespace(item.snippet),
            domain,
            sourceType: classifySourceType(item.url, item.title)
        };
    });
}

// KNOWN DIVERGENCE with app.js sortSourcesByType: this server-side copy
// also deprioritizes wikipedia.org within same type rank. The client copy
// in app.js skips that step (it sorts what the server already pre-sorted).
function sortSourcesByType(sources = []) {
    return [...sources].sort((a, b) => {
        const ra = sourceTypeRank(a.sourceType);
        const rb = sourceTypeRank(b.sourceType);
        if (ra !== rb) return ra - rb;
        const aWiki = /wikipedia\.org$/i.test(a.domain || '');
        const bWiki = /wikipedia\.org$/i.test(b.domain || '');
        if (aWiki !== bWiki) return aWiki ? 1 : -1;
        return (a.domain || '').localeCompare(b.domain || '');
    });
}

function buildSearchPlan(question, searchAngles = []) {
    const q = compactWhitespace(question || '');
    const rawPlan = [
        { label: 'video', provider: 'serper', query: `${q} site:youtube.com` },
        { label: 'video', provider: 'duckduckgo', query: `${q} site:youtube.com` },
        { label: 'visual', provider: 'serper', query: `${q} 3blue1brown OR interactive OR visual explanation OR desmos OR geogebra` },
        { label: 'visual', provider: 'duckduckgo', query: `${q} visual explanation interactive demo` },
        { label: 'course', provider: 'serper', query: `${q} lecture notes OR university OR site:.edu OR pdf` },
        { label: 'course', provider: 'duckduckgo', query: `${q} lecture notes university pdf` },
        { label: 'insight', provider: 'serper', query: `${q} intuition OR betterexplained OR brilliant OR tutorial` },
        { label: 'insight', provider: 'duckduckgo', query: `${q} intuition tutorial explained` },
        { label: 'general', provider: 'serper', query: q },
        { label: 'general', provider: 'duckduckgo', query: q },
        { label: 'reference', provider: 'wikipedia', query: `${q} wikipedia OR mathworld OR wolfram` },
        ...searchAngles.flatMap(angle => [
            { label: 'general', provider: 'serper', query: angle },
            { label: 'general', provider: 'duckduckgo', query: angle }
        ])
    ];
    const seen = new Set();
    return rawPlan.filter(entry => {
        const key = `${entry.provider}|${compactWhitespace(entry.query).toLowerCase()}`;
        if (!compactWhitespace(entry.query) || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function shouldKeepWebSource(source = {}) {
    const urlValue = compactWhitespace(source.url || '');
    const title = compactWhitespace(source.title || '');
    if (!urlValue || !title) return false;
    const text = `${urlValue} ${title}`.toLowerCase();
    if (/\/search\?|duckduckgo\.com|google\.com\/search|bing\.com\/search/.test(text)) return false;
    if (/pinterest|facebook|instagram|tiktok|x\.com|twitter\.com/.test(text)) return false;
    if (/reddit|quora/.test(text)) return false;
    if (/coursehero|chegg|brainly|quizlet/.test(text)) return false;
    return true;
}

async function collectWebSources(searchAngles, options = {}) {
    const merged = [];
    const seen = new Set();
    const onSource = typeof options.onSource === 'function' ? options.onSource : null;
    const question = options.question || '';
    const providerStats = {};
    const providerErrors = [];

    const noteProvider = (provider, count = 0, ok = true, message = '') => {
        const key = provider || 'unknown';
        if (!providerStats[key]) providerStats[key] = { attempts: 0, items: 0, ok: 0, failed: 0 };
        providerStats[key].attempts += 1;
        providerStats[key].items += Number(count || 0);
        if (ok) providerStats[key].ok += 1;
        else {
            providerStats[key].failed += 1;
            if (message) providerErrors.push(`${key}: ${message}`);
        }
    };

    const addItems = (items, bucket = 'general') => {
        const enriched = sortSourcesByType(enrichSources(items));
        for (const item of enriched) {
            const key = normalizeUrl(item.url).toLowerCase();
            if (!key || seen.has(key) || !shouldKeepWebSource(item)) continue;
            seen.add(key);
            const source = { ...item, bucket };
            merged.push(source);
            if (onSource) onSource(source, sortSourcesByType(merged));
            if (merged.length >= 18) break;
        }
    };

    const plan = buildSearchPlan(question, searchAngles);
    for (const entry of plan) {
        let items = [];
        try {
            if (entry.provider === 'wikipedia') {
                items = await wikipediaSearch(entry.query);
            } else if (entry.provider === 'serper') {
                items = await serperSearch(entry.query, entry.label === 'general' ? 10 : 6);
            } else {
                items = await duckDuckGoSearch(entry.query);
            }
            noteProvider(entry.provider, items.length, true);
        } catch (err) {
            noteProvider(entry.provider, 0, false, err.message);
            items = [];
        }
        addItems(items, entry.label);
        if (merged.length >= 18) break;
    }

    if (merged.length < 8) {
        for (const angle of uniqueStrings([
            `${question} site:youtube.com`,
            `${question} lecture notes`,
            `${question} intuitive explanation`,
            `${question} 3blue1brown`,
            `${question} site:.edu`,
            `${question} betterexplained`
        ], 6)) {
            let items = await serperSearch(angle, 6);
            noteProvider('serper', items.length, true);
            if (!items.length) {
                items = await duckDuckGoSearch(angle);
                noteProvider('duckduckgo', items.length, true);
            }
            addItems(items, 'fallback');
            if (merged.length >= 18) break;
        }
    }

    const diverse = [];
    const domainCount = new Map();
    for (const item of sortSourcesByType(merged)) {
        const d = item.domain || 'unknown';
        const count = domainCount.get(d) || 0;
        if (count >= 2) continue;
        domainCount.set(d, count + 1);
        diverse.push(item);
        if (diverse.length >= 14) break;
    }

    const finalSources = diverse;
    const debug = {
        requested: true,
        sourceCount: finalSources.length,
        providersUsed: Object.keys(providerStats).filter(key => providerStats[key].items > 0),
        providerStats,
        providerErrors: providerErrors.slice(0, 5),
        serperConfigured: Boolean(process.env.SERPER_API_KEY || ''),
        planCount: plan.length
    };
    console.log(`[Search] collectWebSources: ${finalSources.length} sources for question: ${question || searchAngles.join(' | ')} providers=${debug.providersUsed.join(',') || 'none'}`);
    return { sources: finalSources, debug };
}

function buildBookContext(bookPages) {
    return bookPages.map((page, index) => {
        return [
            `[书页${index + 1}] ${page.page}`,
            `标题: ${page.title || page.page}`,
            `小节: ${page.subsection || '未标注'}`,
            `摘要: ${page.summary || '无摘要'}`,
            `关键词: ${(page.keywords || []).join(', ') || '无'}`,
            'OCR:',
            page.ocrText || '无 OCR 内容'
        ].join('\n');
    }).join('\n\n----------------\n\n');
}

function buildWebContext(webSources) {
    if (!webSources.length) return '无网页来源。';
    return webSources.map((item, index) => {
        return [
            `[来源${index + 1}] ${item.title}`,
            `URL: ${item.url}`,
            `摘要: ${item.snippet || '无摘要'}`
        ].join('\n');
    }).join('\n\n----------------\n\n');
}

const {
    RAGFLOW_ENABLED,
    RAGFLOW_CONFIGURED,
    retrieveFromRagFlow,
    ragFlowChunksToBookPages,
    mergeAskBookContexts,
} = require('./ragflow-client')({ compactWhitespace, normalizeUrl, httpRequestJson });

const guidanceService = require('./guidance-service')({
    createRequestId: () => crypto.randomUUID(),
    retrieveTextbook: async ({ query }) => {
        if (RAGFLOW_ENABLED) {
            if (!RAGFLOW_CONFIGURED) {
                throw new Error('RAGFlow is enabled but its URL or dataset ids are missing');
            }
            const result = await retrieveFromRagFlow({ query, topK: 6 });
            const chunks = result && Array.isArray(result.chunks) ? result.chunks : [];
            return {
                status: chunks.length ? 'hit' : 'empty',
                source: 'ragflow',
                chunks,
            };
        }

        const keywords = await extractKeywords(query);
        const entries = selectRelevantBooks(query, keywords, 0, 6, OCR_DIR_NEW);
        const chunks = entries.map(entry => ({
            page: entry.page,
            sectionTitle: entry.subsection || entry.title || '',
            text: readOCRText(entry.textPath, 8000),
        })).filter(chunk => compactWhitespace(chunk.text));
        return {
            status: chunks.length ? 'hit' : 'empty',
            source: 'local_ocr',
            chunks,
        };
    },
    generateOptions: async ({ messages }) => callOpenRouterChat({
        model: 'openai/gpt-5.4',
        timeoutMs: 60000,
        temperature: 0.35,
        maxTokens: 1000,
        messages,
    }),
    log: (event, details) => console.warn(`[ask-guidance] ${event}`, details),
});

function parseGuidanceSelection(rawGuidance) {
    if (rawGuidance == null) return null;
    if (!rawGuidance || typeof rawGuidance !== 'object' || Array.isArray(rawGuidance)) {
        throw new Error('guidance must be an object');
    }
    const allowedKeys = new Set(['id', 'title', 'instruction']);
    const unknownKey = Object.keys(rawGuidance).find(key => !allowedKeys.has(key));
    if (unknownKey) throw new Error(`Unknown guidance field: ${unknownKey}`);
    const id = compactWhitespace(rawGuidance.id || '');
    const title = compactWhitespace(rawGuidance.title || '');
    const instruction = compactWhitespace(rawGuidance.instruction || '');
    if (!/^path_[1-3]$/.test(id)) throw new Error('Invalid guidance id');
    if (!title || title.length > 24) throw new Error('Invalid guidance title');
    if (!instruction || instruction.length > 240) throw new Error('Invalid guidance instruction');
    return { id, title, instruction };
}

function parseGuidanceRequestBody(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Request body must be an object');
    }
    const allowedKeys = new Set(['prompt', 'history', 'sectionId', 'sectionTitle', 'lessonContext', 'bookSource', 'language']);
    const unknownKey = Object.keys(data).find(key => !allowedKeys.has(key));
    if (unknownKey) throw new Error(`Unknown field: ${unknownKey}`);
    if (typeof data.prompt !== 'string' || !compactWhitespace(data.prompt)) throw new Error('Question is required');
    if (data.prompt.length > 4000) throw new Error('Question cannot exceed 4000 characters');
    if (data.sectionId != null && (typeof data.sectionId !== 'string' || data.sectionId.length > 80)) throw new Error('Invalid sectionId');
    if (data.sectionTitle != null && (typeof data.sectionTitle !== 'string' || data.sectionTitle.length > 180)) throw new Error('Invalid sectionTitle');
    if (data.lessonContext != null && (typeof data.lessonContext !== 'string' || data.lessonContext.length > 1200)) throw new Error('Invalid lessonContext');
    if (data.bookSource != null && data.bookSource !== 'new') throw new Error('bookSource only supports new');
    if (data.language != null && !['zh', 'en'].includes(data.language)) throw new Error('language only supports zh or en');
    if (data.history != null && !Array.isArray(data.history)) throw new Error('history must be an array');
    if (Array.isArray(data.history) && data.history.length > 12) throw new Error('history cannot contain more than 12 messages');
    const history = (data.history || []).map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Invalid history[${index}]`);
        const unknownHistoryKey = Object.keys(item).find(key => !['role', 'content'].includes(key));
        if (unknownHistoryKey) throw new Error(`history[${index}] contains an unknown field`);
        if (!['user', 'assistant'].includes(item.role)) throw new Error(`Invalid history[${index}].role`);
        if (typeof item.content !== 'string' || item.content.length > 2000) throw new Error(`Invalid history[${index}].content`);
        return { role: item.role, content: item.content };
    });
    return {
        prompt: data.prompt,
        history,
        sectionId: data.sectionId || '',
        sectionTitle: data.sectionTitle || '',
        lessonContext: data.lessonContext || '',
        bookSource: 'new',
        language: data.language === 'zh' ? 'zh' : 'en',
    };
}

function inspectLessonGenerationContext(sectionId, sectionTitle, options = {}) {
    const bookSource = options.bookSource === 'new' ? 'new' : 'old';
    const { ocrDir: secOcrDir } = getBookDirs(bookSource);
    const mappedPages = getPagesForSection(sectionId, secOcrDir);
    const localPages = shouldGenerateParentPreludeLesson(sectionId, sectionTitle, mappedPages)
        ? getParentPreludePages(sectionId, sectionTitle, mappedPages)
        : attachSectionOcrToPages(sectionId, mappedPages, bookSource);
    return {
        sectionId,
        sectionTitle,
        bookSource,
        lessonContextSource: 'local_ocr',
        mappedPageCount: mappedPages.length,
        localPageCount: localPages.length,
        finalBookPageCount: localPages.length,
        localPages: localPages.map(page => ({
            page: page.page,
            title: page.title,
            subsection: page.subsection,
            hasOcrOverride: Object.prototype.hasOwnProperty.call(page, 'ocrOverrideText')
        }))
    };
}

async function generateExplanation(question, bookPages, webSources, options = {}) {
    const history = Array.isArray(options.history) ? options.history : [];
    const sectionTitle = compactWhitespace(options.sectionTitle || '');
    const lessonContext = compactWhitespace(options.lessonContext || '');
    const language = options.language === 'zh' ? 'zh' : 'en';
    const mode = options.mode || 'ask';
    const userProfilePrompt = options.userProfilePrompt || '';
    const attachments = Array.isArray(options.attachments) ? options.attachments : [];
    const preparedAttachments = options.preparedAttachments || null;
    const answerLength = options.answerLength || 'medium';
    const examPriorityGuidance = options.examPriorityGuidance || null;
    const guidance = options.guidance || null;
    const examPriorityAnswerHint = examPriorityGuidance && examPriorityGuidance.json
        ? [
            `Source: ${examPriorityGuidance.source || 'unknown'}`,
            `Relevant topic ids: ${((examPriorityGuidance.json.topic_filter || {}).relevant_topic_ids || []).join(', ') || 'none'}`,
            `High-priority concepts: ${(examPriorityGuidance.json.high_priority_concepts || []).slice(0, 8).join('; ') || 'none'}`,
            `High-priority problem types: ${(examPriorityGuidance.json.high_priority_problem_types || []).slice(0, 8).join('; ') || 'none'}`,
            `Common traps: ${(examPriorityGuidance.json.common_traps || []).slice(0, 8).join('; ') || 'none'}`
        ].join('\n')
        : '';

    let lengthInstruction = '';
    if (answerLength === 'short') {
        lengthInstruction = language === 'zh'
            ? '10. [CRITICAL] 用户选择了 SHORT。最终答案必须控制在 1-2 句内，优先 1 句；总长度尽量不超过 60 个中文字符。禁止分点、禁止长公式推导、禁止举多个例子、禁止开场白、禁止总结段。只保留最核心的直接回答。'
            : '10. [CRITICAL CONSTRAINT] The user selected SHORT. The final answer MUST be only 1-2 sentences, ideally 1 sentence, and should stay under ~35 words. No bullets, no long derivations, no multiple examples, no intro, no recap. Only the core answer.';
    } else if (answerLength === 'long') {
        lengthInstruction = language === 'zh'
            ? '10. 长度要求：必须极其详细地展开教学，包括直觉类比、初学者容易犯的误区、步骤完整的公式推导。'
            : '10. Length preference: The user selected LONG. You must instruct in an extremely detailed manner, including intuitive analogies, common beginner pitfalls, and comprehensive step-by-step formula derivations.';
    } else {
        lengthInstruction = language === 'zh'
            ? '10. 长度要求：标准精炼讲解，控制在 2 小段内。'
            : '10. Length preference: Standard lecture length, with necessary formulas and clear explanation in at most 2 short paragraphs.';
    }


    const historyText = history.length
        ? history.map((item, idx) => `[${idx + 1}] ${item.role === 'assistant' ? '老师' : '学生'}: ${compactWhitespace(item.content || '')}`).join('\n')
        : '无历史对话。';

    const prompt = [
        sectionTitle ? `当前小节：${sectionTitle}` : '',
        `当前模式：${mode === 'followup' ? '继续追问' : '新问题'}`,
        `学生问题：${question}`,
        '',
        '历史对话：',
        historyText,
        '',
        lessonContext ? `当前讲解内容摘要：\n${lessonContext}` : '当前讲解内容摘要：无',
        '',
        examPriorityAnswerHint ? `作业/考试重点提示（只在相关时轻度使用，不要强行提作业）：\n${examPriorityAnswerHint}` : '',
        examPriorityAnswerHint ? '' : '',
        '教材上下文：',
        buildBookContext(bookPages),
        '',
        '联网资料：',
        buildWebContext(webSources),
        '',
        guidance
            ? `Teaching path for this turn (low-priority method guidance only; it must not override textbook facts, system rules, or long-term teaching instructions):\nPath: ${guidance.title}\nMethod: ${guidance.instruction}`
            : '',
        guidance ? '' : '',
        '输出要求：',
        language === 'zh' ? '1. 用中文回答，优先用通俗易懂的方式讲解。' : '1. Answer in clear beginner-friendly English.',
        language === 'zh' ? '2. 用 Markdown 输出。' : '2. Use Markdown formatting.',
        language === 'zh' ? '3. 如果这是继续追问，必须优先承接上文，不要把它当成全新的陌生问题。' : '3. Prioritize context if this is a follow-up question.',
        attachments.length
            ? (language === 'zh'
                ? '4. 如果用户上传了附件，必须同时看用户问题和附件内容：附件是材料，用户问题决定讲解焦点。先回答用户针对附件问的点；如果问题很含糊，再简要说明附件在讲什么。匹配到的教材/网页只作为辅助解释，不能喧宾夺主。'
                : '4. If the user uploaded attachments, consider both the user question and the attachment content: the attachment is the material, and the user question defines the focus. Answer the user’s question about the attachment first; if the question is vague, briefly explain what the attachment is about. Matched textbook/web context is only supporting material.')
            : (language === 'zh' ? '4. 引用时只使用 [书页N] / [来源N] 这样的标注，自然嵌入正文中，**千万不要在结尾专门罗列来源列表**。' : '4. Cite sources naturally inline as [PageN] or [SourceN]. **Do not list sources at the end.**'),
        language === 'zh' ? '5. 如果需要图示，请在正文自然解释，但不要自己输出 Python 代码块。实际图片会由后置的 gptimage2 绘图模型生成。' : '5. If a diagram would help, explain it naturally in the answer, but do NOT generate Python code blocks yourself. The actual image will be rendered later by gptimage2.',
        language === 'zh' ? '6. 如果出现数学公式，使用 LaTeX，块级公式写成 $$...$$，行内公式写成 $...$。' : '6. Use LaTeX for math. $$...$$ for block, $...$ for inline.',
        language === 'zh' ? '7. 优先结合教材，再补充联网资料。' : '7. Prioritize textbook content, then web sources.',
        language === 'zh' ? '8. 如果联网资料为空，也照常基于书页完成讲解。' : '8. Answer using book context if web sources are empty.',
        examPriorityAnswerHint
            ? (language === 'zh'
                ? '9. 如果问题与上述作业/考试重点相关，回答要优先点出常考判断方法、典型题型或常见坑；如果不相关，不要硬扯作业。'
                : '9. If the question matches the homework/exam priority hint, emphasize the tested procedure, representative problem type, or common trap. If it does not match, do not force homework framing.')
            : '',
        lengthInstruction
    ].filter(Boolean).join('\n');

    let userContent;
    const imageAttachments = attachments.filter(a => a.type === 'image' && a.dataUrl);
    const pdfAttachments = attachments.filter(a => a.type === 'pdf' && a.dataUrl);
    const wordAttachments = attachments.filter(a => (a.type === 'document' || a.type === 'word') && compactWhitespace(a.text || ''));
    const extractedPdfs = preparedAttachments && Array.isArray(preparedAttachments.extractedPdfs)
        ? preparedAttachments.extractedPdfs
        : (await prepareAttachmentContext(attachments)).extractedPdfs;

    let attachmentContext = '';
    const pdfVisualImages = [];
    for (const pdf of extractedPdfs) {
        if (pdf.text) {
            attachmentContext += `\n\n[Attached PDF text: ${pdf.name}]\n${pdf.text}\n`;
        } else {
            attachmentContext += `\n\n[Attached PDF: ${pdf.name}]\nCould not extract selectable text from this PDF. Analyze the attached rendered page images if present; otherwise say clearly that the PDF could not be read.\n`;
        }
        if (pdf.pageImages && pdf.pageImages.length) {
            pdfVisualImages.push(...pdf.pageImages.map(url => ({
                name: pdf.name,
                dataUrl: url
            })));
        }
    }
    for (const doc of wordAttachments) {
        attachmentContext += `\n\n[Attached Word document: ${doc.name}]\n${String(doc.text || '').slice(0, 120000)}\n`;
    }

    const visualAttachments = imageAttachments.concat(pdfVisualImages);
    if (visualAttachments.length > 0) {
        userContent = [
            { type: 'text', text: prompt + attachmentContext || '(Please analyze the attached image/PDF page(s))' },
            ...visualAttachments.map(img => ({
                type: 'image_url',
                image_url: { url: img.dataUrl }
            }))
        ];
    } else {
        userContent = prompt + attachmentContext;
    }

    console.log('[ASK] Pipeline Step 1/3: Generating teaching plan with Gemini...');
    let teachingPlan = '';
    try {
        const planFormat = language === 'zh'
            ? `请你作为课程策划，基于上述用户的提问、教材上下文、历史对话，设计一份分步骤的讲解指导计划。另外，当前用户指定的长短要求是【${answerLength}】，如果要求极简请出 1-2 步重点，如果要求巨细说明请列全面大纲。不要直接写答案，只输出【解答策略】和【逻辑提纲】。`
            : 'As an educational planner, read the user question, textbook context, and history, then create a step-by-step teaching blueprint. This will be passed to another model for the final generation. Do NOT output the final answer to the user. Output ONLY the [Response Strategy] and [Logical Outline].';

        const planPrompt = typeof userContent === 'string'
            ? userContent + `\n\n【Planner Instructions】\n${planFormat}`
            : [{ type: 'text', text: `【Planner Instructions】\n${planFormat}\n\n` }].concat(userContent);

        teachingPlan = await callOpenRouterChat({
            model: 'openai/gpt-5.4',
            timeoutMs: 60000,
            temperature: 0.3,
            maxTokens: 1000,
            messages: [{ role: 'user', content: planPrompt }]
        });
        console.log('[ASK] Plan generated successfully.');
    } catch (err) {
        console.warn('[ASK] Plan generation failed, falling back to direct generation.', err.message);
    }

    let finalPrompt = userContent;
    if (teachingPlan) {
        const planInsert = `\n\n【Tutor Blueprint (Follow this plan strictly)】\n${teachingPlan}\n\n`;
        if (typeof finalPrompt === 'string') finalPrompt += planInsert;
        else finalPrompt[0].text += planInsert;
    }

    console.log('[ASK] Pipeline Step 2/3: Generating final explanation with Haiku (fast follow-up)...');
    let explanation = await callOpenRouterChat({
        model: 'anthropic/claude-haiku-4.5',
        timeoutMs: 120000,
        temperature: 0.35,
        maxTokens: 3200,
        messages: [
            {
                role: 'system',
                content: language === 'zh'
                    ? '你是一位耐心、准确、会讲人话的理工科导师，但**你绝对不要做无痛喂饭的复读机**。请基于给定教材 OCR、网页摘要和已有对话上下文生成结构化讲解。\n【追问处理必须遵循的核心法则】：\n当学生答错测验题、或者对概念理解有偏差（哪怕只有一点点）时，**绝对不要直接给出正确答案或马上把定义贴给他**。你必须：\n1. 指出他结论中哪个环节的逻辑断链了；\n2. 抛出一个基于他当前错误逻辑的**反例或极其刁钻的反问**，逼他自己发现矛盾；\n3. 像苏格拉底一样，一层一层用提问扒光他的盲点，直到他自己说出正确的推演逻辑，你再帮他总结。\n（对于 follow-up 问题，必须延续上下文。绝对不要输出 ```python 代码块...）\n绝对不要输出 ASCII 图、纯文本示意图、字符画坐标轴，**严禁**自己伪造 `![Generated Visualization](/generated/...)` 这类的图片链接；如果需要图示，只能在正文里用文字说明，后置的 gptimage2 绘图模型会自动接管画图。' + userProfilePrompt
                    : 'You are a STEM tutor with a strict Socratic method. Generate structured explanations based on the given textbook OCR, web summaries, and conversation history.\n**Crucial rule for follow-ups/wrong answers:**\nIf the student is wrong or misunderstands a concept, DO NOT give away the answer immediately or copy-paste definitions. Instead:\n1. Identify the exact flaw in their logic.\n2. Present a "gotcha" counter-example or probing question based on their own flawed reasoning to expose the contradiction.\n3. Make them realize their own mistake and guide them to the correct conclusion via questions step-by-step.\nNever output ```python code blocks, ASCII diagrams, plain-text sketches, or character-drawn axes, and **NEVER** hallucinate or output markdown image links like `![Generated Visualization](/generated/...)` yourself; if a figure is needed, mention it in prose only and leave the actual image rendering to the subsequent gptimage2 drawing model.' + userProfilePrompt
            },
            {
                role: 'user',
                content: finalPrompt
            }
        ]
    });

    // Remove any hallucinated static image tags if the first agent incorrectly fabricated them
    explanation = explanation.replace(/!\[[^\]]*\]\(\/generated\/[^)]+\)/g, '');
    explanation = stripDiagramFallbackBlocks(explanation);

    const explicitDiagramRequest = /配图讲解|配图|画图讲解|请画图|给我画图|给我一张图|画个图|出图|示意图|帮我画|配一张图|附图|图解|带图讲解|用图讲解|illustrate|illustration|with diagram|with a diagram|with figure|with a figure|show me a diagram|show me a figure|give me a diagram|give me a figure|add a diagram|add a figure|include a diagram|include a figure|draw (?:me )?(?:a )?diagram|draw (?:me )?(?:a )?figure|visual aid|visual explanation/i.test(question);
    if (!explicitDiagramRequest) return explanation;

    console.log('[ASK] Pipeline Step 3/3: Generating gptimage2 visual brief...');
    try {
        const imagePromptRequest = [
            language === 'zh'
                ? '你是一位只负责教学图设计的学术可视化导演。不要写正文讲解，只输出一段可以直接交给 gptimage2 的英文图片 prompt。'
                : 'You are an academic visualization director. Do not write lesson prose. Output only one English image prompt that can be sent directly to gptimage2.',
            language === 'zh'
                ? '硬性要求：纯白干净背景；lecture notes 风格；只讲一个知识点；必须有唯一阅读路径；使用少量低饱和彩色框框和标注；颜色仅限 navy / muted teal / soft gray，warning 可用 muted red；无卡通、无海报感、无花哨装饰、无 dense text blocks、无 full derivation、无 extra examples。'
                : 'Hard requirements: pure white clean background; lecture-notes style; teach exactly one knowledge point; enforce a single clear reading path; use a small amount of low-saturation colored boxes and callouts; colors limited to navy, muted teal, soft gray, with muted red only for warnings; no cartoon feel, no poster feel, no decorative clutter, no dense text blocks, no full derivation, no extra examples.',
            language === 'zh'
                ? '输出必须是英文图片 prompt，不要加引号，不要解释，不要编号。'
                : 'Output must be a plain English image prompt only. No quotes, no explanations, no numbering.',
            '',
            `Question: ${question}`,
            '',
            'Textbook context:',
            buildBookContext(bookPages),
            '',
            'Explanation to support:',
            explanation
        ].join('\n');

        const imagePrompt = await callOpenRouterChat({
            model: 'anthropic/claude-haiku-4.5',
            timeoutMs: 90000,
            temperature: 0.2,
            maxTokens: 700,
            messages: [
                {
                    role: 'system',
                    content: language === 'zh'
                        ? '你专门把教学内容改写成适合 gptimage2 的图片提示词。输出必须短、准、可渲染。'
                        : 'You rewrite teaching intent into concise, renderable prompts for gptimage2. Output must be short, precise, and directly usable.'
                },
                { role: 'user', content: imagePromptRequest }
            ]
        });

        const finalImagePrompt = String(imagePrompt || '').trim();
        if (finalImagePrompt) {
            console.log('[ASK] gptimage2 final image prompt:', finalImagePrompt.slice(0, 400));
            const imgResult = await callTutorSkillRaw(finalImagePrompt);
            const urls = extractRenderableImageUrls(imgResult);
            console.log('[ASK] gptimage2 extracted image count:', urls.length);
            if (urls.length > 0) {
                explanation += `\n\n![Generated Visualization](${urls[0]})\n`;
            } else {
                console.warn('[ASK] gptimage2 returned no renderable image URLs. Raw prefix:', String(imgResult || '').slice(0, 500));
                explanation = stripDiagramFallbackBlocks(explanation);
            }
        }
    } catch (err) {
        console.warn('[ASK] gptimage2 diagram generation failed:', err.message);
        explanation = stripDiagramFallbackBlocks(explanation);
    }

    return explanation;
}


/**
 * 根据小节ID精确查找对应书页
 */
function extractSectionCode(sectionId) {
    // 从 "B.2 Sinusoids" / "1.3-1 Time Shifting" 等格式中提取编号部分
    // 匹配 B.x, B.x-y, x.y, x.y-z 等格式
    const m = String(sectionId || '').match(/^([A-Za-z]?\.?\d+(?:[.-]\d+)*)/);
    return m ? m[1].toLowerCase() : compactWhitespace(sectionId || '').toLowerCase();
}

function matchesBookSourcePageId(pageId = '', bookSource = 'new') {
    const page = compactWhitespace(pageId || '').toLowerCase();
    if (!page) return false;
    return bookSource === 'new'
        ? /^page-\d{3}$/.test(page)
        : /^book-\d{3}$/.test(page);
}

function filterPagesForBookSource(items = [], bookSource = 'new') {
    return (Array.isArray(items) ? items : []).filter(item => matchesBookSourcePageId(item && item.page, bookSource));
}

function getPagesForSection(sectionId, _ocrDir) {
    const code = extractSectionCode(sectionId);
    if (!code) return [];

    const codeUpper = code.toUpperCase().replace(/^([a-z])/, c => c.toUpperCase());
    const mapKey = Object.keys(SECTION_PAGE_MAP_NEW).find(
        k => k.toLowerCase() === code.toLowerCase() || k.toLowerCase() === codeUpper.toLowerCase()
    );
    if (mapKey) {
        const pageNames = SECTION_PAGE_MAP_NEW[mapKey];
        return pageNames.map(pn => ({
            page: pn,
            pageImage: pn + '.png',
            image: getPageImageUrl('new', `${pn}.png`),
            textPath: path.join(OCR_DIR_NEW, `${pn}.txt`),
            subsection: code,
            title: sectionId,
            summary: '',
            keywords: []
        }));
    }
    // parent fallback
    const parentCode = code.replace(/-\d+$/, '');
    if (parentCode !== code) {
        const parentKey = Object.keys(SECTION_PAGE_MAP_NEW).find(k => k.toLowerCase() === parentCode.toLowerCase());
        if (parentKey) {
            return SECTION_PAGE_MAP_NEW[parentKey].map(pn => ({
                page: pn,
                pageImage: pn + '.png',
                image: getPageImageUrl('new', `${pn}.png`),
                textPath: path.join(OCR_DIR_NEW, `${pn}.txt`),
                subsection: parentCode,
                title: sectionId,
                summary: '',
                keywords: []
            }));
        }
    }
    return [];
}

/**
 * 生成小节导读（2-3 句话）
 */
async function generateSectionIntro(sectionId, sectionTitle, bookPages, language = 'en') {
    const ocrSnippets = bookPages.slice(0, 3).map((p, i) => {
        if (Object.prototype.hasOwnProperty.call(p, 'ocrOverrideText')) {
            return p.ocrOverrideText ? `[Section OCR]\n${String(p.ocrOverrideText || '').slice(0, 1800)}` : '';
        }
        const txt = readOCRText(p.textPath, 1200);
        return `[Page ${i+1}]\n${txt}`;
    }).filter(Boolean).join('\n\n');

    const isZh = language === 'zh';
    const prompt = isZh ? [
        `小节：${sectionTitle || sectionId}`,
        '',
        '以下是教材原文节选：',
        ocrSnippets,
        '',
        '请用 2-3 句话回答以下三点（每点一句，用中文，面向零基础学生）：',
        '1. 这节讲什么？',
        '2. 为什么重要？',
        '3. 学完你能做什么？',
        '',
        '直接输出三句话，不要标题、不要编号、不要多余内容。'
    ].join('\n') : [
        `Section: ${sectionTitle || sectionId}`,
        '',
        'Textbook excerpt:',
        ocrSnippets,
        '',
        'In 2-3 sentences for a beginner student, answer:',
        '1. What does this section cover?',
        '2. Why does it matter?',
        '3. What will you be able to do after learning it?',
        '',
        'Output the sentences directly, no headers, no numbering, no extra content.'
    ].join('\n');

    const systemPrompt = isZh
        ? '你是一位理工科教师，擅长用简单语言介绍知识点。'
        : 'You are an engineering tutor who explains topics clearly and concisely for beginners. Always respond in English.';

    return callOpenRouterChat({
        model: 'anthropic/claude-haiku-4.5',
        timeoutMs: 30000,
        temperature: 0.3,
        maxTokens: 200,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ]
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// DUAL-AGENT PIPELINE
// Agent A (Planner):  OpenAI gpt-5.5  — produces Rendering Blueprint JSON
// Agent B (Executor): OpenRouter Claude Sonnet 4.6 — executes each block into final MD
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_A_MODEL = process.env.TUTOR_AGENT_A_MODEL || 'gpt-5.5';
const AGENT_B_MODEL = process.env.TUTOR_AGENT_B_MODEL || 'anthropic/claude-sonnet-4.6';
const EXAM_PRIORITY_DIR = path.join(TUTOR_MATERIALS_DIR, 'exam-priority');

const PREGEN_STYLE_COMBOS = [
    ['example_first'],
    ['principle_first'],
    ['visual'],
    ['step_by_step'],
    ['example_first', 'visual'],
    ['principle_first', 'step_by_step']
];

const PREGEN_OUTCOME_COMBOS = [
    ['one_liner'],
    ['worked_example'],
    ['exam_cheatsheet'],
    ['formula_ref'],
    ['one_liner', 'worked_example'],
    ['exam_cheatsheet', 'formula_ref']
];

function isBackgroundSection(sectionId = '', sectionTitle = '') {
    const id = compactWhitespace(String(sectionId || ''));
    const title = compactWhitespace(String(sectionTitle || ''));
    return /^B(?:[.-]|$)/i.test(id) || /\bbackground\b/i.test(title);
}

function isChapterOneSection(sectionId = '', sectionTitle = '') {
    const code = extractSectionCode(sectionId || sectionTitle).toLowerCase();
    const title = compactWhitespace(String(sectionTitle || '')).toLowerCase();
    return /^1(?:[.\-]|$)/.test(code)
        || /\bchapter\s*1\b/.test(title)
        || /\bintroduction to signals and systems\b/.test(title);
}

function isHistoricalBackgroundNote(sectionId = '', sectionTitle = '') {
    const id = compactWhitespace(String(sectionId || ''));
    const title = compactWhitespace(String(sectionTitle || ''));
    return /^B[.\-]?1[.\-]?1$/i.test(id) || /\bhistorical note\b/i.test(title);
}

function classifyBackgroundSection(sectionId = '', sectionTitle = '') {
    const id = compactWhitespace(String(sectionId || ''));
    const title = compactWhitespace(String(sectionTitle || '')).toLowerCase();

    if (isHistoricalBackgroundNote(id, title)) return 'historical_note';
    if (/sinusoid|phasor|exponential/i.test(title) || /^B[.\-]?2(?:[.\-]|$)/i.test(id)) return 'computational_core';
    if (/algebra of complex numbers|complex numbers and their algebra|complex algebra/i.test(title) || /^B[.\-]?1[.\-]?2$/i.test(id)) return 'computational_core';
    if (/introduction|overview|background/i.test(title)) return 'conceptual_intro';
    return 'background_general';
}

function getExamPriorityTopicBuckets() {
    return {
        complex_algebra: {
            label: 'Complex-number representation and algebra',
            sectionHints: ['B.1-2'],
            includeWhen: (sectionId = '', sectionTitle = '') => {
                const code = extractSectionCode(sectionId || sectionTitle).toLowerCase();
                const title = compactWhitespace(sectionTitle).toLowerCase();
                return /^b[.\-]?1[.\-]?2$/i.test(code)
                    || /algebra of complex numbers|complex algebra/.test(title);
            },
            concepts: [
                'Cartesian form of complex numbers',
                'Polar / exponential form of complex numbers',
                'Complex-plane interpretation',
                'Conversion between Cartesian and polar forms',
                'Multiplication and division of complex numbers',
                'Powers and reciprocals of complex numbers',
                'Real and imaginary parts of a complex-valued function',
                'Magnitude and phase of a complex-valued function'
            ],
            problemTypes: [
                'Convert Cartesian to polar',
                'Convert polar/exponential to Cartesian',
                'Place numbers on the complex plane',
                'Compute product and quotient in both forms',
                'Compute scalar multiples, powers, and reciprocals',
                'Rewrite a rational complex function in Cartesian form',
                'Extract real and imaginary parts',
                'Rewrite a complex function in polar form and compute magnitude/angle'
            ],
            examplePatterns: [
                'a + jb to r*e^(jθ)',
                'r*e^(jθ) to a + jb',
                'nontrivial multiplication and division',
                'reciprocal in polar form',
                'power in polar form',
                'real/imaginary/magnitude/angle extraction from F(ω)'
            ],
            traps: [
                'Wrong quadrant when computing angle',
                'Forgetting magnitude must be nonnegative',
                'Dropping the sign of the imaginary part',
                'Doing invalid termwise multiplication in Cartesian form',
                'Forgetting argument subtraction in division',
                'Missing conjugate logic in simplification'
            ]
        },
        sinusoid_phasor: {
            label: 'Sinusoid and phasor compression',
            sectionHints: ['B.2', 'B.2-1'],
            includeWhen: (sectionId = '', sectionTitle = '') => {
                const code = extractSectionCode(sectionId || sectionTitle).toLowerCase();
                const title = compactWhitespace(sectionTitle).toLowerCase();
                return /^b[.\-]?2(?:[.\-]?1)?$/i.test(code)
                    || /sinusoid|phasor|addition of sinusoids/.test(title);
            },
            concepts: [
                'Phasor interpretation of sinusoidal terms',
                'Converting a cosine-sine combination into a single sinusoid'
            ],
            problemTypes: [
                'Combine sinusoidal terms into one sinusoid'
            ],
            examplePatterns: [
                'cos(ωt) + k sin(ωt) to one sinusoid',
                'a cos(ωt) - b sin(ωt) to one sinusoid with phase explanation'
            ],
            traps: [
                'Confusing radians and informal degree intuition',
                'Getting phase sign wrong in sinusoid compression',
                'Giving amplitude without final phase-adjusted sinusoid'
            ]
        },
        signal_size: {
            label: 'Signal size: energy, power, and rms',
            sectionHints: ['1.1', '1.1-1', '1.1-2'],
            source: 'chapter1_hw2_distilled',
            includeWhen: (sectionId = '', sectionTitle = '') => {
                const code = extractSectionCode(sectionId || sectionTitle).toLowerCase();
                const title = compactWhitespace(sectionTitle).toLowerCase();
                return /^1[.\-]1(?:[.\-][12])?$/i.test(code)
                    || /\benergy\b|\bpower\b|\brms\b|size of a signal/.test(title);
            },
            concepts: [
                'Signal energy',
                'Signal power',
                'RMS value',
                'Scaling effects',
                'Cross terms in signal combinations'
            ],
            problemTypes: [
                'Compute energy of sums/differences',
                'Compute power and rms of periodic signals',
                'Analyze scaling and sign-change effects'
            ],
            examplePatterns: [
                'Energy of x(t)+y(t) and x(t)-y(t)',
                'Power/rms under -f(t), 2f(t), and c f(t)'
            ],
            traps: [
                'Assuming sign change changes power',
                'Forgetting time average',
                'Dropping cross terms'
            ]
        },
        signal_transformations: {
            label: 'Signal transformations and graph literacy',
            sectionHints: ['1.2', '1.2-1', '1.2-2', '1.2-3', '1.2-4', '1.3', '1.3-3'],
            source: 'chapter1_hw2_distilled',
            includeWhen: (sectionId = '', sectionTitle = '') => {
                const code = extractSectionCode(sectionId || sectionTitle).toLowerCase();
                const title = compactWhitespace(sectionTitle).toLowerCase();
                return /^1[.\-][23](?:[.\-][1-5])?$/i.test(code)
                    || /time shift|time scaling|time reversal|combined operation|classification of signals|signal operation/.test(title);
            },
            concepts: [
                'Time shifting',
                'Time scaling',
                'Time reversal',
                'Combined transformations'
            ],
            problemTypes: [
                'Sketch transformed signals',
                'Determine order of operations in f(a t + b)'
            ],
            examplePatterns: [
                'Sketch f(t-a), f(t/a), f(-t), f(2t-4), and f(2-t)'
            ],
            traps: [
                'Shift direction reversal',
                'Wrong order for f(2t-4)',
                'Mistaking compression for expansion'
            ]
        },
        step_impulse_signal_models: {
            label: 'Unit step, impulse, derivative, and integral models',
            sectionHints: ['1.4', '1.4-1', '1.4-2', '1.4-3'],
            source: 'chapter1_hw2_distilled',
            includeWhen: (sectionId = '', sectionTitle = '') => {
                const code = extractSectionCode(sectionId || sectionTitle).toLowerCase();
                const title = compactWhitespace(sectionTitle).toLowerCase();
                return /^1[.\-]4(?:[.\-][1-3])?$/i.test(code)
                    || /unit step|unit impulse|exponential function|signal model|delta|impulse|step function/.test(title);
            },
            concepts: [
                'Unit-step windows',
                'Graph-to-expression conversion',
                'Impulse sifting',
                'Differentiating discontinuities',
                'Running integral as accumulated area'
            ],
            problemTypes: [
                'Build/sketch step-gated signals',
                'Simplify g(t) delta(t-a)',
                'Evaluate impulse integrals',
                'Differentiate and integrate plotted signals'
            ],
            examplePatterns: [
                'Represent a pulse with u(t-a)-u(t-b)',
                'Simplify g(t) delta(t-a) by evaluating g(a)',
                'Evaluate integral f(tau) delta(t-tau) d tau',
                'Differentiate a signal with jumps and add impulse terms',
                'Sketch accumulated area integral from -infinity to t'
            ],
            traps: [
                'Wrong impulse support',
                'Forgetting jump impulses',
                'Confusing impulse height with impulse area'
            ]
        },
        complex_frequency_signal_models: {
            label: 'Complex frequencies for exponentially varying sinusoids',
            sectionHints: ['1.4-3', '1.4'],
            source: 'chapter1_hw2_distilled',
            includeWhen: (sectionId = '', sectionTitle = '') => {
                const code = extractSectionCode(sectionId || sectionTitle).toLowerCase();
                const title = compactWhitespace(sectionTitle).toLowerCase();
                return /^1[.\-]4[.\-]3$/i.test(code)
                    || /exponential function|complex frequenc|e\^st/.test(title);
            },
            concepts: [
                'Complex frequency s = sigma + j omega',
                'Damped and growing sinusoids',
                's-plane location'
            ],
            problemTypes: [
                'Locate sigma +/- j omega in the complex plane'
            ],
            examplePatterns: [
                'Locate sigma +/- j omega for damped or growing sinusoids'
            ],
            traps: [
                'Confusing real-axis growth/decay with imaginary-axis oscillation',
                'Forgetting cosine has conjugate frequency pair'
            ]
        },
        even_odd_decomposition: {
            label: 'Even and odd components',
            sectionHints: ['1.5', '1.5-1', '1.5-2'],
            source: 'chapter1_hw2_distilled',
            includeWhen: (sectionId = '', sectionTitle = '') => {
                const code = extractSectionCode(sectionId || sectionTitle).toLowerCase();
                const title = compactWhitespace(sectionTitle).toLowerCase();
                return /^1[.\-]5(?:[.\-][12])?$/i.test(code)
                    || /even|odd|symmetr/.test(title);
            },
            concepts: [
                'Even component',
                'Odd component',
                'Symmetry check'
            ],
            problemTypes: [
                'Compute x_e(t) and x_o(t)',
                'Recognize already-even/already-odd signals'
            ],
            examplePatterns: [
                'Decompose t u(t) into even and odd components'
            ],
            traps: [
                'Forgetting x(-t)',
                'Assuming a causal signal has no even component',
                'Failing to simplify already-even cosine'
            ]
        },
        system_properties: {
            label: 'System property classification',
            sectionHints: ['1.7', '1.7-1', '1.7-2', '1.7-3', '1.7-4', '1.7-7'],
            source: 'chapter1_hw2_distilled',
            includeWhen: (sectionId = '', sectionTitle = '') => {
                const code = extractSectionCode(sectionId || sectionTitle).toLowerCase();
                const title = compactWhitespace(sectionTitle).toLowerCase();
                return /^1[.\-]7(?:[.\-][1-8])?$/i.test(code)
                    || /classification of systems|linear|time-invariant|time varying|causal|invertible|stable|system propert/.test(title);
            },
            concepts: [
                'Linearity',
                'Time invariance',
                'Causality',
                'Invertibility'
            ],
            problemTypes: [
                'Classify systems from equations',
                'Apply delay test',
                'Check future dependence',
                'Recover input from output when possible'
            ],
            examplePatterns: [
                'Test linearity on f^2(t), affine offsets, squared derivatives, and f(t) df/dt',
                'Test time invariance on delay, time scaling, fixed-window integration, and derivative-square systems',
                'Test causality for f(-t) and f(at)',
                'Find inverse relation for y(t)=integral f and y(t)=f(3t-6)'
            ],
            traps: [
                'Input nonlinearity',
                'Output derivative squared',
                'Affine offsets',
                'Time scaling vs time invariance',
                'Causality for f(at)',
                'Many-to-one mappings'
            ]
        }
    };
}

function filterExamPriorityGuidanceForSection(sectionId = '', sectionTitle = '', rawGuidance = {}) {
    const buckets = getExamPriorityTopicBuckets();
    const relevantTopics = Object.entries(buckets)
        .filter(([, bucket]) => (!bucket.source || bucket.source === rawGuidance.source) && bucket.includeWhen(sectionId, sectionTitle))
        .map(([id, bucket]) => ({ id, ...bucket, includeWhen: undefined }));
    const previewOnlyTopics = Object.entries(buckets)
        .filter(([, bucket]) => !bucket.source || bucket.source === rawGuidance.source)
        .filter(([id]) => !relevantTopics.some(topic => topic.id === id))
        .map(([id, bucket]) => ({ id, label: bucket.label, sectionHints: bucket.sectionHints }));

    const sectionType = classifyBackgroundSection(sectionId, sectionTitle);
    if (!relevantTopics.length || (isBackgroundSection(sectionId, sectionTitle) && sectionType === 'historical_note')) return null;

    const flatten = (key) => [...new Set(relevantTopics.flatMap(topic => topic[key] || []))];
    const displaySource = rawGuidance.source === 'chapter1_hw2_distilled'
        ? 'Chapter 1 HW2 Distillation'
        : 'Background HW1 Distillation';
    return {
        ...rawGuidance,
        filtered: true,
        sectionId,
        sectionTitle,
        relevantTopics,
        previewOnlyTopics,
        json: {
            source_pdf: rawGuidance?.json?.source_pdf,
            scope: rawGuidance?.json?.scope || 'background',
            topic_filter: {
                section_id: sectionId,
                section_title: sectionTitle,
                relevant_topic_ids: relevantTopics.map(topic => topic.id),
                preview_only_topic_ids: previewOnlyTopics.map(topic => topic.id),
                rule: 'Only relevant topics may shape lesson structure, examples, quizzes, and Key Takeaways. Preview-only topics may receive at most one short bridge sentence and must not be listed as core formulas.'
            },
            high_priority_concepts: flatten('concepts'),
            high_priority_problem_types: flatten('problemTypes'),
            required_example_patterns: flatten('examplePatterns'),
            common_traps: flatten('traps'),
            explanation_bias: rawGuidance?.json?.explanation_bias || null,
            quiz_bias: rawGuidance?.json?.quiz_bias || null
        },
        markdown: [
            `# ${displaySource} — Section Filtered`,
            '',
            `Current section: ${sectionId || sectionTitle}`,
            `Relevant topic buckets: ${relevantTopics.map(topic => topic.id).join(', ')}`,
            previewOnlyTopics.length ? `Preview-only topic buckets: ${previewOnlyTopics.map(topic => topic.id).join(', ')}` : 'Preview-only topic buckets: none',
            '',
            '## Relevant Concepts',
            ...flatten('concepts').map(item => `- ${item}`),
            '',
            '## Relevant Problem Types',
            ...flatten('problemTypes').map(item => `- ${item}`),
            '',
            '## Required Example Patterns',
            ...flatten('examplePatterns').map(item => `- ${item}`),
            '',
            '## Common Traps',
            ...flatten('traps').map(item => `- ${item}`),
            '',
            '## Hard Rule',
            '- Section identity wins. Do not import formulas, examples, quiz bias, or Key Takeaways from non-relevant topic buckets.',
            '- Preview-only topics are limited to one short bridge sentence and must not become a teaching page.'
        ].join('\n')
    };
}

function loadExamPriorityGuidance(sectionId = '', sectionTitle = '') {
    const useBackground = isBackgroundSection(sectionId, sectionTitle);
    const useChapterOne = isChapterOneSection(sectionId, sectionTitle);
    if (!useBackground && !useChapterOne) return null;

    if (useBackground) {
        const sectionType = classifyBackgroundSection(sectionId, sectionTitle);
        if (sectionType === 'historical_note') return null;
    }

    const source = useChapterOne ? 'chapter1_hw2_distilled' : 'background_hw1_distilled';
    const mdPath = path.join(EXAM_PRIORITY_DIR, `${source}.md`);
    const jsonPath = path.join(EXAM_PRIORITY_DIR, `${source}.json`);
    if (!fs.existsSync(mdPath) && !fs.existsSync(jsonPath)) return null;

    let markdown = '';
    let json = null;

    try {
        if (fs.existsSync(mdPath)) markdown = fs.readFileSync(mdPath, 'utf8');
    } catch (_) {}

    try {
        if (fs.existsSync(jsonPath)) json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (_) {}

    const rawGuidance = {
        source,
        markdown,
        json,
        sectionType: useBackground ? classifyBackgroundSection(sectionId, sectionTitle) : 'chapter1'
    };
    return filterExamPriorityGuidanceForSection(sectionId, sectionTitle, rawGuidance);
}

function inferExamPriorityContext(sectionId = '', sectionTitle = '', bookPages = []) {
    const explicitId = compactWhitespace(sectionId || '');
    const explicitTitle = compactWhitespace(sectionTitle || '');
    if (explicitId || explicitTitle) {
        return { sectionId: explicitId, sectionTitle: explicitTitle };
    }

    for (const page of Array.isArray(bookPages) ? bookPages : []) {
        const candidateTitle = compactWhitespace(page && page.title ? page.title : '');
        const candidateSubsection = compactWhitespace(page && page.subsection ? page.subsection : '');
        const candidate = candidateSubsection || candidateTitle;
        if (!candidate) continue;
        const code = extractSectionCode(candidate);
        if (/^1(?:[.\-]|$)/.test(code) || /^B(?:[.\-]|$)/i.test(code)) {
            return {
                sectionId: candidateSubsection || code,
                sectionTitle: candidateTitle || candidateSubsection || code
            };
        }
    }

    return { sectionId: '', sectionTitle: '' };
}

function buildSectionSpecificPromptSection(sectionId = '', sectionTitle = '') {
    const sectionType = classifyBackgroundSection(sectionId, sectionTitle);
    const id = compactWhitespace(String(sectionId || ''));
    const title = compactWhitespace(String(sectionTitle || '')).toLowerCase();

    if (/^B[.\-]?1[.\-]?2(?:\b|$)/i.test(id) || /algebra of complex numbers/i.test(title)) {
        return [
            'section_specific_rules:',
            '- This section teaches the algebra of complex numbers. Use a B.2-1-style lecture-note rhythm: context -> standalone formula -> symbol/use-case explanation -> example/trap.',
            '- Absolutely do not place a bank of all formulas immediately after the overview. No formula dump at the top.',
            '- Split the early representation formulas into separate concept-local pages: rectangular form, polar/exponential form, Euler bridge, magnitude/angle/quadrant check.',
            '- Display formulas must look like B.2-1: centered, big, and separated line-by-line. Do not use horizontal-scrolling formula strips, gathered blocks, aligned blocks, or \\\\[4pt] chains for ordinary formula lists.',
            '- Each page may contain at most one small formula family, but each equation inside the family should be its own standalone display formula when possible.',
            '- Textbook-numbered formulas like (B.1), (B.2), (B.3), etc. are key formula signals, but they must be taught locally rather than collected in one table.',
            '- Preserve enough explanation. Each formula page should explain what the symbols mean, when to use the formula, one representative example or near-miss, and one common trap when relevant.',
            '- Keep Key Takeaways complete but selective: include the core representation, conjugate, arithmetic, roots/log formulas and the quadrant rule; exclude worked-example intermediate arithmetic.'
        ].join('\n');
    }

    if (sectionType === 'historical_note') {
        return [
            'section_specific_rules:',
            '- This section is a historical note, not a complex-number skills section.',
            '- Ignore any parent-section overview text that appears before the subsection heading itself. If the OCR page begins with a broader "B.1 Complex Numbers" introduction, treat that only as setup context, not as the lesson body.',
            '- Center the lesson on how the number system expanded over time: natural numbers, fractions, irrational numbers, negative numbers, then complex numbers.',
            '- Highlight Cardano, Bombelli, and Gauss only for their historical role in making complex numbers acceptable.',
            '- Do NOT turn this lesson into Cartesian form, polar form, Euler formula, quadrant-trap, or complex-arithmetic training. Those belong to later subsections.',
            '- Do NOT teach rectangular form, real part vs imaginary part, complex-plane plotting, polar form, exponential form, Euler formula, or angle-finding in this lesson.',
            '- A brief forward-looking sentence is allowed, but the body of the lesson must stay historical and conceptual.',
            '- The concept list should contain historical milestones or acceptance milestones, not later operational tools.',
            '- Worked examples, if any, should support the historical storyline (for example, equations that forced number-system expansion), not later conversion drills.',
            '- De-emphasize exam-coaching labels such as EXAM NOTE or COMMON MISTAKE unless the OCR itself makes them central.',
            '- The formulas \\(j^2=-1\\) and \\(\\sqrt{-1}=\\pm j\\) are mandatory for B.1-1 and must appear both in the local teaching page and in Key Takeaways.'
        ].join('\n');
    }

    if (sectionType === 'conceptual_intro') {
        return [
            'section_specific_rules:',
            '- This section is a conceptual introduction, not a full computational drill.',
            '- Use exam-priority guidance only as a light weighting signal.',
            '- Keep the core identity of the section intact; do not let worked examples or trap warnings dominate the lesson.',
            '- Include at most one representative worked example unless the OCR strongly suggests more.'
        ].join('\n');
    }

    if (sectionType === 'computational_core') {
        return [
            'section_specific_rules:',
            '- This section is computationally central and may receive strong exam-priority weighting.',
            '- Favor worked examples, conversion fluency, trap warnings, and quiz alignment.'
        ].join('\n');
    }

    return '';
}

function buildExamPriorityPromptSection(guidance) {
    if (!guidance) return '';
    const parts = [
        'exam_priority_guidance_source:',
        guidance.source || 'unknown'
    ];
    if (guidance.markdown) {
        parts.push('', 'exam_priority_guidance_markdown:', guidance.markdown.trim());
    }
    if (guidance.json) {
        parts.push('', 'exam_priority_guidance_json:', JSON.stringify(guidance.json, null, 2));
    }
    parts.push(
        '',
        'exam_priority_instructions:',
        '- Treat this guidance as a weighting signal for what is likely exam-relevant.',
        '- This guidance has already been filtered by current section/topic; do not restore omitted homework topics.',
        '- Key Takeaways, formulas, worked examples, and quiz bias must come only from relevant topic buckets.',
        '- Preview-only topics may get at most one short bridge sentence and must not become a teaching page.',
        '- Do not force every page to mention the homework explicitly.',
        '- Use it to decide which concepts deserve more explanation, worked examples, trap warnings, and quiz emphasis.',
        '- Respect section identity first: historical notes stay historical, conceptual intros stay conceptual, and computational core sections may receive the strongest exam-style weighting.',
        '- For Background sections, prefer exam-style worked examples and operational fluency only when the section type is computational_core or the OCR strongly supports that emphasis.'
    );
    return parts.join('\n');
}

function buildSectionCodeRegex(sectionId = '') {
    const code = extractSectionCode(sectionId || '');
    if (!code) return null;
    const source = code
        .split('')
        .map(ch => {
            if (ch === '.' || ch === '-') return '[.\\-]?';
            return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('');
    return new RegExp(source, 'i');
}

function buildHeadingTitleTokenRegex(sectionTitle = '') {
    const title = compactWhitespace(String(sectionTitle || ''))
        .replace(/^[A-Za-z]?\d+(?:[.\-]\d+)*\s*/i, '')
        .trim();
    if (!title) return null;
    const tokens = title
        .split(/[\s/:,()[\]-]+/)
        .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .filter(token => token.length >= 3);
    if (!tokens.length) return null;
    return new RegExp(tokens.join('.*'), 'i');
}

function extractHeadingCodeFromLine(line = '') {
    const match = String(line || '').match(/^\s*([A-Za-z]?\.?\d+(?:[.\-]\d+)*)\s+\S/);
    return match ? match[1] : '';
}

function looksLikeSectionHeadingLine(line = '') {
    const text = String(line || '').trim();
    if (!text || text.length > 140) return false;
    if (/^(chapter|contents?)\b/i.test(text)) return false;
    return /^\s*[A-Za-z]?\.?\d+(?:[.\-]\d+)*\s+\S/.test(text);
}

function normalizeHeadingCompareText(text = '') {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function stripHeadingCode(text = '') {
    return String(text || '').replace(/^\s*[A-Za-z]?\.?\d+(?:[.\-]\d+)*\s*/i, '').trim();
}

function isLikelyRunningSectionHeader(line = '', code = '') {
    const text = String(line || '').trim();
    if (!text) return false;
    const headingCode = extractHeadingCodeFromLine(text).toLowerCase();
    if (headingCode !== String(code || '').toLowerCase()) return false;
    return /\s+\d+\s*$/.test(text);
}

function cropOcrTextToSectionBoundaries(sectionId = '', sectionTitle = '', rawText = '') {
    const text = String(rawText || '');
    if (!text) return text;

    const lines = text.split(/\r?\n/);
    if (!lines.length) return text;

    const sectionCodeRegex = buildSectionCodeRegex(sectionId);
    const titleRegex = buildHeadingTitleTokenRegex(sectionTitle);
    const currentCode = extractSectionCode(sectionId || '');

    let startIndex = 0;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!looksLikeSectionHeadingLine(line)) continue;
        if (!sectionCodeRegex || !sectionCodeRegex.test(line)) continue;
        if (titleRegex && !titleRegex.test(line)) continue;
        startIndex = i;
        break;
    }

    let endIndex = lines.length;
    for (let i = startIndex + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (!looksLikeSectionHeadingLine(line)) continue;
        const candidateCode = extractHeadingCodeFromLine(line);
        if (!candidateCode) continue;
        if (currentCode && candidateCode.toLowerCase() === currentCode.toLowerCase()) continue;
        endIndex = i;
        break;
    }

    const cropped = lines.slice(startIndex, endIndex).join('\n').trim();
    if (!cropped) return text;
    if (cropped.length < 160 && text.length > cropped.length * 2) return text;
    return cropped;
}

function cropOcrTextToParentPrelude(sectionId = '', sectionTitle = '', rawText = '') {
    const text = String(rawText || '');
    if (!text) return '';

    const code = extractSectionCode(sectionId || sectionTitle || '');
    if (!code || /-\d+$/.test(code)) return '';

    const lines = text.split(/\r?\n/);
    if (!lines.length) return '';

    const titleCompare = normalizeHeadingCompareText(stripHeadingCode(sectionTitle || sectionId || ''));
    let startIndex = -1;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!looksLikeSectionHeadingLine(line)) continue;
        const headingCode = extractHeadingCodeFromLine(line).toLowerCase();
        if (headingCode !== code) continue;
        if (isLikelyRunningSectionHeader(line, code)) continue;
        if (titleCompare) {
            const lineCompare = normalizeHeadingCompareText(stripHeadingCode(line));
            if (!lineCompare.includes(titleCompare)) continue;
        }
        startIndex = i;
        break;
    }
    if (startIndex < 0) return '';

    let endIndex = lines.length;
    for (let i = startIndex + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (!looksLikeSectionHeadingLine(line)) continue;
        const candidateCode = extractHeadingCodeFromLine(line).toLowerCase();
        if (!candidateCode || candidateCode === code) continue;
        if (candidateCode.startsWith(code + '-')) {
            endIndex = i;
            break;
        }
        endIndex = i;
        break;
    }

    const cropped = lines.slice(startIndex, endIndex).join('\n').trim();
    return cropped;
}

function hasSubstantiveParentPrelude(sectionId = '', sectionTitle = '', rawText = '') {
    const prelude = cropOcrTextToParentPrelude(sectionId, sectionTitle, rawText);
    if (!prelude) return false;

    const withoutHeading = prelude
        .split(/\r?\n/)
        .filter(line => !looksLikeSectionHeadingLine(line))
        .join('\n')
        .trim();
    const compact = compactWhitespace(withoutHeading);
    const equationCount = (prelude.match(/\(B\.\d+\)|\(\d+\.\d+\)|=\s*|\\omega|ω|π|theta|θ|cos|sin/gi) || []).length;
    const sentenceCount = (compact.match(/[.!?]\s+/g) || []).length;

    return equationCount >= 3 || (compact.length >= 520 && equationCount >= 1 && sentenceCount >= 3);
}

function focusOcrTextForSection(sectionId = '', sectionTitle = '', rawText = '') {
    const text = String(rawText || '');
    if (!text) return text;

    const cropped = cropOcrTextToSectionBoundaries(sectionId, sectionTitle, text);
    const sectionType = classifyBackgroundSection(sectionId, sectionTitle);
    if (sectionType !== 'historical_note') return cropped;

    const headingPatterns = [
        new RegExp(String(sectionId || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[.\-]/g, '[.\\-]?') + '\\s+.*historical\\s+note', 'i'),
        /\bB[.\-]?1[.\-]?1\s+.*historical\s+note/i,
        /\bhistorical\s+note\b/i
    ];

    let start = -1;
    for (const pattern of headingPatterns) {
        const match = cropped.match(pattern);
        if (match && typeof match.index === 'number') {
            start = match.index;
            break;
        }
    }

    if (start <= 0) return cropped;
    return cropped.slice(start).trim();
}

/**
 * Agent A — Lesson Architect (OpenAI GPT-5.4)
 * Reads OCR + existing page images, outputs a Rendering Blueprint JSON.
 */
async function agentA_plan(sectionId, sectionTitle, bookPages, webSources, language = 'en', bookSource = 'new') {
    const ocrPages = bookPages.map(p => ({
        pageId: p.page,
        text: Object.prototype.hasOwnProperty.call(p, 'ocrOverrideText')
            ? p.ocrOverrideText
            : focusOcrTextForSection(sectionId, sectionTitle, readOCRText(p.textPath, 3000))
    }));
    const localBookPages = bookPages.filter(p => !(p && p.ragFlow));
    const existingPageImages = localBookPages.map(p => p.page);
    const allowedNewBookFigures = getAllowedNewBookFigures(sectionId, bookPages, bookSource);
    const examPriorityGuidance = loadExamPriorityGuidance(sectionId, sectionTitle);
    const verifiedFormulaCatalog = readVerifiedFormulaCatalog(sectionId, bookSource);
    const verifiedFormulaSection = buildVerifiedFormulaPromptSection(verifiedFormulaCatalog);
    const availableFigures = {};
    // pageInfo: page -> { page_type, has_math, has_figures, summary_excerpt }
    // Gives Agent A full context even for math-heavy pages with no extracted figure crops.
    const pageInfo = {};
    for (const p of localBookPages) {
        const metaPath = path.join((p.textPath ? path.dirname(p.textPath) : OCR_DIR_NEW), `${p.page}.meta.json`);
        if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (meta.figures && meta.figures.length) {
                const filteredFigures = meta.figures.filter(f => {
                    const crop = path.basename(String((f && f.crop_file) || ''));
                    return !crop || bookSource !== 'new' || allowedNewBookFigures.has(crop);
                });
                if (filteredFigures.length) {
                            availableFigures[p.page] = filteredFigures.map(f => ({
                                fig_id: f.fig_id,
                                caption: f.caption,
                                description: f.description || f.visual_description || f.image_description || ''
                            }));
                }
            }
            pageInfo[p.page] = {
                page_type: meta.page_type || 'unknown',
                has_math: !!meta.has_math,
                has_figures: !!(meta.figures && meta.figures.length),
                summary_excerpt: (meta.summary || '').slice(0, 180)
            };
        }
    }

    const systemPrompt = fs.readFileSync(
        path.join(TUTOR_MATERIALS_DIR, 'prompts', 'agent-a-planner.md'),
        'utf8'
    ) + '\n\n' + LESSON_GENERATION_RULES_TEXT + '\n' + AGENT_A_RULES_APPENDIX;

    const userMsg = [
        `section_id: ${sectionId}`,
        `section_title: ${sectionTitle}`,
        `language: ${language}`,
        '',
        'existing_page_images:',
        existingPageImages.join(', '),
        '',
        'available_figures:',
        JSON.stringify(availableFigures, null, 2),
        '',
        'page_info (page_type / has_math / has_figures / summary_excerpt):',
        JSON.stringify(pageInfo, null, 2),
        '',
        'web_sources_available:',
        webSources.slice(0, 6).map((w, i) => `[${i+1}] ${w.title} — ${w.url}`).join('\n') || 'none',
        '',
        verifiedFormulaSection || [
            'verified_canonical_formulas:',
            'none available; treat OCR math as unverified and avoid inventing exact formulas beyond what the source supports.'
        ].join('\n'),
        '',
        'ocr_pages:',
        ocrPages.map(p => `=== ${p.pageId} ===\n${p.text}`).join('\n\n'),
        '',
        VISUAL_SELECTION_DECISION_LADDER.trim(),
        buildSectionSpecificPromptSection(sectionId, sectionTitle),
        examPriorityGuidance ? `\n${buildExamPriorityPromptSection(examPriorityGuidance)}` : ''
    ].join('\n');

    console.log(`[Agent A] Planning lesson for ${sectionId} (lang=${language})…`);

    let raw = await callOpenAIChat({
        model: AGENT_A_MODEL,
        timeoutMs: 90000,
        temperature: 0.2,
        maxTokens: 18000,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg }
        ]
    });

    let blueprint = tryParseJsonLoose(raw);
    if (!blueprint || !Array.isArray(blueprint.blocks)) {
        console.warn('[Agent A] Failed to parse blueprint JSON; retrying with compact visual-first contract.');
        writeDebugFile(`agentA-${sectionId.replace(/[^a-z0-9._-]/gi, '_')}-raw.txt`, raw);
        raw = await callOpenAIChat({
            model: AGENT_A_MODEL,
            timeoutMs: 90000,
            temperature: 0,
            maxTokens: 14000,
            messages: [
                {
                    role: 'system',
                    content: `${systemPrompt}\n\nRETRY CONTRACT: Return strict JSON only. Use a manageable number of blocks. Keep quiz_plan to max 5 questions unless the section genuinely needs more. Keep instructions concise but pedagogically complete: no filler, but enough explanation, examples, formula-local teaching, and trap coverage for a student to learn. Visual-first and formula-local; never formula-dump-first.`
                },
                {
                    role: 'user',
                    content: `${userMsg}\n\nYour previous output was too long or invalid. Re-plan this section as strict JSON only: overview, concept-local teaching pages where formulas appear beside their explanations, recap with key formulas only, quiz_plan with at most 5 questions unless more are essential.`
                }
            ]
        });
        blueprint = tryParseJsonLoose(raw);
        if (!blueprint || !Array.isArray(blueprint.blocks)) {
            console.warn('[Agent A] Compact retry also failed to parse JSON.');
            writeDebugFile(`agentA-${sectionId.replace(/[^a-z0-9._-]/gi, '_')}-retry-raw.txt`, raw);
            return { raw, blueprint: null };
        }
    }

    const safeSectionId = sectionId.replace(/[^a-z0-9._-]/gi, '_');
    writeDebugFile(`agentA-${safeSectionId}-raw.txt`, raw);
    writeDebugFile(`agentA-${safeSectionId}-preview.md`, buildAgentAPreviewMarkdown(blueprint, raw));

    if (!hasStudentFacingVisualBlock(blueprint)) {
        throw new Error(`Agent A planned no student-facing visual block for ${sectionId}. This is invalid under aquarius_std_v1.`);
    }

    // Post-process: enforce at least one canonical textbook figure when available.
    const hasBookImage = blueprint.blocks.some(b => b && b.type === 'book_image');
    if (!hasBookImage) {
        const candidatePages = Object.keys(availableFigures);
        let injected = false;
        for (const page of candidatePages) {
            const figs = availableFigures[page] || [];
            const canonical = figs.find(f => /complex plane|real axis|imaginary axis|signal|system|block diagram|unit step|impulse|phasor|polar/i.test(`${f.fig_id || ''} ${f.caption || ''}`)) || figs[0];
            if (canonical) {
                blueprint.blocks.splice(Math.min(2, blueprint.blocks.length), 0, {
                    type: 'book_image',
                    source_page: page,
                    fig_id: canonical.fig_id,
                    crop_hint: 'full',
                    caption: canonical.caption || '',
                    description: canonical.description || '',
                    caption_instruction: 'Add a one-sentence caption explaining what this textbook figure shows and why it matters for the core concept of this section.',
                    description_instruction: 'Use the stored figure description to describe axes, objects, relationships, and what students should notice.'
                });
                console.log(`[Agent A] Injected canonical book_image for ${sectionId}: ${page} / ${canonical.fig_id}`);
                injected = true;
                break;
            }
        }
    }

    blueprint = ensureRequiredInteractiveDemoBlocks(blueprint, sectionId, sectionTitle);
    blueprint = pruneForbiddenGenerateImageBlocks(blueprint);

    if (!blueprint.visual_plan) {
        const hasBookImage = blueprint.blocks.some(b => b && b.type === 'book_image');
        const hasGeneratedImage = blueprint.blocks.some(b => b && b.type === 'generate_image');
        blueprint.visual_plan = {
            primary_anchor: hasBookImage && hasGeneratedImage ? 'both' : (hasBookImage ? 'book_figure' : 'generated_image'),
            rationale: hasBookImage && hasGeneratedImage
                ? 'Use the textbook figure as the factual anchor and a generated gptimage2 visual to clarify the relationship visually.'
                : (hasBookImage
                    ? 'Use the textbook figure as the main visual anchor because the book already contains a strong explanatory diagram.'
                    : 'Use a generated gptimage2 lecture-note visual because the key relationship is easier to understand through a clean custom visual.'),
            teaching_emphasis: 'Use visuals to clarify the core idea and support one representative example.'
        };
    }

    blueprint.blocks = blueprint.blocks.map(block => {
        if (!block || (block.type !== 'book_image' && block.type !== 'generate_image')) return block;
        if (!block.teaching_role) {
            block.teaching_role = block.type === 'book_image' ? 'concept_anchor' : 'comparison_anchor';
        }
        return block;
    });

    console.log(`[Agent A] Blueprint ready — ${blueprint.blocks.length} blocks. visual_plan=${blueprint.visual_plan?.primary_anchor || 'none'}`);
    return { raw, blueprint };
}

/**
 * Agent B — Tutor Writer (Claude Sonnet 4.6)
 * Takes the Blueprint and executes each block into final Markdown.
 * Returns a Markdown string ready for the frontend.
 */
function isMajorKnowledgePointRenderedBlock(block) {
    if (!block || block.type !== 'text_explanation') return false;
    const content = String(block.content || '');
    return /^\s*##\s+/.test(content);
}

function normalizePairedVisualPlacement(renderedBlocks, visualPlan = null) {
    if (!Array.isArray(renderedBlocks) || renderedBlocks.length < 3) return renderedBlocks;
    if (!visualPlan || visualPlan.primary_anchor !== 'both') return renderedBlocks;

    const blocks = renderedBlocks.slice();
    const sections = [];
    let current = {
        startIndex: 0,
        indices: [],
        visualIndices: [],
        visualKinds: new Set(),
        isOverview: true
    };
    sections.push(current);

    blocks.forEach((block, index) => {
        if (isMajorKnowledgePointRenderedBlock(block)) {
            current = {
                startIndex: index,
                indices: [index],
                visualIndices: [],
                visualKinds: new Set(),
                isOverview: false
            };
            sections.push(current);
            return;
        }

        current.indices.push(index);
        if (block && (block.type === 'book_image' || block.type === 'generate_image')) {
            current.visualIndices.push(index);
            current.visualKinds.add(block.type);
        }
    });

    if (sections.length < 2) return blocks;

    for (let s = 0; s < sections.length - 1; s += 1) {
        const left = sections[s];
        const right = sections[s + 1];
        if (left.visualIndices.length !== 1 || right.visualIndices.length !== 1) continue;

        const leftKind = Array.from(left.visualKinds)[0] || '';
        const rightKind = Array.from(right.visualKinds)[0] || '';
        if (!leftKind || !rightKind || leftKind === rightKind) continue;

        const fromIndex = left.visualIndices[0];
        const headingIndex = right.startIndex;
        const [moved] = blocks.splice(fromIndex, 1);
        let insertAt = headingIndex + 1;
        if (fromIndex < insertAt) insertAt -= 1;
        blocks.splice(insertAt, 0, moved);
        console.log(`[Agent B] Co-located paired visuals by moving ${moved.type} from block ${fromIndex} to ${insertAt}. overviewSource=${left.isOverview}`);
        return blocks;
    }

    return blocks;
}

function normalizeHistoricalBookImagePlacement(renderedBlocks, sectionId = '') {
    if (!Array.isArray(renderedBlocks) || renderedBlocks.length < 3) return renderedBlocks;
    if (String(sectionId || '').trim().toLowerCase() !== 'b.1-1') return renderedBlocks;

    const blocks = renderedBlocks.slice();
    const bookImageIndex = blocks.findIndex(block => block && block.type === 'book_image');
    if (bookImageIndex < 0) return blocks;

    const targetTextIndex = blocks.findIndex((block, index) => {
        if (!block || block.type !== 'text_explanation' || index <= bookImageIndex) return false;
        return /country x|country y|detour|city a|city b/i.test(String(block.content || ''));
    });

    if (targetTextIndex < 0 || targetTextIndex === bookImageIndex + 1) return blocks;

    const [moved] = blocks.splice(bookImageIndex, 1);
    let insertAt = targetTextIndex;
    if (bookImageIndex < insertAt) insertAt -= 1;
    blocks.splice(insertAt, 0, moved);
    console.log(`[Agent B] Repositioned historical book_image for ${sectionId} from block ${bookImageIndex} to ${insertAt}.`);
    return blocks;
}

function getSummaryHintForSection(sectionId = '', sectionTitle = '') {
    const sid = String(sectionId || '').trim().toLowerCase();
    const title = String(sectionTitle || '').trim().toLowerCase();

    if (sid === 'b.1-1' || /complex numbers|historical note/.test(title)) {
        return 'Preserve the sign-sensitive detail that sqrt(-1) = ±j and sqrt(-4) = ±2j. Do not reduce this to only j^2 = -1.';
    }

    return '';
}

async function agentB_execute(sectionId, blueprint, bookPages, webSources, language = 'en', bookSource = 'new') {
    const systemPrompt = fs.readFileSync(
        path.join(TUTOR_MATERIALS_DIR, 'prompts', 'agent-b-tutor.md'),
        'utf8'
    ) + '\n\n' + LESSON_GENERATION_RULES_TEXT + '\n' + VISUAL_SELECTION_DECISION_LADDER + '\n' + AGENT_B_RULES_APPENDIX;
    const examPriorityGuidance = loadExamPriorityGuidance(sectionId, blueprint?.section_title || sectionId);
    const summaryHint = getSummaryHintForSection(sectionId, blueprint?.section_title || sectionId);
    const verifiedFormulaCatalog = readVerifiedFormulaCatalog(sectionId, bookSource);

    const existingPageImages = {};
    const allowedNewBookFigures = getAllowedNewBookFigures(sectionId, bookPages, bookSource);
    const availableFigures = {};   // page -> [{fig_id, caption}]
    const localBookPages = bookPages.filter(p => !(p && p.ragFlow));
    for (const p of localBookPages) {
        existingPageImages[p.page] = `/pages/${p.pageImage}`;
        // Load figure metadata for precision crop
        const metaPath = path.join((p.textPath ? path.dirname(p.textPath) : OCR_DIR_NEW), `${p.page}.meta.json`);
        if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (meta.figures && meta.figures.length) {
                const filteredFigures = meta.figures.filter(f => {
                    const crop = path.basename(String((f && f.crop_file) || ''));
                    return !crop || bookSource !== 'new' || allowedNewBookFigures.has(crop);
                });
                if (filteredFigures.length) {
                    availableFigures[p.page] = filteredFigures.map(f => ({
                        fig_id: f.fig_id,
                        caption: f.caption,
                        description: f.description || f.visual_description || f.image_description || ''
                    }));
                }
            }
        }
    }

    const payload = {
        blueprint,
        existing_page_images: existingPageImages,
        available_figures: availableFigures,
        web_sources: webSources.slice(0, 8).map((w, i) => ({
            index: i + 1,
            title: w.title,
            url: w.url,
            snippet: w.snippet || ''
        })),
        output_contract: {
            format: 'single_json_object',
            no_markdown_fences: true,
            no_prose: true,
            compact_json_preferred: true
        },
        section_specific_rules: buildSectionSpecificPromptSection(sectionId, blueprint?.section_title || sectionId) || null,
        verified_canonical_formulas: verifiedFormulaCatalog ? {
            source_file: verifiedFormulaCatalog.sourceFile || null,
            instruction: 'These formulas were manually verified against textbook page images. Copy exact LaTeX and labels when teaching these formulas; do not reconstruct conflicting OCR variants.',
            formulas: verifiedFormulaCatalog.formulas
        } : null,
        summary_hint: summaryHint || null,
        exam_priority_guidance: examPriorityGuidance ? {
            source: examPriorityGuidance.source,
            markdown: examPriorityGuidance.markdown || '',
            json: examPriorityGuidance.json || null,
            usage_instruction: 'Use this only as a weighting signal for emphasis, worked examples, trap warnings, and quiz bias in Background sections.'
        } : null
    };

    const userMsg = JSON.stringify(payload, null, 2);
    const safeSectionId = sectionId.replace(/[^a-z0-9._-]/gi, '_');
    writeDebugFile(`agentB-${safeSectionId}-input.json`, userMsg);

    console.log(`[Agent B] Executing ${blueprint.blocks.length} blocks…`);

    let raw;
    const agentBStartTs = Date.now();
    try {
        console.log(`[Agent B] Request start for ${sectionId} using model ${AGENT_B_MODEL} at ${new Date(agentBStartTs).toISOString()}`);
        raw = await callOpenRouterChat({
            model: AGENT_B_MODEL,
            timeoutMs: 120000,
            temperature: 0.2,
            maxTokens: 12000,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMsg }
            ]
        });
        console.log(`[Agent B] Request done for ${sectionId} in ${Date.now() - agentBStartTs}ms; raw length=${String(raw || '').length}`);
    } catch (err) {
        throw new Error(`[Agent B:${sectionId}] ${err.message}`);
    }

    // Try to parse Agent B's JSON output and convert to Markdown
    let rendered = tryParseJsonLoose(raw);
    if (!rendered || !Array.isArray(rendered.rendered_blocks)) {
        console.warn('[Agent B] First pass was not valid JSON. Retrying with strict compact-output instruction.');
        try {
            const agentBRetryStartTs = Date.now();
            console.log(`[Agent B] Retry start for ${sectionId} at ${new Date(agentBRetryStartTs).toISOString()}`);
            raw = await callOpenRouterChat({
                model: AGENT_B_MODEL,
                timeoutMs: 120000,
                temperature: 0,
                maxTokens: 14000,
                messages: [
                    {
                        role: 'system',
                        content: `${systemPrompt}\n\nCRITICAL OUTPUT CONTRACT: Return exactly one complete JSON object. Do not wrap in markdown fences. Do not add commentary. Keep JSON compact.`
                    },
                    {
                        role: 'user',
                        content: `${userMsg}\n\nYour previous attempt was invalid or truncated. Re-output the full result as one complete JSON object only.`
                    }
                ]
            });
            console.log(`[Agent B] Retry done for ${sectionId} in ${Date.now() - agentBRetryStartTs}ms; raw length=${String(raw || '').length}`);
        } catch (err) {
            throw new Error(`[Agent B:${sectionId}:retry] ${err.message}`);
        }
        rendered = tryParseJsonLoose(raw);
    }

    if (rendered && Array.isArray(rendered.rendered_blocks)) {
        console.log(`[Agent B] JSON OK — ${rendered.rendered_blocks.length} blocks`);
        if (blueprint.visual_plan && !rendered.visual_plan) rendered.visual_plan = blueprint.visual_plan;
        rendered.rendered_blocks = normalizePairedVisualPlacement(rendered.rendered_blocks, rendered.visual_plan || blueprint.visual_plan || null);
        rendered.rendered_blocks = normalizeHistoricalBookImagePlacement(rendered.rendered_blocks, sectionId);
        // Auto-fill missing fig_id for book_image blocks using metadata
        rendered.rendered_blocks.forEach((b, i) => {
            const planned = (blueprint.blocks || [])[i] || null;
            if (planned && !b.teaching_role && planned.teaching_role) b.teaching_role = planned.teaching_role;
            if (planned && b.type === 'web_search_image') {
                if (!b.search_query && planned.search_query) b.search_query = planned.search_query;
                if (!b.query && planned.query) b.query = planned.query;
                if (!b.purpose && planned.purpose) b.purpose = planned.purpose;
                if (!b.caption && planned.caption) b.caption = planned.caption;
                if (!b.fallback && planned.fallback) b.fallback = planned.fallback;
            }
            if (planned && b.type === 'book_image') {
                if (!b.source_page && planned.source_page) b.source_page = planned.source_page;
                if (!b.caption && planned.caption) b.caption = planned.caption;
                if (!b.description && planned.description) b.description = planned.description;
            }
            if (b.type === 'book_image' && b.source_page && !b.fig_id) {
                const metaPath = path.join(OCR_DIR_NEW, `${b.source_page}.meta.json`);
                if (fs.existsSync(metaPath)) {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    const figs = meta.figures || [];
                    if (figs.length === 1) {
                        b.fig_id = figs[0].fig_id;
                        if (!b.caption) b.caption = figs[0].caption;
                        console.log(`[Agent B] Auto-filled fig_id for block[${i}]: ${figs[0].fig_id}`);
                    }
                }
            }
            if (b.type === 'book_image')
                console.log(`[Agent B] block[${i}] book_image: page=${b.source_page} fig_id=${b.fig_id} file_path=${b.file_path}`);
        });
        const markdownStartTs = Date.now();
        const lessonMarkdown = await blueprintToMarkdown(
            rendered.rendered_blocks,
            existingPageImages,
            rendered.visual_plan || blueprint.visual_plan || null,
            bookPages,
            sectionId,
            bookSource,
            blueprint.blocks || []
        );
        console.log(`[Agent B] blueprintToMarkdown done for ${sectionId} in ${Date.now() - markdownStartTs}ms; markdown length=${String(lessonMarkdown || '').length}`);
        return lessonMarkdown;
    }

    console.warn('[Agent B] Refusing raw markdown fallback. First 400 chars:', raw.slice(0, 400));
    throw new Error(`[Agent B:${sectionId}] invalid JSON after retry; refusing raw markdown fallback to avoid malformed lesson formatting.`);
}

async function collectSectionWebSources(sectionId, sectionTitle, bookSource = 'new') {
    const queries = [];
    const cleanTitle = compactWhitespace(sectionTitle || '');
    if (cleanTitle) {
        queries.push(`${cleanTitle} site:wikipedia.org`);
        queries.push(`${cleanTitle} site:wikimedia.org`);
    }
    queries.push(`${sectionId} signal processing site:wikipedia.org`);

    const results = [];
    const seen = new Set();
    for (const query of queries) {
        const batch = [
            ...(await wikipediaSearch(query)),
            ...(await duckDuckGoSearch(query))
        ];
        for (const item of batch) {
            const urlValue = normalizeUrl(item && item.url ? item.url : '');
            if (!urlValue || seen.has(urlValue)) continue;
            seen.add(urlValue);
            results.push({
                title: compactWhitespace(item.title || ''),
                url: urlValue,
                snippet: compactWhitespace(item.snippet || '')
            });
            if (results.length >= 8) return sortSourcesByType(results);
        }
    }
    return sortSourcesByType(results);
}

async function preGenerateSectionLesson(sectionId, sectionTitle, options = {}) {
    const language = options.language === 'zh' ? 'zh' : 'en';
    const bookSource = options.bookSource === 'new' ? 'new' : 'old';
    const cacheVariant = options.cacheVariant || 'lesson';
    const { ocrDir: secOcrDir } = getBookDirs(bookSource);

    const mappedPages = getPagesForSection(sectionId, secOcrDir);
    if (!mappedPages.length) {
        throw new Error(`No pages mapped for section ${sectionId}`);
    }
    const preludePages = shouldGenerateParentPreludeLesson(sectionId, sectionTitle, mappedPages)
        ? getParentPreludePages(sectionId, sectionTitle, mappedPages)
        : [];
    if (cacheVariant === 'parent_prelude' && !preludePages.length) {
        console.log(`[Pregen:${sectionId}] skipped parent_prelude: no substantive prelude by rule.`);
        return {
            sectionId,
            sectionTitle,
            cacheVersion: LESSON_CACHE_VERSION,
            cached: false,
            skipped: true,
            lesson: '',
            webSources: []
        };
    }
    const localPages = preludePages.length
        ? preludePages
        : attachSectionOcrToPages(sectionId, mappedPages, bookSource);

    const cachedLesson = readLessonCache(sectionId, bookSource, cacheVariant);
    if (cachedLesson && !options.force) {
        return {
            sectionId,
            sectionTitle,
            cacheVersion: LESSON_CACHE_VERSION,
            cached: true,
            skipped: true,
            lesson: prepareLessonForCache(sectionId, cachedLesson),
            webSources: []
        };
    }

    const rawPages = localPages;

    let webSources = [];
    try {
        webSources = await collectSectionWebSources(sectionId, sectionTitle, bookSource);
    } catch (err) {
        console.error(`[Pregen:${sectionId}] collectSectionWebSources failed:`, err && err.stack ? err.stack : err);
        throw err;
    }

    let lesson = '';
    try {
        lesson = await generateSectionLesson(
            sectionId,
            sectionTitle,
            rawPages,
            webSources,
            language,
            bookSource
        );
    } catch (err) {
        console.error(`[Pregen:${sectionId}] generateSectionLesson failed:`, err && err.stack ? err.stack : err);
        throw err;
    }

    let normalizedLesson = '';
    try {
        normalizedLesson = prepareLessonForCache(sectionId, lesson);
        assertLessonFormatClean(sectionId, normalizedLesson, 'pregenerate');
    } catch (err) {
        console.error(`[Pregen:${sectionId}] post-normalization failed:`, err && err.stack ? err.stack : err);
        throw err;
    }

    try {
        writeLessonCache(sectionId, normalizedLesson, bookSource, cacheVariant);
    } catch (err) {
        console.error(`[Pregen:${sectionId}] writeLessonCache failed:`, err && err.stack ? err.stack : err);
        throw err;
    }

    return {
        sectionId,
        sectionTitle,
        cacheVersion: LESSON_CACHE_VERSION,
        cached: false,
        skipped: false,
        lesson: normalizedLesson,
        webSources
    };
}

function getParentPreludePages(sectionId, sectionTitle, bookPages = []) {
    const out = [];
    for (const page of bookPages || []) {
        const raw = readOCRText(page.textPath, 7000);
        const preludeText = cropOcrTextToParentPrelude(sectionId, sectionTitle, raw);
        if (!preludeText) continue;
        out.push({
            ...page,
            ocrOverrideText: preludeText,
            title: `${sectionTitle} prelude`
        });
    }
    return out;
}

function shouldGenerateParentPreludeLesson(sectionId, sectionTitle, bookPages = []) {
    const code = extractSectionCode(sectionId || sectionTitle || '');
    if (!code || /-\d+$/.test(code)) return false;
    return (bookPages || []).some(page => hasSubstantiveParentPrelude(sectionId, sectionTitle, readOCRText(page.textPath, 7000)));
}

/**
 * Convert Agent B's rendered_blocks JSON → Markdown string for the frontend.
 */
function extractPlannedKnowledgeHeading(plannedBlock = null) {
    if (!plannedBlock || typeof plannedBlock !== 'object') return '';
    const candidates = [
        plannedBlock.page_title,
        plannedBlock.explanation_instruction,
        plannedBlock.instruction,
        plannedBlock.heading,
        plannedBlock.title
    ].filter(Boolean).map(v => String(v));

    for (const text of candidates) {
        const quotedMatch = text.match(/heading[:\s]+['"]?(##\s+[^'"\n]+)['"]?/i);
        if (quotedMatch && quotedMatch[1]) return compactWhitespace(quotedMatch[1]).trim();
        const titledMatch = text.match(/\btitled\s+['"]?(##\s+[^'"\n]+)['"]?/i);
        if (titledMatch && titledMatch[1]) return compactWhitespace(titledMatch[1]).trim();
        const lineMatch = text.match(/^\s*(##\s+[^\n]+)/m);
        if (lineMatch && lineMatch[1]) return compactWhitespace(lineMatch[1]).trim();
    }
    return '';
}

function normalizeKnowledgeHeadingText(text = '') {
    return compactWhitespace(String(text || ''))
        .replace(/^\s*##\s+/, '')
        .replace(/[“”"']/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function extractRenderedKnowledgeHeading(block = null) {
    if (!block || typeof block !== 'object') return '';

    const candidates = [];
    if (block.type === 'text_explanation' || block.type === 'analogy') {
        candidates.push(String(block.content || ''));
    }
    if (block.type === 'math_block') {
        candidates.push(String(block.explanation || ''));
    }

    for (const text of candidates) {
        const lineMatch = text.match(/^\s*(##\s+[^\n]+)/m);
        if (lineMatch && lineMatch[1]) return compactWhitespace(lineMatch[1]).trim();
    }
    return '';
}

function stripLeadingKnowledgeHeading(text = '') {
    const raw = String(text || '');
    return raw.replace(/^\s*##\s+[^\n]+\n*/, '').trimStart();
}

function pushMathBlockExplanation(parts, explanationText = '', options = {}) {
    const text = String(explanationText || '').trim();
    if (!text) return;
    if (options.asProse) {
        parts.push(text);
        return;
    }
    if (/^\s*##\s+/m.test(text) || /^\s*###\s+/m.test(text)) {
        parts.push(text);
    } else {
        parts.push(`*${text}*`);
    }
}

function isOverviewLikeContent(text = '') {
    const raw = String(text || '');
    return /^\s*#\s+/m.test(raw)
        || /section objective/i.test(raw)
        || /concepts in this section/i.test(raw);
}

function isKnowledgeBearingRenderedBlock(block = null) {
    if (!block || typeof block !== 'object') return false;
    if (block.type === 'math_block') return true;
    if (block.type === 'text_explanation' || block.type === 'analogy') {
        return !isOverviewLikeContent(block.content || '');
    }
    return false;
}

async function blueprintToMarkdown(blocks, pageImages, visualPlan = null, bookPages = [], sectionId = '', bookSource = 'new', plannedBlocks = []) {
    const parts = [];
    const allowedSourcePages = new Set((Array.isArray(bookPages) ? bookPages : []).map(p => compactWhitespace((p && p.page) || '')));
    const allowedNewBookFigures = getAllowedNewBookFigures(sectionId, bookPages, bookSource);
    const plannedKnowledgeHeadings = (Array.isArray(plannedBlocks) ? plannedBlocks : [])
        .map(extractPlannedKnowledgeHeading)
        .filter(Boolean);
    let plannedHeadingCursor = 0;

    if (visualPlan) {
        const b64 = Buffer.from(JSON.stringify(visualPlan || {})).toString('base64');
        parts.push(`%%KC_BLOCK%%<div class="kc-visual-plan" data-visual-plan-b64="${b64}" style="display:none;"></div>%%KC_END%%`);
    }

    let skipNextGeneratedFallback = false;
    for (let idx = 0; idx < blocks.length; idx += 1) {
        const block = blocks[idx];
        if (isKnowledgeBearingRenderedBlock(block)) {
            const embeddedHeading = extractRenderedKnowledgeHeading(block);
            const nextPlannedHeading = plannedKnowledgeHeadings[plannedHeadingCursor] || '';
            const embeddedKey = normalizeKnowledgeHeadingText(embeddedHeading);
            const plannedKey = normalizeKnowledgeHeadingText(nextPlannedHeading);

            if (embeddedHeading) {
                if (plannedKey && embeddedKey === plannedKey) {
                    plannedHeadingCursor += 1;
                    if (block.type === 'math_block') {
                        block.__knowledgeHeadingBeforeMath = embeddedHeading;
                        block.explanation = stripLeadingKnowledgeHeading(block.explanation || '');
                    }
                } else if (nextPlannedHeading) {
                    if (block.type === 'text_explanation' || block.type === 'analogy') {
                        block.content = stripLeadingKnowledgeHeading(block.content || '');
                    } else if (block.type === 'math_block') {
                        block.explanation = stripLeadingKnowledgeHeading(block.explanation || '');
                    }
                    parts.push(nextPlannedHeading);
                    parts.push('');
                    if (block.type === 'math_block') {
                        block.__mathHasPriorKnowledgeHeading = true;
                    }
                    plannedHeadingCursor += 1;
                } else if (block.type === 'math_block') {
                    block.__knowledgeHeadingBeforeMath = embeddedHeading;
                    block.explanation = stripLeadingKnowledgeHeading(block.explanation || '');
                }
            } else if (nextPlannedHeading) {
                parts.push(nextPlannedHeading);
                parts.push('');
                if (block.type === 'math_block') {
                    block.__mathHasPriorKnowledgeHeading = true;
                }
                plannedHeadingCursor += 1;
            }
        }
        switch (block.type) {
            case 'text_explanation':
            case 'analogy':
                parts.push(block.content || '');
                break;

            case 'math_block':
                if (block.__knowledgeHeadingBeforeMath) {
                    parts.push(block.__knowledgeHeadingBeforeMath);
                    parts.push('');
                }
                if ((block.__knowledgeHeadingBeforeMath || block.__mathHasPriorKnowledgeHeading) && block.explanation) {
                    pushMathBlockExplanation(parts, block.explanation, { asProse: true });
                    parts.push('');
                }
                parts.push(`$$${block.latex}$$`);
                if (block.explanation && !block.__knowledgeHeadingBeforeMath && !block.__mathHasPriorKnowledgeHeading) {
                    pushMathBlockExplanation(parts, block.explanation);
                }
                break;

            case 'book_image': {
                let sourcePage = compactWhitespace(block.source_page || '');
                const figId = block.fig_id || '';
                const cropHint = block.crop_hint || 'full'; // left_half | right_half | full | top_third

                if (!sourcePage && block.file_path) {
                    const pageMatch = String(block.file_path).match(/page[-_](\d{3})/i);
                    if (pageMatch) sourcePage = `page-${pageMatch[1]}`;
                }

                if (sourcePage && allowedSourcePages.size && !allowedSourcePages.has(sourcePage)) {
                    parts.push(`*(Figure unavailable: source page ${sourcePage} is outside this section's allowed pages)*`);
                    break;
                }

                const metaPath = sourcePage
                    ? path.join(OCR_DIR_NEW, `${sourcePage}.meta.json`)
                    : null;
                let cropUrl = null;

                // --- Tier 1: extracted figure crop (fig_id match within allowlist) ---
                if (metaPath && fs.existsSync(metaPath)) {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    const figures = meta.figures || [];
                    const fig = findAllowedFigureForBlock(figures, block, allowedNewBookFigures);
                    if (fig) {
                        block.fig_id = block.fig_id || fig.fig_id || '';
                        block.caption = block.caption || fig.caption || '';
                        block.description = block.description || fig.description || fig.visual_description || fig.image_description || '';
                        block.file_path = block.file_path || fig.crop_file || '';
                        if (fig.crop_file && allowedNewBookFigures.has(path.basename(fig.crop_file)) && fs.existsSync(path.join(FIGURE_IMAGE_DIR_NEW, fig.crop_file))) {
                            cropUrl = `/figures/${encodeURIComponent(fig.crop_file)}`;
                        } else if (fig.crop_file) {
                            const generatedCropPath = path.join(GENERATED_DIR, 'crops', fig.crop_file);
                            if (fs.existsSync(generatedCropPath)) {
                                cropUrl = `/generated/crops/${encodeURIComponent(fig.crop_file)}`;
                            }
                        }
                    }
                }

                // --- Tier 1b: explicit file_path (figure from new-book-figures dir) ---
                if (!cropUrl && block.file_path) {
                    const fileName = path.basename(String(block.file_path || ''));
                    if (fileName && allowedNewBookFigures.has(fileName) && fs.existsSync(path.join(FIGURE_IMAGE_DIR_NEW, fileName))) {
                        cropUrl = `/figures/${encodeURIComponent(fileName)}`;
                    }
                }

                if (cropUrl && !block.warning) {
                    const altText = block.fig_id || figId || block.caption || 'Textbook page';
                    const metaHtml = block.teaching_role
                        ? `<div class="kc-visual-meta" data-visual-kind="book_image" data-teaching-role="${escapeHtmlAttr(block.teaching_role)}" style="display:none;"></div>`
                        : '';
                    if (metaHtml) parts.push(`%%KC_BLOCK%%${metaHtml}%%KC_END%%`);
                    parts.push(`![${altText}](${cropUrl})`);
                    if (block.caption && block.caption !== (block.fig_id || figId)) parts.push(`*${block.caption}*`);
                    if (block.description) {
                        parts.push(`<div class="lesson-figure-description">${escapeHtmlInline(block.description)}</div>`);
                    }
                } else if (bookSource !== 'new') {
                    const reason = block.warning || `no allowed figure or page image found for ${sourcePage}${figId ? ` (${figId})` : ''}`;
                    parts.push(`*(Figure unavailable: ${reason})*`);
                }
                break;
            }

            case 'web_search_image':
                try {
                    const query = compactWhitespace(block.search_query || block.query || '');
                    if (shouldPreferLatexConceptVisual(query, block.title || '')) {
                        const latexMarkdown = buildLatexConceptVisualMarkdown(query);
                        if (latexMarkdown) {
                            parts.push(latexMarkdown);
                            skipNextGeneratedFallback = true;
                            break;
                        }
                    }
                    const resolved = await resolveReferenceImageForQuery(query, {
                        preferAnimated: Boolean(block.prefer_animated)
                    });
                    if (resolved && resolved.url) {
                        block.selected_url = resolved.url;
                        block.selected_source = resolved.source;
                        block.selected_title = resolved.title;
                        block.selected_mime = resolved.mime;
                        block.fallback_triggered = false;
                        const metaHtml = `<div class="kc-visual-meta" data-visual-kind="web_reference_image" data-teaching-role="${escapeHtmlAttr(block.teaching_role || 'reference_anchor')}" style="display:none;"></div>`;
                        parts.push(`%%KC_BLOCK%%${metaHtml}%%KC_END%%`);
                        const altText = String(resolved.title || 'Reference illustration').replace(/[\]\[]/g, '');
                        parts.push(`![${altText}](${resolved.url})`);
                        const sourceLabel = resolved.source === 'wikimedia' ? 'Wikimedia Commons' : 'Wikipedia';
                        if (block.caption) {
                            parts.push(`*${block.caption}*`);
                        } else if (resolved.title) {
                            parts.push(`*Reference visual from ${sourceLabel}: ${resolved.title}*`);
                        }
                        const mediaNote = String(resolved.mime || '').toLowerCase().includes('gif')
                            ? 'Animated reference'
                            : 'Reference image';
                        parts.push(`%%KC_BLOCK%%<div class="kc-reference-source"><a href="${resolved.url}" target="_blank" rel="noopener noreferrer">${mediaNote} from ${sourceLabel}</a></div>%%KC_END%%`);
                        skipNextGeneratedFallback = true;
                    } else {
                        block.fallback_triggered = true;
                        skipNextGeneratedFallback = block.fallback !== 'generate_image';
                    }
                } catch (err) {
                    console.warn('[LessonImage] web_search_image failed; falling back silently:', err.message);
                    block.fallback_triggered = true;
                    skipNextGeneratedFallback = block.fallback !== 'generate_image';
                }
                break;

            case 'generate_image': {
                if (skipNextGeneratedFallback) {
                    skipNextGeneratedFallback = false;
                    break;
                }
                const rawPrompt = block.prompt || block.spec || (block.python_spec && (block.python_spec.description || block.python_spec.title)) || block.reason || 'educational illustration';
                if (shouldPreferLatexConceptVisual(rawPrompt, block.title || '')) {
                    const latexMarkdown = buildLatexConceptVisualMarkdown(rawPrompt);
                    if (latexMarkdown) {
                        parts.push(latexMarkdown);
                        break;
                    }
                }
                const metaHtml = block.teaching_role
                    ? `<div class="kc-visual-meta" data-visual-kind="generate_image" data-teaching-role="${escapeHtmlAttr(block.teaching_role)}" style="display:none;"></div>`
                    : '';
                const stylePrefix = 'Use this only as a last-resort fallback after textbook figure, wiki/wikimedia, LaTeX-native visual, and interactive-demo options are judged insufficient. Exactly one knowledge point only. Never combine multiple concepts into one image. No collage, no dashboard, no multi-topic poster, no multi-panel concept bundle. Pure white clean background, minimalist lecture-notes educational diagram, centered academic layout, single clear reading path, low-saturation academic palette, navy / muted teal / soft gray with muted red only for warnings, clean linework, restrained colored teaching boxes, no poster styling, no cartoon elements, no dense text blocks, no full derivation, no extra examples, exam-oriented concept clarity. ';
                const prompt = `${stylePrefix}${rawPrompt}`.trim();
                try {
                    const imageTimeoutMs = Number(block.timeout_ms || (block.optional ? 120000 : 240000));
                    const imgResult = await callTutorSkillRaw(prompt, { timeoutMs: imageTimeoutMs });
                    const urls = extractRenderableImageUrls(imgResult);
                    if (urls.length > 0) {
                        if (metaHtml) parts.push(`%%KC_BLOCK%%${metaHtml}%%KC_END%%`);
                        if (block.caption) parts.push(`*🎨 ${block.caption}*`);
                        parts.push(`![Illustration](${urls[0]})`);
                    } else {
                        throw new Error('generate_image returned no renderable URL');
                    }
                } catch (e) {
                    console.warn('[LessonImage] generate_image failed; continuing without image:', e.message);
                    if (block.caption) {
                        parts.push(`*${block.caption}*`);
                    }
                    parts.push(`*(Illustration unavailable: ${escapeHtmlInline(e.message || 'image generation failed')})*`);
                }
                break;
            }

            case 'interactive_demo': {
                const demoB64 = Buffer.from(JSON.stringify(block || {})).toString('base64');
                const metaHtml = `<div class="kc-visual-meta" data-visual-kind="interactive_demo" data-teaching-role="${escapeHtmlAttr(block.teaching_role || 'interactive_demo')}" style="display:none;"></div>`;
                const shell = `<div class="kc-interactive-demo" data-demo-b64="${demoB64}"></div>`;
                parts.push(`%%KC_BLOCK%%${metaHtml}${shell}%%KC_END%%`);
                break;
            }

            case 'knowledge_check': {
                // Legacy single-question support
                const kcHtml = `<div class="kc-container" data-question="${block.question.replace(/"/g,'&quot;')}" data-answer="${block.answer.replace(/"/g,'&quot;')}" data-hint="${(block.hint||'').replace(/"/g,'&quot;')}" style="display:none;"></div>`;
                parts.push(`%%KC_BLOCK%%${kcHtml}%%KC_END%%`);
                break;
            }

            case 'section_summary':
                parts.push('---\n**📌 Key Takeaways**');
                if (Array.isArray(block.bullets)) {
                    block.bullets.forEach(b => parts.push(`- ${b}`));
                }
                if (block.transition) parts.push(`\n*${block.transition}*`);
                break;

            case 'quiz_plan': {
                const b64Json = Buffer.from(JSON.stringify(block || {})).toString('base64');
                const quizHtml = `<div class="kc-quiz-plan" data-quiz-b64="${b64Json}" style="display:none;"></div>`;
                parts.push(`%%KC_BLOCK%%${quizHtml}%%KC_END%%`);
                break;
            }

            default:
                if (block.content) parts.push(block.content);
                break;
        }
        parts.push(''); // spacer between blocks
    }

    return parts.join('\n');
}

/**
 * 生成小节完整讲解 — now powered by dual-agent pipeline.
 *
 * Fail-fast policy (Phase 0, 2026-06-19): if Agent A returns no blueprint or
 * unrecoverable JSON, this function throws. The old `buildFallbackBlueprint`
 * path was deliberately removed so a degraded lesson never silently masks an
 * Agent A regression. Callers must surface the error to the user (or log it
 * in pregen) — do not re-introduce a fallback blueprint without an explicit
 * design discussion.
 */
async function generateSectionLesson(sectionId, sectionTitle, bookPages, webSources, language = 'en', bookSource = 'new') {
    // ── Agent A: Plan ──────────────────────────────────────────────────────────
    let blueprint = null;
    let agentARaw = '';
    const finalizeLesson = (markdown) => normalizeLessonVisualPolicy(markdown, language);

    try {
        const result = await agentA_plan(sectionId, sectionTitle, bookPages, webSources, language, bookSource);
        blueprint = result.blueprint;
        agentARaw = String(result.raw || '');
    } catch (err) {
        console.error('[Agent A] Error:', err.message);
        throw new Error(`Agent A planning failed for ${sectionId}: ${err.message}`);
    }

    if (!blueprint) {
        throw new Error(`Agent A planning failed for ${sectionId}: no blueprint returned.`);
    }

    // ── Agent B: Execute ───────────────────────────────────────────────────────
    let lesson = '';
    try {
        lesson = await agentB_execute(sectionId, blueprint, bookPages, webSources, language, bookSource);
    } catch (err) {
        console.error(`[Agent B:${sectionId}] execute failed:`, err && err.stack ? err.stack : err);
        throw err;
    }

    try {
        return finalizeLesson(lesson);
    } catch (err) {
        console.error(`[LessonFinalize:${sectionId}] finalizeLesson failed:`, err && err.stack ? err.stack : err);
        throw err;
    }
}

/**
 * 直接运行技能脚本（保留旧接口能力）
 */
async function callTutorSkillRaw(prompt, options = {}) {
    return new Promise((resolve, reject) => {
        const timeoutMs = Number(options.timeoutMs || process.env.TUTOR_SKILL_TIMEOUT_MS || 45000);
        const maxOutputBytes = 12 * 1024 * 1024;

        const child = spawn(PYTHON_BIN, [SKILL_SCRIPT, prompt], {
            env: { ...process.env, MPLBACKEND: 'Agg', TUTOR_GENERATED_DIR: GENERATED_DIR, TUTOR_IMAGE_ONLY: '1' },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let outputTooLarge = false;
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, timeoutMs);

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString('utf8');
            if (Buffer.byteLength(stdout, 'utf8') > maxOutputBytes) {
                outputTooLarge = true;
                child.kill('SIGKILL');
            }
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString('utf8');
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            reject(new Error(`Failed to start skill script: ${err.message}`));
        });

        child.on('close', (code) => {
            clearTimeout(timer);

            if (timedOut) return reject(new Error(`Request timeout (${Math.round(timeoutMs / 1000)}s)`));
            if (outputTooLarge) return reject(new Error('Skill output too large (>12MB)'));
            if (code !== 0) {
                writeDebugFile('image-skill-last-error.log', stderr || `Skill exited with code ${code}`);
                return reject(new Error((stderr || `Skill exited with code ${code}`).trim()));
            }

            resolve(stdout.trim() || '处理完成（无文本输出）');
        });
    });
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname || '/';
    setCORSHeaders(res, pathname, req.headers && req.headers.origin);

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    console.log(`[HTTP] ${req.method} ${pathname}`);

    if (pathname === '/api/tutor' && req.method === 'POST') {
        try {
            // LLM-spending route (design §2, review I5): legacy but can spend.
            const auth = await resolveAuth(req);
            if (REQUIRE_AUTH && !auth) { send401(res); return; }
            const data = await readJsonBody(req);
            const prompt = data.prompt;

            if (typeof prompt !== 'string' || !prompt.trim()) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Missing prompt' }));
                return;
            }

            const result = await callTutorSkillRaw(prompt);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                response: result,
                mode: 'direct-skill-script',
                promptPassthrough: true
            }));
        } catch (err) {
            console.error('[API /api/tutor] Error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }


    // ──────────────────────────────────────────────────
    // GET /api/memory?uid=xxx  →  return user memory
    // POST /api/memory          →  create or patch user memory
    // ──────────────────────────────────────────────────
    if (pathname === '/api/sessions' && req.method === 'GET') {
        // uid-scoped route: token uid wins whenever a token is presented.
        const auth = await resolveAuth(req);
        if (REQUIRE_AUTH && !auth) { send401(res); return; }
        const uid = auth ? auth.uid : parsedUrl.query.uid;
        if (!uid) { res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'Missing uid' })); return; }
        const requestId = crypto.randomUUID();
        try {
            const sessions = await listSessionsForUid(uid);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ sessions }));
        } catch (error) {
            console.error(`[sessions:${requestId}] list failed:`, error.message);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Session storage failed', stage: 'persistence', request_id: requestId }));
        }
        return;
    }
    if (pathname.startsWith('/api/sessions/') && ['GET', 'DELETE', 'PATCH'].includes(req.method)) {
        const auth = await resolveAuth(req);
        if (REQUIRE_AUTH && !auth) { send401(res); return; }
        const uid = auth ? auth.uid : parsedUrl.query.uid;
        const sessionId = decodeURIComponent(pathname.slice('/api/sessions/'.length));
        const requestId = crypto.randomUUID();
        if (!uid) { res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'Missing uid' })); return; }
        try {
            if (req.method === 'GET') {
                const session = await readSessionFile(uid, sessionId);
                if (!session) { res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'Session not found' })); return; }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(session));
                return;
            }
            if (req.method === 'PATCH') {
                const data = await readJsonBody(req);
                const allowedFields = new Set(['customTitle', 'starred']);
                const unsupported = Object.keys(data).filter(key => !allowedFields.has(key));
                if (unsupported.length || !Object.keys(data).length
                    || (Object.prototype.hasOwnProperty.call(data, 'customTitle') && (typeof data.customTitle !== 'string' || data.customTitle.trim().length > 80))
                    || (Object.prototype.hasOwnProperty.call(data, 'starred') && typeof data.starred !== 'boolean')) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Invalid session metadata patch' }));
                    return;
                }
                const patch = {};
                if (Object.prototype.hasOwnProperty.call(data, 'customTitle')) patch.customTitle = data.customTitle.trim();
                if (Object.prototype.hasOwnProperty.call(data, 'starred')) patch.starred = data.starred;
                const result = await updateSessionMetadata(uid, sessionId, patch);
                if (result.status === 'not_found') {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Session not found' }));
                    return;
                }
                if (result.status !== 'updated') throw new Error(result.error || 'session metadata write failed');
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, session: result.session }));
                return;
            }
            const ok = await deleteSessionForUid(uid, sessionId);
            res.writeHead(ok ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(ok ? { ok: true } : { error: 'Session not found' }));
            return;
        } catch (error) {
            console.error(`[sessions:${requestId}] ${req.method} failed:`, error.message);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Session storage failed', stage: 'persistence', request_id: requestId }));
        }
        return;
    }

    if (pathname === '/api/memory') {
        if (req.method === 'GET') {
            const auth = await resolveAuth(req);
            if (REQUIRE_AUTH && !auth) { send401(res); return; }
            const uid = auth ? auth.uid : parsedUrl.query.uid;
            if (!uid) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing uid' })); return; }
            const mem = await readUserMemory(uid);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                teachingInstructions: mem && typeof mem.teachingInstructions === 'string'
                    ? mem.teachingInstructions
                    : '',
                updatedAt: mem && (mem.updatedAt || mem.lastUpdated) || null,
            }));
            return;
        }
        if (req.method === 'POST') {
            try {
                const auth = await resolveAuth(req);
                if (REQUIRE_AUTH && !auth) { send401(res); return; }
                const data = await readJsonBody(req);
                const uid = auth ? auth.uid : data.uid;
                if (!uid) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing uid' })); return; }
                const allowedFields = new Set(['teachingInstructions', 'uid']);
                const unsupportedFields = Object.keys(data).filter(key => !allowedFields.has(key));
                if (unsupportedFields.length) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: `Unsupported memory fields: ${unsupportedFields.join(', ')}` }));
                    return;
                }
                if (typeof data.teachingInstructions !== 'string') {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'teachingInstructions must be a string' }));
                    return;
                }
                const teachingInstructions = data.teachingInstructions.trim();
                if (teachingInstructions.length > 1000) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'teachingInstructions must be 1000 characters or fewer' }));
                    return;
                }
                const existing = (await readUserMemory(uid)) || { uid, createdAt: new Date().toISOString() };
                const updatedAt = new Date().toISOString();
                const nextMemory = {
                    uid,
                    createdAt: existing.createdAt || updatedAt,
                    teachingInstructions,
                    updatedAt,
                };
                if (!(await writeUserMemory(uid, nextMemory))) {
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Storage write failed' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, memory: nextMemory }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    if (pathname === '/api/section' && req.method === 'POST') {
        try {
            // Mode gate (design §2, review C1): unauthenticated requests get
            // cache-only behavior. mode defaults to 'intro' when absent, so a
            // missing mode is gated exactly like an explicit intro.
            const auth = await resolveAuth(req);
            const sectionGenerationAllowed = !REQUIRE_AUTH || Boolean(auth);
            const data = await readJsonBody(req);
            const sectionId = compactWhitespace(data.sectionId || '');
            const sectionTitle = compactWhitespace(data.sectionTitle || sectionId);
            const mode = data.mode || 'intro'; // 'intro' | 'lesson'
            const language = (data.language === 'zh') ? 'zh' : 'en'; // default EN
            const b8FormulaAppendix = getB8FormulaAppendix(sectionId, sectionTitle);
            const { ocrDir: secOcrDir } = getBookDirs(data.bookSource);

            if (!sectionId) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Missing sectionId' }));
                return;
            }

            console.log(`[SECTION] sectionId=${sectionId} mode=${mode} book=${data.bookSource||'old'}`);
            const rawPages = getPagesForSection(sectionId, secOcrDir);
            const sectionOcrPages = attachSectionOcrToPages(sectionId, rawPages, data.bookSource);
            const bookPages = rawPages.map(item => ({
                ...item,
                image: getPageImageUrl(data.bookSource, item.pageImage)
            }));

            if (b8FormulaAppendix && mode === 'lesson') {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    sectionId,
                    sectionTitle,
                    lesson: b8FormulaAppendix,
                    cached: true,
                    formulaAppendix: true,
                    bookPages: bookPages.map(p => ({
                        page: p.page,
                        image: p.image,
                        subsection: p.subsection,
                        title: p.title,
                        summary: p.summary
                    })),
                    webSources: []
                }));
                return;
            }

            if (mode === 'intro') {
                if (!sectionGenerationAllowed) { send401(res); return; } // intro always spends (LLM call below)
                const intro = await generateSectionIntro(sectionId, sectionTitle, sectionOcrPages, language);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    sectionId,
                    sectionTitle,
                    intro,
                    bookPages: bookPages.map(p => ({
                        page: p.page,
                        image: p.image,
                        subsection: p.subsection,
                        title: p.title,
                        summary: p.summary
                    }))
                }));
            } else if (mode === 'overview') {
                const hasExistingPrelude = hasLessonCacheFile(sectionId, data.bookSource, 'parent_prelude');
                const hasPrelude = hasExistingPrelude || shouldGenerateParentPreludeLesson(sectionId, sectionTitle, rawPages);
                let cachedLesson = hasPrelude ? readLessonCache(sectionId, data.bookSource, 'parent_prelude') : null;
                const normalizedCachedLesson = cachedLesson
                    ? normalizeMathMarkdown(convertLegacyQuickCheckToKcBlocks(cachedLesson))
                    : '';
                const responseFormatIssues = normalizedCachedLesson ? collectLessonFormatIssues(normalizedCachedLesson) : [];
                let generatedResult = null;

                if (hasPrelude && (!normalizedCachedLesson || responseFormatIssues.length)) {
                    // Cache miss / format repair would spend: 401 instead of
                    // generating for unauthenticated requests; cache hits above
                    // and below stay public.
                    if (!sectionGenerationAllowed) { send401(res); return; }
                    generatedResult = await preGenerateSectionLesson(sectionId, sectionTitle, {
                        language,
                        bookSource: data.bookSource,
                        cacheVariant: 'parent_prelude',
                        force: Boolean(responseFormatIssues.length)
                    });
                    cachedLesson = generatedResult.lesson || readLessonCache(sectionId, data.bookSource, 'parent_prelude');
                }

                const finalLesson = cachedLesson
                    ? normalizeMathMarkdown(convertLegacyQuickCheckToKcBlocks(cachedLesson))
                    : '';
                const finalIssues = finalLesson ? collectLessonFormatIssues(finalLesson) : [];

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    sectionId,
                    sectionTitle,
                    hasPrelude,
                    cached: Boolean(normalizedCachedLesson && !responseFormatIssues.length),
                    generated: Boolean(generatedResult && !generatedResult.skipped),
                    cacheMiss: Boolean(hasPrelude && (!finalLesson || finalIssues.length)),
                    cacheVersion: LESSON_CACHE_VERSION,
                    lesson: finalLesson && !finalIssues.length ? finalLesson : '',
                    bookPages: bookPages.map(p => ({
                        page: p.page,
                        image: p.image,
                        subsection: p.subsection,
                        title: p.title,
                        summary: p.summary
                    })),
                    webSources: []
                }));
            } else if (mode === 'lesson') {
                // ── Check lesson cache first ──────────────────────────────
                const cachedLesson = readLessonCache(sectionId, data.bookSource);
                if (cachedLesson) {
                    console.log(`[SECTION] Cache hit for ${sectionId}, skipping pipeline.`);
                    const normalizedCachedLesson = normalizeMathMarkdown(convertLegacyQuickCheckToKcBlocks(cachedLesson));
                    const responseFormatIssues = collectLessonFormatIssues(normalizedCachedLesson);
                    if (responseFormatIssues.length) {
                        console.warn(`[SECTION] Cache response rejected for ${sectionId}: ${responseFormatIssues.join(', ')}`);
                    } else {
                        if (normalizedCachedLesson !== cachedLesson) {
                            writeLessonCache(sectionId, normalizedCachedLesson, data.bookSource);
                        }
                        const activeCacheExists = hasLessonCacheFile(sectionId, data.bookSource);

                        if (hasVisualMetadataMarkup(normalizedCachedLesson)
                            && !hasDisallowedNewBookPageFallback(normalizedCachedLesson, sectionId, rawPages, data.bookSource)
                            && !hasDisallowedNewBookFigureRefs(normalizedCachedLesson, sectionId, rawPages, data.bookSource)
                            && !hasNewBookFigureUnavailablePlaceholder(normalizedCachedLesson, data.bookSource)
                            && !hasIllustrationUnavailablePlaceholder(normalizedCachedLesson)
                            && (!activeCacheExists || !hasLegacyGeneratedVisualArtifacts(normalizedCachedLesson))) {
                            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({
                                sectionId, sectionTitle,
                                lesson: normalizedCachedLesson,
                                cached: true,
                                bookPages: bookPages.map(p => ({
                                    page: p.page, image: p.image,
                                    subsection: p.subsection, title: p.title, summary: p.summary
                                })),
                                webSources: []
                            }));
                            return;
                        }
                    }
                    console.warn(`[SECTION] Cache for ${sectionId} is stale or invalid under ${LESSON_CACHE_VERSION}; treating as miss.`);
                }
                console.log(`[SECTION] Cache miss for ${sectionId} under ${LESSON_CACHE_VERSION}; runtime generation disabled.`);
                if (isB8FamilySection(sectionId, sectionTitle)) {
                    // B.8 subtopic with no cached lesson yet (e.g. B.8-5): keep
                    // the appendix reference page instead of a dead-end miss,
                    // until pregen backfills its real lesson.
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        sectionId,
                        sectionTitle,
                        lesson: B8_FORMULA_APPENDIX_MARKDOWN,
                        cached: true,
                        formulaAppendix: true,
                        bookPages: bookPages.map(p => ({
                            page: p.page, image: p.image,
                            subsection: p.subsection, title: p.title, summary: p.summary
                        })),
                        webSources: []
                    }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    sectionId,
                    sectionTitle,
                    lesson: LESSON_CACHE_MISS_MESSAGE,
                    cached: false,
                    cacheMiss: true,
                    cacheVersion: LESSON_CACHE_VERSION,
                    bookPages: bookPages.map(p => ({
                        page: p.page,
                        image: p.image,
                        subsection: p.subsection,
                        title: p.title,
                        summary: p.summary
                    })),
                    webSources: []
                }));
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Invalid mode' }));
            }
        } catch (err) {
            console.error('[API /api/section] Error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message || 'Unknown error' }));
        }
        return;
    }

    if (pathname === '/api/pregen/section' && req.method === 'POST') {
        try {
            // LLM-spending route (design §2 / D4).
            const auth = await resolveAuth(req);
            if (REQUIRE_AUTH && !auth) { send401(res); return; }
            const data = await readJsonBody(req);
            const sectionId = compactWhitespace(data.sectionId || '');
            const sectionTitle = compactWhitespace(data.sectionTitle || sectionId);
            if (!sectionId) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Missing sectionId' }));
                return;
            }

            if (data.inspectContextOnly) {
                const context = await inspectLessonGenerationContext(sectionId, sectionTitle, {
                    bookSource: data.bookSource
                });
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    ok: true,
                    inspectContextOnly: true,
                    ...context
                }));
                return;
            }

            const result = await preGenerateSectionLesson(sectionId, sectionTitle, {
                language: data.language,
                bookSource: data.bookSource,
                force: !!data.force,
                cacheVariant: data.cacheVariant
            });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                ok: true,
                ...result,
                lessonPreview: String(result.lesson || '').slice(0, 600)
            }));
        } catch (err) {
            console.error('[API /api/pregen/section] Error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message || 'Unknown error' }));
        }
        return;
    }

    if (pathname === '/api/ask-guidance' && req.method === 'POST') {
        const routeRequestId = crypto.randomUUID();
        try {
            const auth = await resolveAuth(req);
            if (REQUIRE_AUTH && !auth) { send401(res); return; }
            const data = parseGuidanceRequestBody(await readJsonBody(req));
            const result = await guidanceService.createGuidance(data);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(result));
        } catch (err) {
            const isGuidanceError = err && err.name === 'GuidanceServiceError';
            const requestId = isGuidanceError && err.requestId ? err.requestId : routeRequestId;
            const stage = isGuidanceError ? err.stage : 'validation';
            const statusCode = isGuidanceError ? err.statusCode : 400;
            const message = isGuidanceError ? err.message : (err.message || 'Invalid guidance request');
            console.error(`[API /api/ask-guidance:${requestId}] ${stage}:`, err.cause || err);
            res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: message, stage, request_id: requestId }));
        }
        return;
    }

    if (pathname === '/api/intent' && req.method === 'POST') {
        // Triage: does this turn need the grounded teaching pipeline (textbook
        // retrieval + web search + multi-step generation), or is it casual
        // chit-chat that only needs a short reply? Fail-safe: default to grounded
        // so a real question is never wrongly skipped.
        try {
            // LLM-spending route (design §2 / D4). The handler never reads a
            // uid (review I4) — gating is the only identity concern here.
            const auth = await resolveAuth(req);
            if (REQUIRE_AUTH && !auth) { send401(res); return; }
            const data = await readJsonBody(req);
            const question = compactWhitespace(data.prompt || data.question || '');
            const language = data.language === 'zh' ? 'zh' : 'en';
            const history = Array.isArray(data.history) ? data.history : [];
            const sectionTitle = compactWhitespace(data.sectionTitle || data.sectionId || '');
            if (!question) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Missing prompt/question' }));
                return;
            }
            let grounded = true;
            let reply = '';
            try {
                const historyText = history.slice(-3)
                    .map(h => `${h && h.role === 'assistant' ? 'Tutor' : 'Student'}: ${compactWhitespace((h && h.content) || '')}`)
                    .filter(line => line.length > 8)
                    .join('\n')
                    .slice(0, 1200);
                const classifyRaw = await callOpenRouterChat({
                    model: 'anthropic/claude-haiku-4.5',
                    timeoutMs: 15000,
                    temperature: 0,
                    maxTokens: 200,
                    messages: [
                        {
                            role: 'system',
                            content: 'You triage messages for a Signals & Systems tutoring app. Decide whether the student\'s latest message needs the full grounded teaching pipeline (textbook retrieval + web search + a structured explanation), or is a casual/simple turn (greeting, thanks, acknowledgement, small-talk) that only needs a short friendly reply. A short message can still be grounded if, in context, it is a real course question (e.g. "why?", "再详细点"). When unsure, choose grounded. Respond with STRICT JSON only, no prose: {"grounded": true|false, "reply": "<if not grounded: one short warm reply in the student\'s language inviting a course question; else empty string>"}'
                        },
                        {
                            role: 'user',
                            content: [
                                sectionTitle ? `Current section: ${sectionTitle}` : '',
                                historyText ? `Recent conversation:\n${historyText}` : '',
                                `Student's latest message: ${question}`,
                                `Reply language: ${language === 'zh' ? 'Chinese' : 'English'}`
                            ].filter(Boolean).join('\n\n')
                        }
                    ]
                });
                const parsed = tryParseJsonLoose(classifyRaw);
                if (parsed && typeof parsed.grounded === 'boolean') {
                    grounded = parsed.grounded;
                    reply = grounded ? '' : compactWhitespace(parsed.reply || '');
                }
            } catch (err) {
                console.warn('[intent] classification failed; defaulting to grounded:', err.message);
                grounded = true;
                reply = '';
            }
            if (!grounded && !reply) {
                reply = language === 'zh'
                    ? '你好！👋 想学哪个知识点、或者有题目，直接问我就行。'
                    : 'Hi! 👋 What would you like to learn or work on? Ask me a concept or a problem.';
            }
            console.log(`[intent] "${question.slice(0, 60)}" -> grounded=${grounded}`);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ grounded, reply }));
        } catch (err) {
            console.error('[API /api/intent] Error:', err);
            // Hard failure: tell the client to fall back to the grounded flow.
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ grounded: true, reply: '' }));
        }
        return;
    }

    if (pathname === '/api/ask' && req.method === 'POST') {
        const requestId = crypto.randomUUID();
        try {
            // LLM-spending route that ALSO reads/writes per-uid data (review
            // C2): uid must come from the verified token whenever one is
            // presented — body.uid must never select whose memory is read or
            // whose session the turn persists into.
            const auth = await resolveAuth(req);
            if (REQUIRE_AUTH && !auth) { send401(res); return; }
            const data = await readJsonBody(req);
            const question = compactWhitespace(data.prompt || data.question || '');
            const mode = data.mode === 'followup' ? 'followup' : 'ask';
            const history = Array.isArray(data.history) ? data.history : [];
            const sectionId = compactWhitespace(data.sectionId || '');
            const sectionTitle = compactWhitespace(data.sectionTitle || '');
            const lessonContext = compactWhitespace(data.lessonContext || '');
            const language = data.language === 'zh' ? 'zh' : 'en';
            const uid = auth ? auth.uid : (data.uid || null);
            const sessionId = data.session_id == null ? null : String(data.session_id);
            const origin = data.origin || (sectionId || sectionTitle ? 'learn' : 'main');
            let guidance = null;
            if (Object.prototype.hasOwnProperty.call(data, 'sessionId')) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Use session_id instead of sessionId', stage: 'validation', request_id: requestId }));
                return;
            }
            if (sessionId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(sessionId)) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Invalid session_id', stage: 'validation', request_id: requestId }));
                return;
            }
            if (!['main', 'learn'].includes(origin)) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'origin must be main or learn', stage: 'validation', request_id: requestId }));
                return;
            }
            try {
                guidance = parseGuidanceSelection(data.guidance);
            } catch (validationError) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: validationError.message, stage: 'validation', request_id: requestId }));
                return;
            }
            const userMemory = uid ? await readUserMemory(uid) : null;
            const userProfilePrompt = buildTeachingInstructionsPrompt(userMemory);
            const answerLength = ['fast', 'short'].includes(data.answerLength)
                ? 'short'
                : (['detailed', 'long'].includes(data.answerLength) ? 'long' : 'medium');
            const attachments = Array.isArray(data.attachments) ? data.attachments : [];
            const hasReadableAttachments = attachments.some(att => att && (
                (att.type === 'image' && att.dataUrl) ||
                (att.type === 'pdf' && att.dataUrl) ||
                ((att.type === 'document' || att.type === 'word') && compactWhitespace(att.text || ''))
            ));
            const attachmentFirst = Boolean(data.attachmentFirst || data.attachmentOnly || (hasReadableAttachments && !sectionId && !sectionTitle));
            const preparedAttachments = hasReadableAttachments ? await prepareAttachmentContext(attachments) : { extractedPdfs: [], retrievalText: '' };
            const { ocrDir, pageImageDir } = getBookDirs(data.bookSource);

            if (!question) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Missing prompt/question' }));
                return;
            }

            console.log('[ASK] Question:', question, 'mode=', mode);
            let relatedBooks = [];
            let localBookContextCount = 0;
            let ragFlowBookContextCount = 0;
            let textbookContextStrategy = 'local_ocr';
            let usedLocalFallback = false;
            const incomingBookPages = attachmentFirst ? [] : filterPagesForBookSource(data.bookPages, data.bookSource);
            if (Array.isArray(data.bookPages) && data.bookPages.length && !incomingBookPages.length) {
                console.warn(`[ASK] Dropped ${data.bookPages.length} stale bookPages due to bookSource=${data.bookSource || 'old'} mismatch`);
            }

            const loadIncomingBookPages = () => incomingBookPages.map(item => ({
                ...item,
                pageImage: item.pageImage || `${item.page}.png`,
                textPath: path.join(ocrDir, `${item.page}.txt`),
                ocrText: readOCRText(path.join(ocrDir, `${item.page}.txt`), 5500)
            }));
            const loadQuestionLocalOcrPages = async () => {
                const keywords = await extractKeywords(question);
                return selectRelevantBooks(question, keywords, 3, 5, ocrDir).map(item => ({
                    ...item,
                    ocrText: readOCRText(item.textPath, 5500)
                }));
            };
            const loadMainLocalContext = async () => incomingBookPages.length
                ? loadIncomingBookPages()
                : loadQuestionLocalOcrPages();

            let ragFlowContext = null;
            let ragFlowUsed = false;
            const useSectionAnchor = Boolean(sectionId || sectionTitle);
            const useMainRagFirst = !attachmentFirst && !useSectionAnchor;

            if (useMainRagFirst) {
                textbookContextStrategy = 'ragflow_first';
                try {
                    ragFlowContext = await retrieveFromRagFlow({ query: question });
                    if (ragFlowContext && ragFlowContext.chunks.length) {
                        relatedBooks = ragFlowChunksToBookPages(ragFlowContext);
                        ragFlowBookContextCount = relatedBooks.length;
                        ragFlowUsed = true;
                        console.log(`[ASK] Main Q&A using RAGFlow-first context (${ragFlowBookContextCount} chunks)`);
                    }
                } catch (err) {
                    console.warn('[ragflow] main Q&A retrieval failed, falling back to local OCR retrieval:', err.message);
                    ragFlowContext = null;
                    ragFlowUsed = false;
                    ragFlowBookContextCount = 0;
                }
            }

            if (attachmentFirst) {
                textbookContextStrategy = 'attachment_local_ocr';
                relatedBooks = (await selectBooksFromAttachmentText(preparedAttachments.retrievalText, question, ocrDir)).map(item => ({
                    ...item,
                    ocrText: readOCRText(item.textPath, 5500)
                }));
                console.log(`[ASK] Attachment-first mode: selected ${relatedBooks.length} textbook pages from attachment text`);
            } else if (useSectionAnchor) {
                textbookContextStrategy = 'section_ocr_plus_ragflow';
                const sectionKey = sectionId || sectionTitle;
                const mappedSectionPages = getPagesForSection(sectionKey, ocrDir);
                const fallbackPages = mappedSectionPages.length
                    ? mappedSectionPages
                    : incomingBookPages.map(item => ({
                        ...item,
                        pageImage: item.pageImage || `${item.page}.png`,
                        textPath: path.join(ocrDir, `${item.page}.txt`)
                    }));
                const sectionPages = data.bookSource === 'new'
                    ? attachSectionOcrToPages(sectionKey, fallbackPages, data.bookSource).slice(0, 5)
                    : fallbackPages.slice(0, 5);
                relatedBooks = sectionPages.map(item => ({
                    ...item,
                    ocrText: Object.prototype.hasOwnProperty.call(item, 'ocrOverrideText')
                        ? String(item.ocrOverrideText || '').slice(0, 18000)
                        : readOCRText(item.textPath, 5500)
                }));
            } else if (!relatedBooks.length) {
                usedLocalFallback = useMainRagFirst;
                relatedBooks = await loadMainLocalContext();
                if (useMainRagFirst) console.log(`[ASK] Main Q&A RAGFlow empty/unavailable; local OCR fallback selected ${relatedBooks.length} pages`);
            }
            localBookContextCount = relatedBooks.filter(item => !(item && item.ragFlow)).length;

            if (!attachmentFirst && useSectionAnchor) {
                try {
                    const ragFlowQuery = compactWhitespace([
                        sectionTitle || sectionId,
                        lessonContext.slice(0, 800),
                        question
                    ].filter(Boolean).join('\n'));
                    ragFlowContext = await retrieveFromRagFlow({ query: ragFlowQuery });
                    if (ragFlowContext && ragFlowContext.chunks.length) {
                        const ragFlowBookPages = ragFlowChunksToBookPages(ragFlowContext);
                        ragFlowBookContextCount = ragFlowBookPages.length;
                        relatedBooks = mergeAskBookContexts(relatedBooks, ragFlowBookPages);
                        ragFlowUsed = true;
                        console.log(`[ASK] Using section OCR + RAGFlow context (${localBookContextCount} local pages + ${ragFlowBookContextCount} chunks)`);
                    }
                } catch (err) {
                    console.warn('[ragflow] retrieval failed, falling back to local OCR retrieval:', err.message);
                    ragFlowContext = null;
                    ragFlowUsed = false;
                    ragFlowBookContextCount = 0;
                }
            }

            const examContext = inferExamPriorityContext(sectionId, sectionTitle, relatedBooks);
            const examPriorityGuidance = loadExamPriorityGuidance(examContext.sectionId, examContext.sectionTitle);
            if (examPriorityGuidance) {
                console.log(`[ASK] Exam-priority hint active: ${examPriorityGuidance.source} / ${(examPriorityGuidance.json?.topic_filter?.relevant_topic_ids || []).join(',')}`);
            }

            let webSources = attachmentFirst ? [] : (Array.isArray(data.webSources) && data.webSources.length
                ? data.webSources
                : []);
            let searchAngles = [];
            let liveSearchEvents = [];
            let webSearchDebug = {
                requested: false,
                sourceCount: webSources.length,
                providersUsed: [],
                providerStats: {},
                providerErrors: [],
                serperConfigured: Boolean(process.env.SERPER_API_KEY || '')
            };
            
            // Check if web search is enabled from UI
            const useWebSearch = data.useWebSearch !== false;

            if (useWebSearch && (!webSources.length || mode === 'followup')) {
                const searchBase = attachmentFirst && preparedAttachments.retrievalText
                    ? [
                        'Search for reliable supporting material that answers the user question about this uploaded attachment.',
                        'The attachment is the material; the user question is the focus. If the question is vague, infer the focus from the attachment.',
                        '',
                        `User question/focus: ${question}`,
                        '',
                        `Uploaded attachment text:\n${preparedAttachments.retrievalText.slice(0, 8000)}`
                    ].join('\n')
                    : question;
                const searchQuestion = attachmentFirst ? searchBase : question;
                const searchResult = await generateSearchAngles(searchQuestion, {
                    history,
                    sectionTitle: sectionTitle || sectionId,
                    lessonContext: attachmentFirst ? searchBase : lessonContext,
                    userProfilePrompt,
                    examPriorityGuidance
                });
                searchAngles = searchResult.angles || [];
                const resolvedQuestion = attachmentFirst
                    ? (searchResult.resolvedQuery || compactWhitespace(preparedAttachments.retrievalText).slice(0, 180) || question)
                    : (searchResult.resolvedQuery || question);
                console.log(`[ASK] Search resolved: "${question}" → "${resolvedQuestion}"`);
                const webResult = await collectWebSources(searchAngles, {
                    question: resolvedQuestion,
                    onSource: (source, currentSorted) => {
                        liveSearchEvents.push({ type: 'source', source, sources: currentSorted.slice(0, 8) });
                    }
                });
                const newWebSources = Array.isArray(webResult) ? webResult : (webResult.sources || []);
                webSearchDebug = Array.isArray(webResult)
                    ? { ...webSearchDebug, requested: true, sourceCount: newWebSources.length }
                    : (webResult.debug || webSearchDebug);
                // merge avoiding duplicates by url
                const seenUrls = new Set(webSources.map(w => w.url));
                for (const w of newWebSources) {
                    if (!seenUrls.has(w.url)) {
                        seenUrls.add(w.url);
                        webSources.push(w);
                    }
                }
                webSources = sortSourcesByType(webSources);
                webSearchDebug.sourceCount = webSources.length;
            } else if (!useWebSearch) {
                console.log('[ASK] Web search bypassed due to useWebSearch=false');
                webSearchDebug.requested = false;
                liveSearchEvents.push({ type: 'status', message: 'Web search bypassed via toggle' });
            }

            let explanation = await generateExplanation(question, relatedBooks, webSources, {
                history,
                sectionTitle: sectionTitle || sectionId,
                lessonContext,
                language,
                mode,
                userProfilePrompt,
                attachments,
                preparedAttachments,
                answerLength,
                examPriorityGuidance,
                guidance
            });

            if (answerLength === 'short' && !explanation.includes('```')) {
                // 极致截断：保留第一行或第一句
                const parts = explanation.split(/[。！？\n]/);
                if (parts.length > 1 && parts[0].length > 10) {
                    explanation = parts[0] + (explanation.includes('。') ? '。' : '');
                }
            }

            // Post-process pure python outputs into images
            explanation = await processEmbeddedPython(explanation, GENERATED_DIR);

            // A signed-in answer is complete only after its real session turn
            // has persisted. Unknown ids never fork a replacement session.
            let savedSessionId = null;
            if (uid) {
                const persistence = await persistSessionTurn(uid, sessionId, {
                    userText: question,
                    aiText: explanation,
                    origin,
                    sectionId,
                    sectionTitle: sectionTitle || 'General Q&A'
                });
                if (persistence.status === 'not_found') {
                    console.warn(`[ASK:${requestId}] session not found: ${sessionId}`);
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Session not found', stage: 'persistence', request_id: requestId }));
                    return;
                }
                if (!['created', 'appended'].includes(persistence.status)) {
                    console.error(`[ASK:${requestId}] session persistence failed:`, persistence.error || persistence.status);
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Answer generated but session persistence failed', stage: 'persistence', request_id: requestId }));
                    return;
                }
                savedSessionId = persistence.sessionId;
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            const textbookStep = ragFlowUsed
                ? (
                    localBookContextCount > 0
                        ? `✅ ${sectionId || sectionTitle ? '当前小节 OCR' : '相关教材 OCR'} ${localBookContextCount} 页 + RAGFlow ${ragFlowBookContextCount} 个教材片段`
                        : `✅ RAGFlow 检索到 ${ragFlowBookContextCount} 个教材片段`
                )
                : `✅ 找到 ${relatedBooks.length} 个相关书页`;
            res.end(JSON.stringify({
                explanation,
                request_id: requestId,
                session_id: savedSessionId,
                bookPages: relatedBooks.map(item => ({
                    page: item.page,
                    image: item.image || (item.pageImage ? getPageImageUrl(data.bookSource, item.pageImage) : ''),
                    subsection: item.subsection,
                    title: item.title,
                    summary: item.summary,
                    keywords: item.keywords
                })),
                webSources,
                liveSearchEvents,
                steps: [
                    textbookStep,
                    `✅ 搜索到 ${webSources.length} 个网页来源`,
                    '✅ Haiku 讲解生成完毕'
                ],
	                debug: {
	                    mode,
	                    searchAngles,
	                    historyCount: history.length,
	                    sectionTitle: sectionTitle || sectionId,
	                    ragFlowEnabled: RAGFLOW_ENABLED,
	                    ragFlowUsed,
	                    ragFlowChunkCount: ragFlowContext ? ragFlowContext.chunks.length : 0,
	                    localBookContextCount,
	                    ragFlowBookContextCount,
	                    finalBookContextCount: relatedBooks.length,
	                    textbookContextStrategy,
	                    usedLocalFallback,
	                    webSearchEnabled: useWebSearch,
	                    webSearchUsed: Boolean(useWebSearch && webSources.length),
	                    webSourceCount: webSources.length,
	                    webProvidersUsed: webSearchDebug.providersUsed || [],
	                    webProviderStats: webSearchDebug.providerStats || {},
	                    webProviderErrors: webSearchDebug.providerErrors || [],
	                    serperConfigured: Boolean(process.env.SERPER_API_KEY || ''),
	                    examPrioritySource: examPriorityGuidance ? examPriorityGuidance.source : null,
	                    examPriorityTopics: examPriorityGuidance ? (examPriorityGuidance.json?.topic_filter?.relevant_topic_ids || []) : []
	                }
	            }));

            return;
        } catch (err) {
            console.error(`[API /api/ask:${requestId}] Error:`, err);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message || 'Unknown error', request_id: requestId }));
        }
        return;
    }

    if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            status: 'ok',
            mode: 'tutor-rag-ui',
            indexedPages: {
                old: getBookIndex(OCR_DIR_NEW).length,
                new: getBookIndex(OCR_DIR_NEW).length
            },
            apiAsk: true,
            apiTutor: true,
            skillScript: SKILL_SCRIPT
        }));
        return;
    }

    if (pathname === '/api/favicon') {
        const query = url.parse(req.url, true).query;
        const target = compactWhitespace(query.url || '');
        const domain = compactWhitespace(query.domain || '');
        const rawTarget = target || (domain ? `https://${domain}` : '');
        if (!rawTarget) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('missing url/domain');
            return;
        }
        let normalized;
        try {
            normalized = new URL(rawTarget.startsWith('http') ? rawTarget : `https://${rawTarget}`);
        } catch (_) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('bad url');
            return;
        }

        const candidates = [
            `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(normalized.toString())}`,
            `https://icons.duckduckgo.com/ip3/${encodeURIComponent(normalized.hostname)}.ico`
        ];

        let sent = false;
        for (const candidate of candidates) {
            try {
                const parsed = new URL(candidate);
                const body = await new Promise((resolve, reject) => {
                    const chunks = [];
                    const r = https.request({
                        protocol: parsed.protocol,
                        hostname: parsed.hostname,
                        path: `${parsed.pathname}${parsed.search}`,
                        method: 'GET',
                        headers: {
                            'User-Agent': 'TutorAgent/1.0 favicon-proxy'
                        }
                    }, resp => {
                        if ((resp.statusCode || 0) < 200 || (resp.statusCode || 0) >= 300) {
                            resp.resume();
                            reject(new Error(`status ${resp.statusCode}`));
                            return;
                        }
                        resp.on('data', c => chunks.push(c));
                        resp.on('end', () => resolve({
                            body: Buffer.concat(chunks),
                            contentType: resp.headers['content-type'] || 'image/png'
                        }));
                    });
                    r.on('error', reject);
                    r.setTimeout(8000, () => r.destroy(new Error('timeout')));
                    r.end();
                });
                // Validate: must be >100 bytes and look like an image
                if (body.body.length > 100 && (body.contentType || '').startsWith('image/')) {
                    res.writeHead(200, {
                        'Content-Type': body.contentType,
                        'Cache-Control': 'public, max-age=86400'
                    });
                    res.end(body.body);
                    sent = true;
                    break;
                }
            } catch (_) {}
        }
        if (!sent) {
            // Return a 1x1 transparent PNG so <img> doesn't show broken icon
            const TRANSPARENT_1x1_PNG = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC41ZYUyZQAAAA1JREFUGFdjYGBg+A8AAQIBAEK0UNwAAAAASUVORK5CYII=',
                'base64'
            );
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=3600'
            });
            res.end(TRANSPARENT_1x1_PNG);
        }
        return;
    }

    if (handleStaticRoute(req, res, pathname)) return;
});

// Read-only tooling exports. Requiring this module must not start a listener;
// cache verification uses the exact production normalization and format gates.
module.exports = {
    collectLessonFormatIssues,
    prepareLessonForCache,
    assertLessonFormatClean,
};

const IS_PREGEN_CLI = require.main === module && process.argv[2] === '--pregen-section';

if (IS_PREGEN_CLI) {
    const sectionId = compactWhitespace(process.argv[3] || '');
    const sectionTitle = compactWhitespace(process.argv[4] || sectionId);
    const bookSource = process.argv[5] === 'new' ? 'new' : 'old';
    const cacheVariant = compactWhitespace(process.argv[6] || 'lesson') || 'lesson';
    if (!sectionId) {
        console.error('Usage: node ws-bridge.js --pregen-section <sectionId> [sectionTitle] [bookSource] [cacheVariant]');
        process.exit(1);
    }
    preGenerateSectionLesson(sectionId, sectionTitle, { bookSource, force: true, cacheVariant })
        .then((result) => {
            console.log(JSON.stringify({
                ok: true,
                sectionId: result.sectionId,
                sectionTitle: result.sectionTitle,
                cacheVariant,
                cacheVersion: result.cacheVersion,
                skipped: result.skipped,
                webSourceCount: Array.isArray(result.webSources) ? result.webSources.length : 0
            }, null, 2));
            process.exit(0);
        })
        .catch((err) => {
            console.error(err.message || String(err));
            process.exit(1);
        });
} else if (require.main === module) {
    // Eager JWKS fetch when auth is enforced: a typo'd CLERK_JWKS_URL shows
    // up in boot logs instead of as unexplained runtime 401s. Non-blocking,
    // never fatal (unlike the DB, verification is per-request fail-closed).
    if (REQUIRE_AUTH) warmUpClerkVerify();

    // Storage init before listen: in pg mode this bootstraps the schema and
    // fails fast (loud crash, no ephemeral-file fallback) when DATABASE_URL
    // is set but unreachable; in file mode it resolves immediately.
    initUserStore().then(() => {
        server.listen(HTTP_PORT, () => {
            console.log('='.repeat(64));
            console.log('Tutor Agent Bridge');
            console.log('='.repeat(64));
            console.log(`HTTP Server : http://localhost:${HTTP_PORT}`);
            console.log(`Indexed OCR : new=${BOOK_INDEX_NEW.length} pages`);
            console.log(`Skill Script: ${SKILL_SCRIPT}`);
            console.log(`Auth        : ${REQUIRE_AUTH ? 'ENFORCED (TUTOR_REQUIRE_AUTH=1)' : 'off (opportunistic token verification only)'}`);
            console.log('');
            console.log('Endpoints:');
            console.log(`  - http://localhost:${HTTP_PORT}/           (Web UI)`);
            console.log(`  - http://localhost:${HTTP_PORT}/api/ask    (RAG + Web + Claude Opus)`);
            console.log(`  - http://localhost:${HTTP_PORT}/api/tutor  (Legacy API preserved)`);
            console.log(`  - http://localhost:${HTTP_PORT}/health     (Health check)`);
            console.log('='.repeat(64));
        });
    }).catch((err) => {
        console.error('[Storage] init failed, refusing to start:', err.message);
        process.exit(1);
    });

    process.on('SIGINT', () => {
        console.log('\n[Server] Shutting down...');
        server.close(() => process.exit(0));
    });
}
