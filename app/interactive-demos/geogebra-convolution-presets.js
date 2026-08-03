// Textbook convolution presets shared by the lesson, GeoGebra scene, and tests.

(function initConvolutionPresets(root) {
  const presets = [
    {
      id: 'figure-2-7',
      label: 'Figure 2.7',
      inputFormula: 'x(t) = u(t + 1)',
      responseFormula: 'g(t) = 2e^{-(t + 2)}u(t + 2)',
      support: [-3, 'inf'],
      breakpoints: [-3],
      range: { min: -4, max: 3, step: 0.05, initial: -4, target: -3 },
      commands: {
        input: 'xSignal(tau)=If(tau>=-1,1,0)',
        response: 'gSignal(tau)=If(tau>=-2,2*exp(-(tau+2)),0)',
        flipped: 'gFlipped(tau)=If(tau<=2,2*exp(tau-2),0)',
        moving: 'gMoving(tau)=If(tau<=t+2,2*exp(tau-t-2),0)',
        output: 'convolutionOutput(s)=If(s<=-3,0,2*(1-exp(-(s+3))))',
      },
      evaluate(t) {
        const value = Number(t);
        return value <= -3 ? 0 : 2 * (1 - Math.exp(-(value + 3)));
      },
    },
    {
      id: 'example-2-10',
      label: 'Example 2.10',
      inputFormula: 'x(t) = e^{-t}u(t)',
      responseFormula: 'g(t) = e^{-2t}u(t)',
      support: [0, 'inf'],
      breakpoints: [0],
      range: { min: -2, max: 6, step: 0.05, initial: -1, target: 1 },
      commands: {
        input: 'xSignal(tau)=If(tau>=0,exp(-tau),0)',
        response: 'gSignal(tau)=If(tau>=0,exp(-2*tau),0)',
        flipped: 'gFlipped(tau)=If(tau<=0,exp(2*tau),0)',
        moving: 'gMoving(tau)=If(tau<=t,exp(-2*(t-tau)),0)',
        output: 'convolutionOutput(s)=If(s<=0,0,exp(-s)-exp(-2*s))',
      },
      evaluate(t) {
        const value = Number(t);
        return value <= 0 ? 0 : Math.exp(-value) - Math.exp(-2 * value);
      },
    },
    {
      id: 'example-2-11',
      label: 'Example 2.11',
      inputFormula: 'x(t) = u(t)',
      responseFormula: 'g(t) = 2e^{-t}, t >= 0; -2e^{2t}, t < 0',
      support: ['-inf', 'inf'],
      breakpoints: [0],
      range: { min: -4, max: 4, step: 0.05, initial: -2, target: 1 },
      commands: {
        input: 'xSignal(tau)=If(tau>=0,1,0)',
        response: 'gSignal(tau)=If(tau>=0,2*exp(-tau),-2*exp(2*tau))',
        flipped: 'gFlipped(tau)=If(tau<=0,2*exp(tau),-2*exp(-2*tau))',
        moving: 'gMoving(tau)=If(t-tau>=0,2*exp(-(t-tau)),-2*exp(2*(t-tau)))',
        output: 'convolutionOutput(s)=If(s<0,-exp(2*s),1-2*exp(-s))',
      },
      evaluate(t) {
        const value = Number(t);
        return value < 0 ? -Math.exp(2 * value) : 1 - 2 * Math.exp(-value);
      },
    },
    {
      id: 'example-2-12',
      label: 'Example 2.12',
      inputFormula: 'x(t) = u(t + 1) - u(t - 1)',
      responseFormula: 'g(t) = t/3 [u(t) - u(t - 3)]',
      support: [-1, 4],
      breakpoints: [-1, 1, 2, 4],
      range: { min: -2, max: 5, step: 0.05, initial: -1, target: 2 },
      commands: {
        input: 'xSignal(tau)=If(-1<=tau && tau<=1,1,0)',
        response: 'gSignal(tau)=If(0<=tau && tau<=3,tau/3,0)',
        flipped: 'gFlipped(tau)=If(-3<=tau && tau<=0,-tau/3,0)',
        moving: 'gMoving(tau)=If(0<=t-tau && t-tau<=3,(t-tau)/3,0)',
        output: 'convolutionOutput(s)=If(s<=-1,0,If(s<1,(s+1)^2/6,If(s<2,2*s/3,If(s<4,(9-(s-1)^2)/6,0))))',
      },
      evaluate(t) {
        const value = Number(t);
        if (value <= -1 || value >= 4) return 0;
        if (value < 1) return ((value + 1) ** 2) / 6;
        if (value < 2) return (2 * value) / 3;
        return (9 - ((value - 1) ** 2)) / 6;
      },
    },
  ];

  const registry = new Map(presets.map(preset => [preset.id, Object.freeze(preset)]));

  function getConvolutionPreset(id) {
    return registry.get(String(id || '').trim()) || null;
  }

  root.__ftutorConvolutionPresets = Object.freeze({
    getConvolutionPreset,
    list: () => presets.slice(),
  });
})(window);
