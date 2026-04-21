import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const richardson: MethodDefinition = {
  id: 'richardson',
  name: 'Extrapolacion de Richardson',
  category: 'differentiation',
  formula: "D = (4·D(h/2) - D(h)) / 3, mejora O(h²) a O(h⁴)",
  latexFormula: "D = \\frac{4\\,D(h/2) - D(h)}{3}, \\quad \\mathcal{O}(h^2) \\to \\mathcal{O}(h^4)",
  description: 'Combina aproximaciones con diferentes h para obtener mayor precision. Usa diferencia central como base.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'sin(x)', defaultValue: 'sin(x)' },
    { id: 'x0', label: 'x₀ (punto de evaluacion)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'h', label: 'h (paso inicial)', placeholder: '0.5', defaultValue: '0.5' },
    { id: 'levels', label: 'Niveles de extrapolacion', placeholder: '4', type: 'number', defaultValue: '4' },
    { id: 'dfx', label: "f'(x) exacta (opcional)", placeholder: 'cos(x)', defaultValue: 'cos(x)' },
  ],
  tableColumns: [
    { key: 'level', label: 'Nivel' },
    { key: 'h', label: 'h' },
    { key: 'D_base', label: 'D base (central)' },
    { key: 'D_richardson', label: 'D Richardson' },
    { key: 'error_base', label: 'Error base' },
    { key: 'error_rich', label: 'Error Richardson' },
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const x0 = parseFloat(params.x0);
    const hStart = parseFloat(params.h) || 0.5;
    const levels = parseInt(params.levels) || 4;
    const dfExpr = params.dfx?.trim();
    const df = dfExpr ? parseExpression(dfExpr) : null;

    if (isNaN(x0)) throw new Error('x₀ debe ser un numero valido');
    if (levels < 2) throw new Error('Se necesitan al menos 2 niveles');

    // Build Richardson table
    // D[i][j] where i = row (h level), j = column (extrapolation level)
    const n = levels;
    const D: number[][] = [];

    // Column 0: central differences with decreasing h
    for (let i = 0; i < n; i++) {
      const h = hStart / Math.pow(2, i);
      D.push([(f(x0 + h) - f(x0 - h)) / (2 * h)]);
    }

    // Fill Richardson table: D[i][j] = (4^j * D[i][j-1] - D[i-1][j-1]) / (4^j - 1)
    for (let j = 1; j < n; j++) {
      for (let i = j; i < n; i++) {
        const factor = Math.pow(4, j);
        const val = (factor * D[i][j - 1] - D[i - 1][j - 1]) / (factor - 1);
        D[i].push(val);
      }
    }

    const iterations: MethodResult['iterations'] = [];
    const exact = df ? df(x0) : NaN;

    for (let i = 0; i < n; i++) {
      const h = hStart / Math.pow(2, i);
      const dBase = D[i][0];
      const dRich = D[i][D[i].length - 1];
      const errorBase = df ? Math.abs(dBase - exact) : 0;
      const errorRich = df ? Math.abs(dRich - exact) : 0;

      iterations.push({
        level: i + 1,
        h,
        D_base: dBase,
        D_richardson: dRich,
        error_base: errorBase,
        error_rich: errorRich,
      });
    }

    const bestApprox = D[n - 1][D[n - 1].length - 1];
    const finalError = df ? Math.abs(bestApprox - exact) : 0;

    return {
      derivative: bestApprox,
      iterations, converged: true, error: finalError,
      message: `f'(${x0}) ≈ ${bestApprox.toPrecision(12)} (nivel ${n})`,
    };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const x0 = parseFloat(params.x0);
    const dfExpr = params.dfx?.trim();
    const df = dfExpr ? parseExpression(dfExpr) : null;

    const pad = 2;
    const xs = linspace(x0 - pad, x0 + pad, 500);
    const ys = xs.map(x => f(x));

    const bestSlope = result.derivative ?? 0;
    const tanXs = linspace(x0 - 1, x0 + 1, 100);
    const tanYs = tanXs.map(x => f(x0) + bestSlope * (x - x0));

    const chart1: ChartData = {
      title: 'f(x) con tangente Richardson',
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'Tangente Richardson', x: tanXs, y: tanYs, color: '#a6e3a1', dashed: true },
        { label: 'x₀', x: [x0], y: [f(x0)], color: '#fab387', pointRadius: 6, showLine: false },
      ],
      xLabel: 'x', yLabel: 'y',
    };

    // Error comparison: base vs Richardson
    const levels = result.iterations.map(r => r.level as number);
    const errBase = result.iterations.map(r => r.error_base as number).filter(e => e > 0);
    const errRich = result.iterations.map(r => r.error_rich as number).filter(e => e > 0);

    const chart2: ChartData = {
      title: 'Error: Central vs Richardson',
      type: 'line',
      datasets: [
        { label: 'Central O(h²)', x: levels.slice(0, errBase.length), y: errBase, color: '#f38ba8', pointRadius: 3 },
        { label: 'Richardson O(h⁴+)', x: levels.slice(0, errRich.length), y: errRich, color: '#a6e3a1', pointRadius: 3 },
      ],
      xLabel: 'Nivel', yLabel: '|Error|', yLog: true,
    };

    // Approximation comparison
    const dBase = result.iterations.map(r => r.D_base as number);
    const dRich = result.iterations.map(r => r.D_richardson as number);
    const chart3: ChartData = {
      title: "Convergencia: Central vs Richardson",
      type: 'line',
      datasets: [
        { label: 'Central', x: levels, y: dBase, color: '#f38ba8', pointRadius: 3 },
        { label: 'Richardson', x: levels, y: dRich, color: '#a6e3a1', pointRadius: 3 },
        ...(df ? [{ label: "f' exacta", x: [levels[0], levels[levels.length - 1]], y: [df(x0), df(x0)], color: '#f9e2af', dashed: true, pointRadius: 0 }] : []),
      ],
      xLabel: 'Nivel', yLabel: "f'(x)",
    };

    // h values used
    const hValues = result.iterations.map(r => r.h as number);
    const chart4: ChartData = {
      title: 'Valores de h por nivel',
      type: 'line',
      datasets: [{ label: 'h', x: levels, y: hValues, color: '#cba6f7', pointRadius: 4 }],
      xLabel: 'Nivel', yLabel: 'h', yLog: true,
    };

    return [chart1, chart2, chart3, chart4];
  },
};
