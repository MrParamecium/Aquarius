// Tutor Agent shell for trusted, lesson-controlled GeoGebra scenes.

const GEOGEBRA_CONVOLUTION_TASK_COPY = Object.freeze({
  'change-variable': {
    title: 'Change the horizontal variable to tau',
    prompt: 'Read both source signals on the tau-axis before changing either shape.',
  },
  flip: {
    title: 'Flip the response',
    prompt: 'Compare g(tau) with g(-tau). The support boundary mirrors across zero.',
  },
  slide: {
    title: 'Slide the flipped response',
    prompt: 'Move t until the two supports make first contact.',
  },
  multiply: {
    title: 'Find the product over the overlap',
    prompt: 'Move t into an overlapping position and inspect the product layer.',
  },
  integrate: {
    title: 'Trace one output value',
    prompt: 'The product area and the highlighted point on the output are the same value.',
  },
  'worked-example': {
    title: 'Explore the worked example',
    prompt: 'Move t across the breakpoints and compare the overlap with the piecewise output.',
  },
});

const GEOGEBRA_CONVOLUTION_TASK_STEPS_UI = Object.freeze({
  'change-variable': 1,
  flip: 2,
  slide: 3,
  multiply: 4,
  integrate: 5,
  'worked-example': 5,
});

function normalizeGeoGebraDemoSpec(demo = {}) {
  const source = demo.spec || demo.demo_spec || {};
  const presetId = String(source.preset || 'figure-2-7').trim();
  const preset = window.__ftutorConvolutionPresets?.getConvolutionPreset(presetId);
  const defaults = preset?.range || { min: -4, max: 3, step: 0.05, initial: -4, target: -3 };
  const number = (key, fallback) => Number.isFinite(Number(source[key])) ? Number(source[key]) : fallback;
  return {
    scene: String(source.scene || '').trim(),
    presetId,
    task: String(source.task || 'slide').trim(),
    scaffolding: String(source.scaffolding || 'guided').trim(),
    initialStep: GEOGEBRA_CONVOLUTION_TASK_STEPS_UI[source.task] || Math.max(1, Math.min(5, Math.round(number('initial_step', 1)))),
    initialT: number('initial_t', defaults.initial),
    minT: number('t_min', defaults.min),
    maxT: number('t_max', defaults.max),
    stepT: Math.max(0.001, number('t_step', defaults.step)),
    targetT: number('target_t', defaults.target),
    targetTolerance: Math.max(0, number('target_tolerance', 0.08)),
    fallbackFigure: /^\/figures\/[a-zA-Z0-9._-]+$/.test(source.fallback_figure || '')
      ? source.fallback_figure
      : '/figures/page-179-figure_2_7.png',
  };
}

function formatGeoGebraValue(value, digits = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  const clean = Math.abs(number) < 1e-10 ? 0 : number;
  return Number(clean.toFixed(digits)).toString();
}

function renderGeoGebraDemo(node, demo) {
  const runtime = window.__ftutorGeoGebraRuntime;
  const spec = normalizeGeoGebraDemoSpec(demo);
  const preset = window.__ftutorConvolutionPresets?.getConvolutionPreset(spec.presetId);
  const sceneFactory = runtime?.getSceneFactory(spec.scene);
  const title = getInteractiveDemoTitle(demo, preset?.label || 'Graphical convolution');
  const subtitle = getInteractiveDemoSubtitle(demo)
    || 'Keep the signals, product, and output visible while one shared t value moves through the construction.';
  const taskCopy = GEOGEBRA_CONVOLUTION_TASK_COPY[spec.task] || GEOGEBRA_CONVOLUTION_TASK_COPY['worked-example'];
  let generation = 0;
  let scene = null;
  let appletHandle = null;
  let resizeObserver = null;
  let mountAbort = null;
  let cleaned = false;
  const uiAbort = new AbortController();

  node.dataset.convolutionPreset = spec.presetId;
  node.dataset.convolutionTask = spec.task;
  node.dataset.convolutionTaskReady = 'false';
  node.innerHTML = `
    <section class="geogebra-demo-shell" aria-label="${escapeHtml(title)}">
      <header class="geogebra-demo-head">
        <div>
          <div class="geogebra-demo-kicker">${escapeHtml(preset?.label || 'Textbook construction')} · Continuous-time convolution</div>
          <div class="geogebra-demo-title">${escapeHtml(title)}</div>
          <div class="geogebra-demo-subtitle">${escapeHtml(subtitle)}</div>
        </div>
        <button class="geogebra-demo-button geogebra-demo-reset" type="button" title="Reset construction">Reset</button>
      </header>
      <div class="geogebra-demo-instruction">
        <strong>${escapeHtml(taskCopy.title)}</strong>
        <span>${escapeHtml(taskCopy.prompt)}</span>
      </div>
      <label class="geogebra-demo-time-control">
        <span>Shared time <em>t</em></span>
        <input type="range" min="${spec.minT}" max="${spec.maxT}" step="${spec.stepT}" value="${spec.initialT}" data-geogebra-time disabled>
        <output data-geogebra-time-value>${formatGeoGebraValue(spec.initialT, 2)}</output>
      </label>
      <div class="convolution-demo-stack" aria-label="Synchronized convolution layers">
        <div class="convolution-demo-panel" data-convolution-demo-layer="signals"><strong>Signals</strong><span>x(&tau;) and g(t - &tau;)</span></div>
        <div class="convolution-demo-panel" data-convolution-demo-layer="product"><strong>Product</strong><span>x(&tau;)g(t - &tau;)</span></div>
        <div class="convolution-demo-panel" data-convolution-demo-layer="output"><strong>Output</strong><span>c(t)</span></div>
      </div>
      <div class="geogebra-demo-legend" aria-label="Signal colors">
        <span><i class="geogebra-demo-swatch geogebra-demo-swatch--input"></i>x(&tau;)</span>
        <span><i class="geogebra-demo-swatch geogebra-demo-swatch--moving"></i>g(t - &tau;)</span>
        <span><i class="geogebra-demo-swatch geogebra-demo-swatch--product"></i>product</span>
        <span><i class="geogebra-demo-swatch geogebra-demo-swatch--output"></i>c(t)</span>
      </div>
      <div class="geogebra-demo-stage" data-geogebra-stage data-state="loading">
        <div class="geogebra-demo-loading" data-geogebra-loading role="status">Loading the GeoGebra construction...</div>
        <div class="geogebra-demo-mount" data-geogebra-mount aria-label="Interactive GeoGebra construction"></div>
        <div class="geogebra-demo-fallback" data-geogebra-fallback hidden>
          <img src="${escapeHtml(spec.fallbackFigure)}" alt="Textbook graphical convolution reference">
          <div class="geogebra-demo-fallback-copy">
            <strong>The interactive construction is unavailable.</strong>
            <span>Use the three layer labels and the formula on this page to continue.</span>
            <code>Figure 2.7: c(t) = 0 for t &lt;= -3; c(t) = 2 * (1 - exp(-(t + 3))) for t &gt; -3.</code>
            <button class="geogebra-demo-button geogebra-demo-button--primary" type="button" data-geogebra-retry>Retry</button>
          </div>
        </div>
      </div>
      <div class="geogebra-demo-feedback" data-geogebra-feedback aria-live="polite">Preparing the construction...</div>
    </section>
  `;

  const stage = node.querySelector('[data-geogebra-stage]');
  const mount = node.querySelector('[data-geogebra-mount]');
  const loading = node.querySelector('[data-geogebra-loading]');
  const fallback = node.querySelector('[data-geogebra-fallback]');
  const retryButton = node.querySelector('[data-geogebra-retry]');
  const range = node.querySelector('[data-geogebra-time]');
  const rangeValue = node.querySelector('[data-geogebra-time-value]');
  const feedback = node.querySelector('[data-geogebra-feedback]');

  function setTaskReady(ready) {
    const next = Boolean(ready);
    node.dataset.convolutionTaskReady = String(next);
    if (next) window.setConvolutionLessonTaskComplete?.(spec.task, true);
    node.dispatchEvent(new CustomEvent('convolution-task-statechange', { bubbles: true, detail: { task: spec.task, ready: next } }));
    window.__ftutorRefreshPager?.();
  }

  function getAppletSize() {
    const width = Math.max(320, Math.round(mount.clientWidth || stage.clientWidth || 760));
    const height = width <= 520 ? 560 : 640;
    return { width, height };
  }

  function updateStateReadout(state) {
    if (!state) return;
    range.value = String(state.t);
    rangeValue.value = formatGeoGebraValue(state.t, 2);
    let ready = ['change-variable', 'flip', 'worked-example'].includes(spec.task);
    if (spec.task === 'slide') ready = state.atTarget;
    if (spec.task === 'multiply') ready = state.overlap;
    if (spec.task === 'integrate') ready = state.overlap;
    setTaskReady(ready);

    if (spec.task === 'slide') {
      feedback.textContent = state.atTarget
        ? `First contact: at t = ${formatGeoGebraValue(spec.targetT, 2)}, the supports meet and the area is still zero.`
        : `Current t = ${formatGeoGebraValue(state.t, 2)}. Move toward ${formatGeoGebraValue(spec.targetT, 2)} to find first contact.`;
      return;
    }
    if (spec.task === 'multiply') {
      feedback.textContent = state.overlap
        ? `Overlap found. The product layer now shows the heights that contribute at t = ${formatGeoGebraValue(state.t, 2)}.`
        : 'Move t until the two signals overlap, then inspect the product layer.';
      return;
    }
    if (spec.task === 'integrate' || spec.task === 'worked-example') {
      feedback.textContent = `At t = ${formatGeoGebraValue(state.t, 2)}, product area = ${formatGeoGebraValue(state.area)} and c(t) = ${formatGeoGebraValue(state.output)}.`;
      return;
    }
    feedback.textContent = taskCopy.prompt;
  }

  function showFailure(message) {
    stage.dataset.state = 'failed';
    loading.hidden = true;
    mount.hidden = true;
    fallback.hidden = false;
    range.disabled = true;
    feedback.textContent = message;
    setTaskReady(true);
  }

  function releaseApplet() {
    resizeObserver?.disconnect();
    resizeObserver = null;
    scene?.destroy();
    scene = null;
    appletHandle?.remove();
    appletHandle = null;
    mountAbort?.abort();
    mountAbort = null;
  }

  async function mountApplet(retry = false) {
    generation += 1;
    const activeGeneration = generation;
    releaseApplet();
    mountAbort = new AbortController();
    stage.dataset.state = 'loading';
    loading.hidden = false;
    mount.hidden = false;
    fallback.hidden = true;
    range.disabled = true;
    feedback.textContent = 'Preparing the GeoGebra construction...';

    if (!preset) {
      showFailure(`Unknown convolution preset: ${spec.presetId}`);
      return;
    }
    if (!runtime || !sceneFactory) {
      showFailure(sceneFactory ? 'GeoGebra runtime is unavailable.' : `Unknown GeoGebra scene: ${spec.scene || '(empty)'}`);
      return;
    }

    try {
      const size = getAppletSize();
      const handle = await runtime.createApplet(mount, {
        width: size.width,
        height: size.height,
        retry,
        signal: mountAbort.signal,
      });
      if (cleaned || activeGeneration !== generation) {
        handle.remove();
        return;
      }
      appletHandle = handle;
      scene = sceneFactory();
      scene.create(handle.api, {
        presetId: spec.presetId,
        task: spec.task,
        initialStep: spec.initialStep,
        initialT: spec.initialT,
        minT: spec.minT,
        maxT: spec.maxT,
        stepT: spec.stepT,
        targetT: spec.targetT,
        targetTolerance: spec.targetTolerance,
        onStateChange: updateStateReadout,
      });
      node.__geoGebraDiagnostics = {
        getState: () => scene?.getState() || null,
        setTime: value => scene?.setTime(value),
      };
      stage.dataset.state = 'ready';
      loading.hidden = true;
      fallback.hidden = true;
      mount.hidden = false;
      range.disabled = !['slide', 'multiply', 'integrate', 'worked-example'].includes(spec.task);
      resizeObserver = new ResizeObserver(() => {
        if (!appletHandle || cleaned) return;
        const nextSize = getAppletSize();
        appletHandle.setSize(nextSize.width, nextSize.height);
      });
      resizeObserver.observe(stage);
      updateStateReadout(scene.getState());
    } catch (error) {
      if (error?.name === 'AbortError' || cleaned || activeGeneration !== generation) return;
      console.warn('[GeoGebra demo] mount failed:', error);
      releaseApplet();
      showFailure('GeoGebra could not load. Use the static construction or try again.');
    }
  }

  range.addEventListener('input', () => scene?.setTime(Number(range.value)), { signal: uiAbort.signal });
  retryButton.addEventListener('click', () => mountApplet(true), { signal: uiAbort.signal });
  node.querySelector('.geogebra-demo-reset').addEventListener('click', () => scene?.reset(), { signal: uiAbort.signal });

  if (['change-variable', 'flip'].includes(spec.task)) setTaskReady(true);
  mountApplet();

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    generation += 1;
    uiAbort.abort();
    releaseApplet();
    delete node.__geoGebraDiagnostics;
  };
  window.__ftutorRegisterInteractiveDemoCleanup?.(node, cleanup);
}
