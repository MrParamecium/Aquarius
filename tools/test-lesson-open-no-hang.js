#!/usr/bin/env node
/**
 * Regression test: opening a section that has NO pre-generated preview must
 * still render a lesson (or the cache-miss notice) instead of hanging on
 * "Preparing lesson..." forever.
 *
 * Repro path (B.8 subtopic hang, 2026-06-12):
 *   Guest mode -> Syllabus -> "B Background"
 *   -> "B.8 Appendix: Useful Mathematical Formulas"
 *   -> subtopic card "B.8-2 Complex Numbers" (one of the five B.8 subtopics
 *   with no SECTION_PREVIEWS_NEW entry, so getSectionPreview() returns null
 *   and openLearnMode takes the intro-fallback branch).
 *
 * Also guards the second B.8 regression (issue #6, fixed same day): subtopic
 * cards must render their OWN cached lesson, not the parent's generic
 * "compact formula reference" appendix page.
 *
 * Usage: node tools/test-lesson-open-no-hang.js
 * Exits 0 on pass, 1 on fail. Needs playwright (devDependency) + chromium.
 */
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { enterGuestMode, ensureSyllabusOpen } = require('./test-utils.js');

const PORT = Number(process.env.TUTOR_TEST_PORT || 9123);
const BASE = `http://127.0.0.1:${PORT}`;
const SUBTOPIC = process.env.TUTOR_TEST_SUBTOPIC || 'B.8-2 Complex Numbers';
// Phrase unique to the subtopic's own cached lesson — never present in the
// chapter-overview HTML, so it cannot produce a false pass.
const LESSON_MARKER = (process.env.TUTOR_TEST_MARKER || 'euler').toLowerCase();
// The parent appendix blurb. Seeing it on a SUBTOPIC means the B.8
// textbook-only override regex regressed to swallowing B.8-N again.
const FORBIDDEN_MARKER = 'compact formula reference';
const LESSON_WAIT_MS = 25000;

function waitForHealth(timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const tryOnce = () => {
            fetch(`${BASE}/health`).then(r => r.ok ? resolve() : retry()).catch(retry);
        };
        const retry = () => {
            if (Date.now() > deadline) return reject(new Error('bridge /health never came up'));
            setTimeout(tryOnce, 300);
        };
        tryOnce();
    });
}

(async () => {
    const repoRoot = path.resolve(__dirname, '..');
    const server = spawn('node', ['app/ws-bridge.js'], {
        cwd: repoRoot,
        env: { ...process.env, PORT: String(PORT) },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stdout.on('data', d => {
        const line = d.toString();
        if (/\[SECTION\]|\[LessonCache\]/.test(line)) process.stdout.write(`  [bridge] ${line}`);
    });

    let browser;
    let failure = null;
    const consoleLines = [];
    const sawLog = pattern => consoleLines.some(t => pattern.test(t));
    try {
        await waitForHealth();
        browser = await chromium.launch();
        const page = await browser.newPage({
            viewport: { width: 1440, height: 900 },
            reducedMotion: 'reduce'
        });
        page.on('console', m => {
            const t = m.text();
            consoleLines.push(t);
            if (/\[preview result\]|\[openLearnMode\]|\[openChapterOverviewMode\]|Failed to load/.test(t)) {
                console.log(`  [page] ${t}`);
            }
        });
        // Use the shared startup flow so this regression stays aligned with
        // the rest of the Playwright harness after Quick Setup was deleted.
        await enterGuestMode(page, BASE);

        // Full user click path: Syllabus -> B Background -> B.8 -> subtopic
        await ensureSyllabusOpen(page);
        await page.click('#courseSyllabus .syllabus-chapter:has-text("B Background")');
        await page.click('#courseSyllabus .syllabus-section[data-section="B.8 Appendix: Useful Mathematical Formulas"]');
        const card = page.locator(`.chapter-overview-subcard[data-sublesson-title="${SUBTOPIC}"]`);
        await card.waitFor({ state: 'visible', timeout: 15000 });

        // The card handler is ignored while a page-turn animation runs, so
        // retry until openLearnMode actually fires.
        let entered = false;
        for (let attempt = 0; attempt < 5 && !entered; attempt++) {
            await card.click();
            const t0 = Date.now();
            while (Date.now() - t0 < 2000) {
                if (sawLog(/\[openLearnMode\]/)) { entered = true; break; }
                await page.waitForTimeout(100);
            }
        }
        if (!entered) throw new Error('subtopic click never entered lesson mode (no [openLearnMode] log)');

        // The lesson pane must leave "Preparing lesson..." and show the
        // subtopic's own lesson.
        const content = page.locator('#learnExplainContent');
        let lastText = '';
        const deadline = Date.now() + LESSON_WAIT_MS;
        let rendered = false;
        while (Date.now() < deadline) {
            lastText = (await content.innerText().catch(() => '')) || '';
            if (lastText.toLowerCase().includes(LESSON_MARKER)) { rendered = true; break; }
            await page.waitForTimeout(500);
        }

        if (!rendered) {
            const stuck = lastText.includes('Preparing lesson...');
            failure = stuck
                ? `HANG REPRODUCED: lesson pane still shows "Preparing lesson..." after ${LESSON_WAIT_MS / 1000}s for "${SUBTOPIC}"`
                : lastText.toLowerCase().includes(FORBIDDEN_MARKER)
                    ? `APPENDIX REGRESSION: subtopic "${SUBTOPIC}" rendered the parent's generic appendix page instead of its own lesson`
                    : `lesson pane never rendered the subtopic lesson. Last content: ${JSON.stringify(lastText.slice(0, 200))}`;
        } else if (lastText.toLowerCase().includes(FORBIDDEN_MARKER)) {
            failure = `APPENDIX REGRESSION: subtopic "${SUBTOPIC}" lesson also contains the parent appendix blurb`;
        }
    } catch (err) {
        failure = `test error: ${err.message}`;
    } finally {
        if (browser) await browser.close().catch(() => {});
        server.kill('SIGKILL');
    }

    if (failure) {
        console.error(`FAIL: ${failure}`);
        process.exit(1);
    }
    console.log(`PASS: "${SUBTOPIC}" rendered lesson content without hanging`);
    process.exit(0);
})();
