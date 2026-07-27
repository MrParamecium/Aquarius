// interactive-demos/dispatcher — the orchestration spine of the demo
// subsystem. Pulled out of app.js in Phase 3 Step G.1 (Phase 2 #18 part 1)
// so that app.js drops the ~550 lines of demo dispatcher + spec helpers
// + lab-shell + Laplace-flow + stem-axes infrastructure.
//
// Loaded as a classic <script> AFTER every family module (so that
// INTERACTIVE_DEMO_FAMILY_RENDERERS can resolve `renderXxxFallback` /
// `renderXxxLabDemo` free names at module-eval time) and BEFORE app.js
// (so app.js's event handlers can call hydrateInteractiveDemos as a
// free name). All names below are script-global free-name conventions —
// no IIFE wrapper, no module.exports.
//
// Public free-name surface consumed by app.js + family modules:
//   - hydrateInteractiveDemos(root)                 (called by app.js event handlers)
//   - inferInteractiveDemoFamily(demo)              (also attached to window for visual-diff.js)
//   - getInteractiveDemoSpec / Text / Title / Subtitle
//   - getInteractiveDemoDedupKey / Intent
//   - formatInteractiveDemoNumber / fmt
//   - getDemoControlValue / normalizeInteractiveDemoControl
//   - setupInteractiveDemoCanvas / drawInteractiveDemoAxes / drawDemoStemSeries
//   - renderInteractiveLabShell / renderLaplaceFlowTransformDemo / isLaplaceFlowTransformDemo
//   - CHAPTER_ONE_DEMO_TYPES / inferChapterOneDemoType
//   - INTERACTIVE_DEMO_FAMILY_RENDERERS
//
// External free-names dispatcher.js reaches at call time (defined in app.js):
//   - parseBase64JsonAttr, compactWhitespace, escapeHtml, decodeInlineMarkdownFragment
//   - hydrateChapterOneDemo, renderOppositeRotationsDemo
//   - renderComplexPlaneDemo, renderSinusoidPhasorDemo, renderPhasorDemo,
//     renderMatrixConformabilityDemo, renderBriefDemoFallback
//   - All renderXxxFallback / renderXxxLabDemo family functions
// External free-names dispatcher.js reaches from helpers.js:
//   - applyCanvasDpr (used by setupInteractiveDemoCanvas)

function getDemoControlValue(control, state) {
  const raw = state[control.key];
  const num = Number(raw);
  return Number.isFinite(num) ? num : Number(control.default ?? control.min ?? 1);
}

function fmt(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return Number((Math.abs(num) < 1e-9 ? 0 : num).toFixed(digits)).toString();
}

const CHAPTER_ONE_DEMO_TYPES = new Set([
  'energy_cross_term',
  'step_window_composer',
  'impulse_unit_area_limit',
  'impulse_sifting',
  'invertibility_tester'
]);

function inferChapterOneDemoType(demo = {}) {
  const explicit = demo.demo_type || demo.demo_spec?.demo_type || '';
  if (explicit) return explicit;
  const spec = demo.spec || demo.demo_spec || {};
  const text = [
    demo.title,
    demo.explanation,
    demo.content,
    spec.description,
    spec.note_below_demo,
    JSON.stringify(spec.pulse_formulas || {})
  ].filter(Boolean).join(' ');
  if (/impulse/i.test(text) && /unit[-\s]?area|pulse|rectangular|triangular|gaussian|exponential/i.test(text)) {
    return 'impulse_unit_area_limit';
  }
  return '';
}

function getInteractiveDemoSpec(demo = {}) {
  return demo.demo_spec || demo.spec || {};
}

function slugifyInteractiveDemoKey(value = '') {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'control';
}

function getInteractiveDemoText(demo = {}) {
  const spec = getInteractiveDemoSpec(demo);
  const mode = demo.mode_specific_visual_use || {};
  return [
    demo.title,
    demo.demo_title,
    demo.explanation,
    demo.content,
    demo.caption,
    demo.student_prompt,
    demo.student_instruction,
    demo.student_task,
    demo.observation_note,
    demo.purpose,
    demo.page_title,
    demo.code,
    demo.component_code,
    demo.react_code,
    demo.demo_code,
    spec.title,
    spec.description,
    spec.note_below_demo,
    spec.note_below_canvas,
    spec.student_prompt,
    spec.student_task_prompt,
    spec.what_to_notice,
    spec.observation_prompt,
    JSON.stringify(spec || {}),
    JSON.stringify(mode || {})
  ].filter(Boolean).join(' ');
}

function getInteractiveDemoTitle(demo = {}, fallback = 'Interactive demo') {
  const spec = getInteractiveDemoSpec(demo);
  return compactWhitespace(demo.title || demo.demo_title || spec.title || demo.page_title || fallback);
}

function getInteractiveDemoSubtitle(demo = {}) {
  const spec = getInteractiveDemoSpec(demo);
  const mode = demo.mode_specific_visual_use || {};
  return compactWhitespace(
    demo.explanation
    || demo.content
    || demo.caption
    || demo.student_prompt
    || demo.student_instruction
    || spec.description
    || spec.student_prompt
    || spec.student_task_prompt
    || mode.standard
    || mode.cram
    || ''
  );
}

function normalizeInteractiveDemoControl(control = {}) {
  const key = control.key
    || control.id
    || control.param
    || control.name
    || slugifyInteractiveDemoKey(control.label || control.title || control.value || 'control');
  return { ...control, key };
}

function inferInteractiveDemoFamily(demo = {}) {
  const title = getInteractiveDemoTitle(demo, '');
  const text = getInteractiveDemoText(demo).toLowerCase();
  const spec = getInteractiveDemoSpec(demo);
  const frame = String(spec.framework || demo.framework || '').toLowerCase();
  const combinedText = `${title} ${text}`.toLowerCase();
  const hasLaplaceFlowIntent = /\b(visual recipe|three[-\s]?box flow|time domain to s[-\s]?domain|s[-\s]?domain and back|laplace[-\s]?domain multiplication|transforming x\(t\)|multiply(?:ing)? by h\(s\)|inverse[-\s]?(?:laplace[-\s]?)?transform|x\(s\)\s*h\(s\)|y\(s\)\s*=\s*x\(s\)\s*h\(s\)|canonical transfer functions|ideal delay|ideal differentiator|ideal integrator)\b/i.test(combinedText);
  const hasZTransformPropertyIntent = /\b(gamma\^n|multiplying by.*gamma|replacing.*z.*z\/gamma|reflect the sequence|invert z|z\/gamma|1\/z|z-transform property|time reversal property|exponential weighting)\b/i.test(combinedText);
  const hasSinusoidalSystemIntent = /\b(causal sinusoid through a stable ltic system|sinusoid.*stable ltic|steady[-\s]?state sinusoid|amplitude.*phase.*sinusoid|h\(j\\?omega\))\b/i.test(combinedText);
  const hasPoleRocIntent = /\b(roc|region of convergence|pole[-\s]?zero|poles?\s+and\s+zeros?|zeros?\s+and\s+poles?|root location|stability tester|stable pole|pole location|causal\s*\/\s*(?:right|outside)|anti[-\s]?causal\s*\/\s*(?:left|inside)|inside\s+the\s+unit\s+circle|outside\s+the\s+unit\s+circle)\b/i.test(combinedText);
  const hasTransformRuleIntent = /\b(z[-\s]?transform|z[-\s]?domain|laplace|s[-\s]?domain|transfer function|h\[z\]|x\[z\]|y\[z\]|block diagram|realization|direct form|op[-\s]?amp|transform[-\s]?scale|time integration|running area|time scaling|delay factor|frequency shifting)\b/i.test(combinedText);

  if (frame === 'geogebra') {
    return 'geogebra';
  }
  if (/\b(convol|sliding overlap|reverse.*shift.*multiply|overlap.*sum)\b/i.test(combinedText)) {
    return 'convolution_lab';
  }
  if (hasSinusoidalSystemIntent || /\b(bode|frequency response|filter|lowpass|low[-\s]?pass|highpass|high[-\s]?pass|bandpass|band[-\s]?pass|notch|butterworth|chebyshev|ripple|cutoff|prewarp|frequency folding|phase reversal|unit circle.*frequency)\b/i.test(combinedText)) {
    return 'frequency_response_lab';
  }
  if (hasLaplaceFlowIntent || hasZTransformPropertyIntent) {
    return 'transform_rule_lab';
  }
  if (/\b(difference equation|recurrence|recursive|impulse response|h\[n\]|zero[-\s]?state|zero[-\s]?input|characteristic mode|resonance|mode matching|unit sample|delta selector|gamma\^n|a\^n)\b/i.test(combinedText) && !hasPoleRocIntent) {
    return 'sequence_system_lab';
  }
  if (hasPoleRocIntent) {
    return 'pole_zero_roc_lab';
  }
  if (hasTransformRuleIntent) {
    return 'transform_rule_lab';
  }
  if (/\b(difference equation|recurrence|recursive|impulse response|h\[n\]|zero[-\s]?state|zero[-\s]?input|characteristic mode|resonance|mode matching)\b/i.test(combinedText)) {
    return 'sequence_system_lab';
  }

  if (demo.demo_type === 'matrix_multiplication_conformability'
    || /matrix multiplication conformability|matrix size compatibility|inner dimensions|rows of a.*rows of b|product c = ab/i.test(combinedText)) {
    return 'matrix_conformability';
  }
  if (/matrix size and entry locator|matrix entry locator|a_{ij}|row index|column index|entry locator/i.test(combinedText)) {
    return 'matrix_locator';
  }
  if (/point-by-point multiplication|point by point multiplication|sample-by-sample|element-by-element|vector orientation|dimension mismatch/i.test(combinedText)) {
    return 'pointwise_multiplication';
  }
  if (/watch energy grow but power settle|running energy|average power|energy vs power|energy signal|power signal|rectangular approximation of signal energy|classifier/i.test(combinedText)) {
    return 'energy_power';
  }
  if (/sampling a continuous-time signal|sampling time|quantizing amplitude|discrete-time|analog|digital|sample stems|sampled continuous-time/i.test(combinedText)) {
    return 'sampling_quantization';
  }
  if (/superposition|time-invariance|time invariance|causality|bibo|invertibility|recover the input|delay-then-system|system-then-delay|time-shift tester/i.test(combinedText)) {
    return 'system_property';
  }
  if (/dc motor|parameter response|motor parameter|inertia|damping|drive strength|step response/i.test(combinedText)) {
    return 'parameter_response';
  }
  if (/time constant|decay and growth controlled by a|exponential time constant|complex exponential|envelope-controlled sinusoid|decay|growth|e\^\(st\)|e\^st|sigma|omega|damped/i.test(combinedText)) {
    return 'exponential_envelope';
  }
  if (/opposite rotations create sine and cosine|e\^\{?j\\?phi|e\^\{-j\\?phi|conjugate rotations/i.test(combinedText)) {
    return 'opposite_rotations';
  }
  if (/rotating vector|sine and cosine|phasor|complex plane|polar form|rectangular form|quadrant-safe phase|same frequency/i.test(combinedText) || frame.includes('react_canvas')) {
    if (/complex plane|polar form|rectangular form/i.test(combinedText)) return 'complex_plane';
    return 'sinusoid';
  }
  if (/time scaling|mirror the signal|time reflection|shift-test|does the shift match|move and flip the unit step|explore y\(t\)\s*=\s*x\(at-b\)|explore g\(at\+b\)|y\(t\)\s*=\s*x\(at-b\)|unit step|window|landmark|periodicity|shift|reflection/i.test(combinedText)) {
    return 'signal_transform';
  }
  if (/clearing fractions|repeated-factor|fraction expansion|term ladder|partial fractions|matrix locator|point-by-point/i.test(combinedText)) {
    return 'algebra_brief';
  }
  return 'brief';
}
// Exposed for tools/visual-diff.js family-verification eval — do not remove
// without updating tools/test-utils.js / tools/visual-diff.js.
window.inferInteractiveDemoFamily = inferInteractiveDemoFamily;

function setupInteractiveDemoCanvas(canvas, ctx, height = 260, minWidth = 320) {
  if (!canvas || !ctx) return { width: 0, height: 0 };
  const width = Math.max(Math.floor(canvas.parentElement?.clientWidth || canvas.clientWidth || 0), minWidth);
  const sized = applyCanvasDpr(canvas, ctx, width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  return sized;
}


function drawInteractiveDemoAxes(ctx, width, height, options = {}) {
  const pad = options.pad ?? 42;
  const minT = options.minT ?? -4;
  const maxT = options.maxT ?? 6;
  const originY = options.originY ?? Math.round(height * 0.68);
  const toX = (t) => pad + ((t - minT) / (maxT - minT)) * (width - pad * 2);
  ctx.strokeStyle = options.axisColor || '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, originY);
  ctx.lineTo(width - pad, originY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pad, 18);
  ctx.lineTo(pad, height - 30);
  ctx.stroke();
  ctx.fillStyle = options.labelColor || '#64748b';
  ctx.font = '600 12px Quicksand, sans-serif';
  ctx.textAlign = 'center';
  for (let t = minT; t <= maxT; t += options.tickStep ?? 2) {
    const x = toX(t);
    ctx.beginPath();
    ctx.moveTo(x, originY - 4);
    ctx.lineTo(x, originY + 4);
    ctx.stroke();
    ctx.fillText(String(t), x, originY + 18);
  }
  return { toX, originY, minT, maxT, pad };
}
const INTERACTIVE_DEMO_FAMILY_RENDERERS = {
  signal_transform: renderSignalTransformFallback,
  energy_power: renderEnergyPowerFallback,
  sampling_quantization: renderSamplingQuantizationFallback,
  system_property: renderSystemPropertyFallback,
  exponential_envelope: renderExponentialEnvelopeFallback,
  matrix_locator: renderMatrixLocatorFallback,
  parameter_response: renderParameterResponseFallback,
  pointwise_multiplication: renderPointwiseMultiplicationFallback,
  geogebra: renderGeoGebraDemo,
  convolution_lab: renderConvolutionLabDemo,
  pole_zero_roc_lab: renderPoleZeroRocLabDemo,
  frequency_response_lab: renderFrequencyResponseLabDemo,
  transform_rule_lab: renderTransformRuleLabDemo,
  sequence_system_lab: renderSequenceSystemLabDemo,
};

// Interactive-demo dispose lifecycle contract (SP-1/PH-6). Renderers that own
// teardown-worthy resources (rAF loops, window listeners, observers) register a
// cleanup via window.__ftutorRegisterInteractiveDemoCleanup; the app calls
// teardownInteractiveDemos(container) BEFORE any innerHTML replace, so those
// resources are cancelled deterministically instead of being orphaned when the
// node detaches (the pre-existing `if (!node.isConnected) return` self-heal is
// racy and cannot stop a window-level listener).
function registerInteractiveDemoCleanup(node, fn) {
  if (!node || typeof fn !== 'function') return;
  (node.__demoCleanups = node.__demoCleanups || []).push(fn);
}
function disposeInteractiveDemo(node) {
  if (!node) return;
  (node.__demoCleanups || []).forEach((fn) => { try { fn(); } catch (_) {} });
  node.__demoCleanups = [];
  if (node.dataset) delete node.dataset.hydrated;
}
function teardownInteractiveDemos(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  let n = 0;
  root.querySelectorAll('.kc-interactive-demo').forEach((node) => {
    if (node.__demoCleanups || (node.dataset && node.dataset.hydrated === '1')) {
      disposeInteractiveDemo(node);
      n += 1;
    }
  });
  return n;
}
window.__ftutorRegisterInteractiveDemoCleanup = registerInteractiveDemoCleanup;
window.__ftutorTeardownInteractiveDemos = teardownInteractiveDemos;

function hydrateInteractiveDemos(root) {
  if (!root) return;
  const seenDemoKeys = new Set();
  root.querySelectorAll('.kc-interactive-demo').forEach((node) => {
    if (!node || node.dataset.hydrated === '1') return;
    const demo = parseBase64JsonAttr(node.dataset.demoB64 || node.getAttribute('data-demo-b64'));
    if (!demo) return;
    const dedupKey = getInteractiveDemoDedupKey(demo);
    if (dedupKey && seenDemoKeys.has(dedupKey)) {
      node.remove();
      return;
    }
    if (dedupKey) seenDemoKeys.add(dedupKey);

    const demoSpec = getInteractiveDemoSpec(demo);
    const family = inferInteractiveDemoFamily(demo);
    const isMatrixDemo = family === 'matrix_conformability';
    const specControls = Array.isArray(demoSpec.controls) ? demoSpec.controls : [];
    const demoControls = specControls.length ? specControls : (Array.isArray(demo.controls) ? demo.controls : []);
    const demoText = getInteractiveDemoText(demo);
    const isComplexPlaneDemo = demo.type === 'interactive_demo'
      && demoSpec
      && String(demoSpec.framework || '').toLowerCase() === 'react_canvas'
      && demoControls.some((control) => (control.id || control.key) === 'slider_a')
      && demoControls.some((control) => (control.id || control.key) === 'slider_b')
      && /complex number|rectangular|polar|complex plane/i.test(demoText)
      && !/sinusoid|same frequency|cosine wave|phasor sum/i.test(demoText);
    const isPhasorDemo = !isComplexPlaneDemo
      && demo.type === 'interactive_demo'
      && demoSpec
      && String(demoSpec.framework || '').toLowerCase() === 'react_canvas'
      && Array.isArray(demoSpec.panels)
      && demoSpec.panels.some((panel) => panel.id === 'phasor_panel');
    const isSinusoidDemo = demo.demo_type === 'sinusoid_phasor_projection'
      || (demo.type === 'interactive_demo'
        && /sinusoid/i.test(demoText)
        && /phasor|amplitude|frequency|phase/i.test(demoText));
    const isOppositeRotationDemo = family === 'opposite_rotations';
    const chapterOneDemoType = inferChapterOneDemoType(demo);
    const isChapterOneDemo = CHAPTER_ONE_DEMO_TYPES.has(chapterOneDemoType);

    node.dataset.hydrated = '1';

    if (isChapterOneDemo) {
      hydrateChapterOneDemo(node, demo);
      return;
    }

    if (isOppositeRotationDemo) {
      renderOppositeRotationsDemo(node, demo);
      return;
    }

    if (isComplexPlaneDemo) {
      renderComplexPlaneDemo(node, demo, demoControls);
      return;
    }

    if (isSinusoidDemo) {
      renderSinusoidPhasorDemo(node, demo, demoControls);
      return;
    }

    if (isPhasorDemo) {
      renderPhasorDemo(node, demo, demoControls, demoSpec);
      return;
    }

    const familyRenderer = INTERACTIVE_DEMO_FAMILY_RENDERERS[family];
    if (familyRenderer) {
      familyRenderer(node, demo);
      return;
    }

    if (!isMatrixDemo) {
      renderBriefDemoFallback(node, demo, family);
      return;
    }

    renderMatrixConformabilityDemo(node, demo, demoControls);
  });
}

function formatInteractiveDemoNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  const clean = Math.abs(num) < 1e-9 ? 0 : num;
  return Number(clean.toFixed(digits)).toString();
}

function getInteractiveDemoIntent(demo = '') {
  return `${getInteractiveDemoTitle(demo, '')} ${getInteractiveDemoText(demo)}`.toLowerCase();
}

function getInteractiveDemoDedupKey(demo = {}) {
  const spec = getInteractiveDemoSpec(demo);
  const pieces = [
    getInteractiveDemoTitle(demo, ''),
    getInteractiveDemoSubtitle(demo),
    demo.page_title,
    demo.caption,
    demo.student_prompt,
    spec.title,
    spec.description,
    spec.note_below_demo,
    spec.student_prompt,
    JSON.stringify(spec.controls || demo.controls || []),
    JSON.stringify(spec.canvas_elements || demo.canvas_elements || []),
    JSON.stringify(spec.implementation_spec || demo.implementation_spec || {})
  ];
  return compactWhitespace(pieces.filter(Boolean).join(' ')).toLowerCase();
}

function isLaplaceFlowTransformDemo(demo = {}) {
  const intent = getInteractiveDemoIntent(demo);
  return /\b(visual recipe|three[-\s]?box flow|time domain to s[-\s]?domain|s[-\s]?domain and back|laplace[-\s]?domain multiplication|transforming x\(t\)|multiply(?:ing)? by h\(s\)|inverse[-\s]?(?:laplace[-\s]?)?transform|x\(s\)\s*h\(s\)|y\(s\)\s*=\s*x\(s\)\s*h\(s\)|ideal delay|ideal differentiator|ideal integrator)\b/i.test(intent);
}

function renderInteractiveLabShell(node, demo, modifier, bodyHtml = '') {
  const title = getInteractiveDemoTitle(demo, 'Interactive demo');
  const subtitle = getInteractiveDemoSubtitle(demo);
  node.innerHTML = `
    <section class="interactive-demo-shell interactive-demo-shell--lab interactive-demo-shell--${escapeHtml(modifier)}">
      <div class="interactive-demo-head">
        <div class="interactive-demo-title">${escapeHtml(title)}</div>
        <div class="interactive-demo-subtitle">${escapeHtml(subtitle || 'Move the controls and connect the graph to the formula.')}</div>
      </div>
      ${bodyHtml}
    </section>
  `;
  return node.querySelector('.interactive-demo-shell');
}

function renderLaplaceFlowTransformDemo(node, demo) {
  const state = { input: 'slow', system: 'delay', delay: 2 };
  const inputs = {
    slow: { label: 'x(t) = e^(-2t)u(t)', x: 'X(s) = 1/(s + 2)', yBase: 'e^(-2t)u(t)', amp: 1, rate: 2 },
    fast: { label: 'x(t) = 3e^(-5t)u(t)', x: 'X(s) = 3/(s + 5)', yBase: '3e^(-5t)u(t)', amp: 3, rate: 5 }
  };
  const systems = {
    delay: { label: 'Ideal Delay', h: 'H(s) = e^(-sT)', y: () => `y(t) = x(t - ${formatInteractiveDemoNumber(state.delay, 1)})`, note: 'Delay multiplies the transform by e^(-sT); the shape is preserved and starts later.' },
    differentiator: { label: 'Ideal Differentiator', h: 'H(s) = s', y: () => 'y(t) = dx(t)/dt', note: 'Differentiation is multiplication by s under zero initial conditions.' },
    integrator: { label: 'Ideal Integrator', h: 'H(s) = 1/s', y: () => 'y(t) = integral from 0 to t of x(tau)d tau', note: 'Integration divides by s, so the output accumulates area over time.' }
  };
  renderInteractiveLabShell(node, demo, 'laplace-flow', `
    <div class="interactive-demo-grid interactive-demo-grid--lab interactive-demo-grid--flow">
      <div class="interactive-demo-controls">
        <label class="interactive-demo-control">
          <span class="interactive-demo-control-label">Input signal</span>
          <select class="interactive-demo-select" data-flow-control="input">
            <option value="slow">${escapeHtml(inputs.slow.label)}</option>
            <option value="fast">${escapeHtml(inputs.fast.label)}</option>
          </select>
        </label>
        <label class="interactive-demo-control">
          <span class="interactive-demo-control-label">System H(s)</span>
          <select class="interactive-demo-select" data-flow-control="system">
            <option value="delay">${escapeHtml(systems.delay.label)}</option>
            <option value="differentiator">${escapeHtml(systems.differentiator.label)}</option>
            <option value="integrator">${escapeHtml(systems.integrator.label)}</option>
          </select>
        </label>
        <label class="interactive-demo-control" data-delay-control>
          <span class="interactive-demo-control-label">Delay T</span>
          <div class="interactive-demo-slider-row"><input data-flow-control="delay" type="range" min="0" max="3" step="0.1" value="${state.delay}"><strong data-value="delay"></strong></div>
        </label>
      </div>
      <div class="interactive-demo-stage interactive-demo-flow-stage">
        <div class="interactive-demo-flow" aria-label="Laplace-domain zero-state flow">
          <div class="interactive-demo-flow-card">
            <span class="interactive-demo-flow-kicker">1. Time domain</span>
            <strong data-flow-text="inputLabel"></strong>
            <small>Start with the actual input signal.</small>
          </div>
          <div class="interactive-demo-flow-arrow">
            <span>L</span>
          </div>
          <div class="interactive-demo-flow-card interactive-demo-flow-card--domain">
            <span class="interactive-demo-flow-kicker">2. s-domain</span>
            <strong data-flow-text="xFormula"></strong>
            <em data-flow-text="hFormula"></em>
            <b data-flow-text="yFormula"></b>
          </div>
          <div class="interactive-demo-flow-arrow">
            <span>L^-1</span>
          </div>
          <div class="interactive-demo-flow-card">
            <span class="interactive-demo-flow-kicker">3. Back to time</span>
            <strong data-flow-text="outputFormula"></strong>
            <small data-flow-text="outputNote"></small>
            <canvas class="interactive-demo-flow-canvas"></canvas>
          </div>
        </div>
      </div>
    </div>
    <div class="interactive-demo-readouts"></div>
  `);
  const canvas = node.querySelector('.interactive-demo-flow-canvas');
  const ctx = canvas?.getContext?.('2d');
  const readoutsEl = node.querySelector('.interactive-demo-readouts');
  const drawSketch = () => {
    if (!canvas || !ctx) return;
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const width = Math.max(Math.floor(canvas.parentElement?.clientWidth || 0), 220);
    const height = 112;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    const left = 18;
    const right = width - 14;
    const baseY = height - 24;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, baseY);
    ctx.lineTo(right, baseY);
    ctx.stroke();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const input = inputs[state.input];
    for (let i = 0; i <= 120; i += 1) {
      const t = i / 120 * 6;
      let value;
      if (state.system === 'integrator') {
        value = 1 - Math.exp(-input.rate * t / 2.6);
      } else if (state.system === 'differentiator') {
        value = Math.exp(-input.rate * t / 3.4) * (1 - t * 0.22);
      } else {
        const shifted = Math.max(t - state.delay, 0);
        value = t < state.delay ? 0 : Math.exp(-input.rate * shifted / 3.4);
      }
      const x = left + (right - left) * i / 120;
      const y = baseY - Math.max(-0.5, Math.min(1.15, value)) * 58;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  const render = () => {
    const input = inputs[state.input] || inputs.slow;
    const system = systems[state.system] || systems.delay;
    const yFormula = state.system === 'delay'
      ? `Y(s) = ${input.x.replace(/^X\(s\)\s*=\s*/, '')} * e^(-s${formatInteractiveDemoNumber(state.delay, 1)})`
      : `Y(s) = X(s) * ${system.h.replace(/^H\(s\)\s*=\s*/, '')}`;
    const delayWrap = node.querySelector('[data-delay-control]');
    if (delayWrap) delayWrap.hidden = state.system !== 'delay';
    node.querySelector('[data-flow-text="inputLabel"]').textContent = input.label;
    node.querySelector('[data-flow-text="xFormula"]').textContent = input.x;
    node.querySelector('[data-flow-text="hFormula"]').textContent = system.h;
    node.querySelector('[data-flow-text="yFormula"]').textContent = yFormula;
    node.querySelector('[data-flow-text="outputFormula"]').textContent = system.y();
    node.querySelector('[data-flow-text="outputNote"]').textContent = system.note;
    const delayValue = node.querySelector('[data-value="delay"]');
    if (delayValue) delayValue.textContent = formatInteractiveDemoNumber(state.delay, 1);
    readoutsEl.innerHTML = `
      <div class="interactive-demo-readout"><strong>Zero-state recipe:</strong> transform the input, multiply by the system transfer function, then invert the product.</div>
      <div class="interactive-demo-readout"><strong>Important:</strong> the system action happens in the middle box as multiplication by H(s), not as pole/ROC selection.</div>
    `;
    drawSketch();
  };
  node.querySelectorAll('[data-flow-control]').forEach((input) => {
    const key = input.dataset.flowControl;
    const update = () => {
      state[key] = input.type === 'range' ? Number(input.value) : input.value;
      render();
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
    update();
  });
  window.addEventListener('resize', render, { passive: true });
}

function drawDemoStemSeries(ctx, values, startIndex, toX, originY, scale, color, options = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = options.lineWidth || 2.5;
  values.forEach((value, i) => {
    const n = startIndex + i;
    const x = toX(n);
    const y = originY - value * scale;
    ctx.beginPath();
    ctx.moveTo(x, originY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, options.radius || 4, 0, Math.PI * 2);
    ctx.fill();
    if (options.labels && values.length <= 16) {
      ctx.fillStyle = '#475569';
      ctx.font = '600 11px Quicksand, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(n), x, originY + 18);
      ctx.fillStyle = color;
    }
  });
  ctx.restore();
}
