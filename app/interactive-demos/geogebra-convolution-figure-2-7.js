// Trusted GeoGebra construction for textbook Figure 2.7.

const GEOGEBRA_FIGURE_2_7_OBJECTS = {
  xSignal: 'xSignal',
  gSignal: 'gSignal',
  gFlipped: 'gFlipped',
  gMoving: 'gMoving',
  product: 'productSignal',
  overlap: 'overlapFill',
  supportBoundary: 'supportBoundary',
  output: 'convolutionOutput',
  currentPoint: 'currentOutputPoint',
};

function createGeoGebraConvolutionFigure27Scene() {
  let api = null;
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
    try { api.setVisible(name, Boolean(visible)); } catch (_) {}
  }

  function styleObject(name, color, thickness = 4) {
    try { api.setColor(name, color[0], color[1], color[2]); } catch (_) {}
    try { api.setLineThickness(name, thickness); } catch (_) {}
    try { api.setLabelVisible(name, false); } catch (_) {}
  }

  function configureView(view, bounds) {
    api.evalCommand(`SetActiveView(${view})`);
    api.evalCommand(`ZoomIn(${bounds.xMin},${bounds.yMin},${bounds.xMax},${bounds.yMax})`);
    try { api.setAxesVisible(view, true, true); } catch (_) {}
    try { api.setGridVisible(view, false); } catch (_) {}
  }

  function readValue(name, fallback = 0) {
    const value = Number(api?.getValue?.(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function getState() {
    const t = readValue('t', settings.initialT);
    const output = readValue('outputValue', t <= -3 ? 0 : 2 * (1 - Math.exp(-(t + 3))));
    const area = readValue('overlapArea', output);
    return {
      step,
      t,
      area,
      output,
      atTarget: Math.abs(t - settings.targetT) <= settings.targetTolerance,
    };
  }

  function emitState() {
    if (!destroyed && typeof stateListener === 'function') stateListener(getState());
  }

  function setStep(nextStep) {
    step = Math.max(1, Math.min(4, Math.round(Number(nextStep) || 1)));
    const o = GEOGEBRA_FIGURE_2_7_OBJECTS;
    setVisible(o.xSignal, true);
    setVisible(o.gSignal, step <= 2);
    setVisible(o.gFlipped, step === 2);
    setVisible(o.gMoving, step >= 3);
    setVisible(o.supportBoundary, step >= 3);
    setVisible(o.product, step === 4);
    setVisible(o.overlap, step === 4);
    setVisible(o.output, step === 4);
    setVisible(o.currentPoint, step === 4);
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
    api = loadedApi;
    destroyed = false;
    settings = {
      initialT: Number.isFinite(Number(options.initialT)) ? Number(options.initialT) : -4,
      minT: Number.isFinite(Number(options.minT)) ? Number(options.minT) : -4,
      maxT: Number.isFinite(Number(options.maxT)) ? Number(options.maxT) : 3,
      stepT: Number.isFinite(Number(options.stepT)) ? Number(options.stepT) : 0.05,
      targetT: Number.isFinite(Number(options.targetT)) ? Number(options.targetT) : -3,
      targetTolerance: Number.isFinite(Number(options.targetTolerance)) ? Number(options.targetTolerance) : 0.08,
    };
    stateListener = typeof options.onStateChange === 'function' ? options.onStateChange : null;

    configureView(1, { xMin: -4.5, xMax: 5.5, yMin: -0.35, yMax: 2.35 });
    run(`t=${settings.initialT}`);
    try { api.setSliderMin('t', settings.minT); } catch (_) {}
    try { api.setSliderMax('t', settings.maxT); } catch (_) {}
    try { api.setSliderIncrement('t', settings.stepT); } catch (_) {}
    setVisible('t', false);
    run('xSignal(tau)=If(tau>=-1,1,0)');
    run('gSignal(tau)=If(tau>=-2,2*exp(-(tau+2)),0)');
    run('gFlipped(tau)=If(tau<=2,2*exp(tau-2),0)');
    run('gMoving(tau)=If(tau<=t+2,2*exp(tau-t-2),0)');
    run('productSignal(tau)=xSignal(tau)*gMoving(tau)');
    run('overlapFill=Integral(productSignal,-1,Max(-1,t+2))');
    run('supportBoundary: x=t+2');
    run('overlapArea=If(t<=-3,0,2*(1-exp(-(t+3))))');
    setVisible('overlapArea', false);
    styleObject('xSignal', [37, 99, 235], 5);
    styleObject('gSignal', [13, 148, 136], 5);
    styleObject('gFlipped', [124, 58, 237], 5);
    styleObject('gMoving', [124, 58, 237], 5);
    styleObject('productSignal', [217, 119, 6], 4);
    styleObject('supportBoundary', [100, 116, 139], 2);
    try { api.setLineStyle('supportBoundary', 2); } catch (_) {}
    try { api.setColor('overlapFill', 245, 158, 11); } catch (_) {}
    try { api.setFilling('overlapFill', 0.35); } catch (_) {}

    configureView(2, { xMin: -4.5, xMax: 3.5, yMin: -0.2, yMax: 2.3 });
    run('convolutionOutput(s)=If(s<=-3,0,2*(1-exp(-(s+3))))');
    run('outputValue=convolutionOutput(t)');
    run('currentOutputPoint=(t,outputValue)');
    setVisible('outputValue', false);
    styleObject('convolutionOutput', [180, 83, 9], 5);
    try { api.setColor('currentOutputPoint', 220, 38, 38); } catch (_) {}
    try { api.setPointSize('currentOutputPoint', 6); } catch (_) {}

    window[listenerName] = emitState;
    api.registerUpdateListener(listenerName);
    setStep(options.initialStep);
    return getState();
  }

  function reset() {
    setTime(settings.initialT);
    setStep(1);
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
