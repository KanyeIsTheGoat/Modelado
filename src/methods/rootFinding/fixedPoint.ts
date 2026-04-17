import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const fixedPoint: MethodDefinition = {
  id: 'fixedPoint',
  name: 'Punto Fijo',
  category: 'rootFinding',
  formula: 'x_{n+1} = g(x_n), converge si |g\'(x)| < 1',
  description: 'Iteracion de punto fijo. Reescribir f(x)=0 como x=g(x) y iterar.',
  inputs: [
    { id: 'gx', label: 'g(x)', placeholder: '(x + 2/x) / 2', hint: 'Funcion de iteracion x = g(x)', defaultValue: '(x + 2/x) / 2' },
    { id: 'x0', label: 'x₀ (valor inicial)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'tol', label: 'Tolerancia', placeholder: '1e-6', defaultValue: '1e-6' },
    { id: 'maxIter', label: 'Max iteraciones', placeholder: '100', type: 'number', defaultValue: '100' },
  ],
  tableColumns: [
    { key: 'iter', label: 'n' },
    { key: 'xn', label: 'x_n' },
    { key: 'gxn', label: 'g(x_n)' },
    { key: 'error', label: 'Error' },
  ],

  solve(params) {
    const g = parseExpression(params.gx);
    let x = parseFloat(params.x0);
    const tol = parseFloat(params.tol) || 1e-6;
    const maxIter = parseInt(params.maxIter) || 100;

    if (isNaN(x)) throw new Error('x₀ debe ser un numero valido');

    const iterations: MethodResult['iterations'] = [];
    let converged = false;
    let error = Infinity;

    for (let i = 1; i <= maxIter; i++) {
      const xNew = g(x);
      error = Math.abs(xNew - x);

      iterations.push({ iter: i, xn: x, gxn: xNew, error });

      if (isNaN(xNew) || !isFinite(xNew)) {
        return { root: x, iterations, converged: false, error, message: 'Divergencia detectada' };
      }

      if (error < tol) {
        converged = true;
        x = xNew;
        break;
      }
      x = xNew;
    }

    return { root: x, iterations, converged, error };
  },

  getCharts(params, result) {
    const g = parseExpression(params.gx);
    const x0 = parseFloat(params.x0);
    const root = result.root ?? x0;

    // Determine plot range
    const allX = result.iterations.map(r => r.xn as number);
    const minX = Math.min(...allX, root) - 1;
    const maxX = Math.max(...allX, root) + 1;
    const xs = linspace(minX, maxX, 500);
    const gys = xs.map(x => g(x));

    // Chart 1: g(x) and y=x
    const chart1: ChartData = {
      title: 'g(x) y y = x',
      type: 'line',
      datasets: [
        { label: 'g(x)', x: xs, y: gys, color: '#89b4fa' },
        { label: 'y = x', x: xs, y: [...xs], color: '#585b70', dashed: true },
        ...(result.root !== undefined ? [{
          label: 'Punto fijo', x: [root], y: [root], color: '#a6e3a1', pointRadius: 6, showLine: false as const,
        }] : []),
      ],
      xLabel: 'x',
      yLabel: 'y',
    };

    // Chart 2: Cobweb diagram
    const cobwebX: number[] = [];
    const cobwebY: number[] = [];
    let cx = x0;
    cobwebX.push(cx);
    cobwebY.push(0);
    for (let i = 0; i < Math.min(result.iterations.length, 30); i++) {
      const gcx = g(cx);
      cobwebX.push(cx);
      cobwebY.push(gcx);
      cobwebX.push(gcx);
      cobwebY.push(gcx);
      cx = gcx;
    }

    const chart2: ChartData = {
      title: 'Diagrama de Telarana (Cobweb)',
      type: 'line',
      datasets: [
        { label: 'g(x)', x: xs, y: gys, color: '#89b4fa' },
        { label: 'y = x', x: xs, y: [...xs], color: '#585b70', dashed: true },
        { label: 'Cobweb', x: cobwebX, y: cobwebY, color: '#fab387', pointRadius: 0 },
      ],
      xLabel: 'x',
      yLabel: 'y',
    };

    // Chart 3: x_n convergence
    const iters = result.iterations.map(r => r.iter as number);
    const xnVals = result.iterations.map(r => r.xn as number);
    const chart3: ChartData = {
      title: 'Convergencia de x_n',
      type: 'line',
      datasets: [
        { label: 'x_n', x: iters, y: xnVals, color: '#cba6f7', pointRadius: 3 },
      ],
      xLabel: 'Iteracion',
      yLabel: 'x_n',
    };

    // Chart 4: Error
    const errors = result.iterations.map(r => r.error as number).filter(e => e > 0);
    const chart4: ChartData = {
      title: 'Convergencia del error',
      type: 'line',
      datasets: [
        { label: '|error|', x: iters.slice(0, errors.length), y: errors, color: '#fab387', pointRadius: 2 },
      ],
      xLabel: 'Iteracion',
      yLabel: 'Error',
      yLog: true,
    };

    return [chart1, chart2, chart3, chart4];
  },
};
