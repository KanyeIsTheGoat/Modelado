import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { parseTableData } from '../../ui';
import { maxAbsDerivative } from '../../integrationHelpers';

function dividedDifferences(xs: number[], ys: number[]): number[][] {
  const n = xs.length;
  const table: number[][] = [ys.slice()];
  for (let k = 1; k < n; k++) {
    const col: number[] = [];
    for (let i = 0; i < n - k; i++) {
      const num = table[k - 1][i + 1] - table[k - 1][i];
      const den = xs[i + k] - xs[i];
      col.push(num / den);
    }
    table.push(col);
  }
  return table;
}

function evalNewton(xs: number[], coeffs: number[], x: number): number {
  let result = coeffs[coeffs.length - 1];
  for (let i = coeffs.length - 2; i >= 0; i--) {
    result = result * (x - xs[i]) + coeffs[i];
  }
  return result;
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export const newtonDD: MethodDefinition = {
  id: 'newtonDD',
  name: 'Diferencias Divididas de Newton',
  category: 'interpolation',
  formula: 'P_n(x) = f[x_0] + f[x_0,x_1](x-x_0) + ... + f[x_0,...,x_n]∏(x-x_i)',
  latexFormula: 'P_n(x) = f[x_0] + \\sum_{k=1}^{n} f[x_0, x_1, \\ldots, x_k]\\,\\prod_{i=0}^{k-1}(x - x_i)',
  description: 'Construye el polinomio interpolante de Newton con diferencias divididas. Tabla triangular con f[x_i,...,x_{i+k}] como coeficientes.',
  inputs: [
    {
      id: 'points',
      label: 'Puntos (x, y)',
      placeholder: '',
      type: 'table',
      tableColumns: 2,
      tableHeaders: ['x_i', 'y_i'],
      defaultValue: '0,1;1,3;2,2;3,5',
    },
    { id: 'xQuery', label: 'x objetivo (donde evaluar P_n(x))', placeholder: '1.5', type: 'number', defaultValue: '1.5' },
    { id: 'fx', label: 'f(x) real (opcional, para error)', placeholder: 'p.ej. sin(x)', hint: 'Funcion subyacente para calcular error local y cota global.' },
  ],
  tableColumns: [
    { key: 'i', label: 'i', latex: 'i' },
    { key: 'xi', label: 'x_i', latex: 'x_i' },
    { key: 'f0', label: 'f[x_i]', latex: 'f[x_i]' },
    { key: 'f1', label: 'f[·,·]', latex: 'f[x_i, x_{i+1}]' },
    { key: 'f2', label: 'f[·,·,·]', latex: 'f[x_i, \\ldots, x_{i+2}]' },
    { key: 'f3', label: 'f[·,·,·,·]', latex: 'f[x_i, \\ldots, x_{i+3}]' },
    { key: 'f4', label: 'f[·,·,·,·,·]', latex: 'f[x_i, \\ldots, x_{i+4}]' },
  ],
  steps: [
    'Carga los puntos (x_i, y_i) en la tabla. Funciona igual que Lagrange pero produce el polinomio en <b>forma de Newton</b>: <code>P_n(x) = a_0 + a_1(x - x_0) + a_2(x - x_0)(x - x_1) + ...</code> donde los <code>a_k</code> son las diferencias divididas.',
    'Ventaja vs Lagrange: <em>agregar un nuevo punto no obliga a recomputar todo</em> — solo agregas una columna a la tabla. Util cuando el parcial pide progresivamente ver como cambia el polinomio al sumar puntos.',
    'Pulsa <b>Resolver</b>. La tabla triangular muestra:<br>&nbsp;&nbsp;• Columna <code>f[x_i]</code>: valores <code>y_i</code>.<br>&nbsp;&nbsp;• Columna <code>f[x_i, x_{i+1}]</code>: <code>(f[x_{i+1}] - f[x_i]) / (x_{i+1} - x_i)</code>.<br>&nbsp;&nbsp;• Columnas siguientes: diferencias divididas de orden mayor.<br>Los <b>coeficientes</b> <code>a_k = f[x_0, ..., x_k]</code> son la fila superior (i = 0) de cada columna.',
    'Si diste <code>f(x)</code> real, la app calcula error local y cota global igual que Lagrange.',
    'Los graficos muestran, ademas del polinomio final, los <b>polinomios parciales</b> <code>P_0, P_1, ..., P_n</code> — util para visualizar como cada punto nuevo refina la interpolacion.',
    'En el informe mostra la tabla triangular completa de diferencias divididas + el polinomio resultante + valor en x* + error vs f(x) si esta disponible.',
  ],

  solve(params) {
    const table = parseTableData(params.points);
    if (table.length < 2) throw new Error('Se requieren al menos 2 puntos');
    const xs = table.map(r => r[0]);
    const ys = table.map(r => r[1]);

    const uniqueXs = new Set(xs);
    if (uniqueXs.size !== xs.length) throw new Error('Los valores de x_i deben ser distintos');

    const xQuery = parseFloat(params.xQuery);
    if (isNaN(xQuery)) throw new Error('x objetivo invalido');

    const dd = dividedDifferences(xs, ys);
    const coeffs = dd.map(col => col[0]);
    const n = xs.length - 1;
    const value = evalNewton(xs, coeffs, xQuery);

    const iterations: MethodResult['iterations'] = xs.map((xi, i) => {
      const row: Record<string, any> = { i, xi };
      for (let k = 0; k < dd.length && k <= 4; k++) {
        row[`f${k}`] = i < dd[k].length ? dd[k][i] : null;
      }
      return row;
    });

    // Error analysis (if f(x) provided)
    let relativeErrorPercent: number | undefined;
    let truncationBound: number | undefined;
    let maxDerivative: number | undefined;
    let xiApprox: number | undefined;
    let derivativeExpr: string | undefined;
    const coeffStr = coeffs.map((c, i) => `${i === 0 ? '' : c >= 0 ? '+' : ''}${c.toPrecision(5)}`).join(' ');
    let message = `P_${n}(${xQuery}) = ${value.toPrecision(8)} | coef: [${coeffStr}]`;

    const fxExpr = (params.fx ?? '').trim();
    if (fxExpr !== '') {
      try {
        const f = parseExpression(fxExpr);
        const fVal = f(xQuery);
        relativeErrorPercent = Math.abs(fVal) > 1e-14
          ? Math.abs(value - fVal) / Math.abs(fVal) * 100
          : Math.abs(value - fVal) * 100;

        const aInt = Math.min(...xs);
        const bInt = Math.max(...xs);
        const d = maxAbsDerivative(fxExpr, n + 1, aInt, bInt);
        maxDerivative = d.max;
        xiApprox = d.xAtMax;
        derivativeExpr = d.derivativeExpr ?? undefined;

        let prod = 1;
        for (const xi of xs) prod *= (xQuery - xi);
        truncationBound = (d.max / factorial(n + 1)) * Math.abs(prod);

        message += ` · f(${xQuery}) = ${fVal.toPrecision(8)} · |error| = ${Math.abs(value - fVal).toPrecision(6)}`;
        if (derivativeExpr) message += ` · f⁽${n + 1}⁾(x) = ${derivativeExpr}`;
      } catch (e: any) {
        message += ` · (no se pudo evaluar f(x): ${e.message})`;
      }
    }

    return {
      root: value,
      iterations,
      converged: true,
      error: truncationBound ?? 0,
      exact: fxExpr !== '' ? parseExpression(fxExpr)(xQuery) : undefined,
      relativeErrorPercent,
      truncationBound,
      truncationOrder: truncationBound !== undefined ? n + 1 : undefined,
      maxDerivative,
      xiApprox,
      derivativeExpr,
      message,
    };
  },

  getCharts(params, result) {
    const table = parseTableData(params.points);
    const xs = table.map(r => r[0]);
    const ys = table.map(r => r[1]);
    const xQuery = parseFloat(params.xQuery);
    const n = xs.length - 1;

    const dd = dividedDifferences(xs, ys);
    const coeffs = dd.map(col => col[0]);

    const aInt = Math.min(...xs);
    const bInt = Math.max(...xs);
    const pad = (bInt - aInt) * 0.15 + 1e-6;
    const xsPlot = linspace(aInt - pad, bInt + pad, 400);
    const ysPoly = xsPlot.map(x => evalNewton(xs, coeffs, x));

    const fxExpr = (params.fx ?? '').trim();
    const datasetsCurve: ChartData['datasets'] = [
      { label: 'P_n(x)', x: xsPlot, y: ysPoly, color: '#cba6f7' },
      { label: 'Datos', x: xs, y: ys, color: '#f9e2af', pointRadius: 5, showLine: false },
      { label: 'P_n(x*)', x: [xQuery], y: [result.root ?? 0], color: '#a6e3a1', pointRadius: 6, showLine: false },
    ];
    if (fxExpr !== '') {
      try {
        const f = parseExpression(fxExpr);
        datasetsCurve.unshift({ label: 'f(x)', x: xsPlot, y: xsPlot.map(x => f(x)), color: '#89b4fa', dashed: true });
      } catch {}
    }
    const chart1: ChartData = {
      title: `Polinomio de Newton (grado ${n})`,
      type: 'line',
      datasets: datasetsCurve,
      xLabel: 'x', yLabel: 'y',
    };

    // Partial polynomials: P_0, P_1, ..., P_n
    const partialDatasets: ChartData['datasets'] = [];
    const COLORS = ['#89b4fa', '#a6e3a1', '#fab387', '#f38ba8', '#94e2d5', '#f9e2af', '#cba6f7', '#f5c2e7'];
    for (let k = 0; k <= n; k++) {
      const partialCoeffs = coeffs.slice(0, k + 1);
      const partialXs = xs.slice(0, k + 1);
      partialDatasets.push({
        label: `P_${k}(x)`,
        x: xsPlot,
        y: xsPlot.map(x => evalNewton(partialXs, partialCoeffs, x)),
        color: COLORS[k % COLORS.length],
        pointRadius: 0,
      });
    }
    partialDatasets.push({ label: 'Datos', x: xs, y: ys, color: '#f9e2af', pointRadius: 5, showLine: false });
    const chart2: ChartData = {
      title: 'Polinomios parciales P_0 ... P_n',
      type: 'line',
      datasets: partialDatasets,
      xLabel: 'x', yLabel: 'y',
    };

    // Error or product
    let chart3: ChartData;
    if (fxExpr !== '') {
      try {
        const f = parseExpression(fxExpr);
        const err = xsPlot.map(x => Math.abs(f(x) - evalNewton(xs, coeffs, x)));
        chart3 = {
          title: '|f(x) - P_n(x)| — error absoluto',
          type: 'line',
          datasets: [
            { label: '|error|', x: xsPlot, y: err, color: '#f38ba8' },
            { label: 'x objetivo', x: [xQuery, xQuery], y: [0, Math.max(...err)], color: '#a6e3a1', dashed: true, pointRadius: 0 },
          ],
          xLabel: 'x', yLabel: '|error|',
        };
      } catch {
        chart3 = productChart(xsPlot, xs, xQuery);
      }
    } else {
      chart3 = productChart(xsPlot, xs, xQuery);
    }

    // Coefficients bar
    const chart4: ChartData = {
      title: 'Coeficientes de Newton f[x_0, ..., x_k]',
      type: 'bar',
      datasets: [
        { label: 'a_k', x: coeffs.map((_, i) => i), y: coeffs, color: '#94e2d5' },
      ],
      xLabel: 'k', yLabel: 'coeficiente',
    };

    return [chart1, chart2, chart3, chart4];
  },
};

function productChart(xsPlot: number[], xs: number[], xQuery: number): ChartData {
  const prodY = xsPlot.map(x => xs.reduce((acc, xi) => acc * (x - xi), 1));
  return {
    title: '∏ (x - x_i) — factor del error',
    type: 'line',
    datasets: [
      { label: '∏(x - x_i)', x: xsPlot, y: prodY, color: '#fab387' },
      { label: 'x objetivo', x: [xQuery], y: [xs.reduce((acc, xi) => acc * (xQuery - xi), 1)], color: '#a6e3a1', pointRadius: 6, showLine: false },
    ],
    xLabel: 'x', yLabel: 'producto',
  };
}
