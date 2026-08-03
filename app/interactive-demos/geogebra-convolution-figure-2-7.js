// One trusted GeoGebra scene for Figure 2.7 and Examples 2.10-2.12.

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
  let api = null;
  let preset = null;
  let task = 'slide';
  let step = 1;
  let destroyed = false;
  let stateListener = null;
  const listenerName = `__ftutorGeoGebraTUpdate${Date.now()}${Math.floor(Math.random() * 100000)}`;
  let settings = {
    initialT: -4,
    minT: -4,
    maxT: 3,
    stepT: 0.05,
    targetT: -3,
    targetTolerance: 0.08,
  };

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
      preset: preset?.id || '',
      task,
      step,
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

  function setStep(nextStep) {
    step = Math.max(1, Math.min(5, Math.round(Number(nextStep) || 1)));
    const o = GEOGEBRA_CONVOLUTION_OBJECTS;
    setVisible(o.input, true);
    setVisible(o.source, step === 1);
    setVisible(o.flipped, step === 2);
    setVisible(o.moving, step >= 3);
    setVisible(o.product, true);
    setVisible(o.output, true);
    setVisible(o.currentPoint, true);
    setVisible(o.signalDivider, true);
    setVisible(o.productDivider, true);
    setVisible(o.signalAxis, true);
    setVisible(o.productAxis, true);
    emitState();
  }

  function setTime(value) {
    if (!api || destroyed) return;
    const raw = Math.max(settings.minT, Math.min(settings.maxT, Number(value)));
    const snapped = Math.round(raw / settings.stepT) * settings.stepT;
    api.setValue('t', Number(snapped.toFixed(8)));
    emitState();
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
    stateListener = typeof options.onStateChange === 'function' ? options.onStateChange : null;

    try { api.setCoordSystem(settings.minT - 0.5, settings.maxT + 0.5, -0.5, 8.5); } catch (_) {}
    try { api.setAxesVisible(1, true, false); } catch (_) {}
    try { api.setGridVisible(1, false); } catch (_) {}

    run(`t=${settings.initialT}`);
    try { api.setSliderMin('t', settings.minT); } catch (_) {}
    try { api.setSliderMax('t', settings.maxT); } catch (_) {}
    try { api.setSliderIncrement('t', settings.stepT); } catch (_) {}
    setVisible('t', false);

    run(preset.commands.input);
    run(preset.commands.response);
    run(preset.commands.flipped);
    run(preset.commands.moving);
    run('productSignal(tau)=xSignal(tau)*gMoving(tau)');
    run('inputBand(tau)=xSignal(tau)+6');
    run('sourceBand(tau)=gSignal(tau)+6');
    run('flippedBand(tau)=gFlipped(tau)+6');
    run('movingBand(tau)=gMoving(tau)+6');
    run('productBand(tau)=productSignal(tau)+3');
    run(preset.commands.output);
    run('currentOutputPoint=(t,convolutionOutput(t))');
    run(`signalDivider: y=5`);
    run(`productDivider: y=2.5`);
    run(`signalAxis: y=6`);
    run(`productAxis: y=3`);

    ['xSignal', 'gSignal', 'gFlipped', 'gMoving', 'productSignal'].forEach(name => setVisible(name, false));
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
    try { api.setLineStyle('signalDivider', 2); } catch (_) {}
    try { api.setLineStyle('productDivider', 2); } catch (_) {}
    try { api.setLineStyle('signalAxis', 1); } catch (_) {}
    try { api.setLineStyle('productAxis', 1); } catch (_) {}
    try { api.setColor('currentOutputPoint', 220, 38, 38); } catch (_) {}
    try { api.setPointSize('currentOutputPoint', 6); } catch (_) {}

    window[listenerName] = emitState;
    api.registerUpdateListener(listenerName);
    const initialStep = options.initialStep || GEOGEBRA_CONVOLUTION_TASK_STEPS[task] || 1;
    setStep(initialStep);
    return getState();
  }

  function reset() {
    setTime(settings.initialT);
    setStep(GEOGEBRA_CONVOLUTION_TASK_STEPS[task] || 1);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    try { api?.unregisterUpdateListener?.(listenerName); } catch (_) {}
    try { delete window[listenerName]; } catch (_) { window[listenerName] = undefined; }
    stateListener = null;
    api = null;
  }

  return { create, destroy, getState, reset, setStep, setTime };
}

registerGeoGebraScene('convolution_figure_2_7', createGeoGebraConvolutionFigure27Scene);
