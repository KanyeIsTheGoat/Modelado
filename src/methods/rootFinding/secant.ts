import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const secant: MethodDefinition = {
  id: 'secant',
  name: 'Metodo de la Secante',
  category: 'rootFinding',
  formula: 'x_{n+1} = x_n - f(x_n)·(x_n - x_{n-1}) / (f(x_n) - f(x_{n-1}))',
  description: 'Similar a Newton-Raphson pero no requiere la derivada. Usa dos puntos iniciales.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^3 - x - 2', defaultValue: 'x^3 - x - 2' },
    { id: 'x0', label: 'x₀', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'x1', label: 'x₁', placeholder: '2', type: 'number', defaultValue: '2' },
    { id: 'tol', label: 'Tolerancia', placeholder: '1e-6', defaultValue: '1e-6' },
    { id: 'maxIter', label: 'Max iteraciones', placeholder: '100', type: 'number', defaultValue: '100' },
  ],
  tableColumns: [
    { key: 'iter', label: 'n' },
    { key: 'xn_1', label: 'x_{n-1}' },
    { key: 'xn', label: 'x_n' },
    { key: 'fxn', label: 'f(x_n)' },
    { key: 'xn1', label: 'x_{n+1}' },
    { key: 'error', label: 'Error' },
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    let x0 = parseFloat(params.x0);
    let x1 = parseFloat(params.x1);
    const tol = parseFloat(params.tol) || 1e-6;
    const maxIter = parseInt(params.maxIter) || 100;

    if (isNaN(x0) || isNaN(x1)) throw new Error('x₀ y x₁ deben ser numeros validos');

    const iterations: MethodResult['iterations'] = [];
    let converged = false;
    let error = Infinity;

    for (let i = 1; i <= maxIter; i++) {
      const fx0 = f(x0);
      const fx1 = f(x1);
      const denom = fx1 - fx0;

      if (Math.abs(denom) < 1e-14) {
        iterations.push({ iter: i, xn_1: x0, xn: x1, fxn: fx1, xn1: x1, error });
        return { root: x1, iterations, converged: false, error, message: 'f(x_n) - f(x_{n-1}) ≈ 0' };
      }

      const x2 = x1 - fx1 * (x1 - x0) / denom;
      error = Math.abs(x2 - x1);

      iterations.push({ iter: i, xn_1: x0, xn: x1, fxn: fx1, xn1: x2, error });

      if (isNaN(x2) || !isFinite(x2)) {
        return { root: x1, iterations, converged: false, error, message: 'Divergencia detectada' };
      }

      if (error < tol || Math.abs(fx1) < 1e-15) {
        converged = true;
        x0 = x1;
        x1 = x2;
        break;
      }

      x0 = x1;
      x1 = x2;
    }

    return { root: x1, iterations, converged, error };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const root = result.root ?? 0;
    const allX = result.iterations.flatMap(r => [r.xn_1 as number, r.xn as number]);
    const minX = Math.min(...allX, root) - 1;
    const maxX = Math.max(...allX, root) + 1;
    const xs = linspace(minX, maxX, 500);
    const ys = xs.map(x => f(x));

    const chart1: ChartData = {
      title: 'f(x)',
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'y=0', x: [xs[0], xs[xs.length - 1]], y: [0, 0], color: '#585b70', dashed: true },
        { label: 'Raiz', x: [root], y: [0], color: '#a6e3a1', pointRadius: 6, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    // Secant lines
    const secDatasets: ChartData['datasets'] = [
      { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
      { label: 'y=0', x: [xs[0], xs[xs.length - 1]], y: [0, 0], color: '#585b70', dashed: true },
    ];
    const nLines = Math.min(result.iterations.length, 6);
    for (let i = 0; i < nLines; i++) {
      const xa = result.iterations[i].xn_1 as number;
      const xb = result.iterations[i].xn as number;
      const fxa = f(xa);
      const fxb = f(xb);
      secDatasets.push({
        label: `Secante n=${i + 1}`,
        x: [xa, xb],
        y: [fxa, fxb],
        color: `hsl(${30 + i * 40}, 80%, 65%)`,
        dashed: true,
        pointRadius: 3,
      });
    }
    const chart2: ChartData = { title: 'Lineas secantes', type: 'line', datasets: secDatasets, xLabel: 'x', yLabel: 'y' };

    const iters = result.iterations.map(r => r.iter as number);
    const xnVals = result.iterations.map(r => r.xn as number);
    const chart3: ChartData = {
      title: 'Convergencia de x_n',
      type: 'line',
      datasets: [{ label: 'x_n', x: iters, y: xnVals, color: '#cba6f7', pointRadius: 3 }],
      xLabel: 'Iteracion', yLabel: 'x_n',
    };

    const errors = result.iterations.map(r => r.error as number).filter(e => e > 0);
    const chart4: ChartData = {
      title: 'Convergencia del error',
      type: 'line',
      datasets: [{ label: '|error|', x: iters.slice(0, errors.length), y: errors, color: '#fab387', pointRadius: 2 }],
      xLabel: 'Iteracion', yLabel: 'Error', yLog: true,
    };

    return [chart1, chart2, chart3, chart4];
  },
};
