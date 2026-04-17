import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const midpoint: MethodDefinition = {
  id: 'midpoint',
  name: 'Regla del Rectangulo (Punto Medio)',
  category: 'integration',
  formula: '∫f(x)dx ≈ (b-a) · f((a+b)/2)',
  description: 'Aproxima la integral usando el valor de f en el punto medio del intervalo.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'n (subintervalos)', placeholder: '10', type: 'number', defaultValue: '10' },
  ],
  tableColumns: [
    { key: 'i', label: 'i' },
    { key: 'xi_mid', label: 'x_i (medio)' },
    { key: 'fxi', label: 'f(x_i)' },
    { key: 'area', label: 'Area parcial' },
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

    for (let i = 0; i < n; i++) {
      const xMid = a + (i + 0.5) * h;
      const fxMid = f(xMid);
      const area = h * fxMid;
      sum += fxMid;
      iterations.push({ i: i + 1, xi_mid: xMid, fxi: fxMid, area });
    }

    const integral = h * sum;
    return { integral, iterations, converged: true, error: 0, message: `h = ${h}` };
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

    // Rectangles for visualization
    const rectX: number[] = [];
    const rectY: number[] = [];
    for (let i = 0; i < n; i++) {
      const xL = a + i * h;
      const xR = a + (i + 1) * h;
      const xM = (xL + xR) / 2;
      const fM = f(xM);
      rectX.push(xL, xL, xR, xR, xL);
      rectY.push(0, fM, fM, 0, 0);
      rectX.push(NaN);
      rectY.push(NaN);
    }

    const chart1: ChartData = {
      title: 'Regla del Punto Medio',
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'Rectangulos', x: rectX, y: rectY, color: '#a6e3a1', fill: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    // Cumulative area
    const iters = result.iterations.map(r => r.i as number);
    let cumSum = 0;
    const cumAreas = result.iterations.map(r => { cumSum += r.area as number; return cumSum; });
    const chart2: ChartData = {
      title: 'Area acumulada',
      type: 'line',
      datasets: [{ label: 'Area acumulada', x: iters, y: cumAreas, color: '#cba6f7', pointRadius: 3 }],
      xLabel: 'Subintervalo', yLabel: 'Area',
    };

    // f(x_i) values
    const fvals = result.iterations.map(r => r.fxi as number);
    const xmids = result.iterations.map(r => r.xi_mid as number);
    const chart3: ChartData = {
      title: 'Valores f(x_i) en puntos medios',
      type: 'scatter',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa', pointRadius: 0 },
        { label: 'f(x_i)', x: xmids, y: fvals, color: '#fab387', pointRadius: 4, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    // Convergence: compute integral with different n values
    const nValues = [1, 2, 4, 8, 16, 32, 64, 128];
    const integrals = nValues.map(nv => {
      const hv = (b - a) / nv;
      let s = 0;
      for (let i = 0; i < nv; i++) s += f(a + (i + 0.5) * hv);
      return hv * s;
    });
    const chart4: ChartData = {
      title: 'Convergencia con n',
      type: 'line',
      datasets: [{ label: 'Integral', x: nValues, y: integrals, color: '#f9e2af', pointRadius: 3 }],
      xLabel: 'n (subintervalos)', yLabel: 'Valor integral',
    };

    return [chart1, chart2, chart3, chart4];
  },
};
