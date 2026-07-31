// Tutor Agent shell for trusted GeoGebra scenes.

const GEOGEBRA_DEMO_STEPS = [
  {
    key: 'signals',
    label: '1. Signals',
    title: 'Read both signals on the integration axis',
    prompt: 'Treat tau as the horizontal variable. The output time t is still only a parameter.',
  },
  {
    key: 'flip',
    label: '2. Flip',
    title: 'Reverse g(tau)',
    prompt: 'Reflect g(tau) across tau = 0. Its boundary moves from -2 to 2.',
  },
  {
    key: 'slide',
    label: '3. Slide',
    title: 'Move g(t - tau)',
    prompt: 'Slide the purple signal. First contact with x(tau) occurs at t = -3.',
  },
  {
    key: 'integrate',
    label: '4. Integrate',
    title: 'Connect overlap area to c(t)',
    prompt: 'The orange product area and the point on c(t) are the same value.',
  },
];

function normalizeGeoGebraDemoSpec(demo = {}) {
  const source = demo.spec || demo.demo_spec || {};
  const number = (key, fallback) => Number.isFinite(Number(source[key])) ? Number(source[key]) : fallback;
  return {
    scene: String(source.scene || '').trim(),
    guidance: source.guidance === 'soft' ? 'soft' : 'soft',
    initialStep: Math.max(1, Math.min(4, Math.round(number('initial_step', 1)))),
    initialT: number('initial_t', -4),
    minT: number('t_min', -4),
    maxT: number('t_max', 3),
    stepT: Math.max(0.001, number('t_step', 0.05)),
    targetT: number('target_t', -3),
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
  const sceneFactory = runtime?.getSceneFactory(spec.scene);
  const title = getInteractiveDemoTitle(demo, 'Graphical convolution: flip, slide, and integrate');
  const subtitle = getInteractiveDemoSubtitle(demo)
    || 'Use one continuous construction to follow Figure 2.7 from the input signals to the convolution output.';
  let currentStep = spec.initialStep;
  let generation = 0;
  let scene = null;
  let appletHandle = null;
  let resizeObserver = null;
  let mountAbort = null;
  let cleaned = false;
  const uiAbort = new AbortController();

  node.innerHTML = `
    <section class="geogebra-demo-shell" aria-label="${escapeHtml(title)}">
      <header class="geogebra-demo-head">
        <div>
          <div class="geogebra-demo-kicker">Figure 2.7 · Continuous-time convolution</div>
          <div class="geogebra-demo-title">${escapeHtml(title)}</div>
          <div class="geogebra-demo-subtitle">${escapeHtml(subtitle)}</div>
        </div>
        <button class="geogebra-demo-button geogebra-demo-reset" type="button">Reset</button>
      </header>
      <div class="geogebra-demo-steps" role="tablist" aria-label="Convolution steps">
        ${GEOGEBRA_DEMO_STEPS.map((item, index) => `
          <button class="geogebra-demo-step" type="button" role="tab" data-geogebra-step="${index + 1}">${escapeHtml(item.label)}</button>
        `).join('')}
      </div>
      <div class="geogebra-demo-toolbar">
        <button class="geogebra-demo-button" type="button" data-geogebra-nav="previous">Previous</button>
        <div class="geogebra-demo-instruction">
          <strong data-geogebra-step-title></strong>
          <span data-geogebra-step-prompt></span>
        </div>
        <button class="geogebra-demo-button geogebra-demo-button--primary" type="button" data-geogebra-nav="next">Next</button>
      </div>
      <label class="geogebra-demo-time-control">
        <span>Slide time <em>t</em></span>
        <input type="range" min="${spec.minT}" max="${spec.maxT}" step="${spec.stepT}" value="${spec.initialT}" data-geogebra-time disabled>
        <output data-geogebra-time-value>${formatGeoGebraValue(spec.initialT, 2)}</output>
      </label>
      <div class="geogebra-demo-legend" aria-label="Signal colors">
        <span><i class="geogebra-demo-swatch geogebra-demo-swatch--input"></i>x(&tau;)</span>
        <span><i class="geogebra-demo-swatch geogebra-demo-swatch--source"></i>g(&tau;)</span>
        <span><i class="geogebra-demo-swatch geogebra-demo-swatch--moving"></i>g(-&tau;) / g(t - &tau;)</span>
        <span><i class="geogebra-demo-swatch geogebra-demo-swatch--product"></i>product</span>
        <span><i class="geogebra-demo-swatch geogebra-demo-swatch--output"></i>c(t)</span>
      </div>
      <div class="geogebra-demo-stage" data-geogebra-stage data-state="loading">
        <div class="geogebra-demo-loading" data-geogebra-loading role="status">Loading the GeoGebra construction...</div>
        <div class="geogebra-demo-mount" data-geogebra-mount aria-label="Interactive GeoGebra construction"></div>
        <div class="geogebra-demo-fallback" data-geogebra-fallback hidden>
          <img src="${escapeHtml(spec.fallbackFigure)}" alt="Textbook Figure 2.7 showing the graphical convolution steps">
          <div class="geogebra-demo-fallback-copy">
            <strong>The interactive construction is unavailable.</strong>
            <span>The lesson still follows the textbook figure. For these signals,</span>
            <code>c(t) = 0 for t &lt;= -3; c(t) = 2 * (1 - exp(-(t + 3))) for t &gt; -3.</code>
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
  const stepTitle = node.querySelector('[data-geogebra-step-title]');
  const stepPrompt = node.querySelector('[data-geogebra-step-prompt]');
  const previousButton = node.querySelector('[data-geogebra-nav="previous"]');
  const nextButton = node.querySelector('[data-geogebra-nav="next"]');

  function getAppletSize() {
    const width = Math.max(320, Math.round(mount.clientWidth || stage.clientWidth || 760));
    const height = width <= 520 ? 540 : 620;
    return { width, height };
  }

  function updateStateReadout(state) {
    if (!state) return;
    range.value = String(state.t);
    rangeValue.value = formatGeoGebraValue(state.t, 2);
    if (currentStep === 3) {
      feedback.textContent = state.atTarget
        ? 'First contact: at t = -3, the two supports just meet and the overlap area is still zero.'
        : `Explore t = ${formatGeoGebraValue(state.t, 2)}. Move toward -3 to find first contact.`;
      return;
    }
    if (currentStep === 4) {
      feedback.textContent = `At t = ${formatGeoGebraValue(state.t, 2)}, overlap area = ${formatGeoGebraValue(state.area)} and c(t) = ${formatGeoGebraValue(state.output)}.`;
      return;
    }
    feedback.textContent = GEOGEBRA_DEMO_STEPS[currentStep - 1].prompt;
  }

  function applyStep(nextStep) {
    currentStep = Math.max(1, Math.min(4, Number(nextStep) || 1));
    const item = GEOGEBRA_DEMO_STEPS[currentStep - 1];
    node.querySelectorAll('[data-geogebra-step]').forEach((button) => {
      const selected = Number(button.dataset.geogebraStep) === currentStep;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    stepTitle.textContent = item.title;
    stepPrompt.textContent = item.prompt;
    previousButton.disabled = currentStep === 1;
    nextButton.disabled = currentStep === 4;
    range.disabled = !scene || currentStep < 3;
    scene?.setStep(currentStep);
    updateStateReadout(scene?.getState());
  }

  function showFailure(message) {
    stage.dataset.state = 'failed';
    loading.hidden = true;
    mount.hidden = true;
    fallback.hidden = false;
    range.disabled = true;
    feedback.textContent = message || 'GeoGebra could not load. Use the textbook figure below or try again.';
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
        initialStep: currentStep,
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
        setTime: (value) => scene?.setTime(value),
      };
      stage.dataset.state = 'ready';
      loading.hidden = true;
      fallback.hidden = true;
      mount.hidden = false;
      resizeObserver = new ResizeObserver(() => {
        if (!appletHandle || cleaned) return;
        const nextSize = getAppletSize();
        appletHandle.setSize(nextSize.width, nextSize.height);
      });
      resizeObserver.observe(stage);
      applyStep(currentStep);
    } catch (error) {
      if (error?.name === 'AbortError' || cleaned || activeGeneration !== generation) return;
      console.warn('[GeoGebra demo] mount failed:', error);
      releaseApplet();
      showFailure('GeoGebra could not load. Use the textbook figure below or try again.');
    }
  }

  node.querySelectorAll('[data-geogebra-step]').forEach((button) => {
    button.addEventListener('click', () => applyStep(Number(button.dataset.geogebraStep)), { signal: uiAbort.signal });
  });
  previousButton.addEventListener('click', () => applyStep(currentStep - 1), { signal: uiAbort.signal });
  nextButton.addEventListener('click', () => applyStep(currentStep + 1), { signal: uiAbort.signal });
  range.addEventListener('input', () => scene?.setTime(Number(range.value)), { signal: uiAbort.signal });
  retryButton.addEventListener('click', () => mountApplet(true), { signal: uiAbort.signal });
  node.querySelector('.geogebra-demo-reset').addEventListener('click', () => {
    currentStep = 1;
    scene?.reset();
    applyStep(1);
  }, { signal: uiAbort.signal });

  applyStep(currentStep);
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
