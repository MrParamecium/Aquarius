#!/usr/bin/env node
/**
 * Regression test for the 07-05 session-restore feature (Stage B):
 * refreshing mid-lesson must land back IN that lesson, not on the
 * homepage/intro (prd AC1, design D2).
 *
 * Drives the guest path because Clerk OAuth cannot run headlessly — the
 * restore machinery (recordLastLocation -> reload -> rehydrateGuestSession /
 * session sync -> maybeBootRestoreLastLocation) is shared with signed-in
 * users; only the identity source differs.
 *
 * Asserts after an in-tab reload:
 *   1. the intro landing does NOT reappear (live guest session skips it),
 *   2. the same lesson is re-opened and renders its own content,
 *   3. localStorage kept { view: 'learn', sectionId } across the reload.
 * Plus a fresh-profile control: a brand-new browser context (no session at
 * all) still gets the intro landing.
 *
 * Usage: node tools/test-session-restore.js
 * Exits 0 on pass, 1 on fail. Needs playwright (devDependency) + chromium.
 */
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const PORT = Number(process.env.TUTOR_TEST_PORT || 9127);
const BASE = `http://127.0.0.1:${PORT}`;
const SUBTOPIC = 'B.8-2 Complex Numbers';
const LESSON_MARKER = 'euler'; // phrase unique to the subtopic's cached lesson
const LESSON_WAIT_MS = 25000;
const RESTORE_WAIT_MS = 30000; // reload restore also waits on Clerk's script settling

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

async function waitForLessonMarker(page, timeoutMs) {
    const content = page.locator('#learnExplainContent');
    const deadline = Date.now() + timeoutMs;
    let lastText = '';
    while (Date.now() < deadline) {
        lastText = (await content.innerText().catch(() => '')) || '';
        if (lastText.toLowerCase().includes(LESSON_MARKER)) return { ok: true, lastText };
        await page.waitForTimeout(500);
    }
    return { ok: false, lastText };
}

(async () => {
    const repoRoot = path.resolve(__dirname, '..');
    const server = spawn('node', ['app/ws-bridge.js'], {
        cwd: repoRoot,
        env: { ...process.env, PORT: String(PORT) },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let browser;
    let failure = null;
    try {
        await waitForHealth();
        browser = await chromium.launch();
        const page = await browser.newPage({
            viewport: { width: 1440, height: 900 },
            reducedMotion: 'reduce'
        });
        await page.goto(BASE, { waitUntil: 'domcontentloaded' });

        // Enter as guest, dismiss the quiz, open a lesson (same proven click
        // path as tools/test-lesson-open-no-hang.js).
        await page.click('#introGetStartedBtn');
        await page.click('#guestModeBtnLogin[data-bound-guest-mode="1"]', { timeout: 25000 });
        await page.click('#quizCloseBtn');
        await page.click('#navSyllabusBtn');
        await page.waitForSelector('#sidebarSyllabusPanel.is-open:not(.is-animating)');
        await page.click('#courseSyllabus .syllabus-chapter:has-text("B Background")');
        await page.click('#courseSyllabus .syllabus-section[data-section="B.8 Appendix: Useful Mathematical Formulas"]');
        const card = page.locator(`.chapter-overview-subcard[data-sublesson-title="${SUBTOPIC}"]`);
        await card.waitFor({ state: 'visible', timeout: 15000 });
        for (let attempt = 0; attempt < 5; attempt++) {
            await card.click();
            await page.waitForTimeout(400);
            const loc = await page.evaluate(() => localStorage.getItem('aquarius-last-location') || '');
            if (loc.includes('"learn"')) break;
        }
        const first = await waitForLessonMarker(page, LESSON_WAIT_MS);
        if (!first.ok) throw new Error(`could not open the lesson before the reload test (last content: ${JSON.stringify(first.lastText.slice(0, 120))})`);

        const savedLoc = await page.evaluate(() => localStorage.getItem('aquarius-last-location') || '');
        if (!savedLoc.includes('"view":"learn"') || !savedLoc.includes(SUBTOPIC)) {
            throw new Error(`last-location not recorded before reload: ${savedLoc}`);
        }

        // ── The actual AC1 check: reload mid-lesson ──
        await page.reload({ waitUntil: 'domcontentloaded' });

        const introVisible = await page.evaluate(() => {
            const intro = document.getElementById('introLanding');
            return Boolean(intro && !intro.classList.contains('hidden'));
        });
        if (introVisible) {
            failure = 'INTRO REGRESSION: intro landing reappeared on reload despite a live guest session';
        } else {
            const restored = await waitForLessonMarker(page, RESTORE_WAIT_MS);
            if (!restored.ok) {
                const welcomeVisible = await page.evaluate(() => {
                    const w = document.getElementById('welcomeScreen');
                    return Boolean(w && !w.classList.contains('hidden'));
                });
                failure = welcomeVisible
                    ? `RESTORE FAILED: reload landed on the welcome screen instead of "${SUBTOPIC}"`
                    : `RESTORE FAILED: lesson never re-rendered after reload (last content: ${JSON.stringify(restored.lastText.slice(0, 160))})`;
            }
        }

        // ── Control: a brand-new profile still sees the intro landing ──
        if (!failure) {
            const freshContext = await browser.newContext();
            const freshPage = await freshContext.newPage();
            await freshPage.goto(BASE, { waitUntil: 'domcontentloaded' });
            await freshPage.waitForTimeout(1000);
            const freshIntro = await freshPage.evaluate(() => {
                const intro = document.getElementById('introLanding');
                return Boolean(intro && !intro.classList.contains('hidden'));
            });
            if (!freshIntro) failure = 'CONTROL FAILED: fresh visitor (no session) no longer sees the intro landing';
            await freshContext.close();
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
    console.log(`PASS: reload restored "${SUBTOPIC}" and fresh visitors still get the intro`);
    process.exit(0);
})();
