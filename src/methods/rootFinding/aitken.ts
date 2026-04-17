import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const aitken: MethodDefinition = {
  id: 'aitken',
  name: 'Aceleracion de Aitken (Δ²)',
  category: 'rootFinding',
  formula: 'x̂_n = x_n - (x_{n+1} - x_n)² / (x_{n+2} - 2x_{n+1} + x_n)',
  description: 'Acelera la convergencia de punto fijo usando extrapolacion delta-cuadrado de Aitken.',
  inputs: [
    { id: 'gx', label: 'g(x)', placeholder: '(x + 2/x) / 2', hint: 'Funcion de iteracion x = g(x)', defaultValue: '(x + 2/x) / 2' },
    { id: 'x0', label: 'x₀ (valor inicial)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'tol', label: 'Tolerancia', placeholder: '1e-6', defaultValue: '1e-6' },
    { id: 'maxIter', label: 'Max iteraciones', placeholder: '100', type: 'number', defaultValue: '100' },
  ],
  tableColumns: [
    { key: 'iter', label: 'n' },
    { key: 'xn', label: 'x_n (plain)' },
    { key: 'xn_aitken', label: 'x̂_n (Aitken)' },
    { key: 'error_plain', label: 'Error plain' },
    { key: 'error_aitken', label: 'Error Aitken' },
  ],

  solve(params) {
    const g = parseExpression(params.gx);
    const x0 = parseFloat(params.x0);
    const tol = parseFloat(params.tol) || 1e-6;
    const maxIter = parseInt(params.maxIter) || 100;

    if (isNaN(x0)) throw new Error('x₀ debe ser un numero valido');

    const iterations: MethodResult['iterations'] = [];
    let converged = false;
    let error = Infinity;

    // Generate plain fixed-point sequence
    const plain: number[] = [x0];
    let x = x0;
    for (let i = 0; i < maxIter + 2; i++) {
      x = g(x);
      if (isNaN(x) || !isFinite(x)) break;
      plain.push(x);
    }

    // Apply Aitken acceleration: x̂_n = x_n - (x_{n+1} - x_n)^2 / (x_{n+2} - 2*x_{n+1} + x_n)
    let lastAitken = x0;
    for (let n = 0; n < plain.length - 2 && n < maxIter; n++) {
      const xn = plain[n];
      const xn1 = plain[n + 1];
      const xn2 = plain[n + 2];

      const denom = xn2 - 2 * xn1 + xn;
      let aitkenVal: number;

      if (Math.abs(denom) < 1e-14) {
        aitkenVal = xn2; // Can't accelerate, use plain value
      } else {
        aitkenVal = xn - (xn1 - xn) ** 2 / denom;
      }

      const errorPlain = n > 0 ? Math.abs(plain[n] - plain[n - 1]) : Math.abs(xn1 - xn);
      const errorAitken = Math.abs(aitkenVal - lastAitken);
      error = errorAitken;

      iterations.push({
        iter: n + 1,
        xn: plain[n + 1],
        xn_aitken: aitkenVal,
        error_plain: errorPlain,
        error_aitken: errorAitken,
      });

      if (errorAitken < tol) {
        converged = true;
        lastAitken = aitkenVal;
        break;
      }
      lastAitken = aitkenVal;
    }

    return { root: lastAitken, iterations, converged, error };
  },

  getCharts(params, result) {
    const g = parseExpression(params.gx);
    const x0 = parseFloat(params.x0);
    const root = result.root ?? x0;

    const allX = result.iterations.flatMap(r => [r.xn as number, r.xn_aitken as number]);
    const minX = Math.min(...allX, root) - 1;
    const maxX = Math.max(...allX, root) + 1;
    const xs = linspace(minX, maxX, 500);
    const gys = xs.map(x => g(x));

    const chart1: ChartData = {
      title: 'g(x) y y = x',
      type: 'line',
      datasets: [
        { label: 'g(x)', x: xs, y: gys, color: '#89b4fa' },
        { label: 'y = x', x: xs, y: [...xs], color: '#585b70', dashed: true },
        { label: 'Punto fijo', x: [root], y: [root], color: '#a6e3a1', pointRadius: 6, showLine: false },
      ],
      xLabel: 'x', yLabel: 'y',
    };

    const iters = result.iterations.map(r => r.iter as number);
    const plainVals = result.iterations.map(r => r.xn as number);
    const aitkenVals = result.iterations.map(r => r.xn_aitken as number);

    const chart2: ChartData = {
      title: 'Comparacion: Plain vs Aitken',
      type: 'line',
      datasets: [
        { label: 'Punto fijo', x: iters, y: plainVals, color: '#f38ba8', pointRadius: 3 },
        { label: 'Aitken', x: iters, y: aitkenVals, color: '#a6e3a1', pointRadius: 3 },
      ],
      xLabel: 'Iteracion', yLabel: 'x_n',
    };

    const errPlain = result.iterations.map(r => r.error_plain as number).filter(e => e > 0);
    const errAitken = result.iterations.map(r => r.error_aitken as number).filter(e => e > 0);
    const minLen = Math.min(errPlain.length, errAitken.length);

    const chart3: ChartData = {
      title: 'Comparacion de errores',
      type: 'line',
      datasets: [
        { label: 'Error plain', x: iters.slice(0, errPlain.length), y: errPlain, color: '#f38ba8', pointRadius: 2 },
        { label: 'Error Aitken', x: iters.slice(0, errAitken.length), y: errAitken, color: '#a6e3a1', pointRadius: 2 },
      ],
      xLabel: 'Iteracion', yLabel: 'Error', yLog: true,
    };

    const chart4: ChartData = {
      title: 'Secuencia Aitken',
      type: 'line',
      datasets: [{ label: 'x̂_n', x: iters, y: aitkenVals, color: '#cba6f7', pointRadius: 3 }],
      xLabel: 'Iteracion', yLabel: 'x̂_n',
    };

    return [chart1, chart2, chart3, chart4];
  },
};
