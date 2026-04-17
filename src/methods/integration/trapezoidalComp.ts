import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const trapezoidalComp: MethodDefinition = {
  id: 'trapezoidalComp',
  name: 'Regla del Trapecio Compuesta',
  category: 'integration',
  formula: '∫f(x)dx ≈ h/2 · [f(a) + 2·Σf(x_i) + f(b)]',
  description: 'Divide [a,b] en n subintervalos y aplica la regla del trapecio en cada uno.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'n (subintervalos)', placeholder: '10', type: 'number', defaultValue: '10' },
  ],
  tableColumns: [
    { key: 'i', label: 'i' },
    { key: 'xi', label: 'x_i' },
    { key: 'fxi', label: 'f(x_i)' },
    { key: 'coeff', label: 'Coeficiente' },
    { key: 'contrib', label: 'Contribucion' },
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const n = parseInt(params.n) || 10;

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');
    if (n < 1) throw new Error('n debe ser >= 1');

    const h = (b - a) / n;
    const iterations: MethodResult['iterations'] = [];
    let sum = 0;

    for (let i = 0; i <= n; i++) {
      const xi = a + i * h;
      const fxi = f(xi);
      const coeff = (i === 0 || i === n) ? 1 : 2;
      const contrib = coeff * fxi;
      sum += contrib;
      iterations.push({ i, xi, fxi, coeff, contrib });
    }

    const integral = (h / 2) * sum;
    return { integral, iterations, converged: true, error: 0, message: `h = ${h}, n = ${n}` };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const n = parseInt(params.n) || 10;
    const h = (b - a) / n;

    const pad = (b - a) * 0.1;
    const xs = linspace(a - pad, b + pad, 500);
    const ys = xs.map(x => f(x));

    // Trapezoids
    const trapX: number[] = [];
    const trapY: number[] = [];
    for (let i = 0; i < n; i++) {
      const xL = a + i * h;
      const xR = a + (i + 1) * h;
      trapX.push(xL, xL, xR, xR, xL);
      trapY.push(0, f(xL), f(xR), 0, 0);
      trapX.push(NaN);
      trapY.push(NaN);
    }

    const chart1: ChartData = {
      title: `Trapecio Compuesto (n=${n})`,
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'Trapecios', x: trapX, y: trapY, color: '#a6e3a1', fill: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    // Evaluation points
    const xPts = result.iterations.map(r => r.xi as number);
    const yPts = result.iterations.map(r => r.fxi as number);
    const chart2: ChartData = {
      title: 'Puntos de evaluacion',
      type: 'scatter',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa', pointRadius: 0 },
        { label: 'x_i', x: xPts, y: yPts, color: '#fab387', pointRadius: 4, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    // Cumulative
    const iters = result.iterations.map(r => r.i as number);
    let cumSum = 0;
    const hHalf = h / 2;
    const cumAreas = result.iterations.map(r => { cumSum += (r.contrib as number); return hHalf * cumSum; });
    const chart3: ChartData = {
      title: 'Integral acumulada',
      type: 'line',
      datasets: [{ label: 'Integral parcial', x: iters, y: cumAreas, color: '#cba6f7', pointRadius: 2 }],
      xLabel: 'Punto i', yLabel: 'Integral parcial',
    };

    // Convergence
    const nValues = [2, 4, 8, 16, 32, 64, 128, 256];
    const integrals = nValues.map(nv => {
      const hv = (b - a) / nv;
      let s = f(a) + f(b);
      for (let i = 1; i < nv; i++) s += 2 * f(a + i * hv);
      return (hv / 2) * s;
    });
    const chart4: ChartData = {
      title: 'Convergencia con n',
      type: 'line',
      datasets: [{ label: 'Integral', x: nValues, y: integrals, color: '#f9e2af', pointRadius: 3 }],
      xLabel: 'n', yLabel: 'Valor integral',
    };

    return [chart1, chart2, chart3, chart4];
  },
};
