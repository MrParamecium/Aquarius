// Three-question, one-at-a-time assessment for the graphical-convolution lesson.

(function initConvolutionExitCheck(root) {
  const QUESTIONS = Object.freeze([
    { id: 'order', label: 'Order the operations' },
    { id: 'support', label: 'Find the output support' },
    { id: 'overlap', label: 'Find the overlap at t = 0.5' },
  ]);
  const ORDER_ANSWER = ['flip', 'slide', 'multiply', 'integrate'];
  const MESSAGES = Object.freeze({
    order: 'Correct. Flip and slide create the moving signal before multiplication and integration.',
    support: 'Correct. The output can exist from t = -1 through t = 4.',
    overlap: 'Correct. At t = 0.5, the overlap runs from 0 to 1.5.',
  });
  let activeRoot = null;
  let state = null;
  let completionDispatched = false;
  const controllers = new WeakMap();

  function initialState() {
    return { currentQuestion: 1, attempts: {}, answers: {}, completed: false };
  }

  function feedbackLevel(attempts) {
    if (attempts <= 1) return 'highlight';
    if (attempts === 2) return 'direction';
    return 'demonstration';
  }

  function normalizeNumber(value) {
    const number = Number(String(value ?? '').trim());
    return Number.isFinite(number) ? number : null;
  }

  function equalNumbers(actual, expected) {
    return normalizeNumber(actual) !== null && normalizeNumber(actual) === expected;
  }

  function evaluate(id, answer) {
    const question = String(id || '').trim();
    if (question === 'order') {
      const order = Array.isArray(answer) ? answer : answer?.order;
      const ok = Array.isArray(order) && order.length === ORDER_ANSWER.length
        && order.every((value, index) => String(value) === ORDER_ANSWER[index]);
      return ok
        ? { ok: true, field: '', message: MESSAGES.order }
        : { ok: false, field: 'order', message: 'Start with Flip, then Slide, Multiply, and Integrate.' };
    }
    if (question === 'support') {
      const ok = equalNumbers(answer?.start, -1) && equalNumbers(answer?.end, 4);
      return ok
        ? { ok: true, field: '', message: MESSAGES.support }
        : { ok: false, field: 'support', message: 'Use the earliest and latest times where the moving supports can overlap.' };
    }
    if (question === 'overlap') {
      const ok = equalNumbers(answer?.start, 0) && equalNumbers(answer?.end, 1.5);
      return ok
        ? { ok: true, field: '', message: MESSAGES.overlap }
        : { ok: false, field: 'overlap', message: 'At t = 0.5, check the two moving edges before choosing the limits.' };
    }
    return { ok: false, field: 'question', message: 'Choose one of the three Exit Check questions.' };
  }

  function safeState() {
    const saved = root.getConvolutionExitCheckState?.();
    if (!saved || typeof saved !== 'object') return initialState();
    return {
      currentQuestion: Math.max(1, Math.min(QUESTIONS.length, Number(saved.currentQuestion) || 1)),
      attempts: saved.attempts && typeof saved.attempts === 'object' ? { ...saved.attempts } : {},
      answers: saved.answers && typeof saved.answers === 'object' ? { ...saved.answers } : {},
      completed: Boolean(saved.completed),
    };
  }

  function save() {
    root.setConvolutionExitCheckState?.(state);
  }

  function questionHtml(question) {
    if (question.id === 'order') {
      return `<fieldset data-exit-question="order"><legend>Put the four graphical steps in order.</legend>
        <div class="convolution-exit-order" data-exit-order-list>
          ${ORDER_ANSWER.map((_, index) => `<label>Step ${index + 1}<select data-exit-order-select><option value="">Choose step</option>${ORDER_ANSWER.map(id => `<option value="${id}">${id[0].toUpperCase()}${id.slice(1)}</option>`).join('')}</select></label>`).join('')}
        </div>
      </fieldset>`;
    }
    if (question.id === 'support') {
      return `<fieldset data-exit-question="support"><legend>For Figure 2.7, find the output support.</legend>
        <label>Starts at <input data-exit-support-start inputmode="decimal" placeholder="-1"></label>
        <label>Ends at <input data-exit-support-end inputmode="decimal" placeholder="4"></label>
      </fieldset>`;
    }
    return `<fieldset data-exit-question="overlap"><legend>At t = 0.5, choose the overlap limits.</legend>
      <label>Starts at <input data-exit-overlap-start inputmode="decimal" placeholder="0"></label>
      <label>Ends at <input data-exit-overlap-end inputmode="decimal" placeholder="1.5"></label>
    </fieldset>`;
  }

  function buildHtml() {
    state ||= initialState();
    const question = QUESTIONS[state.currentQuestion - 1] || QUESTIONS[0];
    return `<section class="convolution-exit-check" data-convolution-exit-check data-convolution-task-ready="${state.completed ? 'true' : 'false'}">
      <header><p class="convolution-exit-kicker">EXIT CHECK</p><h3>${question.label}</h3><p>One focused check before you move on.</p></header>
      <div class="convolution-exit-progress" aria-label="Exit Check progress">
        ${QUESTIONS.map((item, index) => `<span data-exit-progress="${index + 1}"${index + 1 === state.currentQuestion ? ' aria-current="step"' : ''}></span>`).join('')}
      </div>
      <div data-exit-question-host>${state.completed ? '<p class="convolution-exit-complete-copy">All three checks are complete.</p>' : questionHtml(question)}</div>
      <div class="convolution-exit-actions">
        <button type="button" class="convolution-practice-submit" data-exit-submit${state.completed ? ' hidden' : ''}>Check answer</button>
        <button type="button" class="convolution-practice-hint" data-exit-reset${state.completed ? '' : ' hidden'}>Review again</button>
      </div>
      <p class="convolution-exit-feedback" data-exit-feedback data-feedback-level="" aria-live="polite">${state.completed ? 'You are ready for the next step.' : 'Make your choice, then check it.'}</p>
    </section>`;
  }

  function render() {
    if (!activeRoot) return;
    activeRoot.innerHTML = buildHtml();
    if (state.completed && !completionDispatched) {
      completionDispatched = true;
      activeRoot.dispatchEvent(new CustomEvent('convolution-exit-check-complete', { bubbles: true, detail: { completed: true } }));
    }
  }

  function readAnswer() {
    const question = QUESTIONS[state.currentQuestion - 1]?.id;
    if (question === 'order') {
      return { order: Array.from(activeRoot.querySelectorAll('[data-exit-order-select]')).map(select => select.value) };
    }
    if (question === 'support') {
      return {
        start: activeRoot.querySelector('[data-exit-support-start]')?.value,
        end: activeRoot.querySelector('[data-exit-support-end]')?.value,
      };
    }
    return {
      start: activeRoot.querySelector('[data-exit-overlap-start]')?.value,
      end: activeRoot.querySelector('[data-exit-overlap-end]')?.value,
    };
  }

  function submit() {
    const question = QUESTIONS[state.currentQuestion - 1];
    const result = evaluate(question.id, readAnswer());
    const attempts = (state.attempts[question.id] || 0) + (result.ok ? 0 : 1);
    if (!result.ok) {
      state.attempts[question.id] = attempts;
      save();
      const feedback = activeRoot.querySelector('[data-exit-feedback]');
      feedback.dataset.feedbackLevel = feedbackLevel(attempts);
      feedback.textContent = attempts <= 1
        ? 'Recheck the highlighted field.'
        : attempts === 2
          ? result.message
          : `Demonstration: ${result.message}`;
      activeRoot.querySelector(`[data-exit-question="${question.id}"]`)?.setAttribute('data-feedback-level', feedbackLevel(attempts));
      return result;
    }
    state.answers[question.id] = readAnswer();
    state.attempts[question.id] = attempts;
    if (state.currentQuestion < QUESTIONS.length) state.currentQuestion += 1;
    else state.completed = true;
    save();
    render();
    const feedback = activeRoot.querySelector('[data-exit-feedback]');
    if (feedback) feedback.textContent = result.message;
    window.__ftutorRefreshPager?.();
    return result;
  }

  function mount(host) {
    if (!host) return;
    controllers.get(host)?.abort();
    const controller = new AbortController();
    controllers.set(host, controller);
    activeRoot = host;
    state = safeState();
    completionDispatched = false;
    render();
    host.addEventListener('click', (event) => {
      if (event.target.closest('[data-exit-submit]')) submit();
      if (event.target.closest('[data-exit-reset]')) {
        state = initialState();
        save();
        render();
      }
    }, { signal: controller.signal });
  }

  function getState() { return JSON.parse(JSON.stringify(state || initialState())); }

  root.__ftutorConvolutionExitCheck = Object.freeze({
    QUESTIONS,
    buildHtml,
    evaluate,
    feedbackLevel,
    getState,
    mount,
  });
})(window);
