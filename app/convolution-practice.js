// Focused semantic practice for Section 2.4-2.

(function initConvolutionPractice(root) {
  const STORAGE_KEY = 'ftutor:convolution-practice:v1';
  const DRILLS = Object.freeze([
    { id: '2.10', label: 'Drill 2.10', prompt: 'Interchange Example 2.11: keep g(τ) fixed and move x(t − τ).' },
    { id: '2.11', label: 'Drill 2.11', prompt: 'Two causal signals: e^(−t)u(t) convolved with u(t).' },
    { id: '2.12', label: 'Drill 2.12', prompt: 'Causal and anticausal signals: e^(−t)u(t) convolved with u(−t).' },
    { id: '2.13', label: 'Drill 2.13', prompt: 'Shifted signals: u(t - T) convolved with u(t + T).' },
  ]);
  const ANSWERS = Object.freeze({
    '2.10': { flips: ['x'], supportStart: '-inf', supportEnd: 'inf', breakpoints: [0], segments: ['falling', 'rising'] },
    '2.11': { flips: ['x', 'g'], supportStart: '0', supportEnd: 'inf', breakpoints: [0], segments: ['rising'] },
    '2.12': { flips: ['x', 'g'], supportStart: '-inf', supportEnd: 'inf', breakpoints: [0], segments: ['constant', 'falling'] },
    '2.13': { flips: ['x', 'g'], supportStart: '0', supportEnd: 'inf', breakpoints: [0], segments: ['rising'] },
  });
  const STATUS = Object.freeze({ untouched: 'Not Started', started: 'In Progress', mastered: 'Mastered' });
  let state = loadState();

  function blankDraft() {
    return { flip: '', supportStart: '', supportEnd: '', breakpoints: [], segments: [''] };
  }

  function initialState() {
    return {
      active: '2.10',
      drills: Object.fromEntries(DRILLS.map(drill => [drill.id, {
        status: STATUS.untouched,
        attempted: false,
        draft: blankDraft(),
      }])),
    };
  }

  function loadState() {
    const fallback = initialState();
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return fallback;
      for (const drill of DRILLS) {
        const saved = parsed.drills?.[drill.id];
        if (!saved || !Object.values(STATUS).includes(saved.status)) continue;
        fallback.drills[drill.id] = {
          status: saved.status,
          attempted: Boolean(saved.attempted),
          draft: { ...blankDraft(), ...(saved.draft || {}) },
        };
      }
      if (DRILLS.some(drill => drill.id === parsed.active)) fallback.active = parsed.active;
    } catch (_) {}
    return fallback;
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function normalizeBoundary(value) {
    const text = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
    if (['∞', '+∞', '+infinity', 'infinity', '+inf'].includes(text)) return 'inf';
    if (['-∞', '-infinity'].includes(text)) return '-inf';
    return text;
  }

  function normalizeNumbers(values) {
    return (Array.isArray(values) ? values : [])
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  }

  function equalArray(actual, expected) {
    return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
  }

  function evaluate(drillId, answer = {}) {
    const expected = ANSWERS[String(drillId || '')];
    if (!expected) return { ok: false, field: 'drill', message: 'Choose a valid drill.' };
    if (!expected.flips.includes(String(answer.flip || ''))) {
      return { ok: false, field: 'flip', message: 'Choose the signal that should be flipped first.' };
    }
    if (normalizeBoundary(answer.supportStart) !== expected.supportStart
      || normalizeBoundary(answer.supportEnd) !== expected.supportEnd) {
      return { ok: false, field: 'support', message: 'Check the first and last t values where the output can exist.' };
    }
    if (!equalArray(normalizeNumbers(answer.breakpoints), expected.breakpoints)) {
      return { ok: false, field: 'breakpoints', message: 'Check where the overlap rule changes.' };
    }
    const segments = (Array.isArray(answer.segments) ? answer.segments : []).filter(Boolean);
    if (!equalArray(segments, expected.segments)) {
      return { ok: false, field: 'segments', message: 'Check the curve type in each output interval.' };
    }
    return { ok: true, field: '', message: `${DRILLS.find(drill => drill.id === drillId)?.label || 'Drill'} mastered. The interval structure is correct.` };
  }

  function buildHtml() {
    return `
      <section class="convolution-practice-stage" data-convolution-practice-stage="true" data-convolution-practice>
        <header class="convolution-practice-heading">
          <p class="convolution-practice-kicker">PRACTICE</p>
          <h2>Build the output curve</h2>
          <p>Describe the curve by its mathematical structure. Exact drawing is not required.</p>
        </header>
        <div class="convolution-practice-builder">
          <div class="convolution-practice-drills" role="tablist" aria-label="Textbook convolution drills">
            ${DRILLS.map(drill => `
              <button type="button" role="tab" data-practice-drill="${drill.id}">
                <span>${drill.label}</span>
                <strong data-practice-status>Not Started</strong>
              </button>
            `).join('')}
          </div>
          <div class="convolution-practice-workspace">
            <div class="convolution-practice-prompt" data-practice-prompt></div>
            <fieldset class="convolution-practice-fieldset">
              <legend>1. Which signal will you flip?</legend>
              <label><input type="radio" name="convolution-practice-flip" value="x" data-practice-flip> x(t)</label>
              <label><input type="radio" name="convolution-practice-flip" value="g" data-practice-flip> g(t)</label>
            </fieldset>
            <fieldset class="convolution-practice-fieldset convolution-practice-support">
              <legend>2. What is the output support?</legend>
              <label>Starts at <input type="text" inputmode="decimal" placeholder="e.g. 0 or -inf" data-practice-support-start></label>
              <label>Ends at <input type="text" inputmode="decimal" placeholder="e.g. 4 or inf" data-practice-support-end></label>
            </fieldset>
            <fieldset class="convolution-practice-fieldset">
              <legend>3. Place the breakpoint</legend>
              <button class="convolution-breakpoint" type="button" aria-pressed="false" data-practice-breakpoint="0">t = 0</button>
            </fieldset>
            <fieldset class="convolution-practice-fieldset">
              <legend>4. Choose the curve in each interval</legend>
              <div class="convolution-curve-segment">
                <label>Segment 1
                  <select data-practice-curve-segment="0">
                    <option value="">Choose shape</option>
                    <option value="constant">Constant</option>
                    <option value="rising">Rising</option>
                    <option value="falling">Falling</option>
                  </select>
                </label>
              </div>
              <div class="convolution-curve-segment" data-practice-second-segment>
                <label>Segment 2
                  <select data-practice-curve-segment="1">
                    <option value="">Choose shape</option>
                    <option value="constant">Constant</option>
                    <option value="rising">Rising</option>
                    <option value="falling">Falling</option>
                  </select>
                </label>
              </div>
            </fieldset>
            <div class="convolution-practice-actions">
              <button type="button" class="convolution-practice-submit" data-practice-submit>Check structure</button>
              <button type="button" class="convolution-practice-hint" data-practice-hint disabled>Show hint</button>
            </div>
            <p class="convolution-practice-feedback" data-practice-feedback aria-live="polite">Complete the four choices, then check your structure.</p>
          </div>
        </div>
      </section>
    `;
  }

  function readDraft(rootElement) {
    return {
      flip: rootElement.querySelector('[data-practice-flip]:checked')?.value || '',
      supportStart: rootElement.querySelector('[data-practice-support-start]')?.value || '',
      supportEnd: rootElement.querySelector('[data-practice-support-end]')?.value || '',
      breakpoints: rootElement.querySelector('[data-practice-breakpoint]')?.getAttribute('aria-pressed') === 'true' ? [0] : [],
      segments: Array.from(rootElement.querySelectorAll('[data-practice-curve-segment]')).map(select => select.value).filter(Boolean),
    };
  }

  function renderActive(rootElement) {
    const active = DRILLS.find(drill => drill.id === state.active) || DRILLS[0];
    const saved = state.drills[active.id];
    rootElement.querySelectorAll('[data-practice-drill]').forEach(button => {
      const selected = button.dataset.practiceDrill === active.id;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.querySelector('[data-practice-status]').textContent = state.drills[button.dataset.practiceDrill].status;
    });
    rootElement.querySelector('[data-practice-prompt]').textContent = active.prompt;
    rootElement.querySelectorAll('[data-practice-flip]').forEach(input => { input.checked = input.value === saved.draft.flip; });
    rootElement.querySelector('[data-practice-support-start]').value = saved.draft.supportStart || '';
    rootElement.querySelector('[data-practice-support-end]').value = saved.draft.supportEnd || '';
    const breakpoint = rootElement.querySelector('[data-practice-breakpoint]');
    breakpoint.setAttribute('aria-pressed', String(saved.draft.breakpoints?.includes(0)));
    rootElement.querySelectorAll('[data-practice-curve-segment]').forEach((select, index) => {
      select.value = saved.draft.segments?.[index] || '';
    });
    rootElement.querySelector('[data-practice-second-segment]').hidden = ANSWERS[active.id].segments.length < 2;
    rootElement.querySelector('[data-practice-hint]').disabled = !saved.attempted;
  }

  function mount(rootElement) {
    if (!rootElement || rootElement.dataset.practiceMounted === 'true') return;
    rootElement.dataset.practiceMounted = 'true';
    renderActive(rootElement);

    rootElement.addEventListener('click', event => {
      const drillButton = event.target.closest('[data-practice-drill]');
      if (drillButton) {
        state.drills[state.active].draft = readDraft(rootElement);
        state.active = drillButton.dataset.practiceDrill;
        saveState();
        renderActive(rootElement);
        return;
      }
      const breakpoint = event.target.closest('[data-practice-breakpoint]');
      if (breakpoint) {
        breakpoint.setAttribute('aria-pressed', String(breakpoint.getAttribute('aria-pressed') !== 'true'));
        return;
      }
      if (event.target.closest('[data-practice-submit]')) {
        const current = state.drills[state.active];
        current.draft = readDraft(rootElement);
        current.attempted = true;
        const result = evaluate(state.active, current.draft);
        current.status = result.ok ? STATUS.mastered : STATUS.started;
        saveState();
        renderActive(rootElement);
        rootElement.querySelector('[data-practice-feedback]').textContent = result.message;
        window.__ftutorRefreshPager?.();
        return;
      }
      if (event.target.closest('[data-practice-hint]')) {
        const expected = ANSWERS[state.active];
        const flipHint = expected.flips.length === 1 ? expected.flips[0] : 'either signal';
        rootElement.querySelector('[data-practice-feedback]').textContent = `Hint: flip ${flipHint}, then locate support before choosing each curve segment.`;
      }
    });
  }

  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  root.__ftutorConvolutionPractice = Object.freeze({ buildHtml, evaluate, getState, mount });
})(window);
