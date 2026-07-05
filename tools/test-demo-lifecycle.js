'use strict';
// Behavioral regression tests for the four structural demo-driver fixes in PR-A
// (SP-5, PH-4, SP-1, PH-6). Deterministic Playwright — injects SYNTHETIC demos
// into a fully-loaded app page, hydrates them through the real dispatcher, and
// asserts behaviour (not pixels). No cached-lesson dependency.
//
// Discriminating by design (see docs/phase3_deferred §1c / the pre-execution
// adversarial review): SP-1 spies on requestAnimationFrame/cancelAnimationFrame
// and asserts the loop is actually CANCELLED (not merely "drawing stopped" — the
// pre-existing `!node.isConnected` self-heal would mask a broken cancel, so the
// node is kept connected during teardown). PH-6 counts window 'resize' listeners.
//
// Run: node tools/test-demo-lifecycle.js   (needs playwright chromium + a bridge)

const path = require('path');
const { chromium } = require('playwright');
const {
    spawnBridge, stopBridge, waitForHealth, injectMaskInitScript,
    enterGuestMode,
} = require('./test-utils.js');

const PORT = Number(process.env.TUTOR_DEMO_LIFECYCLE_PORT || 9139);
const BASE = `http://127.0.0.1:${PORT}`;
const repoRoot = path.resolve(__dirname, '..');

// Synthetic demos. IDs/labels are ASCII so btoa() round-trips.
const SINUSOID_DEMO = {
    type: 'interactive_demo',
    demo_type: 'sinusoid_phasor_projection',       // -> isSinusoidDemo branch
    title: 'Synthetic sinusoid',
    controls: [                                    // top-level -> dispatcher demoControls
        { id: 'amplitude', label: 'Amp', min: 1, max: 5, step: 0.5, default: 3.5 },
        { id: 'frequency', label: 'Freq', min: 0.5, max: 2.5, step: 0.1, default: 1.8 },
        { id: 'phase', label: 'Phase', min: -3.14, max: 3.14, step: 0.02, default: 0.7 },
    ],
};
// Routes to renderPhasorDemo (react_canvas + phasor_panel), NOT complex-plane:
// control ids are NOT slider_a/slider_b, so isComplexPlaneDemo is false. Controls
// live at top-level demo.controls with demo_spec.controls absent, so ONLY the
// PH-4 fix (prefer resolved demoControls) populates the panel.
const PHASOR_DEMO = {
    type: 'interactive_demo',
    title: 'Synthetic phasor sum',
    controls: [
        { id: 'mag', label: 'Magnitude', min: 0, max: 5, step: 0.1, default: 2.5 },
        { id: 'ang', label: 'Angle', min: -180, max: 180, step: 1, default: 45 },
    ],
    demo_spec: { framework: 'react_canvas', panels: [{ id: 'phasor_panel' }] },
};

const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

async function main() {
    const server = spawnBridge(repoRoot, PORT);
    try {
        await waitForHealth(BASE);
        const browser = await chromium.launch();
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        await injectMaskInitScript(context);
        const page = await context.newPage();
        await enterGuestMode(page, BASE);

        // Expose the synthetic demos to the page.
        await page.evaluate(({ sin, pha }) => {
            window.__demoTest = {
                sin, pha,
                b64: (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))),
                hydrateSynthetic(demo) {
                    const c = document.createElement('div');
                    c.className = '__demo-test-container';
                    // Keep it off-viewport but IN the document so nodes stay connected.
                    c.style.cssText = 'position:absolute;left:-99999px;top:0;width:900px;height:600px;';
                    document.body.appendChild(c);
                    const n = document.createElement('div');
                    n.className = 'kc-interactive-demo';
                    n.setAttribute('data-demo-b64', this.b64(demo));
                    c.appendChild(n);
                    hydrateInteractiveDemos(c);
                    return { container: c, node: n };
                },
            };
        }, { sin: SINUSOID_DEMO, pha: PHASOR_DEMO });

        // ---- SP-5: sinusoid honours authored controls ----
        const sp5 = await page.evaluate(() => {
            const { container, node } = window.__demoTest.hydrateSynthetic(window.__demoTest.sin);
            const amp = node.querySelector('[data-demo-control="amplitude"]');
            const freq = node.querySelector('[data-demo-control="frequency"]');
            const out = amp ? { value: amp.value, min: amp.min, max: amp.max, step: amp.step, freqVal: freq && freq.value } : null;
            window.__ftutorTeardownInteractiveDemos?.(container); container.remove();
            return out;
        });
        record('SP-5 sinusoid uses authored controls',
            !!sp5 && sp5.value === '3.5' && sp5.min === '1' && sp5.max === '5' && sp5.freqVal === '1.8',
            sp5 ? `amp value=${sp5.value} min=${sp5.min} max=${sp5.max}, freq=${sp5.freqVal} (want 3.5/1/5, 1.8)` : 'no amplitude slider rendered');

        // ---- PH-4: phasor renders authored control panel (not empty) ----
        const ph4 = await page.evaluate(() => {
            const { container, node } = window.__demoTest.hydrateSynthetic(window.__demoTest.pha);
            const shell = node.querySelector('.phasor-demo-shell');
            const controlsWrap = node.querySelector('.phasor-demo-controls');
            const controlCount = controlsWrap ? controlsWrap.querySelectorAll('.phasor-demo-control').length : 0;
            const out = { hasShell: !!shell, controlCount };
            window.__ftutorTeardownInteractiveDemos?.(container); container.remove();
            return out;
        });
        record('PH-4 phasor renders authored controls (routed to renderPhasorDemo)',
            ph4.hasShell && ph4.controlCount >= 2,
            `phasor-demo-shell=${ph4.hasShell}, control panels=${ph4.controlCount} (want shell + >=2)`);

        // ---- SP-1: sinusoid tick loop is cancelled by teardown (node kept connected) ----
        // Count the DEMO's OWN draws (clearRect on its wave canvas) rather than global
        // rAF requests — the app runs its own continuous rAF loop that would otherwise
        // drown out the demo loop. The node is kept CONNECTED during teardown, so a drop
        // in draws can only be the explicit cancelAnimationFrame in the cleanup, not the
        // `!node.isConnected` self-heal (the pre-execution review's exact concern). This
        // also catches a stale-id cancel: if the cleanup cancelled the wrong frame the
        // loop keeps drawing.
        const sp1 = await page.evaluate(async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const W = 300;
            const { container, node } = window.__demoTest.hydrateSynthetic(window.__demoTest.sin);
            const cleanupCount = node.__demoCleanups ? node.__demoCleanups.length : -1;
            const waveCanvas = node.querySelector('.sinusoid-demo-wave');
            const ctx = waveCanvas && waveCanvas.getContext ? waveCanvas.getContext('2d') : null;
            if (!ctx) { container.remove(); return { cleanupCount, noCtx: true }; }
            let draws = 0;
            const origClear = ctx.clearRect.bind(ctx);
            ctx.clearRect = (...a) => { draws++; return origClear(...a); };

            let d0 = draws;
            await sleep(W);
            const running = draws - d0;                                     // demo draws while running / W

            const cancelSpy = [];
            const _caf = window.cancelAnimationFrame.bind(window);
            window.cancelAnimationFrame = (id) => { cancelSpy.push(id); return _caf(id); };
            d0 = draws;
            const disposed = window.__ftutorTeardownInteractiveDemos?.(container);  // node stays connected
            const cancelDelta = cancelSpy.length;
            const stillConnected = node.isConnected;
            window.cancelAnimationFrame = _caf;
            await sleep(W);
            const afterTeardown = draws - d0;                              // demo draws after teardown / W

            container.remove();
            return { cleanupCount, running, afterTeardown, disposed, cancelDelta, stillConnected };
        });
        record('SP-1 tick loop cancelled by teardown (node connected, not self-heal)',
            !!sp1 && !sp1.noCtx && sp1.stillConnected && sp1.cleanupCount >= 1
                && sp1.cancelDelta >= 1 && sp1.running > 3 && sp1.afterTeardown <= 1,
            !sp1 || sp1.noCtx ? 'wave canvas 2d context unavailable'
                : `cleanups=${sp1.cleanupCount} cancelCalled=${sp1.cancelDelta} demoDraws running=${sp1.running} afterTeardown=${sp1.afterTeardown} (want ~0), nodeConnected=${sp1.stillConnected}`);

        // ---- PH-6: phasor window 'resize' listener removed on teardown ----
        const ph6 = await page.evaluate(async () => {
            let resizeCount = 0;
            const _add = window.addEventListener.bind(window);
            const _rem = window.removeEventListener.bind(window);
            window.addEventListener = (type, fn, opts) => { if (type === 'resize') resizeCount++; return _add(type, fn, opts); };
            window.removeEventListener = (type, fn, opts) => { if (type === 'resize') resizeCount--; return _rem(type, fn, opts); };

            const base = resizeCount;
            const { container, node } = window.__demoTest.hydrateSynthetic(window.__demoTest.pha);
            const afterHydrate = resizeCount;
            const disposed = window.__ftutorTeardownInteractiveDemos?.(container);
            const afterTeardown = resizeCount;

            container.remove();
            window.addEventListener = _add; window.removeEventListener = _rem;
            return { base, afterHydrate, afterTeardown, disposed };
        });
        record('PH-6 phasor resize listener removed on teardown',
            ph6.afterHydrate === ph6.base + 1 && ph6.afterTeardown === ph6.base && ph6.disposed >= 1,
            `resize listeners base=${ph6.base} afterHydrate=${ph6.afterHydrate} afterTeardown=${ph6.afterTeardown} (want +1 then back to base)`);

        // ---- SP-2: reset-while-paused resumes animation (not frozen at t=0) ----
        // The demo autoplays; pausing freezes the wave (identical frames), and Reset
        // must resume it. Observed via the wave canvas pixels: frozen while paused
        // (identical), CHANGING after Reset (animating), and the Play/Pause label
        // consistent. Discriminates the fix: pre-fix, Reset left running=false so the
        // wave stayed frozen and the label stayed 'Play'.
        const sp2 = await page.evaluate(async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const { container, node } = window.__demoTest.hydrateSynthetic(window.__demoTest.sin);
            const wave = node.querySelector('.sinusoid-demo-wave');
            const playBtn = node.querySelector('.sinusoid-demo-play');
            const resetBtn = node.querySelector('.sinusoid-demo-reset');
            if (!wave || !wave.toDataURL || !playBtn || !resetBtn) { container.remove(); return { missing: true }; }
            await sleep(80);
            playBtn.click();                                    // Pause
            const pausedLabel = playBtn.textContent;
            const pa = wave.toDataURL(); await sleep(140); const pb = wave.toDataURL();
            const frozenWhilePaused = pa === pb;                // sanity: paused == frozen
            resetBtn.click();                                   // Reset while paused
            const afterResetLabel = playBtn.textContent;
            const ra = wave.toDataURL(); await sleep(140); const rb = wave.toDataURL();
            const animatingAfterReset = ra !== rb;
            window.__ftutorTeardownInteractiveDemos?.(container); container.remove();
            return { frozenWhilePaused, animatingAfterReset, pausedLabel, afterResetLabel };
        });
        // The reliable discriminator is the Play/Pause LABEL: the fix couples
        // running=true with label='Pause' in reset; pre-fix, reset left running=false
        // so after a Pause the label stayed 'Play'. animatingAfterReset (wave pixels
        // change post-reset) is a supporting signal. frozenWhilePaused is reported for
        // context only — it is NOT asserted (canvas-size-settling / sub-pixel variance
        // makes "paused == pixel-identical" too strict to be reliable).
        record('SP-2 reset resumes animation when paused',
            !sp2.missing && sp2.afterResetLabel === 'Pause' && sp2.animatingAfterReset,
            sp2.missing ? 'sinusoid canvas/controls not rendered'
                : `pausedLabel=${sp2.pausedLabel}; afterReset label=${sp2.afterResetLabel} (want Pause) animating=${sp2.animatingAfterReset}; frozenWhilePaused=${sp2.frozenWhilePaused} (info only)`);

        // ---- SP-3: updateControlLabels is null-safe when a readout span is absent ----
        // Simulate a template variant missing a data-demo-value span, then trigger
        // updateControlLabels (via a control input). Pre-fix this threw
        // "Cannot set properties of null"; the guarded fix skips the missing span.
        const sp3errors = [];
        const onPageError = (e) => sp3errors.push(e.message || String(e));
        page.on('pageerror', onPageError);
        await page.evaluate(() => {
            const { node } = window.__demoTest.hydrateSynthetic(window.__demoTest.sin);
            window.__sp3 = node;
            node.querySelector('[data-demo-value="amplitude"]')?.remove();  // omit a readout span
            const input = node.querySelector('[data-demo-control="amplitude"]');
            if (input) { input.value = '2.2'; input.dispatchEvent(new Event('input')); }  // -> updateControlLabels
        });
        await page.waitForTimeout(60);   // let any pageerror propagate
        page.off('pageerror', onPageError);
        await page.evaluate(() => {
            const c = window.__sp3 && window.__sp3.closest('.__demo-test-container');
            if (c) { window.__ftutorTeardownInteractiveDemos?.(c); c.remove(); }
        });
        const sp3nullErrors = sp3errors.filter((m) => /null|undefined/i.test(m));
        record('SP-3 updateControlLabels null-safe on missing span',
            sp3nullErrors.length === 0,
            sp3nullErrors.length ? `threw: ${sp3nullErrors[0]}` : 'no null-deref when a data-demo-value span is absent');

        await browser.close();
    } catch (err) {
        console.error('[demo-lifecycle] FATAL', err);
        record('harness ran without fatal error', false, err.message);
    } finally {
        await stopBridge(server, { label: 'demo-lifecycle' });
    }

    const failed = results.filter((r) => !r.ok);
    console.log(`\n[demo-lifecycle] ${results.length - failed.length}/${results.length} passed`);
    process.exit(failed.length ? 1 : 0);
}

main();
