import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { parseTableData } from '../../ui';
import { maxAbsDerivative } from '../../integrationHelpers';

function evalLagrange(xs: number[], ys: number[], x: number): { value: number; basis: number[] } {
  const n = xs.length;
  const basis: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let Li = 1;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      Li *= (x - xs[j]) / (xs[i] - xs[j]);
    }
    basis.push(Li);
    sum += ys[i] * Li;
  }
  return { value: sum, basis };
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export const lagrange: MethodDefinition = {
  id: 'lagrange',
  name: 'Interpolacion de Lagrange',
  category: 'interpolation',
  formula: 'P_n(x) = Σ y_i · L_i(x), L_i(x) = ∏_{j≠i} (x - x_j)/(x_i - x_j)',
  description: 'Construye el polinomio interpolante de grado ≤ n que pasa por n+1 puntos. Si se provee f(x), calcula error local y cota global.',
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
    { key: 'i', label: 'i' },
    { key: 'xi', label: 'x_i' },
    { key: 'yi', label: 'y_i' },
    { key: 'Li', label: 'L_i(x)' },
    { key: 'yiLi', label: 'y_i · L_i(x)' },
  ],
  steps: [
    'Carga la <b>tabla de puntos</b> (x_i, y_i) en el primer input. Podes:<br>&nbsp;&nbsp;• Pegar tabla discreta tal cual viene del parcial, ej: <code>0,1;1,3;3,0</code> (puntos (0,1), (1,3), (3,0)).<br>&nbsp;&nbsp;• Construirla evaluando <code>f(x)</code> en cada nodo. Ej: para <code>f(x) = sin(πx)</code> en nodos 0, 0.5, 1, 1.5 → <code>0,0;0.5,1;1,0;1.5,-1</code>.',
    'El <b>grado</b> del polinomio interpolante sera <code>n - 1</code> donde n es la cantidad de puntos. Con 4 puntos → polinomio cubico.',
    'En "x objetivo" pone donde queres <b>evaluar</b> <code>P_n(x*)</code>. Ej: x = 2 para la tabla (0,1)(1,3)(3,0); o x = 0.45 o x = 0.75 segun el parcial.',
    'Si el parcial da una <code>f(x)</code> original (no solo tabla), escribila en el campo "f(x) real". La app calcula:<br>&nbsp;&nbsp;• <b>Error local</b> en x*: <code>|f(x*) - P_n(x*)|</code>.<br>&nbsp;&nbsp;• <b>Cota global</b>: <code>|E| ≤ max|f⁽ⁿ⁺¹⁾(ξ)| / (n+1)! · |∏(x - x_i)|</code>. La app deriva <code>f</code> simbolicamente orden n+1 y encuentra <code>max|f⁽ⁿ⁺¹⁾|</code> en [min(x_i), max(x_i)] numericamente. ξ es el punto donde ese maximo se alcanza.',
    'Pulsa <b>Resolver</b>. La tabla muestra por nodo: <code>i, x_i, y_i, L_i(x*), y_i·L_i(x*)</code>. La suma de la ultima columna es <code>P_n(x*)</code>. Cada <code>L_i(x)</code> es <code>∏_{j≠i} (x - x_j) / (x_i - x_j)</code>: vale 1 en x_i y 0 en los demas nodos.',
    'Revisa los graficos:<br>&nbsp;&nbsp;1. <em>Polinomio interpolante</em> con nodos marcados y, si diste f(x), la curva real superpuesta para ver donde divergen.<br>&nbsp;&nbsp;2. <em>Polinomios base L_i(x)</em> — cada L_i vale 1 en un solo nodo.<br>&nbsp;&nbsp;3. <em>Error |f - P_n|</em> o el factor <code>∏(x - x_i)</code>.<br>&nbsp;&nbsp;4. <em>Contribuciones y_i·L_i(x*)</em>.',
    'Para el <b>punto b del parcial</b> (derivar en x*): copia <code>P_n(x*)</code> como <code>y_0</code> y usa <b>diferencias centrales</b> con paso chico sobre el polinomio. O mejor: re-evalua <code>P_n</code> en <code>x* ± h</code> directamente con Lagrange y aplica <code>f\'(x*) ≈ [P_n(x*+h) - P_n(x*-h)] / (2h)</code>. La guia del metodo <em>Diferencia central</em> te indica como.',
    'Informe: polinomio resultante, grafica, error local en ξ, cota global, y justificacion de que <code>|error| &lt; 1 %</code>.',
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

    const { value, basis } = evalLagrange(xs, ys, xQuery);
    const n = xs.length - 1;

    const iterations: MethodResult['iterations'] = xs.map((xi, i) => ({
      i,
      xi,
      yi: ys[i],
      Li: basis[i],
      yiLi: ys[i] * basis[i],
    }));

    // Error analysis (if f(x) provided)
    let relativeErrorPercent: number | undefined;
    let truncationBound: number | undefined;
    let maxDerivative: number | undefined;
    let xiApprox: number | undefined;
    let derivativeExpr: string | undefined;
    let message = `P_${n}(${xQuery}) = ${value.toPrecision(8)} | grado ${n}`;

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

        // Global bound: |f(x) - P_n(x)| ≤ M/(n+1)! · |∏(x - x_i)|
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

    const aInt = Math.min(...xs);
    const bInt = Math.max(...xs);
    const pad = (bInt - aInt) * 0.15 + 1e-6;
    const xsPlot = linspace(aInt - pad, bInt + pad, 400);
    const ysPoly = xsPlot.map(x => evalLagrange(xs, ys, x).value);

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
      title: `Polinomio interpolante (grado ${n})`,
      type: 'line',
      datasets: datasetsCurve,
      xLabel: 'x', yLabel: 'y',
    };

    // Lagrange basis polynomials L_i(x)
    const basisDatasets: ChartData['datasets'] = xs.map((_, i) => ({
      label: `L_${i}(x)`,
      x: xsPlot,
      y: xsPlot.map(x => evalLagrange(xs, ys, x).basis[i]),
      color: `hsl(${(i * 360) / xs.length}, 70%, 65%)`,
      pointRadius: 0,
    }));
    const chart2: ChartData = {
      title: 'Polinomios base L_i(x)',
      type: 'line',
      datasets: basisDatasets,
      xLabel: 'x', yLabel: 'L_i(x)',
    };

    // Error curve or product ∏(x - x_i)
    let chart3: ChartData;
    if (fxExpr !== '') {
      try {
        const f = parseExpression(fxExpr);
        const err = xsPlot.map(x => Math.abs(f(x) - evalLagrange(xs, ys, x).value));
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

    // Contributions y_i·L_i at x*
    const iterRows = result.iterations;
    const contribX = iterRows.map(r => r.i as number);
    const contribY = iterRows.map(r => r.yiLi as number);
    const chart4: ChartData = {
      title: `Contribuciones y_i · L_i(x*) con x* = ${xQuery}`,
      type: 'bar',
      datasets: [
        { label: 'y_i · L_i(x*)', x: contribX, y: contribY, color: '#94e2d5' },
      ],
      xLabel: 'i', yLabel: 'Contribucion',
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
