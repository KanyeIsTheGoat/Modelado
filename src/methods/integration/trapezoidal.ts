import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const trapezoidal: MethodDefinition = {
  id: 'trapezoidal',
  name: 'Regla del Trapecio (Simple)',
  category: 'integration',
  formula: '∫f(x)dx ≈ (b-a)/2 · [f(a) + f(b)]',
  description: 'Aproxima el area bajo la curva con un solo trapecio entre a y b.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
  ],
  tableColumns: [
    { key: 'punto', label: 'Punto' },
    { key: 'x', label: 'x' },
    { key: 'fx', label: 'f(x)' },
  ],
  steps: [
    'Version simple con un solo trapecio entre a y b. Util para <em>didactico</em> o verificar una formula — pero en el parcial siempre piden version compuesta (<code>trapezoidalComp</code>).',
    'Formula: <code>I ≈ (b-a)/2 · [f(a) + f(b)]</code>.',
    'Si el parcial da <code>n = 4</code> o <code>n = 10</code>, usa <b>Trapecio compuesto</b>, no este.',
    'La cota de error: <code>|E| = -(b-a)³/12 · f\'\'(ξ)</code> para algun ξ ∈ (a, b).',
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');

    const fa = f(a);
    const fb = f(b);
    const integral = (b - a) / 2 * (fa + fb);

    const iterations: MethodResult['iterations'] = [
      { punto: 'a', x: a, fx: fa },
      { punto: 'b', x: b, fx: fb },
    ];

    return { integral, iterations, converged: true, error: 0, message: `Trapecio simple: (${b}-${a})/2 · [f(${a}) + f(${b})]` };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const fa = f(a);
    const fb = f(b);

    const pad = (b - a) * 0.3;
    const xs = linspace(a - pad, b + pad, 500);
    const ys = xs.map(x => f(x));

    const chart1: ChartData = {
      title: 'Regla del Trapecio Simple',
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'Trapecio', x: [a, a, b, b, a], y: [0, fa, fb, 0, 0], color: '#a6e3a1', fill: true },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    // Show the actual area under curve vs trapezoid
    const xFill = linspace(a, b, 200);
    const yFill = xFill.map(x => f(x));

    const chart2: ChartData = {
      title: 'Area exacta vs Trapecio',
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'Area bajo curva', x: [...xFill, b, a], y: [...yFill, 0, 0], color: '#cba6f7', fill: true },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    // Convergence with composite for comparison
    const nValues = [1, 2, 4, 8, 16, 32, 64];
    const integrals = nValues.map(n => {
      const h = (b - a) / n;
      let s = f(a) + f(b);
      for (let i = 1; i < n; i++) s += 2 * f(a + i * h);
      return (h / 2) * s;
    });

    const chart3: ChartData = {
      title: 'Convergencia Trapecio Compuesto',
      type: 'line',
      datasets: [{ label: 'Integral', x: nValues, y: integrals, color: '#f9e2af', pointRadius: 3 }],
      xLabel: 'n', yLabel: 'Valor',
    };

    const chart4: ChartData = {
      title: 'Puntos de evaluacion',
      type: 'scatter',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa', pointRadius: 0 },
        { label: 'Puntos', x: [a, b], y: [fa, fb], color: '#fab387', pointRadius: 6, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    return [chart1, chart2, chart3, chart4];
  },
};
