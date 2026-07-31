#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const modulePath = path.join(ROOT, 'app', 'guidance-mode.js');
const stylePath = path.join(ROOT, 'app', 'style.css');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
        const fixtureHtml = `<!doctype html><html><body>
          <div><button id="mainA" data-guidance-toggle data-guidance-scope="main"></button></div>
          <div><button id="mainB" data-guidance-toggle data-guidance-scope="main"></button></div>
          <div id="learnView">
            <div id="learnBody" class="learn-body explain-collapsed">
              <div id="learnChatCol">
                <div id="learnFollowupBar" class="learn-followup-bar edu-tutor-composer glass-panel">
                  <div class="input-wrapper">
                    <button class="btn-clip" type="button" aria-label="Attach"></button>
                    <textarea class="input-field" id="learnFollowupInput" placeholder="Ask a question about this page..."></textarea>
                    <button class="btn-send" type="button" aria-label="Send"></button>
                  </div>
                  <div class="bottom-actions">
                    <button class="action-chip edu-mode-toggle" id="learnModeToggleBtn" type="button">
                      <span class="edu-mode-icon"></span><span id="learnModeCurrentText">Balanced</span>
                    </button>
                    <button id="guidanceToggleBtnLearn" class="action-chip guidance-toggle" type="button" data-guidance-toggle data-guidance-scope="learn"></button>
                    <button id="webSearchToggleBtnLearn" class="action-chip network-on" type="button"></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div id="mount"></div>
        </body></html>`;
        await page.route('http://guidance.test/**', route => route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: fixtureHtml
        }));
        await page.goto('http://guidance.test/');
        await page.addStyleTag({ path: stylePath });
        await page.evaluate(() => {
            window.guidanceCalls = 0;
            window.guidanceResponse = {
                ok: true,
                status: 200,
                body: {
                    request_id: 'request-ui-1',
                    status: 'hit',
                    retrieval_source: 'local_ocr',
                    options: [
                        { id: 'path_1', title: 'Start with intuition', description: 'Build orientation with diagrams.', instruction: 'Start with an intuition, then connect it to the formula.' },
                        { id: 'path_2', title: 'Derive step by step', description: 'Move from the definition line by line.', instruction: 'Start from the definition and explain each reason.' }
                    ]
                }
            };
            window.apiFetch = async () => {
                window.guidanceCalls += 1;
                const response = window.guidanceResponse;
                return {
                    ok: response.ok,
                    status: response.status,
                    json: async () => response.body
                };
            };
        });
        await page.addScriptTag({ path: modulePath });
        await page.evaluate(() => window.guidanceMode.init());

        const initial = await page.evaluate(() => window.guidanceMode.getSnapshot());
        assert.equal(initial.enabled, false, 'guidance must default to off');
        const disabled = await page.evaluate(() => window.guidanceMode.requestChoice({
            scope: 'main',
            mount: document.getElementById('mount'),
            payload: { prompt: 'test' }
        }));
        assert.equal(disabled.status, 'disabled');
        assert.equal(await page.evaluate(() => window.guidanceCalls), 0, 'disabled mode must not call the API');

        await page.click('#mainA');
        assert.deepEqual(await page.$$eval('[data-guidance-toggle]', buttons => buttons.map(button => button.getAttribute('aria-pressed'))), ['true', 'true', 'true']);
        assert.equal(await page.evaluate(() => localStorage.getItem('aquarius-guidance-enabled-v1')), '1');

        await page.evaluate(() => {
            window.choiceResult = null;
            window.guidanceMode.requestChoice({
                scope: 'main',
                mount: document.getElementById('mount'),
                payload: { prompt: 'Why does convolution require a flip?', language: 'en' }
            }).then(result => { window.choiceResult = result; });
        });
        await page.waitForSelector('.guidance-option');
        assert.equal(await page.locator('.guidance-option').count(), 2);
        await page.locator('.guidance-option').first().click();
        await page.waitForFunction(() => window.choiceResult !== null);
        const selected = await page.evaluate(() => window.choiceResult);
        assert.equal(selected.status, 'selected');
        assert.equal(selected.guidance.id, 'path_1');
        assert.equal(await page.locator('.guidance-path-chip').count(), 2, 'main selection must mirror across both main controls');

        const reused = await page.evaluate(() => window.guidanceMode.requestChoice({
            scope: 'main',
            mount: document.getElementById('mount'),
            payload: { prompt: 'Continue explaining', language: 'en' }
        }));
        assert.equal(reused.reused, true);
        assert.equal(await page.evaluate(() => window.guidanceCalls), 1, 'follow-up must reuse the selected path');

        await page.locator('.guidance-path-chip-clear').first().click();
        assert.equal((await page.evaluate(() => window.guidanceMode.getSnapshot())).mainSelection, null);

        await page.evaluate(() => {
            window.guidanceResponse = {
                ok: true,
                status: 200,
                body: {
                    request_id: 'request-ui-learn',
                    status: 'hit',
                    retrieval_source: 'local_ocr',
                    options: [
                        { id: 'path_1', title: 'Use a timeline', description: 'Build an intuitive picture.', instruction: 'Start by drawing a timeline.' },
                        { id: 'path_2', title: 'Apply the definition', description: 'Check the relationship step by step.', instruction: 'Start from the definition.' }
                    ]
                }
            };
            window.learnChoiceResult = null;
            window.guidanceMode.requestChoice({
                scope: 'learn',
                mount: document.getElementById('mount'),
                payload: { prompt: 'Why is x(t-2) a right shift?', language: 'en' }
            }).then(result => { window.learnChoiceResult = result; });
        });
        await page.waitForSelector('.guidance-option');
        await page.locator('.guidance-option').first().click();
        await page.waitForFunction(() => window.learnChoiceResult !== null);
        const mobileComposer = await page.evaluate(() => {
            const box = selector => document.querySelector(selector)?.getBoundingClientRect();
            const composer = box('#learnFollowupBar');
            const inputRow = box('#learnFollowupBar .input-wrapper');
            const input = box('#learnFollowupInput');
            const tools = box('#learnFollowupBar .bottom-actions');
            const chip = box('#learnFollowupBar .guidance-path-chip');
            const web = document.getElementById('webSearchToggleBtnLearn');
            const toolsElement = document.querySelector('#learnFollowupBar .bottom-actions');
            const composerElement = document.getElementById('learnFollowupBar');
            const inputRowElement = document.querySelector('#learnFollowupBar .input-wrapper');
            return {
                composerHeight: composer?.height || 0,
                composerDisplay: composerElement ? getComputedStyle(composerElement).display : '',
                inputWidth: input?.width || 0,
                inputRowTop: inputRow?.top || 0,
                inputBottom: inputRow?.bottom || 0,
                toolsTop: tools?.top || 0,
                toolsBottom: tools?.bottom || 0,
                chipTop: chip?.top || 0,
                chipBottom: chip?.bottom || 0,
                webPseudoContent: web ? getComputedStyle(web, '::after').content : '',
                toolsDisplay: toolsElement ? getComputedStyle(toolsElement).display : '',
                toolsPosition: toolsElement ? getComputedStyle(toolsElement).position : '',
                toolsTransform: toolsElement ? getComputedStyle(toolsElement).transform : '',
                toolsMarginTop: toolsElement ? getComputedStyle(toolsElement).marginTop : '',
                toolsColumns: toolsElement ? getComputedStyle(toolsElement).gridTemplateColumns : '',
                toolsRows: toolsElement ? getComputedStyle(toolsElement).gridTemplateRows : '',
                inputRowPosition: inputRowElement ? getComputedStyle(inputRowElement).position : '',
                inputRowTransform: inputRowElement ? getComputedStyle(inputRowElement).transform : '',
                toolItems: toolsElement ? Array.from(toolsElement.children).map(element => {
                    const rect = element.getBoundingClientRect();
                    const style = getComputedStyle(element);
                    return {
                        id: element.id || element.className,
                        display: style.display,
                        gridColumn: style.gridColumn,
                        top: rect.top,
                        bottom: rect.bottom,
                        width: rect.width
                    };
                }) : [],
                horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth
            };
        });
        assert.ok(mobileComposer.inputWidth >= 180, `lesson input must remain usable on mobile: ${JSON.stringify(mobileComposer)}`);
        assert.ok(mobileComposer.toolsTop >= mobileComposer.inputBottom - 1, `lesson tools must stay on the second row: ${JSON.stringify(mobileComposer)}`);
        assert.ok(mobileComposer.chipTop >= mobileComposer.toolsTop - 1 && mobileComposer.chipBottom <= mobileComposer.toolsBottom + 1,
            `selected teaching path must stay inside the tools row: ${JSON.stringify(mobileComposer)}`);
        assert.ok(mobileComposer.composerHeight <= 170, `selected teaching path must not make the lesson composer jump: ${JSON.stringify(mobileComposer)}`);
        assert.ok(['none', 'normal', '""'].includes(mobileComposer.webPseudoContent), `mobile lesson web control must be icon-only: ${JSON.stringify(mobileComposer)}`);
        assert.ok(mobileComposer.horizontalOverflow <= 1, `lesson composer must not overflow horizontally: ${JSON.stringify(mobileComposer)}`);

        await page.evaluate(() => {
            window.guidanceResponse = {
                ok: false,
                status: 502,
                body: { error: 'Textbook retrieval failed', stage: 'retrieval', request_id: 'request-error-7' }
            };
            window.choiceResult = null;
            window.guidanceMode.requestChoice({
                scope: 'main',
                mount: document.getElementById('mount'),
                payload: { prompt: 'Error test', language: 'en' }
            }).then(result => { window.choiceResult = result; });
        });
        await page.waitForSelector('.guidance-error');
        const errorText = await page.locator('.guidance-error').innerText();
        assert.ok(errorText.includes('retrieval'));
        assert.ok(errorText.includes('request-error-7'));
        await page.getByRole('button', { name: 'Skip and answer now' }).click();
        await page.waitForFunction(() => window.choiceResult !== null);
        assert.equal((await page.evaluate(() => window.choiceResult)).status, 'skipped');

        await page.click('#guidanceToggleBtnLearn');
        const finalState = await page.evaluate(() => window.guidanceMode.getSnapshot());
        assert.equal(finalState.enabled, false);
        assert.equal(finalState.mainSelection, null);
        assert.equal(finalState.learnSelection, null);

        const appSource = fs.readFileSync(path.join(ROOT, 'app', 'app.js'), 'utf8');
        assert.ok(appSource.includes("guidance: selectedGuidance || undefined"), 'formal ask payload must carry the selected guidance');
        assert.ok(appSource.includes("resetScope('learn')"), 'lesson changes must clear the lesson guidance selection');
        assert.ok(appSource.includes("resetScope('main')"), 'new/restored main sessions must clear the main guidance selection');

        console.log('[guidance-ui] PASS');
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(`[guidance-ui] FAIL: ${error.stack || error.message}`);
    process.exit(1);
});
