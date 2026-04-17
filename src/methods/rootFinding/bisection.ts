import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const bisection: MethodDefinition = {
  id: 'bisection',
  name: 'Metodo de Biseccion',
  category: 'rootFinding',
  formula: 'c = (a + b) / 2, si f(a)·f(c) < 0 => b=c, sino a=c',
  description: 'Encuentra raices dividiendo el intervalo a la mitad en cada iteracion. Requiere f(a)·f(b) < 0.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^3 - x - 2', hint: 'Funcion a encontrar raiz', defaultValue: 'x^3 - x - 2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'b', label: 'b (limite superior)', placeholder: '2', type: 'number', defaultValue: '2' },
    { id: 'tol', label: 'Tolerancia', placeholder: '1e-6', defaultValue: '1e-6' },
    { id: 'maxIter', label: 'Max iteraciones', placeholder: '100', type: 'number', defaultValue: '100' },
  ],
  tableColumns: [
    { key: 'iter', label: 'n' },
    { key: 'a', label: 'a' },
    { key: 'b', label: 'b' },
    { key: 'c', label: 'c' },
    { key: 'fc', label: 'f(c)' },
    { key: 'error', label: 'Error' },
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    let a = parseFloat(params.a);
    let b = parseFloat(params.b);
    const tol = parseFloat(params.tol) || 1e-6;
    const maxIter = parseInt(params.maxIter) || 100;

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');

    const fa = f(a);
    const fb = f(b);
    if (fa * fb > 0) throw new Error('f(a) y f(b) deben tener signos opuestos (f(a)·f(b) < 0)');

    const iterations: MethodResult['iterations'] = [];
    let converged = false;
    let error = Math.abs(b - a);
    let c = a;

    for (let i = 1; i <= maxIter; i++) {
      c = (a + b) / 2;
      const fc = f(c);
      error = Math.abs(b - a) / 2;

      iterations.push({ iter: i, a, b, c, fc, error });

      if (Math.abs(fc) < 1e-15 || error < tol) {
        converged = true;
        break;
      }

      if (fa * fc < 0) {
        // Use f(a) sign comparison — but we need to track the actual f(a)
        // Since f(a) sign doesn't change when we update b:
      }
      if (f(a) * fc < 0) {
        b = c;
      } else {
        a = c;
      }
    }

    return { root: c, iterations, converged, error };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const aOrig = parseFloat(params.a);
    const bOrig = parseFloat(params.b);
    const pad = (bOrig - aOrig) * 0.3;
    const xs = linspace(aOrig - pad, bOrig + pad, 500);
    const ys = xs.map(x => f(x));

    // Chart 1: Function plot
    const chart1: ChartData = {
      title: 'f(x)',
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'y=0', x: [xs[0], xs[xs.length - 1]], y: [0, 0], color: '#585b70', dashed: true },
        ...(result.root !== undefined ? [{
          label: 'Raiz', x: [result.root], y: [0], color: '#a6e3a1', pointRadius: 6, showLine: false as const,
        }] : []),
      ],
      xLabel: 'x',
      yLabel: 'f(x)',
    };

    // Chart 2: Interval narrowing
    const iters = result.iterations.map(r => r.iter as number);
    const aVals = result.iterations.map(r => r.a as number);
    const bVals = result.iterations.map(r => r.b as number);
    const chart2: ChartData = {
      title: 'Convergencia del intervalo',
      type: 'line',
      datasets: [
        { label: 'a', x: iters, y: aVals, color: '#89b4fa' },
        { label: 'b', x: iters, y: bVals, color: '#f38ba8' },
      ],
      xLabel: 'Iteracion',
      yLabel: 'Valor',
    };

    // Chart 3: Midpoints
    const cVals = result.iterations.map(r => r.c as number);
    const chart3: ChartData = {
      title: 'Puntos medios c_n',
      type: 'line',
      datasets: [
        { label: 'c_n', x: iters, y: cVals, color: '#cba6f7', pointRadius: 3 },
      ],
      xLabel: 'Iteracion',
      yLabel: 'c',
    };

    // Chart 4: Error convergence (log scale)
    const errors = result.iterations.map(r => r.error as number).filter(e => e > 0);
    const errIters = iters.slice(0, errors.length);
    const chart4: ChartData = {
      title: 'Convergencia del error',
      type: 'line',
      datasets: [
        { label: '|error|', x: errIters, y: errors, color: '#fab387', pointRadius: 2 },
      ],
      xLabel: 'Iteracion',
      yLabel: 'Error',
      yLog: true,
    };

    return [chart1, chart2, chart3, chart4];
  },
};
