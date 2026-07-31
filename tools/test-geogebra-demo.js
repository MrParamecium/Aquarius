'use strict';

const path = require('path');
const { chromium } = require('playwright');
const {
  spawnBridge,
  stopBridge,
  waitForHealth,
  injectMaskInitScript,
  enterGuestMode,
} = require('./test-utils.js');

const PORT = Number(process.env.TUTOR_GEOGEBRA_TEST_PORT || 9148);
const BASE = `http://127.0.0.1:${PORT}`;
const repoRoot = path.resolve(__dirname, '..');
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

const DEMO = {
  type: 'interactive_demo',
  title: 'Synthetic Figure 2.7',
  explanation: 'Fake API lifecycle test',
  spec: {
    framework: 'geogebra',
    scene: 'convolution_figure_2_7',
    guidance: 'soft',
    initial_step: 1,
    initial_t: -4,
    t_min: -4,
    t_max: 3,
    t_step: 0.05,
    target_t: -3,
    target_tolerance: 0.08,
    fallback_figure: '/figures/page-179-figure_2_7.png',
  },
};

async function installFakeGeoGebra(page) {
  await page.evaluate(() => {
    window.__fakeGeoGebra = {
      constructorCount: 0,
      injectCount: 0,
      removeCount: 0,
      resizeCount: 0,
      observerDisconnectCount: 0,
      unregisterCount: 0,
      codebases: [],
      visibilities: {},
      commands: [],
    };
    const metrics = window.__fakeGeoGebra;
    const NativeResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class FakeResizeObserver {
      constructor(callback) { this.callback = callback; }
      observe() { this.callback([]); }
      disconnect() { metrics.observerDisconnectCount += 1; }
      unobserve() {}
    };
    window.__fakeGeoGebra.restoreResizeObserver = () => { window.ResizeObserver = NativeResizeObserver; };

    function makeApi() {
      const values = { t: -4 };
      const listeners = new Set();
      return {
        evalCommand(command) {
          metrics.commands.push(command);
          const tMatch = command.match(/^t=(-?\d+(?:\.\d+)?)$/);
          if (tMatch) values.t = Number(tMatch[1]);
          return true;
        },
        setErrorDialogsActive() {},
        setSliderMin() {},
        setSliderMax() {},
        setSliderIncrement() {},
        setVisible(name, visible) { metrics.visibilities[name] = visible; },
        setColor() {},
        setLineThickness() {},
        setLabelVisible() {},
        setLineStyle() {},
        setFilling() {},
        setCaption() {},
        setCoordSystem() {},
        setAxesVisible() {},
        setGridVisible() {},
        setPointSize() {},
        setValue(name, value) {
          values[name] = Number(value);
          listeners.forEach((listenerName) => window[listenerName]?.());
        },
        getValue(name) {
          const t = values.t;
          if (name === 't') return t;
          if (name === 'overlapArea' || name === 'outputValue') {
            return t <= -3 ? 0 : 2 * (1 - Math.exp(-(t + 3)));
          }
          return values[name] || 0;
        },
        registerUpdateListener(listenerName) { listeners.add(listenerName); },
        unregisterUpdateListener(listenerName) {
          if (listeners.delete(listenerName)) metrics.unregisterCount += 1;
        },
        setSize() { metrics.resizeCount += 1; },
        remove() { metrics.removeCount += 1; },
      };
    }

    window.GGBApplet = function FakeGGBApplet(params) {
      metrics.constructorCount += 1;
      this.setHTML5Codebase = (url) => metrics.codebases.push(url);
      this.inject = (mountId) => {
        metrics.injectCount += 1;
        const mount = document.getElementById(mountId);
        const marker = document.createElement('canvas');
        marker.width = 12;
        marker.height = 12;
        mount?.appendChild(marker);
        queueMicrotask(() => params.appletOnLoad(makeApi()));
      };
    };
  });
}

async function hydrateDemo(page, demo = DEMO) {
  await page.evaluate((payload) => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const container = document.createElement('div');
    container.id = 'geogebra-test-container';
    container.style.cssText = 'position:absolute;left:-99999px;top:0;width:900px;';
    const node = document.createElement('div');
    node.className = 'kc-interactive-demo';
    node.dataset.demoB64 = b64;
    container.appendChild(node);
    document.body.appendChild(container);
    window.__geogebraTestContainer = container;
    window.__geogebraTestNode = node;
    hydrateInteractiveDemos(container);
  }, demo);
  await page.waitForFunction(() => {
    const stage = window.__geogebraTestNode?.querySelector('[data-geogebra-stage]');
    return stage?.dataset.state === 'ready' || stage?.dataset.state === 'failed';
  });
}

async function main() {
  const server = spawnBridge(repoRoot, PORT);
  let browser;
  try {
    await waitForHealth(BASE);
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await injectMaskInitScript(context);
    const page = await context.newPage();
    await enterGuestMode(page, BASE);
    await installFakeGeoGebra(page);

    const route = await page.evaluate((demo) => inferInteractiveDemoFamily(demo), DEMO);
    const plainConvolutionRoute = await page.evaluate(() => inferInteractiveDemoFamily({
      type: 'interactive_demo',
      title: 'Sliding overlap convolution',
      spec: { framework: 'canvas' },
    }));
    record('explicit GeoGebra route wins before convolution keywords', route === 'geogebra', `got ${route}`);
    record('ordinary convolution route is unchanged', plainConvolutionRoute === 'convolution_lab', `got ${plainConvolutionRoute}`);

    const sharedLoader = await page.evaluate(async () => {
      const runtime = window.__ftutorGeoGebraRuntime;
      const [a, b] = await Promise.all([runtime.load(), runtime.load()]);
      return a === b && document.querySelectorAll('#ftutor-geogebra-loader').length === 0;
    });
    record('existing runtime is reused without a loader tag', sharedLoader);

    await hydrateDemo(page);
    const initial = await page.evaluate(() => {
      const node = window.__geogebraTestNode;
      return {
        state: node.querySelector('[data-geogebra-stage]').dataset.state,
        active: node.querySelector('[data-geogebra-step].is-active')?.dataset.geogebraStep,
        rangeDisabled: node.querySelector('[data-geogebra-time]').disabled,
        codebase: window.__fakeGeoGebra.codebases[0],
        canvasCount: node.querySelectorAll('canvas').length,
      };
    });
    record('scene mounts at step 1 with the pinned codebase',
      initial.state === 'ready'
        && initial.active === '1'
        && initial.rangeDisabled
        && initial.canvasCount === 1
        && initial.codebase === 'https://www.geogebra.org/apps/5.4.920.0/web3d',
      JSON.stringify(initial));

    const textbookCommands = await page.evaluate(() => window.__fakeGeoGebra.commands.slice());
    const requiredCommands = [
      'gSignal(tau)=If(tau>=-2,2*exp(-(tau+2)),0)',
      'gFlipped(tau)=If(tau<=2,2*exp(tau-2),0)',
      'gMoving(tau)=If(tau<=t+2,2*exp(tau-t-2),0)',
      'overlapArea=If(t<=-3,0,2*(1-exp(-(t+3))))',
      'convolutionOutput(s)=If(s<=-3,0,2*(1-exp(-(s+3))))',
    ];
    record('scene commands use the textbook amplitude 2',
      requiredCommands.every((command) => textbookCommands.includes(command)),
      `${requiredCommands.filter((command) => !textbookCommands.includes(command)).length} command(s) missing`);

    const softGuidance = await page.evaluate(() => {
      const node = window.__geogebraTestNode;
      node.querySelector('[data-geogebra-step="3"]').click();
      const range = node.querySelector('[data-geogebra-time]');
      const canSlide = !range.disabled;
      range.value = '-3';
      range.dispatchEvent(new Event('input', { bubbles: true }));
      const contact = node.querySelector('[data-geogebra-feedback]').textContent;
      node.querySelector('[data-geogebra-nav="next"]').click();
      const reachedStep4 = node.querySelector('[data-geogebra-step="4"]').classList.contains('is-active');
      const output = node.querySelector('[data-geogebra-feedback]').textContent;
      return { canSlide, contact, reachedStep4, output };
    });
    record('soft guidance allows progress and reports first contact',
      softGuidance.canSlide
        && /First contact/.test(softGuidance.contact)
        && softGuidance.reachedStep4
        && /overlap area = 0/.test(softGuidance.output),
      JSON.stringify(softGuidance));

    const textbookValues = await page.evaluate(() => {
      const diagnostics = window.__geogebraTestNode.__geoGebraDiagnostics;
      const readAt = (t) => {
        diagnostics.setTime(t);
        return diagnostics.getState();
      };
      return { atMinus2: readAt(-2), atZero: readAt(0) };
    });
    const expectedMinus2 = 2 * (1 - Math.exp(-1));
    const expectedZero = 2 * (1 - Math.exp(-3));
    const close = (actual, expected) => Math.abs(actual - expected) <= 1e-9;
    record('t = -2 and t = 0 match the textbook convolution values',
      close(textbookValues.atMinus2.output, expectedMinus2)
        && close(textbookValues.atMinus2.area, expectedMinus2)
        && close(textbookValues.atZero.output, expectedZero)
        && close(textbookValues.atZero.area, expectedZero),
      JSON.stringify(textbookValues));

    const reset = await page.evaluate(() => {
      const node = window.__geogebraTestNode;
      node.querySelector('.geogebra-demo-reset').click();
      return {
        step: node.querySelector('[data-geogebra-step].is-active')?.dataset.geogebraStep,
        t: node.querySelector('[data-geogebra-time]').value,
        disabled: node.querySelector('[data-geogebra-time]').disabled,
      };
    });
    record('reset restores step 1 and t = -4', reset.step === '1' && reset.t === '-4' && reset.disabled, JSON.stringify(reset));

    const teardown = await page.evaluate(() => {
      const before = { ...window.__fakeGeoGebra };
      const disposedFirst = window.__ftutorTeardownInteractiveDemos(window.__geogebraTestContainer);
      const disposedSecond = window.__ftutorTeardownInteractiveDemos(window.__geogebraTestContainer);
      const after = window.__fakeGeoGebra;
      window.__geogebraTestContainer.remove();
      window.__fakeGeoGebra.restoreResizeObserver();
      return {
        disposedFirst,
        disposedSecond,
        removeDelta: after.removeCount - before.removeCount,
        disconnectDelta: after.observerDisconnectCount - before.observerDisconnectCount,
        unregisterDelta: after.unregisterCount - before.unregisterCount,
      };
    });
    record('teardown removes applet, observer, and listener exactly once',
      teardown.disposedFirst === 1
        && teardown.disposedSecond === 1
        && teardown.removeDelta === 1
        && teardown.disconnectDelta === 1
        && teardown.unregisterDelta === 1,
      JSON.stringify(teardown));

    const unknownDemo = JSON.parse(JSON.stringify(DEMO));
    unknownDemo.spec.scene = 'not_registered';
    await hydrateDemo(page, unknownDemo);
    const unknown = await page.evaluate(() => ({
      state: window.__geogebraTestNode.querySelector('[data-geogebra-stage]').dataset.state,
      fallbackVisible: !window.__geogebraTestNode.querySelector('[data-geogebra-fallback]').hidden,
      feedback: window.__geogebraTestNode.querySelector('[data-geogebra-feedback]').textContent,
    }));
    record('unknown scenes fail closed to the local fallback',
      unknown.state === 'failed' && unknown.fallbackVisible && /Unknown GeoGebra scene/.test(unknown.feedback),
      JSON.stringify(unknown));
    await page.evaluate(() => {
      window.__ftutorTeardownInteractiveDemos(window.__geogebraTestContainer);
      window.__geogebraTestContainer.remove();
    });

    await context.close();

    const loaderContext = await browser.newContext();
    const loaderPage = await loaderContext.newPage();
    let loaderRequests = 0;
    await loaderPage.route('https://www.geogebra.org/apps/deployggb.js', async (routeRequest) => {
      loaderRequests += 1;
      if (loaderRequests === 1) {
        await routeRequest.abort('failed');
        return;
      }
      await routeRequest.fulfill({
        contentType: 'application/javascript',
        body: 'window.GGBApplet = function FakeLoaderApplet() {};',
      });
    });
    await loaderPage.goto(BASE, { waitUntil: 'domcontentloaded' });
    const retry = await loaderPage.evaluate(async () => {
      const runtime = window.__ftutorGeoGebraRuntime;
      let firstFailed = false;
      try { await runtime.load(); } catch (_) { firstFailed = true; }
      const loaded = await runtime.load({ retry: true });
      return {
        firstFailed,
        loaded: typeof loaded === 'function',
        scripts: document.querySelectorAll('#ftutor-geogebra-loader').length,
      };
    });
    record('loader failure clears state and a retry succeeds',
      retry.firstFailed && retry.loaded && retry.scripts === 1 && loaderRequests === 2,
      `${JSON.stringify(retry)}, requests=${loaderRequests}`);
    await loaderContext.close();
  } catch (error) {
    console.error(error && error.stack || error);
    record('test harness completed', false, error.message);
  } finally {
    if (browser) await browser.close();
    await stopBridge(server, { label: 'geogebra-test' });
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n[geogebra-demo] ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main();
