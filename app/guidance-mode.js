/*
 * Optional per-turn teaching-path guidance for the main and lesson Q&A flows.
 * Only the enabled flag is persisted. Options and selections live in memory.
 */
'use strict';

(function attachGuidanceMode(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory;
    return;
  }
  root.guidanceMode = factory({
    document: root.document,
    storage: (() => {
      try { return root.localStorage; } catch (_) { return null; }
    })(),
    request: (path, options) => apiFetch(path, options),
  });
}(typeof globalThis !== 'undefined' ? globalThis : this, function createGuidanceMode(deps = {}) {
  const doc = deps.document || null;
  const storage = deps.storage || null;
  const request = deps.request;
  const storageKey = 'aquarius-guidance-enabled-v1';
  const scopes = {
    main: { selected: null },
    learn: { selected: null },
  };
  let enabled = false;
  let state = 'closed';
  let activeRequest = null;

  try { enabled = storage && storage.getItem(storageKey) === '1'; } catch (_) {}
  state = enabled ? 'waiting' : 'closed';

  function copy() {
    return {
      loadingTitle: 'Preparing teaching paths',
      loadingBody: 'Searching the full textbook before offering distinct ways to explain this.',
      title: 'How should I explain this?',
      empty: 'No direct textbook match was found. These paths are based on your question only.',
      skip: 'Skip and answer now',
      cancel: 'Cancel',
      retry: 'Retry',
      errorTitle: 'Guidance failed',
      stage: 'Stage',
      request: 'Request ID',
      clear: 'Clear this teaching path',
      selected: 'Teaching path',
      cancelled: 'Cancelled. Your question is still in the input.',
    };
  }

  function setText(parent, tag, className, value) {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    parent.appendChild(element);
    return element;
  }

  function scopeState(scope) {
    return scopes[scope] || scopes.main;
  }

  function syncUi() {
    if (!doc) return;
    doc.querySelectorAll('[data-guidance-toggle]').forEach((button) => {
      const scope = button.dataset.guidanceScope === 'learn' ? 'learn' : 'main';
      const selected = scopeState(scope).selected;
      button.classList.toggle('active', enabled);
      button.classList.toggle('guidance-on', enabled);
      button.classList.toggle('has-selection', Boolean(enabled && selected));
      button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      button.setAttribute('aria-label', enabled ? 'Guided: On' : 'Guided: Off');
      button.title = enabled
        ? 'Get hints and step-by-step prompts · Guidance: On'
        : 'Get hints and step-by-step prompts · Guidance: Off';
    });

    doc.querySelectorAll('.guidance-path-chip').forEach(node => node.remove());
    if (!enabled) return;
    doc.querySelectorAll('[data-guidance-toggle]').forEach((button) => {
      const scope = button.dataset.guidanceScope === 'learn' ? 'learn' : 'main';
      const selected = scopeState(scope).selected;
      if (!selected || !button.parentNode) return;
      const chip = doc.createElement('span');
      chip.className = 'guidance-path-chip';
      chip.dataset.guidanceScope = scope;
      chip.title = selected.title;
      setText(chip, 'span', 'guidance-path-chip-label', selected.title);
      const clearButton = doc.createElement('button');
      clearButton.type = 'button';
      clearButton.className = 'guidance-path-chip-clear';
      clearButton.setAttribute('aria-label', copy().clear);
      clearButton.textContent = '\u00d7';
      clearButton.addEventListener('click', (event) => {
        event.stopPropagation();
        clearSelection(scope);
      });
      chip.appendChild(clearButton);
      button.insertAdjacentElement('afterend', chip);
    });
  }

  function abortCurrent(reason = 'cancelled') {
    if (!activeRequest) return;
    const current = activeRequest;
    activeRequest = null;
    current.controller.abort();
    if (current.externalSignal && current.onExternalAbort) {
      current.externalSignal.removeEventListener('abort', current.onExternalAbort);
    }
    current.resolve({ status: 'cancelled', guidance: null, reason });
    state = enabled ? 'waiting' : 'closed';
  }

  function clearSelection(scope) {
    scopeState(scope).selected = null;
    if (!activeRequest) state = enabled ? 'waiting' : 'closed';
    syncUi();
  }

  function resetScope(scope) {
    if (activeRequest && activeRequest.scope === scope) abortCurrent('scope_reset');
    clearSelection(scope);
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    try {
      if (storage) storage.setItem(storageKey, enabled ? '1' : '0');
    } catch (_) {}
    if (!enabled) {
      abortCurrent('disabled');
      scopes.main.selected = null;
      scopes.learn.selected = null;
      state = 'closed';
    } else {
      state = 'waiting';
    }
    syncUi();
  }

  function renderLoading(mount, language) {
    const words = copy(language);
    mount.replaceChildren();
    const panel = doc.createElement('section');
    panel.className = 'guidance-panel guidance-loading';
    panel.setAttribute('aria-live', 'polite');
    const heading = doc.createElement('div');
    heading.className = 'guidance-heading';
    const spinner = doc.createElement('span');
    spinner.className = 'guidance-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    heading.appendChild(spinner);
    setText(heading, 'strong', '', words.loadingTitle);
    panel.appendChild(heading);
    setText(panel, 'p', 'guidance-copy', words.loadingBody);
    mount.appendChild(panel);
  }

  function renderCancelled(mount, language) {
    mount.replaceChildren();
    setText(mount, 'p', 'guidance-cancelled', copy(language).cancelled);
  }

  function addAction(actions, label, className, handler) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', handler);
    actions.appendChild(button);
  }

  function settle(current, result) {
    if (activeRequest !== current) return;
    activeRequest = null;
    if (current.externalSignal && current.onExternalAbort) {
      current.externalSignal.removeEventListener('abort', current.onExternalAbort);
    }
    current.resolve(result);
  }

  function renderChoices(current, data) {
    if (activeRequest !== current) return;
    const words = copy(current.language);
    const mount = current.mount;
    mount.replaceChildren();
    const panel = doc.createElement('section');
    panel.className = 'guidance-panel guidance-choices';
    panel.setAttribute('aria-label', words.title);
    setText(panel, 'h3', 'guidance-title', words.title);
    if (data.status === 'empty') setText(panel, 'p', 'guidance-empty-note', words.empty);
    const list = doc.createElement('div');
    list.className = 'guidance-option-list';
    data.options.forEach((option) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'guidance-option';
      setText(button, 'strong', 'guidance-option-title', option.title);
      setText(button, 'span', 'guidance-option-description', option.description);
      const arrow = setText(button, 'span', 'guidance-option-arrow', '\u2192');
      arrow.setAttribute('aria-hidden', 'true');
      button.addEventListener('click', () => {
        const selected = { id: option.id, title: option.title, instruction: option.instruction };
        scopeState(current.scope).selected = selected;
        state = 'answering';
        syncUi();
        settle(current, { status: 'selected', guidance: selected, requestId: data.request_id || '' });
      });
      list.appendChild(button);
    });
    panel.appendChild(list);
    const actions = doc.createElement('div');
    actions.className = 'guidance-actions';
    addAction(actions, words.skip, 'guidance-action guidance-action-primary', () => {
      state = 'answering';
      settle(current, { status: 'skipped', guidance: null, requestId: data.request_id || '' });
    });
    addAction(actions, words.cancel, 'guidance-action', () => {
      renderCancelled(mount, current.language);
      state = 'waiting';
      settle(current, { status: 'cancelled', guidance: null, requestId: data.request_id || '' });
    });
    panel.appendChild(actions);
    mount.appendChild(panel);
    state = 'choosing';
  }

  function renderError(current, error) {
    if (activeRequest !== current) return;
    const words = copy(current.language);
    const mount = current.mount;
    mount.replaceChildren();
    const panel = doc.createElement('section');
    panel.className = 'guidance-panel guidance-error';
    panel.setAttribute('role', 'alert');
    setText(panel, 'h3', 'guidance-title', words.errorTitle);
    setText(panel, 'p', 'guidance-copy', error.message || words.errorTitle);
    const meta = doc.createElement('dl');
    meta.className = 'guidance-error-meta';
    setText(meta, 'dt', '', words.stage);
    setText(meta, 'dd', '', error.stage || 'generation');
    setText(meta, 'dt', '', words.request);
    setText(meta, 'dd', '', error.requestId || '-');
    panel.appendChild(meta);
    const actions = doc.createElement('div');
    actions.className = 'guidance-actions';
    addAction(actions, words.retry, 'guidance-action guidance-action-primary', () => runRequest(current));
    addAction(actions, words.skip, 'guidance-action', () => {
      state = 'answering';
      settle(current, { status: 'skipped', guidance: null, requestId: error.requestId || '' });
    });
    addAction(actions, words.cancel, 'guidance-action', () => {
      renderCancelled(mount, current.language);
      state = 'waiting';
      settle(current, { status: 'cancelled', guidance: null, requestId: error.requestId || '' });
    });
    panel.appendChild(actions);
    mount.appendChild(panel);
    state = 'error';
  }

  function validateResponse(data) {
    if (!data || !['hit', 'empty'].includes(data.status) || !Array.isArray(data.options)) {
      throw new Error('Invalid guidance response');
    }
    if (data.options.length < 2 || data.options.length > 3) throw new Error('Invalid guidance option count');
    data.options.forEach((option) => {
      if (!option || !/^path_[1-3]$/.test(option.id) || !option.title || !option.description || !option.instruction) {
        throw new Error('Invalid guidance option');
      }
    });
    return data;
  }

  async function runRequest(current) {
    if (activeRequest !== current) return;
    state = 'generating';
    renderLoading(current.mount, current.language);
    try {
      const response = await request('/api/ask-guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: current.controller.signal,
        body: JSON.stringify(current.payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || `HTTP ${response.status}`);
        error.stage = data.stage || 'generation';
        error.requestId = data.request_id || '';
        throw error;
      }
      renderChoices(current, validateResponse(data));
    } catch (error) {
      if (activeRequest !== current) return;
      if (error.name === 'AbortError') {
        renderCancelled(current.mount, current.language);
        state = enabled ? 'waiting' : 'closed';
        settle(current, { status: 'cancelled', guidance: null, reason: 'aborted' });
        return;
      }
      renderError(current, {
        message: error.message,
        stage: error.stage || 'generation',
        requestId: error.requestId || '',
      });
    }
  }

  function requestChoice({ scope = 'main', payload = {}, mount, signal = null } = {}) {
    if (!enabled) return Promise.resolve({ status: 'disabled', guidance: null });
    const existing = scopeState(scope).selected;
    if (existing) return Promise.resolve({ status: 'selected', guidance: existing, reused: true });
    if (!doc || !mount || typeof request !== 'function') {
      return Promise.reject(new Error('Guidance UI is unavailable'));
    }
    abortCurrent('superseded');
    return new Promise((resolve) => {
      const current = {
        scope,
        payload,
        mount,
        language: payload.language === 'zh' ? 'zh' : 'en',
        controller: new AbortController(),
        externalSignal: signal,
        onExternalAbort: null,
        resolve,
      };
      if (signal) {
        current.onExternalAbort = () => {
          if (activeRequest === current) abortCurrent('external_abort');
        };
        if (signal.aborted) {
          resolve({ status: 'cancelled', guidance: null, reason: 'external_abort' });
          return;
        }
        signal.addEventListener('abort', current.onExternalAbort, { once: true });
      }
      activeRequest = current;
      runRequest(current);
    });
  }

  function markDone() {
    if (!activeRequest) state = enabled ? 'done' : 'closed';
  }

  function init() {
    if (!doc) return;
    doc.querySelectorAll('[data-guidance-toggle]').forEach((button) => {
      if (button.dataset.guidanceBound === 'true') return;
      button.dataset.guidanceBound = 'true';
      button.addEventListener('click', () => setEnabled(!enabled));
    });
    syncUi();
  }

  function getSnapshot() {
    return {
      enabled,
      state,
      mainSelection: scopes.main.selected ? { ...scopes.main.selected } : null,
      learnSelection: scopes.learn.selected ? { ...scopes.learn.selected } : null,
      hasActiveRequest: Boolean(activeRequest),
    };
  }

  return {
    init,
    isEnabled: () => enabled,
    setEnabled,
    requestChoice,
    getSelection: scope => scopeState(scope).selected,
    clearSelection,
    resetScope,
    abortCurrent,
    markDone,
    getSnapshot,
  };
}));
