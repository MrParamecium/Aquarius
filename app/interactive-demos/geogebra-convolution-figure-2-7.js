// One trusted GeoGebra scene for Figure 2.7 and Examples 2.10-2.12.

const CONVOLUTION_MIN_X_SPAN = 9;
const CONVOLUTION_MIN_Y_SPAN = 9;

function calculateConvolutionCoordSystem(width, height, minT, maxT) {
  const drawableWidth = Math.max(1, Number(width) || 1);
  const drawableHeight = Math.max(1, Number(height) || 1);
  const normalizedMinT = Number.isFinite(Number(minT)) ? Number(minT) : -4;
  const normalizedMaxT = Number.isFinite(Number(maxT)) ? Number(maxT) : 3;
  const xCenter = (normalizedMinT + normalizedMaxT) / 2;
  const minXSpan = Math.max(
    CONVOLUTION_MIN_X_SPAN,
    normalizedMaxT - normalizedMinT + 1,
  );
  const scale = Math.min(drawableWidth / minXSpan, drawableHeight / CONVOLUTION_MIN_Y_SPAN);
  const xSpan = drawableWidth / scale;
  const ySpan = drawableHeight / scale;
  return {
    xMin: xCenter - xSpan / 2,
    xMax: xCenter + xSpan / 2,
    yMin: 4 - ySpan / 2,
    yMax: 4 + ySpan / 2,
    pixelsPerXUnit: drawableWidth / xSpan,
    pixelsPerYUnit: drawableHeight / ySpan,
  };
}

window.__ftutorConvolutionGeometry = Object.freeze({
  calculateCoordSystem: calculateConvolutionCoordSystem,
});

const GEOGEBRA_CONVOLUTION_OBJECTS = Object.freeze({
  source: 'sourceBand',
  input: 'inputBand',
  flipped: 'flippedBand',
  moving: 'movingBand',
  product: 'productBand',
  output: 'convolutionOutput',
  currentPoint: 'currentOutputPoint',
  signalDivider: 'signalDivider',
  productDivider: 'productDivider',
  signalAxis: 'signalAxis',
  productAxis: 'productAxis',
  signalYAxis: 'signalYAxis',
  productYAxis: 'productYAxis',
  outputYAxis: 'outputYAxis',
});

const GEOGEBRA_CONVOLUTION_TASK_STEPS = Object.freeze({
  'change-variable': 1,
  flip: 2,
  slide: 3,
  multiply: 4,
  integrate: 5,
  'worked-example': 5,
});

function createGeoGebraConvolutionFigure27Scene() {
  const instanceId = `convolution-scene-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let api = null;
  let preset = null;
  let task = 'slide';
  let step = 1;
  let orderId = 'x-fixed';
  let outputRevealMode = 'hidden';
  let revealedTimes = [];
  let parameters = {};
  let destroyed = false;
  let stateListener = null;
  let listenerRegistered = false;
  const listenerName = `__ftutorGeoGebraTUpdate${Date.now()}${Math.floor(Math.random() * 100000)}`;
  let settings = {
    initialT: -4,
    minT: -4,
    maxT: 3,
    stepT: 0.05,
    targetT: -3,
    targetTolerance: 0.08,
  };
  let viewport = { width: 760, height: 620 };

  function run(command) {
    if (!api?.evalCommand(command)) throw new Error(`GeoGebra command failed: ${command}`);
  }

  function setVisible(name, visible) {
    try { api?.setVisible(name, Boolean(visible)); } catch (_) {}
  }

  function styleObject(name, color, thickness = 4) {
    try { api?.setColor(name, color[0], color[1], color[2]); } catch (_) {}
    try { api?.setLineThickness(name, thickness); } catch (_) {}
    try { api?.setLabelVisible(name, false); } catch (_) {}
  }

  function readTime() {
    const value = Number(api?.getValue?.('t'));
    return Number.isFinite(value) ? value : settings.initialT;
  }

  function getState() {
    const t = readTime();
    const output = Number(preset?.evaluate?.(t)) || 0;
    return {
      instanceId,
      listenerCount: listenerRegistered ? 1 : 0,
      preset: preset?.id || '',
      task,
      step,
      orderId,
      outputRevealMode,
      revealedTimes: revealedTimes.slice(),
      parameters: { ...parameters },
      t,
      overlap: Math.abs(output) > 1e-10,
      area: output,
      output,
      atTarget: Math.abs(t - settings.targetT) <= settings.targetTolerance,
    };
  }

  function emitState() {
    if (!destroyed && typeof stateListener === 'function') stateListener(getState());
  }

  function applyOrder(nextOrder) {
    if (!preset?.supportedOrders?.includes(nextOrder) || !api) return false;
    orderId = nextOrder;
    const order = preset.commands?.orders?.[orderId];
    if (!order) return false;
    [order.fixed, order.flipped, order.moving, order.product].forEach(run);
    setVisible('inputBand', orderId === 'x-fixed');
    setVisible('sourceBand', orderId === 'g-fixed');
    setVisible('flippedBand', true);
    setVisible('movingBand', true);
    setVisible('productBand', true);
    emitState();
    return true;
  }

  function setOutputReveal(next = {}) {
    const mode = ['hidden', 'points', 'full'].includes(next.mode) ? next.mode : 'hidden';
    outputRevealMode = mode;
    revealedTimes = [...new Set((next.revealedTimes || []).map(Number).filter(Number.isFinite))]
      .sort((a, b) => a - b);
    setVisible('convolutionOutput', mode === 'full');
    setVisible('currentOutputPoint', mode !== 'hidden');
    emitState();
  }

  function setStep(nextStep) {
    step = Math.max(1, Math.min(5, Math.round(Number(nextStep) || 1)));
    const o = GEOGEBRA_CONVOLUTION_OBJECTS;
    setVisible(o.input, true);
    setVisible(o.source, step === 1);
    setVisible(o.flipped, step === 2);
    setVisible(o.moving, step >= 3);
    setVisible(o.product, true);
    setVisible(o.output, outputRevealMode === 'full');
    setVisible(o.currentPoint, outputRevealMode !== 'hidden');
    setVisible(o.signalDivider, true);
    setVisible(o.productDivider, true);
    setVisible(o.signalAxis, true);
    setVisible(o.productAxis, true);
    setVisible(o.signalYAxis, true);
    setVisible(o.productYAxis, true);
    setVisible(o.outputYAxis, true);
    emitState();
  }

  function setTime(value) {
    if (!api || destroyed) return;
    const raw = Math.max(settings.minT, Math.min(settings.maxT, Number(value)));
    const snapped = Math.round(raw / settings.stepT) * settings.stepT;
    api.setValue('t', Number(snapped.toFixed(8)));
    emitState();
  }

  function resize(nextSize = {}) {
    if (!api || destroyed) return;
    const width = Number(nextSize.width) || viewport.width;
    const height = Number(nextSize.height) || viewport.height;
    viewport = { width, height };
    const bounds = calculateConvolutionCoordSystem(width, height, settings.minT, settings.maxT);
    try { api.setCoordSystem(bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax); } catch (_) {}
  }

  function setOrder(nextOrder) {
    return applyOrder(String(nextOrder || '').trim());
  }

  function setParameters(next = {}) {
    if (!api || !preset) return false;
    const allowed = preset.parameters || {};
    Object.keys(next || {}).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(allowed, key) && Number.isFinite(Number(next[key]))) {
        parameters[key] = Number(next[key]);
        run(`${key}=${parameters[key]}`);
      }
    });
    const order = preset.commands?.orders?.[orderId];
    if (order) [order.fixed, order.flipped, order.moving, order.product].forEach(run);
    emitState();
    return true;
  }

  function create(loadedApi, options = {}) {
    const presetId = String(options.presetId || options.preset || 'figure-2-7');
    preset = window.__ftutorConvolutionPresets?.getConvolutionPreset(presetId) || null;
    if (!preset) throw new Error(`Unknown convolution preset: ${presetId}`);

    api = loadedApi;
    destroyed = false;
    task = String(options.task || 'slide');
    const range = preset.range || {};
    settings = {
      initialT: Number.isFinite(Number(options.initialT)) ? Number(options.initialT) : range.initial,
      minT: Number.isFinite(Number(options.minT)) ? Number(options.minT) : range.min,
      maxT: Number.isFinite(Number(options.maxT)) ? Number(options.maxT) : range.max,
      stepT: Number.isFinite(Number(options.stepT)) ? Number(options.stepT) : range.step,
      targetT: Number.isFinite(Number(options.targetT)) ? Number(options.targetT) : range.target,
      targetTolerance: Number.isFinite(Number(options.targetTolerance)) ? Number(options.targetTolerance) : 0.08,
    };
    viewport = {
      width: Number(options.width) || viewport.width,
      height: Number(options.height) || viewport.height,
    };
    stateListener = typeof options.onStateChange === 'function' ? options.onStateChange : null;
    orderId = preset.supportedOrders?.includes(options.order) ? options.order : (preset.defaultOrder || 'x-fixed');
    parameters = { ...(preset.parameters || {}), ...(options.parameters || {}) };
    outputRevealMode = 'hidden';
    revealedTimes = [];

    resize(viewport);
    try { api.setAxesVisible(1, true, false); } catch (_) {}
    try { api.setGridVisible(1, false); } catch (_) {}

    run(`t=${settings.initialT}`);
    try { api.setSliderMin('t', settings.minT); } catch (_) {}
    try { api.setSliderMax('t', settings.maxT); } catch (_) {}
    try { api.setSliderIncrement('t', settings.stepT); } catch (_) {}
    setVisible('t', false);

    Object.values(parameters).forEach((value, index) => {
      const key = Object.keys(parameters)[index];
      run(`${key}=${Number(value)}`);
    });
    run(preset.commands.xSignal);
    run(preset.commands.gSignal);
    const initialOrder = preset.commands.orders?.[orderId];
    if (!initialOrder) throw new Error(`Unsupported convolution order: ${orderId}`);
    [initialOrder.fixed, initialOrder.flipped, initialOrder.moving, initialOrder.product].forEach(run);
    run('inputBand(tau)=xSignal(tau)+6');
    run('sourceBand(tau)=gSignal(tau)+6');
    run('flippedBand(tau)=gFlipped(tau)+6');
    run('movingBand(tau)=gMoving(tau)+6');
    run('productBand(tau)=productSignal(tau)+3');
    run(preset.commands.output);
    run('currentOutputPoint=(t,convolutionOutput(t))');
    run('signalsXAxis: y=6');
    run('productXAxis: y=3');
    run('outputXAxis: y=0');
    run('signalsYAxis=Segment((0,6),(0,8.5))');
    run('productYAxis=Segment((0,3),(0,5.5))');
    run('outputYAxis=Segment((0,0),(0,2.5))');
    // Backward-compatible aliases for existing style probes.
    run('signalAxis: y=6');
    run('productAxis: y=3');
    run('signalYAxis=Segment((0,6),(0,8.5))');

    ['xSignal', 'gSignal', 'gFlipped', 'gMoving', 'productSignal', 'convolutionOutput', 'currentOutputPoint'].forEach(name => setVisible(name, false));
    styleObject('inputBand', [37, 99, 235], 5);
    styleObject('sourceBand', [13, 148, 136], 5);
    styleObject('flippedBand', [124, 58, 237], 5);
    styleObject('movingBand', [124, 58, 237], 5);
    styleObject('productBand', [22, 135, 106], 5);
    styleObject('convolutionOutput', [180, 83, 9], 5);
    styleObject('signalDivider', [203, 213, 225], 2);
    styleObject('productDivider', [203, 213, 225], 2);
    styleObject('signalAxis', [148, 163, 184], 2);
    styleObject('productAxis', [148, 163, 184], 2);
    styleObject('signalYAxis', [148, 163, 184], 2);
    styleObject('productYAxis', [148, 163, 184], 2);
    styleObject('outputYAxis', [148, 163, 184], 2);
    try { api.setLineStyle('signalDivider', 2); } catch (_) {}
    try { api.setLineStyle('productDivider', 2); } catch (_) {}
    try { api.setLineStyle('signalAxis', 0); } catch (_) {}
    try { api.setLineStyle('productAxis', 0); } catch (_) {}
    try { api.setLineStyle('signalYAxis', 0); } catch (_) {}
    try { api.setLineStyle('productYAxis', 0); } catch (_) {}
    try { api.setLineStyle('outputYAxis', 0); } catch (_) {}
    try { api.setColor('currentOutputPoint', 220, 38, 38); } catch (_) {}
    try { api.setPointSize('currentOutputPoint', 6); } catch (_) {}

    window[listenerName] = emitState;
    api.registerUpdateListener(listenerName);
    listenerRegistered = true;
    const initialStep = options.initialStep || GEOGEBRA_CONVOLUTION_TASK_STEPS[task] || 1;
    setStep(initialStep);
    applyOrder(orderId);
    setOutputReveal({ mode: 'hidden' });
    return getState();
  }

  function reset() {
    if (preset?.defaultOrder) applyOrder(preset.defaultOrder);
    parameters = { ...(preset?.parameters || {}) };
    Object.entries(parameters).forEach(([key, value]) => { try { run(`${key}=${Number(value)}`); } catch (_) {} });
    setTime(settings.initialT);
    outputRevealMode = 'hidden';
    revealedTimes = [];
    setStep(1);
    setOutputReveal({ mode: 'hidden' });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (listenerRegistered) {
      try { api?.unregisterUpdateListener?.(listenerName); } catch (_) {}
      listenerRegistered = false;
    }
    try { delete window[listenerName]; } catch (_) { window[listenerName] = undefined; }
    stateListener = null;
    api = null;
  }

  return { create, destroy, getState, reset, resize, setStep, setTime, setOrder, setOutputReveal, setParameters };
}

registerGeoGebraScene('convolution_figure_2_7', createGeoGebraConvolutionFigure27Scene);
