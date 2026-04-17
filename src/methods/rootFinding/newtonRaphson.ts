import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace, numericalDerivative } from '../../parser';

export const newtonRaphson: MethodDefinition = {
  id: 'newtonRaphson',
  name: 'Newton-Raphson',
  category: 'rootFinding',
  formula: 'x_{n+1} = x_n - f(x_n) / f\'(x_n)',
  description: 'Metodo de la tangente. Convergencia cuadratica cerca de la raiz. Requiere f\'(x).',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^3 - x - 2', defaultValue: 'x^3 - x - 2' },
    { id: 'dfx', label: "f'(x) (dejar vacio para derivada numerica)", placeholder: '3*x^2 - 1', hint: 'Derivada analitica. Si se deja vacio se usa derivada numerica central.', defaultValue: '3*x^2 - 1' },
    { id: 'x0', label: 'x₀ (valor inicial)', placeholder: '2', type: 'number', defaultValue: '2' },
    { id: 'tol', label: 'Tolerancia', placeholder: '1e-6', defaultValue: '1e-6' },
    { id: 'maxIter', label: 'Max iteraciones', placeholder: '100', type: 'number', defaultValue: '100' },
  ],
  tableColumns: [
    { key: 'iter', label: 'n' },
    { key: 'xn', label: 'x_n' },
    { key: 'fxn', label: 'f(x_n)' },
    { key: 'dfxn', label: "f'(x_n)" },
    { key: 'error', label: 'Error' },
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const dfExpr = params.dfx?.trim();
    const df = dfExpr ? parseExpression(dfExpr) : (x: number) => numericalDerivative(f, x);

    let x = parseFloat(params.x0);
    const tol = parseFloat(params.tol) || 1e-6;
    const maxIter = parseInt(params.maxIter) || 100;

    if (isNaN(x)) throw new Error('x₀ debe ser un numero valido');

    const iterations: MethodResult['iterations'] = [];
    let converged = false;
    let error = Infinity;

    for (let i = 1; i <= maxIter; i++) {
      const fxn = f(x);
      const dfxn = df(x);

      if (Math.abs(dfxn) < 1e-14) {
        iterations.push({ iter: i, xn: x, fxn, dfxn, error });
        return { root: x, iterations, converged: false, error, message: "f'(x) ≈ 0, division por cero" };
      }

      const xNew = x - fxn / dfxn;
      error = Math.abs(xNew - x);

      iterations.push({ iter: i, xn: x, fxn, dfxn, error });

      if (isNaN(xNew) || !isFinite(xNew)) {
        return { root: x, iterations, converged: false, error, message: 'Divergencia detectada' };
      }

      if (error < tol || Math.abs(fxn) < 1e-15) {
        converged = true;
        x = xNew;
        break;
      }
      x = xNew;
    }

    return { root: x, iterations, converged, error };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const dfExpr = params.dfx?.trim();
    const df = dfExpr ? parseExpression(dfExpr) : (x: number) => numericalDerivative(f, x);
    const root = result.root ?? parseFloat(params.x0);

    const allX = result.iterations.map(r => r.xn as number);
    const minX = Math.min(...allX, root) - 1;
    const maxX = Math.max(...allX, root) + 1;
    const xs = linspace(minX, maxX, 500);
    const ys = xs.map(x => f(x));

    // Chart 1: f(x) with root
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

    // Chart 2: Tangent lines
    const tangentDatasets: ChartData['datasets'] = [
      { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
      { label: 'y=0', x: [xs[0], xs[xs.length - 1]], y: [0, 0], color: '#585b70', dashed: true },
    ];
    const nTangents = Math.min(result.iterations.length, 6);
    for (let i = 0; i < nTangents; i++) {
      const xn = result.iterations[i].xn as number;
      const fxn = f(xn);
      const dfxn = df(xn);
      // Tangent: y = f(xn) + f'(xn)*(t - xn), find t where y=0: t = xn - f(xn)/f'(xn)
      const xInt = xn - fxn / dfxn;
      const t0 = Math.min(xn, xInt) - 0.2;
      const t1 = Math.max(xn, xInt) + 0.2;
      tangentDatasets.push({
        label: `Tangente n=${i + 1}`,
        x: [t0, t1],
        y: [fxn + dfxn * (t0 - xn), fxn + dfxn * (t1 - xn)],
        color: `hsl(${30 + i * 40}, 80%, 65%)`,
        dashed: true,
        pointRadius: 0,
      });
    }
    const chart2: ChartData = {
      title: 'Lineas tangentes',
      type: 'line',
      datasets: tangentDatasets,
      xLabel: 'x', yLabel: 'y',
    };

    // Chart 3: x_n convergence
    const iters = result.iterations.map(r => r.iter as number);
    const xnVals = result.iterations.map(r => r.xn as number);
    const chart3: ChartData = {
      title: 'Convergencia de x_n',
      type: 'line',
      datasets: [{ label: 'x_n', x: iters, y: xnVals, color: '#cba6f7', pointRadius: 3 }],
      xLabel: 'Iteracion', yLabel: 'x_n',
    };

    // Chart 4: Error
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
