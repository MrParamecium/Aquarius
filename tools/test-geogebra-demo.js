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
  title: 'Textbook Figure 2.7',
  explanation: 'Controlled lesson task',
  spec: {
    framework: 'geogebra',
    scene: 'convolution_figure_2_7',
    preset: 'figure-2-7',
    task: 'slide',
    scaffolding: 'guided',
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
      constructorSizes: [],
      resizeSizes: [],
      observerDisconnectCount: 0,
      unregisterCount: 0,
      codebases: [],
      perspectives: [],
      axesVisible: [],
      coordSystems: [],
      lineStyles: {},
      visibilities: {},
      commands: [],
    };
    const metrics = window.__fakeGeoGebra;
    const NativeResizeObserver = window.ResizeObserver;
    window.__fakeResizeObservers = [];
    window.ResizeObserver = class FakeResizeObserver {
      constructor(callback) {
        this.callback = callback;
        window.__fakeResizeObservers.push(this);
      }
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
        setLineStyle(name, style) { metrics.lineStyles[name] = style; },
        setFilling() {},
        setCaption() {},
        setCoordSystem(...coordinates) { metrics.coordSystems.push(coordinates); },
        setAxesVisible(view, horizontal, vertical) { metrics.axesVisible.push([view, horizontal, vertical]); },
        setGridVisible() {},
        setPointSize() {},
        setValue(name, value) {
          values[name] = Number(value);
          listeners.forEach((listenerName) => window[listenerName]?.());
        },
        getValue(name) { return values[name] || 0; },
        registerUpdateListener(listenerName) { listeners.add(listenerName); },
        unregisterUpdateListener(listenerName) {
          if (listeners.delete(listenerName)) metrics.unregisterCount += 1;
        },
        setSize(width, height) {
          metrics.resizeCount += 1;
          metrics.resizeSizes.push({ width, height });
        },
        remove() { metrics.removeCount += 1; },
      };
    }

    window.GGBApplet = function FakeGGBApplet(params) {
      metrics.constructorCount += 1;
      metrics.constructorSizes.push({ width: params.width, height: params.height });
      metrics.perspectives.push(params.perspective);
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
    const old = document.getElementById('geogebra-test-container');
    if (old) {
      window.__ftutorTeardownInteractiveDemos?.(old);
      old.remove();
    }
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

    const presetChecks = await page.evaluate(() => {
      const api = window.__ftutorConvolutionPresets;
      if (!api) return { ready: false };
      const ids = api.list().map(preset => preset.id);
      const read = (id, t) => api.getConvolutionPreset(id)?.evaluate(t);
      const describe = (id) => {
        const preset = api.getConvolutionPreset(id);
        return {
          support: preset?.support,
          breakpoints: preset?.breakpoints,
          defaultOrder: preset?.defaultOrder,
          supportedOrders: preset?.supportedOrders,
          commands: preset?.commands,
        };
      };
      return {
        ready: true,
        ids,
        figure: { minus2: read('figure-2-7', -2), zero: read('figure-2-7', 0), shape: describe('figure-2-7') },
        example210: { minus1: read('example-2-10', -1), one: read('example-2-10', 1), shape: describe('example-2-10') },
        example211: { minus1: read('example-2-11', -1), one: read('example-2-11', 1), shape: describe('example-2-11') },
        example212: {
          minus1: read('example-2-12', -1),
          zero: read('example-2-12', 0),
          one: read('example-2-12', 1),
          two: read('example-2-12', 2),
          three: read('example-2-12', 3),
          four: read('example-2-12', 4),
          shape: describe('example-2-12'),
        },
        figure211: { one: read('figure-2-11', 1), shape: describe('figure-2-11') },
        figure212: { minusOne: read('figure-2-12', -1), one: read('figure-2-12', 1), shape: describe('figure-2-12') },
        figure213: { two: api.getConvolutionPreset('figure-2-13')?.evaluate(2, { T: 3 }), shape: describe('figure-2-13') },
        practice: { onePointFive: read('practice-rectangle-triangle', 1.5), shape: describe('practice-rectangle-triangle') },
      };
    });
    const close = (actual, expected) => Math.abs(Number(actual) - expected) <= 1e-9;
    const expectedPresetIds = [
      'figure-2-7', 'example-2-10', 'example-2-11', 'example-2-12',
      'figure-2-11', 'figure-2-12', 'figure-2-13', 'practice-rectangle-triangle',
    ];
    const hasRoles = (shape) => shape?.commands
      && shape.supportedOrders?.every(order => ['fixed', 'flipped', 'moving', 'product'].every(key => typeof shape.commands.orders?.[order]?.[key] === 'string'));
    record('preset registry exposes the eight approved textbook cases',
      presetChecks.ready
        && JSON.stringify(presetChecks.ids) === JSON.stringify(expectedPresetIds)
        && JSON.stringify(presetChecks.figure.shape.support) === JSON.stringify([-3, 'inf'])
        && JSON.stringify(presetChecks.figure.shape.breakpoints) === JSON.stringify([-3])
        && JSON.stringify(presetChecks.example210.shape.support) === JSON.stringify([0, 'inf'])
        && JSON.stringify(presetChecks.example210.shape.breakpoints) === JSON.stringify([0])
        && JSON.stringify(presetChecks.example211.shape.support) === JSON.stringify(['-inf', 'inf'])
        && JSON.stringify(presetChecks.example211.shape.breakpoints) === JSON.stringify([0])
        && JSON.stringify(presetChecks.example212.shape.support) === JSON.stringify([-1, 4])
        && JSON.stringify(presetChecks.example212.shape.breakpoints) === JSON.stringify([-1, 1, 2, 4]),
      JSON.stringify(presetChecks));
    record('preset roles and trusted command groups cover every supported order',
      hasRoles(presetChecks.figure.shape)
        && hasRoles(presetChecks.example210.shape)
        && hasRoles(presetChecks.example211.shape)
        && hasRoles(presetChecks.example212.shape)
        && hasRoles(presetChecks.figure211.shape)
        && hasRoles(presetChecks.figure212.shape)
        && hasRoles(presetChecks.figure213.shape)
        && hasRoles(presetChecks.practice.shape)
        && presetChecks.example212.shape.defaultOrder === 'g-fixed'
        && JSON.stringify(presetChecks.example212.shape.supportedOrders) === JSON.stringify(['g-fixed'])
        && presetChecks.practice.shape.defaultOrder === 'g-fixed'
        && JSON.stringify(presetChecks.figure211.shape.supportedOrders) === JSON.stringify(['x-fixed', 'g-fixed']),
      JSON.stringify({
        example212: presetChecks.example212.shape,
        practice: presetChecks.practice.shape,
        figure211: presetChecks.figure211.shape,
      }));
    record('all eight textbook output evaluators match representative values',
      close(presetChecks.figure?.minus2, 2 * (1 - Math.exp(-1)))
        && close(presetChecks.figure?.zero, 2 * (1 - Math.exp(-3)))
        && close(presetChecks.example210?.minus1, 0)
        && close(presetChecks.example210?.one, Math.exp(-1) - Math.exp(-2))
        && close(presetChecks.example211?.minus1, -Math.exp(-2))
        && close(presetChecks.example211?.one, 1 - 2 * Math.exp(-1))
        && close(presetChecks.example212?.minus1, 0)
        && close(presetChecks.example212?.zero, 1 / 6)
        && close(presetChecks.example212?.one, 2 / 3)
        && close(presetChecks.example212?.two, 4 / 3)
        && close(presetChecks.example212?.three, 5 / 6)
        && close(presetChecks.example212?.four, 0)
        && close(presetChecks.figure211?.one, 1 - Math.exp(-1))
        && close(presetChecks.figure212?.minusOne, 1)
        && close(presetChecks.figure212?.one, Math.exp(-1))
        && close(presetChecks.figure213?.two, 2)
        && close(presetChecks.practice?.onePointFive, 0.5),
      JSON.stringify(presetChecks));

    const sharedLoader = await page.evaluate(async () => {
      const runtime = window.__ftutorGeoGebraRuntime;
      const [a, b] = await Promise.all([runtime.load(), runtime.load()]);
      return a === b && document.querySelectorAll('#ftutor-geogebra-loader').length === 0;
    });
    record('existing runtime is reused without a loader tag', sharedLoader);

    const geometryChecks = await page.evaluate(() => {
      const geometry = window.__ftutorConvolutionGeometry;
      if (!geometry?.calculateCoordSystem) return { ready: false };
      const samples = [
        { bounds: geometry.calculateCoordSystem(900, 500, -4, 3), minT: -4, maxT: 3 },
        { bounds: geometry.calculateCoordSystem(500, 500, -2, 6), minT: -2, maxT: 6 },
        { bounds: geometry.calculateCoordSystem(360, 420, -4, 4), minT: -4, maxT: 4 },
      ];
      return {
        ready: true,
        samples: samples.map(({ bounds, minT, maxT }) => ({
          ...bounds,
          minT,
          maxT,
          unitDelta: Math.abs(bounds.pixelsPerXUnit - bounds.pixelsPerYUnit),
        })),
      };
    });
    record('coordinate geometry keeps x and y unit pixels equal at compact and wide sizes',
      geometryChecks.ready
        && geometryChecks.samples.every(sample => sample.unitDelta <= 1e-9
          && sample.xMin <= sample.minT
          && sample.xMax >= sample.maxT
          && sample.yMax - sample.yMin >= 9),
      JSON.stringify(geometryChecks));

    await hydrateDemo(page);
    const initial = await page.evaluate(() => {
      const node = window.__geogebraTestNode;
      return {
        state: node.querySelector('[data-geogebra-stage]')?.dataset.state,
        preset: node.dataset.convolutionPreset,
        task: node.dataset.convolutionTask,
        layers: Array.from(node.querySelectorAll('[data-convolution-demo-layer]')).map(layer => layer.dataset.convolutionDemoLayer),
        internalStepTabs: node.querySelectorAll('[data-geogebra-step], [data-geogebra-nav]').length,
        rangeDisabled: node.querySelector('[data-geogebra-time]')?.disabled,
        canvasCount: node.querySelectorAll('canvas').length,
        codebase: window.__fakeGeoGebra.codebases[0],
        perspective: window.__fakeGeoGebra.perspectives[0],
        productVisible: window.__fakeGeoGebra.visibilities.productBand,
        outputVisible: window.__fakeGeoGebra.visibilities.convolutionOutput,
        diagnostic: node.__geoGebraDiagnostics?.getState?.(),
        localYAxes: {
          signal: window.__fakeGeoGebra.visibilities.signalYAxis,
          product: window.__fakeGeoGebra.visibilities.productYAxis,
          output: window.__fakeGeoGebra.visibilities.outputYAxis,
        },
        axisCommands: window.__fakeGeoGebra.commands.filter(command => /(?:signalsXAxis|productXAxis|outputXAxis)/.test(command)),
        redMotionArrowCommands: window.__fakeGeoGebra.commands.filter(command => /arrow/i.test(command)),
        axesVisible: window.__fakeGeoGebra.axesVisible.at(-1),
        signalAxisStyle: window.__fakeGeoGebra.lineStyles.signalAxis,
        productAxisStyle: window.__fakeGeoGebra.lineStyles.productAxis,
      };
    });
    record('controlled lesson demo mounts one applet with the three stacked layers and no duplicate pager',
      initial.state === 'ready'
        && initial.preset === 'figure-2-7'
        && initial.task === 'slide'
        && JSON.stringify(initial.layers) === JSON.stringify(['signals', 'product', 'output'])
        && initial.internalStepTabs === 0
        && initial.rangeDisabled === false
        && initial.canvasCount === 1
        && initial.perspective === 'G'
        && initial.productVisible === true
        && initial.outputVisible === false
        && initial.diagnostic?.orderId === 'x-fixed'
        && initial.diagnostic?.outputRevealMode === 'hidden'
        && initial.diagnostic?.listenerCount === 1
        && JSON.stringify(initial.localYAxes) === JSON.stringify({ signal: true, product: true, output: true })
        && initial.axisCommands.length === 3
        && initial.redMotionArrowCommands.length === 0
        && JSON.stringify(initial.axesVisible) === JSON.stringify([1, true, false])
        && initial.signalAxisStyle === 0
        && initial.productAxisStyle === 0
        && initial.codebase === 'https://www.geogebra.org/apps/5.4.920.0/web3d',
      JSON.stringify(initial));

    const responsiveSize = await page.evaluate(() => {
      const node = window.__geogebraTestNode;
      const stage = node.querySelector('[data-geogebra-stage]');
      const mount = node.querySelector('[data-geogebra-mount]');
      stage.style.height = '204px';
      mount.style.height = '620px';
      window.__fakeResizeObservers.at(-1)?.callback([]);
      const metrics = window.__fakeGeoGebra;
      return {
        initial: metrics.constructorSizes[0],
        resized: metrics.resizeSizes.at(-1),
        coordSystems: metrics.coordSystems,
        constructorCount: metrics.constructorCount,
        injectCount: metrics.injectCount,
        canvasCount: node.querySelectorAll('canvas').length,
      };
    });
    record('applet sizing follows the real stage width and height without rebuilding the instance',
      responsiveSize.initial?.width >= 896
        && responsiveSize.initial.width <= 900
        && responsiveSize.initial?.height >= 618
        && responsiveSize.initial.height <= 620
        && responsiveSize.resized?.width >= 896
        && responsiveSize.resized.width <= 900
        && responsiveSize.resized?.height >= 200
        && responsiveSize.resized.height <= 204
        && responsiveSize.coordSystems.length >= 2
        && responsiveSize.coordSystems.at(-1)?.[0] < -4
        && responsiveSize.coordSystems.at(-1)?.[1] > 3
        && responsiveSize.coordSystems.at(-1)?.[2] < 0
        && responsiveSize.coordSystems.at(-1)?.[3] > 8
        && responsiveSize.constructorCount === 1
        && responsiveSize.injectCount === 1
        && responsiveSize.canvasCount === 1,
      JSON.stringify(responsiveSize));

    const firstContact = await page.evaluate(() => {
      const node = window.__geogebraTestNode;
      const range = node.querySelector('[data-geogebra-time]');
      range.value = '-3';
      range.dispatchEvent(new Event('input', { bubbles: true }));
      return {
        ready: node.dataset.convolutionTaskReady,
        feedback: node.querySelector('[data-geogebra-feedback]')?.textContent.trim() || '',
        state: node.__geoGebraDiagnostics?.getState?.(),
      };
    });
    record('slide task completes at first contact and reports the shared atomic state',
      firstContact.ready === 'true'
        && /first contact/i.test(firstContact.feedback)
        && firstContact.state?.preset === 'figure-2-7'
        && firstContact.state?.task === 'slide'
        && close(firstContact.state?.t, -3)
        && close(firstContact.state?.area, 0)
        && close(firstContact.state?.output, 0),
      JSON.stringify(firstContact));

    const stableScene = await page.evaluate(() => {
      const diagnostics = window.__geogebraTestNode.__geoGebraDiagnostics;
      const before = diagnostics.getState();
      const changedOrder = diagnostics.setOrder('g-fixed');
      diagnostics.setOutputReveal({ mode: 'points', revealedTimes: [-3, -2] });
      const after = diagnostics.getState();
      return {
        changedOrder,
        sameInstance: before.instanceId === after.instanceId,
        orderId: after.orderId,
        outputRevealMode: after.outputRevealMode,
        revealedTimes: after.revealedTimes,
        listenerCount: after.listenerCount,
        outputVisible: window.__fakeGeoGebra.visibilities.convolutionOutput,
      };
    });
    record('order and output reveal changes reuse one applet and one listener',
      stableScene.changedOrder
        && stableScene.sameInstance
        && stableScene.orderId === 'g-fixed'
        && stableScene.outputRevealMode === 'points'
        && JSON.stringify(stableScene.revealedTimes) === JSON.stringify([-3, -2])
        && stableScene.listenerCount === 1
        && stableScene.outputVisible === false,
      JSON.stringify(stableScene));

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
    unknownDemo.spec.preset = 'not-registered';
    await hydrateDemo(page, unknownDemo);
    const unknown = await page.evaluate(() => ({
      state: window.__geogebraTestNode.querySelector('[data-geogebra-stage]')?.dataset.state,
      fallbackVisible: !window.__geogebraTestNode.querySelector('[data-geogebra-fallback]')?.hidden,
      ready: window.__geogebraTestNode.dataset.convolutionTaskReady,
      feedback: window.__geogebraTestNode.querySelector('[data-geogebra-feedback]')?.textContent || '',
      layers: window.__geogebraTestNode.querySelectorAll('[data-convolution-demo-layer]').length,
    }));
    record('unknown presets fail to a usable three-layer fallback without locking Continue',
      unknown.state === 'failed'
        && unknown.fallbackVisible
        && unknown.ready === 'true'
        && unknown.layers === 3
        && /Unknown convolution preset/.test(unknown.feedback),
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

  const failed = results.filter(result => !result.ok);
  console.log(`\n[geogebra-demo] ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main();
