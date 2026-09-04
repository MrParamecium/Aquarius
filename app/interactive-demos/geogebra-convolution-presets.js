// Trusted textbook-aligned convolution presets. Lesson cache may select an id,
// but all formulas, commands, and numerical evaluation stay here.

(function initConvolutionPresets(root) {
  // Figure 2.7 trusted commands: gSignal(tau)=If(tau>=-2,2*exp(-(tau+2)),0)
  // convolutionOutput(s)=If(s<=-3,0,2*(1-exp(-(s+3))))
  function roleCommands({ xSignal, gSignal, output, flippedX, flippedG, movingX, movingG, productX, productG }) {
    const xFixed = {
      fixed: `fixedSignal(tau)=${xSignal}`,
      flipped: flippedG,
      moving: movingG,
      product: productX || 'productSignal(tau)=fixedSignal(tau)*movingSignal(tau)',
    };
    const gFixed = {
      fixed: `fixedSignal(tau)=${gSignal}`,
      flipped: flippedX,
      moving: movingX,
      product: productG || 'productSignal(tau)=fixedSignal(tau)*movingSignal(tau)',
    };
    return {
      xSignal: `xSignal(tau)=${xSignal}`,
      gSignal: `gSignal(tau)=${gSignal}`,
      output: `convolutionOutput(s)=${output}`,
      orders: { 'x-fixed': xFixed, 'g-fixed': gFixed },
    };
  }

  const presets = [
    {
      id: 'figure-2-7', label: 'Figure 2.7',
      inputFormula: 'x(t) = u(t + 1)', responseFormula: 'g(t) = 2e^{-(t + 2)}u(t + 2)',
      support: [-3, 'inf'], breakpoints: [-3],
      range: { min: -4, max: 3, step: 0.05, initial: -4, target: -3 },
      defaultOrder: 'x-fixed', supportedOrders: ['x-fixed', 'g-fixed'],
      checkpoints: [-3, -2, 0, 1], parameters: {},
      commands: roleCommands({
        xSignal: 'If(tau>=-1,1,0)', gSignal: 'If(tau>=-2,2*exp(-(tau+2)),0)',
        flippedG: 'gFlipped(tau)=If(tau<=2,2*exp(tau-2),0)', movingG: 'gMoving(tau)=If(tau<=t+2,2*exp(tau-t-2),0)',
        flippedX: 'xFlipped(tau)=If(tau<=1,1,0)', movingX: 'xMoving(tau)=If(tau<=t+1,1,0)',
        output: 'If(s<=-3,0,2*(1-exp(-(s+3))))',
      }),
      evaluate(t) { const value = Number(t); return value <= -3 ? 0 : 2 * (1 - Math.exp(-(value + 3))); },
    },
    {
      id: 'example-2-10', label: 'Example 2.10',
      inputFormula: 'x(t) = e^{-t}u(t)', responseFormula: 'g(t) = e^{-2t}u(t)',
      support: [0, 'inf'], breakpoints: [0],
      range: { min: -2, max: 6, step: 0.05, initial: -1, target: 1 },
      defaultOrder: 'x-fixed', supportedOrders: ['x-fixed', 'g-fixed'],
      checkpoints: [0, 1, 3], parameters: {},
      commands: roleCommands({
        xSignal: 'If(tau>=0,exp(-tau),0)', gSignal: 'If(tau>=0,exp(-2*tau),0)',
        flippedG: 'gFlipped(tau)=If(tau<=0,exp(2*tau),0)', movingG: 'gMoving(tau)=If(tau<=t,exp(-2*(t-tau)),0)',
        flippedX: 'xFlipped(tau)=If(tau<=0,1,0)', movingX: 'xMoving(tau)=If(tau<=t,exp(-(t-tau)),0)',
        output: 'If(s<=0,0,exp(-s)-exp(-2*s))',
      }),
      evaluate(t) { const value = Number(t); return value <= 0 ? 0 : Math.exp(-value) - Math.exp(-2 * value); },
    },
    {
      id: 'example-2-11', label: 'Example 2.11',
      inputFormula: 'x(t) = u(t)', responseFormula: 'g(t) = 2e^{-t}u(t) - 2e^{2t}u(-t)',
      support: ['-inf', 'inf'], breakpoints: [0],
      range: { min: -4, max: 4, step: 0.05, initial: -2, target: 1 },
      defaultOrder: 'x-fixed', supportedOrders: ['x-fixed', 'g-fixed'],
      checkpoints: [-1, 0, 1], parameters: {},
      commands: roleCommands({
        xSignal: 'If(tau>=0,1,0)', gSignal: 'If(tau>=0,2*exp(-tau),-2*exp(2*tau))',
        flippedG: 'gFlipped(tau)=If(tau<=0,2*exp(tau),-2*exp(-2*tau))', movingG: 'gMoving(tau)=If(t-tau>=0,2*exp(-(t-tau)),-2*exp(2*(t-tau)))',
        flippedX: 'xFlipped(tau)=If(tau<=0,1,0)', movingX: 'xMoving(tau)=If(tau<=t,1,0)',
        output: 'If(s<0,-exp(2*s),1-2*exp(-s))',
      }),
      evaluate(t) { const value = Number(t); return value < 0 ? -Math.exp(2 * value) : 1 - 2 * Math.exp(-value); },
    },
    {
      id: 'example-2-12', label: 'Example 2.12',
      inputFormula: 'x(t) = u(t + 1) - u(t - 1)', responseFormula: 'g(t) = t/3 [u(t) - u(t - 3)]',
      support: [-1, 4], breakpoints: [-1, 1, 2, 4],
      range: { min: -2, max: 5, step: 0.05, initial: -1, target: 2 },
      defaultOrder: 'g-fixed', supportedOrders: ['g-fixed'],
      checkpoints: [-1, 0, 1, 2, 3, 4], parameters: {},
      commands: roleCommands({
        xSignal: 'If(-1<=tau && tau<=1,1,0)', gSignal: 'If(0<=tau && tau<=3,tau/3,0)',
        flippedG: 'gFlipped(tau)=If(-3<=tau && tau<=0,-tau/3,0)', movingG: 'gMoving(tau)=If(0<=t-tau && t-tau<=3,(t-tau)/3,0)',
        flippedX: 'xFlipped(tau)=If(tau<=1 && tau>=-1,1,0)', movingX: 'xMoving(tau)=If(t-tau<=1 && t-tau>=-1,1,0)',
        output: 'If(s<=-1,0,If(s<1,(s+1)^2/6,If(s<2,2*s/3,If(s<4,(9-(s-1)^2)/6,0))))',
      }),
      evaluate(t) {
        const value = Number(t);
        if (value <= -1 || value >= 4) return 0;
        if (value < 1) return ((value + 1) ** 2) / 6;
        if (value < 2) return (2 * value) / 3;
        return (9 - ((value - 1) ** 2)) / 6;
      },
    },
    {
      id: 'figure-2-11', label: 'Figure 2.11',
      inputFormula: 'x(t) = e^{-t}u(t)', responseFormula: 'g(t) = u(t)',
      support: [0, 'inf'], breakpoints: [0],
      range: { min: -2, max: 6, step: 0.05, initial: -1, target: 1 },
      defaultOrder: 'x-fixed', supportedOrders: ['x-fixed', 'g-fixed'],
      checkpoints: [-1, 0, 1, 3], parameters: {},
      commands: roleCommands({
        xSignal: 'If(tau>=0,exp(-tau),0)', gSignal: 'If(tau>=0,1,0)',
        flippedG: 'gFlipped(tau)=If(tau<=0,1,0)', movingG: 'gMoving(tau)=If(tau<=t,1,0)',
        flippedX: 'xFlipped(tau)=If(tau<=0,exp(tau),0)', movingX: 'xMoving(tau)=If(tau<=t,exp(tau-t),0)',
        output: 'If(s<=0,0,1-exp(-s))',
      }),
      evaluate(t) { const value = Number(t); return value <= 0 ? 0 : 1 - Math.exp(-value); },
    },
    {
      id: 'figure-2-12', label: 'Figure 2.12',
      inputFormula: 'x(t) = u(t) - u(t - 1)', responseFormula: 'g(t) = u(-t)',
      support: [0, 'inf'], breakpoints: [0, 1],
      range: { min: -2, max: 4, step: 0.05, initial: -1, target: 1 },
      defaultOrder: 'g-fixed', supportedOrders: ['g-fixed'],
      checkpoints: [0, 1, 2], parameters: {},
      commands: roleCommands({
        xSignal: 'If(0<=tau && tau<=1,1,0)', gSignal: 'If(tau<=0,1,0)',
        flippedG: 'gFlipped(tau)=If(tau>=0,1,0)', movingG: 'gMoving(tau)=If(tau>=t,1,0)',
        flippedX: 'xFlipped(tau)=If(0<=tau && tau<=1,1,0)', movingX: 'xMoving(tau)=If(0<=t-tau && t-tau<=1,1,0)',
        output: 'If(s<=0,1,If(s<1,1,exp(-s)))',
      }),
      evaluate(t) { const value = Number(t); return value <= 0 ? 1 : Math.exp(-value); },
    },
    {
      id: 'figure-2-13', label: 'Figure 2.13',
      inputFormula: 'x(t) = u(t) - u(t - 1)', responseFormula: 'g(t) = u(t - T)',
      support: [0, 'inf'], breakpoints: [0, 1],
      range: { min: -2, max: 6, step: 0.05, initial: -1, target: 2 },
      defaultOrder: 'x-fixed', supportedOrders: ['x-fixed', 'g-fixed'],
      checkpoints: [0, 1, 2, 3], parameters: { T: 2 },
      commands: roleCommands({
        xSignal: 'If(0<=tau && tau<=1,1,0)', gSignal: 'If(tau>=T,1,0)',
        flippedG: 'gFlipped(tau)=If(tau<=-T,1,0)', movingG: 'gMoving(tau)=If(tau<=t-T,1,0)',
        flippedX: 'xFlipped(tau)=If(0<=tau && tau<=1,1,0)', movingX: 'xMoving(tau)=If(0<=t-tau && t-tau<=1,1,0)',
        output: 'If(s<=0,0,s)',
      }),
      evaluate(t) { return Math.max(0, Number(t)); },
    },
    {
      id: 'practice-rectangle-triangle', label: 'Practice: rectangle x triangle',
      inputFormula: 'x(t) = u(t) - u(t - 1)', responseFormula: 'g(t) = t[u(t) - u(t - 1)]',
      support: [0, 3], breakpoints: [0, 1, 2, 3],
      range: { min: -1, max: 4, step: 0.05, initial: -1, target: 1 },
      defaultOrder: 'g-fixed', supportedOrders: ['g-fixed'],
      checkpoints: [0, 1, 1.5, 2, 3], parameters: {},
      commands: roleCommands({
        xSignal: 'If(0<=tau && tau<=1,1,0)', gSignal: 'If(0<=tau && tau<=1,tau,0)',
        flippedG: 'gFlipped(tau)=If(-1<=tau && tau<=0,-tau,0)', movingG: 'gMoving(tau)=If(0<=t-tau && t-tau<=1,t-tau,0)',
        flippedX: 'xFlipped(tau)=If(0<=tau && tau<=1,1,0)', movingX: 'xMoving(tau)=If(0<=t-tau && t-tau<=1,1,0)',
        output: 'If(s<0,0,If(s<1,s^2/2,If(s<2,1/2,If(s<3,1/2-(s-2)^2/2,0))))',
      }),
      evaluate(t) {
        const value = Number(t);
        if (value < 0 || value >= 3) return 0;
        if (value < 1) return 0.5 * value ** 2;
        if (value < 2) return 0.5;
        return 0.5 - 0.5 * (value - 2) ** 2;
      },
    },
  ];

  const registry = new Map(presets.map(preset => [preset.id, Object.freeze(preset)]));
  function getConvolutionPreset(id) { return registry.get(String(id || '').trim()) || null; }

  root.__ftutorConvolutionPresets = Object.freeze({
    getConvolutionPreset,
    list: () => presets.slice(),
  });
})(window);
