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
  'guided-sequence': {
    title: 'Predict before you reveal',
    prompt: 'Complete the five steps and reveal one output point only after your prediction.',
  },
  segments: {
    title: 'Track the active segment',
    prompt: 'Move t through zero and identify which segment contributes.',
  },
  cases: {
    title: 'Build the two cases',
    prompt: 'Select the overlap rule for t below and above zero.',
  },
  'contact-points': {
    title: 'Find the contact points',
    prompt: 'Match each moving edge with a fixed edge to locate every breakpoint.',
  },
  'integration-limits': {
    title: 'Choose the integration range',
    prompt: 'Read the left and right overlap boundaries from the graph.',
  },
  'piecewise-output': {
    title: 'Assemble the piecewise output',
    prompt: 'Compare the three overlap intervals with the final curve.',
  },
  commutativity: {
    title: 'Swap the fixed signal',
    prompt: 'Change the order without creating a second applet.',
  },
  'support-transfer': {
    title: 'Transfer the support',
    prompt: 'Test causal and anticausal support on both sides of t = 0.',
  },
  'shift-transfer': {
    title: 'Transfer the shifts',
    prompt: 'Change T and check whether the output start moves.',
  },
  'practice-builder': {
    title: 'Build the practice curve',
    prompt: 'Use the overlap cases to assemble the rectangle × triangle output.',
  },
});

const GEOGEBRA_CONVOLUTION_TASK_STEPS_UI = Object.freeze({
  'guided-sequence': 1,
  'change-variable': 1,
  flip: 2,
  slide: 3,
  multiply: 4,
  integrate: 5,
  'worked-example': 5,
});

const CONVOLUTION_TASK_BEHAVIORS = Object.freeze({
  'guided-sequence': { output: 'hidden', control: 'guided' },
  'worked-example': { output: 'full', control: 'time' },
  segments: { output: 'points', control: 'segment-check' },
  cases: { output: 'points', control: 'case-check' },
  'contact-points': { output: 'hidden', control: 'breakpoint-choice' },
  'integration-limits': { output: 'hidden', control: 'limit-choice' },
  'piecewise-output': { output: 'full', control: 'shape-check' },
  commutativity: { output: 'full', control: 'swap-order' },
  'support-transfer': { output: 'points', control: 'sign-region' },
  'shift-transfer': { output: 'points', control: 'parameter-T' },
  'practice-builder': { output: 'points', control: 'practice-progress' },
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
    order: String(source.order || '').trim(),
    outputRevealMode: ['hidden', 'points', 'full'].includes(source.output_reveal_mode)
      ? source.output_reveal_mode
      : 'hidden',
    revealedTimes: Array.isArray(source.revealed_times) ? source.revealed_times.map(Number).filter(Number.isFinite) : [],
    parameters: source.parameters && typeof source.parameters === 'object' ? { ...source.parameters } : {},
    taskBehavior: CONVOLUTION_TASK_BEHAVIORS[String(source.task || 'slide').trim()] || null,
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
  const savedGuided = window.getConvolutionFigure27State?.() || {};
  const guidedState = {
    step: Math.max(1, Math.min(5, Number(savedGuided.step) || 1)),
    t: Number.isFinite(Number(savedGuided.t)) ? Number(savedGuided.t) : spec.initialT,
    revealedTimes: Array.isArray(savedGuided.revealedTimes) ? savedGuided.revealedTimes.map(Number).filter(Number.isFinite) : [],
    completedCheckpoints: Array.isArray(savedGuided.revealedTimes) ? savedGuided.revealedTimes.map(Number).filter(Number.isFinite) : [],
    predictionAttempts: {},
    completed: Boolean(savedGuided.completed),
  };
  let appletCreateCount = 0;

  const guidedControlsHtml = spec.task === 'guided-sequence' ? `
    <section class="geogebra-guided-sequence" data-guided-sequence aria-label="Guided Figure 2.7 sequence">
      <div class="geogebra-guided-steps" role="list">
        ${['Read the Signals', 'Flip', 'Slide', 'Predict and Check', 'Explore Freely'].map((label, index) => `<button type="button" data-guided-step="${index + 1}" role="listitem"><span>${index + 1}</span>${label}</button>`).join('')}
      </div>
      <div class="geogebra-guided-panel" data-guided-panel>
        <p data-guided-copy>Start by reading the two signals, then complete Flip to unlock the shared t slider.</p>
        <button class="geogebra-demo-button geogebra-demo-button--primary" type="button" data-guided-step-action="complete-flip">Complete Flip</button>
        <div class="geogebra-guided-prediction" data-guided-prediction hidden>
          <strong>Predict before you reveal</strong>
          <label>Output <select data-guided-nonzero><option value="">Choose</option><option value="false">zero</option><option value="true">nonzero</option></select></label>
          <label>Trend <select data-guided-trend><option value="">Choose</option><option value="increasing">increasing</option><option value="decreasing">decreasing</option></select></label>
          <label>Integral limits <input data-guided-interval placeholder="e.g. -1,-1"></label>
          <button class="geogebra-demo-button geogebra-demo-button--primary" type="button" data-guided-submit-prediction>Check prediction</button>
        </div>
        <div class="geogebra-guided-checkpoints" data-guided-checkpoints aria-label="Checkpoints">
          ${[-3, -2, 0, 1].map(value => `<button type="button" data-guided-checkpoint="${value}">t = ${value}</button>`).join('')}
        </div>
      </div>
    </section>` : '';
  const taskControlsHtml = spec.task === 'commutativity' ? `
    <div class="geogebra-task-control"><button type="button" class="geogebra-demo-button" data-convolution-swap-order>Swap Order</button><span data-convolution-order-readout>x-fixed</span></div>`
    : spec.task === 'shift-transfer' ? `<label class="geogebra-task-control">Shift T <input type="range" min="0" max="4" step="0.5" value="${Number(spec.parameters.T) || 2}" data-convolution-parameter-t></label>`
      : '';

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
      ${guidedControlsHtml}
      ${taskControlsHtml}
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
    const width = Math.max(320, Math.round(stage.clientWidth || mount.clientWidth || 760));
    const height = Math.max(200, Math.round(stage.clientHeight || mount.clientHeight || 620));
    return { width, height };
  }

  function persistGuidedState() {
    window.setConvolutionFigure27State?.({
      step: guidedState.step,
      t: guidedState.t,
      revealedTimes: guidedState.revealedTimes,
      completed: guidedState.completed,
    });
  }

  function renderGuidedControls() {
    if (spec.task !== 'guided-sequence') return;
    node.querySelectorAll('[data-guided-step]').forEach((button) => {
      const value = Number(button.dataset.guidedStep);
      button.classList.toggle('is-active', value === guidedState.step);
      button.setAttribute('aria-current', value === guidedState.step ? 'step' : 'false');
      button.disabled = value > guidedState.step + 1;
    });
    const action = node.querySelector('[data-guided-step-action="complete-flip"]');
    if (action) action.hidden = guidedState.step >= 3;
    const prediction = node.querySelector('[data-guided-prediction]');
    if (prediction) prediction.hidden = guidedState.step < 4;
    node.querySelectorAll('[data-guided-checkpoint]').forEach((button) => {
      const value = Number(button.dataset.guidedCheckpoint);
      const done = guidedState.revealedTimes.includes(value);
      button.classList.toggle('is-complete', done);
      button.setAttribute('aria-pressed', String(guidedState.t === value));
    });
    const copy = node.querySelector('[data-guided-copy]');
    if (copy) {
      copy.textContent = guidedState.completed
        ? 'All checkpoints are revealed. Explore the complete output curve.'
        : guidedState.step < 3
          ? 'Start by reading the two signals, then complete Flip to unlock the shared t slider.'
          : guidedState.step < 4
            ? 'Slide to a checkpoint. Predict the overlap before checking the output.'
            : `Predict the output at t = ${formatGeoGebraValue(guidedState.t, 2)}, then check your interval.`;
    }
    if (range) range.disabled = guidedState.step < 3 || guidedState.completed;
  }

  function evaluateGuidedPrediction(value, answer) {
    const expectedNonzero = value > -3;
    const expectedInterval = [-1, value + 2];
    const interval = Array.isArray(answer.interval) ? answer.interval.map(Number) : [];
    const ok = answer.nonzero === expectedNonzero
      && answer.trend === 'increasing'
      && interval.length === 2
      && Math.abs(interval[0] - expectedInterval[0]) < 1e-9
      && Math.abs(interval[1] - expectedInterval[1]) < 1e-9;
    return {
      ok,
      message: ok
        ? `At t = ${formatGeoGebraValue(value)}, the overlap limits are [-1, ${formatGeoGebraValue(value + 2)}].`
        : 'Check whether the moving boundary t + 2 lies to the right of -1.',
    };
  }

  function completeGuidedCheckpoint(value, answer) {
    const result = evaluateGuidedPrediction(value, answer);
    if (!result.ok) {
      guidedState.predictionAttempts[value] = (guidedState.predictionAttempts[value] || 0) + 1;
      const attempts = guidedState.predictionAttempts[value];
      feedback.dataset.feedbackLevel = attempts <= 1 ? 'highlight' : attempts === 2 ? 'direction' : 'demonstration';
      feedback.textContent = attempts <= 1
        ? 'Recheck the highlighted prediction.'
        : attempts === 2
          ? result.message
          : 'Demonstration: the fixed boundary is -1 and the moving boundary is t + 2. Enter those limits, then check again.';
      return result;
    }
    guidedState.revealedTimes = [...new Set([...guidedState.revealedTimes, value])].sort((a, b) => a - b);
    guidedState.completedCheckpoints = guidedState.revealedTimes.slice();
    scene?.setOutputReveal?.({ mode: 'points', revealedTimes: guidedState.revealedTimes });
    if (guidedState.revealedTimes.length === (preset?.checkpoints || []).length) {
      guidedState.step = 5;
      guidedState.completed = true;
      scene?.setOutputReveal?.({ mode: 'full', revealedTimes: guidedState.revealedTimes });
      setTaskReady(true);
    }
    persistGuidedState();
    renderGuidedControls();
    feedback.textContent = result.message;
    return result;
  }

  function updateStateReadout(state) {
    if (!state) return;
    range.value = String(state.t);
    rangeValue.value = formatGeoGebraValue(state.t, 2);
    let ready = ['change-variable', 'flip', 'worked-example'].includes(spec.task);
    if (spec.task === 'guided-sequence') ready = guidedState.completed;
    if (spec.task === 'slide') ready = state.atTarget;
    if (spec.task === 'multiply') ready = state.overlap;
    if (spec.task === 'integrate') ready = state.overlap;
    if (spec.taskBehavior && !['guided-sequence', 'slide', 'multiply', 'integrate'].includes(spec.task)) ready = true;
    setTaskReady(ready);

    if (spec.task === 'slide') {
      feedback.textContent = state.atTarget
        ? `First contact: at t = ${formatGeoGebraValue(spec.targetT, 2)}, the supports meet and the area is still zero.`
        : `Current t = ${formatGeoGebraValue(state.t, 2)}. Move toward ${formatGeoGebraValue(spec.targetT, 2)} to find first contact.`;
      return;
    }
    if (spec.task === 'guided-sequence') {
      guidedState.t = Number(state.t);
      renderGuidedControls();
      if (!guidedState.completed) feedback.textContent = `Current t = ${formatGeoGebraValue(state.t, 2)}. Predict before revealing the output.`;
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
    const support = preset?.support ? `${preset.support[0]} to ${preset.support[1]}` : 'the supported interval';
    feedback.textContent = `${message} Formula: ${preset?.inputFormula || 'x(t)'}; ${preset?.responseFormula || 'g(t)'}. Support: ${support}.`;
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
      appletCreateCount += 1;
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
        order: spec.order,
        parameters: spec.parameters,
        width: size.width,
        height: size.height,
        onStateChange: updateStateReadout,
      });
      scene.setOutputReveal?.({ mode: spec.outputRevealMode, revealedTimes: spec.revealedTimes });
      if (spec.task === 'guided-sequence') {
        scene.setStep?.(guidedState.step);
        scene.setTime?.(guidedState.t);
        scene.setOutputReveal?.({
          mode: guidedState.completed ? 'full' : guidedState.revealedTimes.length ? 'points' : 'hidden',
          revealedTimes: guidedState.revealedTimes,
        });
        renderGuidedControls();
      } else if (spec.taskBehavior?.output === 'full') {
        scene.setOutputReveal?.({ mode: 'full' });
      } else if (spec.taskBehavior?.output === 'points') {
        scene.setOutputReveal?.({ mode: 'points', revealedTimes: preset?.checkpoints?.slice(0, 1) || [] });
      }
      node.__geoGebraDiagnostics = {
        getState: () => scene?.getState() || null,
        setTime: value => scene?.setTime(value),
        setStep: value => scene?.setStep(value),
        setOrder: value => scene?.setOrder?.(value),
        setOutputReveal: value => scene?.setOutputReveal?.(value),
        setParameters: value => scene?.setParameters?.(value),
        reset: () => scene?.reset?.(),
        getAppletCreateCount: () => appletCreateCount,
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
        scene?.resize?.(nextSize);
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
  node.querySelector('.geogebra-demo-reset').addEventListener('click', () => {
    scene?.reset();
    if (spec.task === 'guided-sequence') {
      guidedState.step = 1;
      guidedState.t = spec.initialT;
      guidedState.revealedTimes = [];
      guidedState.completedCheckpoints = [];
      guidedState.predictionAttempts = {};
      guidedState.completed = false;
      persistGuidedState();
      renderGuidedControls();
      setTaskReady(false);
    }
  }, { signal: uiAbort.signal });

  node.addEventListener('click', (event) => {
    const flip = event.target.closest('[data-guided-step-action="complete-flip"]');
    if (flip && spec.task === 'guided-sequence') {
      guidedState.step = Math.max(guidedState.step, 3);
      scene?.setStep?.(3);
      persistGuidedState();
      renderGuidedControls();
      feedback.textContent = 'Flip complete. Move t to a checkpoint and predict the overlap.';
      return;
    }
    const checkpoint = event.target.closest('[data-guided-checkpoint]');
    if (checkpoint && spec.task === 'guided-sequence') {
      guidedState.step = Math.max(guidedState.step, 4);
      guidedState.t = Number(checkpoint.dataset.guidedCheckpoint);
      scene?.setStep?.(4);
      scene?.setTime?.(guidedState.t);
      persistGuidedState();
      renderGuidedControls();
      return;
    }
    const submit = event.target.closest('[data-guided-submit-prediction]');
    if (submit && spec.task === 'guided-sequence') {
      const value = guidedState.t;
      const intervalText = node.querySelector('[data-guided-interval]')?.value || '';
      const interval = intervalText.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
      completeGuidedCheckpoint(value, {
        nonzero: node.querySelector('[data-guided-nonzero]')?.value === 'true',
        trend: node.querySelector('[data-guided-trend]')?.value || '',
        interval,
      });
      return;
    }
    const swap = event.target.closest('[data-convolution-swap-order]');
    if (swap) {
      const current = scene?.getState?.()?.orderId || preset?.defaultOrder || 'x-fixed';
      const next = current === 'x-fixed' ? 'g-fixed' : 'x-fixed';
      if (scene?.setOrder?.(next)) {
        const readout = node.querySelector('[data-convolution-order-readout]');
        if (readout) readout.textContent = next;
      }
    }
  }, { signal: uiAbort.signal });
  node.querySelector('[data-convolution-parameter-t]')?.addEventListener('input', (event) => {
    scene?.setParameters?.({ T: Number(event.target.value) });
  }, { signal: uiAbort.signal });

  if (['change-variable', 'flip'].includes(spec.task)) setTaskReady(true);
  if (spec.task === 'commutativity') setTaskReady(true);
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
