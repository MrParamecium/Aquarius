// Five-step Practice for the rectangle × triangle convolution pattern.

(function initConvolutionPractice(root) {
  const STORAGE_KEY = 'ftutor:convolution-practice:v2';
  const STEPS = Object.freeze(['predict', 'plan', 'build', 'calculate', 'sketch']);
  const LABELS = Object.freeze({ predict: 'Predict', plan: 'Plan', build: 'Build', calculate: 'Calculate', sketch: 'Sketch' });
  const EXPECTED = Object.freeze({
    predict: { start: 0, end: 3, intervals: 3 },
    plan: { flip: 'x', breakpoints: [0, 1, 2, 3] },
    build: { ranges: ['[0,t]', '[0,1]', '[t-2,1]'] },
    calculate: { expressions: ['int_0_t_tau', 'int_0_1_tau', 'int_t-2_1_tau'] },
    sketch: { shapes: ['increasing', 'constant', 'decreasing'], points: [[0, 0], [1, 0.5], [2, 0.5], [3, 0]] },
  });
  const controllers = new WeakMap();
  let state = null;

  function initialState() {
    return { version: 2, activeStep: 'predict', completedSteps: [], attempts: {}, hintLevel: {}, draft: {}, completed: false };
  }

  function loadState() {
    const fallback = initialState();
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || parsed.version !== 2) return fallback;
      fallback.activeStep = STEPS.includes(parsed.activeStep) ? parsed.activeStep : 'predict';
      fallback.completedSteps = Array.isArray(parsed.completedSteps) ? parsed.completedSteps.filter(step => STEPS.includes(step)) : [];
      fallback.attempts = parsed.attempts && typeof parsed.attempts === 'object' ? parsed.attempts : {};
      fallback.hintLevel = parsed.hintLevel && typeof parsed.hintLevel === 'object' ? parsed.hintLevel : {};
      fallback.draft = parsed.draft && typeof parsed.draft === 'object' ? parsed.draft : {};
      fallback.completed = Boolean(parsed.completed);
      return fallback;
    } catch (_) { return fallback; }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function arraysEqual(actual, expected) {
    return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => JSON.stringify(value) === JSON.stringify(expected[index]));
  }

  function evaluateStep(stepId, answer = {}) {
    const id = String(stepId || '').trim();
    const expected = EXPECTED[id];
    if (!expected) return { ok: false, field: 'step', message: 'Choose one of the five Practice steps.' };
    if (id === 'predict') {
      const ok = Number(answer.start) === expected.start && Number(answer.end) === expected.end && Number(answer.intervals) === expected.intervals;
      return ok ? { ok: true, field: '', message: 'Correct. The output support runs from 0 to 3 across three intervals.' } : { ok: false, field: 'predict', message: 'Use the two support endpoints and count the three breakpoint intervals.' };
    }
    if (id === 'plan') {
      const ok = answer.flip === expected.flip && arraysEqual(answer.breakpoints, expected.breakpoints);
      return ok ? { ok: true, field: '', message: 'Correct. Flip x(t − τ), then mark 0, 1, 2, and 3.' } : { ok: false, field: 'plan', message: 'The rectangle is the moving signal; its edges create four breakpoints.' };
    }
    if (id === 'build') {
      const ok = arraysEqual(answer.ranges, expected.ranges);
      return ok ? { ok: true, field: '', message: 'Correct. Each range matches one overlap case.' } : { ok: false, field: 'build', message: 'Match each overlap case to its moving boundary.' };
    }
    if (id === 'calculate') {
      const ok = arraysEqual(answer.expressions, expected.expressions);
      return ok ? { ok: true, field: '', message: 'Correct. Integrate the triangle over each overlap interval.' } : { ok: false, field: 'calculate', message: 'Use one integral block per interval, keeping the same triangle formula.' };
    }
    const ok = arraysEqual(answer.shapes, expected.shapes) && arraysEqual(answer.points, expected.points);
    return ok ? { ok: true, field: '', message: 'Correct. The output rises, holds, then falls to zero.' } : { ok: false, field: 'sketch', message: 'Check the three shapes and the four anchor points.' };
  }

  function panelHtml(step) {
    if (step === 'predict') return `<section class="convolution-practice-panel" data-practice-panel="predict"><h3>1. Predict the support</h3><p>Before calculating, locate where the rectangle and triangle can overlap.</p><label>Starts at <input data-practice-predict-start inputmode="decimal" placeholder="0"></label><label>Ends at <input data-practice-predict-end inputmode="decimal" placeholder="3"></label><label>Intervals <input data-practice-predict-intervals inputmode="numeric" placeholder="3"></label></section>`;
    if (step === 'plan') return `<section class="convolution-practice-panel" data-practice-panel="plan"><h3>2. Plan the motion</h3><p>Choose the signal to flip and mark every support change.</p><fieldset><legend>Flip</legend><label><input type="radio" name="practice-flip" value="x" data-practice-plan-flip> x(t − τ)</label><label><input type="radio" name="practice-flip" value="g" data-practice-plan-flip> g(t − τ)</label></fieldset><label>Breakpoints <input data-practice-plan-breakpoints placeholder="0,1,2,3"></label></section>`;
    if (step === 'build') return `<section class="convolution-practice-panel" data-practice-panel="build"><h3>3. Build the overlap ranges</h3><p>Select the integration range for each case.</p>${EXPECTED.build.ranges.map((range, index) => `<label>Case ${index + 1}<select data-practice-build-range="${index}"><option value="">Choose range</option>${EXPECTED.build.ranges.map(option => `<option value="${option}">${option}</option>`).join('')}</select></label>`).join('')}</section>`;
    if (step === 'calculate') return `<section class="convolution-practice-panel" data-practice-panel="calculate"><h3>4. Calculate each piece</h3><p>Choose the integral block that belongs to each range.</p>${EXPECTED.calculate.expressions.map((expression, index) => `<label>Case ${index + 1}<select data-practice-calculate-expression="${index}"><option value="">Choose expression</option>${EXPECTED.calculate.expressions.map(option => `<option value="${option}">${option}</option>`).join('')}</select></label>`).join('')}</section>`;
    return `<section class="convolution-practice-panel" data-practice-panel="sketch"><h3>5. Sketch the output</h3><p>Choose the shape in each interval and place the anchor points.</p>${EXPECTED.sketch.shapes.map((shape, index) => `<label>Interval ${index + 1}<select data-practice-sketch-shape="${index}"><option value="">Choose shape</option>${EXPECTED.sketch.shapes.map(option => `<option value="${option}">${option}</option>`).join('')}</select></label>`).join('')}<div class="convolution-practice-points">${EXPECTED.sketch.points.map((point, index) => `<label>Point ${index + 1}<input data-practice-sketch-point="${index}" placeholder="${point[0]},${point[1]}"></label>`).join('')}</div></section>`;
  }

  function buildHtml() {
    state ||= initialState();
    return `<section class="convolution-practice-stage" data-convolution-practice data-convolution-practice-ready="true">
      <header class="convolution-practice-heading"><p class="convolution-practice-kicker">PRACTICE</p><h2>Rectangle and triangle convolution</h2><p>Build the output one decision at a time.</p><div class="convolution-practice-formulas"><code>x(t) = u(t) − u(t − 1)</code><code>g(t) = t[u(t) − u(t − 1)]</code></div></header>
      <div class="convolution-practice-step-row" role="list">${STEPS.map((step, index) => `<span data-practice-step-chip="${step}"${state.completedSteps.includes(step) ? ' data-complete="true"' : ''}${step === state.activeStep ? ' aria-current="step"' : ''}>${index + 1}. ${LABELS[step]}</span>`).join('')}</div>
      <div class="convolution-practice-columns"><div class="convolution-practice-builder"><div data-practice-panel-host>${panelHtml(state.activeStep)}</div><div class="convolution-practice-actions"><button type="button" class="convolution-practice-submit" data-practice-submit>Check step</button></div><p class="convolution-practice-feedback" data-practice-feedback aria-live="polite">Make one choice, then check it.</p></div><div class="convolution-practice-demo kc-interactive-demo" data-practice-demo-host data-practice-preset="practice-rectangle-triangle" aria-label="Rectangle and triangle convolution demo"></div></div>
      <div data-practice-handoff></div>
    </section>`;
  }

  function readAnswer(rootElement) {
    const step = state.activeStep;
    if (step === 'predict') return { start: rootElement.querySelector('[data-practice-predict-start]')?.value, end: rootElement.querySelector('[data-practice-predict-end]')?.value, intervals: rootElement.querySelector('[data-practice-predict-intervals]')?.value };
    if (step === 'plan') return { flip: rootElement.querySelector('[data-practice-plan-flip]:checked')?.value || '', breakpoints: (rootElement.querySelector('[data-practice-plan-breakpoints]')?.value || '').split(',').map(Number).filter(Number.isFinite) };
    if (step === 'build') return { ranges: Array.from(rootElement.querySelectorAll('[data-practice-build-range]')).map(select => select.value) };
    if (step === 'calculate') return { expressions: Array.from(rootElement.querySelectorAll('[data-practice-calculate-expression]')).map(select => select.value) };
    return {
      shapes: Array.from(rootElement.querySelectorAll('[data-practice-sketch-shape]')).map(select => select.value),
      points: Array.from(rootElement.querySelectorAll('[data-practice-sketch-point]')).map(input => (input.value.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)),
    };
  }

  function render(rootElement) {
    rootElement.querySelector('[data-practice-panel-host]').innerHTML = panelHtml(state.activeStep);
    rootElement.querySelectorAll('[data-practice-step-chip]').forEach((chip) => {
      chip.toggleAttribute('aria-current', chip.dataset.practiceStepChip === state.activeStep);
      chip.dataset.complete = String(state.completedSteps.includes(chip.dataset.practiceStepChip));
    });
    const handoff = rootElement.querySelector('[data-practice-handoff]');
    handoff.innerHTML = state.completed ? `<section class="convolution-practice-handoff"><h3>Next — Interconnected Systems</h3><ul><li>Parallel systems add impulse responses.</li><li>Cascade systems convolve impulse responses.</li><li>Next, use today’s method to understand h1(t) * h2(t).</li></ul><button type="button" data-convolution-next-section>Continue to Interconnected Systems</button></section>` : '';
  }

  function mount(rootElement) {
    if (!rootElement) return;
    controllers.get(rootElement)?.abort();
    const controller = new AbortController();
    controllers.set(rootElement, controller);
    state = loadState();
    rootElement.innerHTML = buildHtml();
    const demoHost = rootElement.querySelector('[data-practice-demo-host]');
    if (demoHost && typeof root.renderGeoGebraDemo === 'function') {
      root.renderGeoGebraDemo(demoHost, { demo_type: 'geogebra_convolution', title: 'Rectangle and Triangle Convolution', teaching_role: 'exam_pattern_anchor', spec: { framework: 'geogebra', scene: 'convolution_figure_2_7', preset: 'practice-rectangle-triangle', task: 'practice-builder', scaffolding: 'practice', fallback_figure: '/figures/page-186-figure_2_10.png' } });
    }
    rootElement.addEventListener('click', (event) => {
      if (event.target.closest('[data-practice-submit]')) {
        const result = evaluateStep(state.activeStep, readAnswer(rootElement));
        const attempts = (state.attempts[state.activeStep] || 0) + (result.ok ? 0 : 1);
        if (!result.ok) {
          state.attempts[state.activeStep] = attempts;
          state.hintLevel[state.activeStep] = attempts <= 1 ? 'highlight' : attempts === 2 ? 'direction' : 'demonstration';
          const feedback = rootElement.querySelector('[data-practice-feedback]');
          feedback.dataset.feedbackLevel = state.hintLevel[state.activeStep];
          feedback.textContent = attempts >= 3 ? `Demonstration: ${result.message} Enter it, then press Check step again.` : result.message;
          if (attempts >= 3) {
            state.draft[state.activeStep] = EXPECTED[state.activeStep];
          }
          saveState();
          return;
        }
        state.completedSteps = [...new Set([...state.completedSteps, state.activeStep])];
        const nextIndex = STEPS.indexOf(state.activeStep) + 1;
        state.completed = state.completedSteps.length === STEPS.length;
        state.activeStep = state.completed ? 'sketch' : STEPS[Math.min(nextIndex, STEPS.length - 1)];
        saveState();
        render(rootElement);
        rootElement.querySelector('[data-practice-feedback]').textContent = result.message;
        root.__ftutorRefreshPager?.();
        return;
      }
      if (event.target.closest('[data-convolution-next-section]')) root.continueAfterConvolutionPractice?.();
    }, { signal: controller.signal });
  }

  function getState() { return JSON.parse(JSON.stringify(state || initialState())); }
  root.continueAfterConvolutionPractice = () => document.getElementById('learnKpNextBtn')?.click();
  root.__ftutorConvolutionPractice = Object.freeze({ buildHtml, evaluateStep, getState, mount });
})(window);
