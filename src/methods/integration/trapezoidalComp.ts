import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { trapecioError, renderIntegrationConvergencePanel, renderIntegrationTruncationAtXi, renderPerPointBreakdownPanel, detectRemovableSingularities, renderLhopitalPanel } from '../../integrationHelpers';

function computeTrapecio(f: (x: number) => number, a: number, b: number, n: number): { integral: number; iterations: MethodResult['iterations']; h: number } {
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
  return { integral: (h / 2) * sum, iterations, h };
}

export const trapezoidalComp: MethodDefinition = {
  id: 'trapezoidalComp',
  name: 'Regla del Trapecio Compuesta',
  category: 'integration',
  formula: '∫f(x)dx ≈ h/2 · [f(a) + 2·Σf(x_i) + f(b)]',
  latexFormula: '\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\left[f(a) + 2\\sum_{i=1}^{n-1} f(x_i) + f(b)\\right], \\quad h = \\frac{b-a}{n}',
  description: 'Divide [a,b] en n subintervalos y aplica la regla del trapecio en cada uno.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'n (subintervalos)', placeholder: '10', type: 'number', defaultValue: '10' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: 'p.ej. 0.333333', type: 'number', hint: 'Si se provee, se calcula el error relativo vs exacto.' },
    { id: 'xi', label: 'ξ para error de truncamiento (opcional)', placeholder: 'p.ej. 0.5', type: 'number', hint: 'Punto donde evaluar E = -(b-a)h²/12 · f´´(ξ). Dejar vacio para mostrar solo la cota del peor caso.' },
  ],
  tableColumns: [
    { key: 'i', label: 'i', latex: 'i' },
    { key: 'xi', label: 'x_i', latex: 'x_i' },
    { key: 'fxi', label: 'f(x_i)', latex: 'f(x_i)' },
    { key: 'coeff', label: 'Coef', latex: 'c_i' },
    { key: 'contrib', label: 'c_i·f(x_i)', latex: 'c_i \\cdot f(x_i)' },
  ],
  steps: [
    'Escribe <code>f(x)</code>. Para el <b>parcial 2025-I</b>: <code>ln(x+1)/x</code> sobre <code>[0, 1]</code>. Ojo, en <code>x=0</code> la funcion tiene singularidad removible — el parser lanzaria <code>NaN</code>; usa <code>a = 1e-10</code> (≈ 0) o redefine como <code>ln(x+1)/x</code> y prueba primero n=4. Para <b>parcial 30/04/2025</b>: <code>sqrt(2)·exp(x^2)</code> sobre <code>[0, 1]</code>.',
    'Completa <code>a</code>, <code>b</code>, y <code>n</code>. El parcial te pide <code>n = 4</code> (y luego <code>n = 10</code> en el de 30/04 para comparar). El paso es <code>h = (b - a)/n</code>. La app calcula <b>una sola vez</b> con ese n (sin duplicaciones automaticas).',
    'Formula compuesta: <code>I ≈ h/2 · [f(a) + 2·Σ f(x_i) + f(b)]</code> con pesos <b>1, 2, 2, ..., 2, 1</b>. La tabla te muestra en la columna <em>Coeficiente</em> exactamente esto: 1 en los extremos y 2 en los puntos interiores.',
    'Pulsa <b>Resolver</b>. La columna <em>Contribucion = coef · f(x_i)</em> y la suma total multiplicada por <code>h/2</code> da la integral aproximada.',
    '<b>Error de truncamiento</b>: <code>|E| = -(b-a)·h²/12 · f\'\'(ξ)</code> para algun <code>ξ ∈ (a, b)</code>. La app calcula <code>f\'\'(x)</code> simbolicamente y halla el <code>ξ</code> que maximiza <code>|f\'\'|</code> en [a,b] (peor caso — cota superior).',
    'Si el parcial te fija <code>ξ = 0.5</code> (como en 30/04/2025), evalua a mano <code>f\'\'(0.5)</code> y calcula la cota con ese valor concreto: <code>|E| = (b-a)h²/12 · |f\'\'(0.5)|</code>. La app siempre reporta el peor caso; puedes usarlo de referencia.',
    'Si das <b>valor exacto</b>: la app calcula <em>error relativo %</em> vs ese exacto. No reintenta con otro n — si queres mas precision, cambia <code>n</code> manualmente.',
    'Para la <b>comparacion con Simpson 1/3</b> (ultima parte del parcial): anota el <em>valor integral</em>, <em>error relativo</em> y la <em>cota</em>. Simpson con mismo n baja el error porque converge <code>O(h⁴)</code> vs <code>O(h²)</code> del trapecio — se ve claramente en la grafica de convergencia.',
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const n = parseInt(params.n) || 10;
    const exactRaw = (params.exact ?? '').trim();
    const exact = exactRaw === '' ? undefined : parseFloat(exactRaw);

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');
    if (n < 1) throw new Error('n debe ser >= 1');

    const run = computeTrapecio(f, a, b, n);
    const errInfo = trapecioError(params.fx, a, b, run.h);

    const errRelPct = exact !== undefined && !isNaN(exact) && exact !== 0
      ? Math.abs((run.integral - exact) / exact) * 100
      : undefined;

    const msgParts = [`h = ${run.h.toPrecision(6)}, n = ${n}`];
    if (errInfo.derivativeExpr) msgParts.push(`f''(x) = ${errInfo.derivativeExpr}`);
    if (errRelPct !== undefined) msgParts.push(`error relativo vs exacto: ${errRelPct.toPrecision(4)}%`);

    const panels: string[] = [];

    const xsForDetect = run.iterations.map(r => r.xi as number);
    const singularities = detectRemovableSingularities(params.fx, xsForDetect);
    if (singularities.length > 0) {
      panels.push(renderLhopitalPanel(singularities, params.fx));
    }

    panels.push(renderPerPointBreakdownPanel({
      methodName: 'Trapecio Compuesto',
      n, h: run.h, prefactor: run.h / 2, prefactorLabel: 'h/2',
      integral: run.integral,
      points: run.iterations.map(r => ({
        i: r.i as number, xi: r.xi as number, fxi: r.fxi as number,
        coeff: r.coeff as number, contrib: r.contrib as number,
      })),
    }));

    const xiRaw = (params.xi ?? '').trim();
    if (xiRaw !== '') {
      const xiVal = parseFloat(xiRaw);
      if (!isNaN(xiVal)) {
        panels.push(renderIntegrationTruncationAtXi({
          methodName: 'Trapecio Compuesto',
          fxExpr: params.fx, a, b, h: run.h, n, xi: xiVal,
          order: 2, denom: 12, sign: '-',
        }));
      }
    }

    panels.push(renderIntegrationConvergencePanel(
      'Trapecio Compuesto', a, b,
      [2, 4, 8, 16, 32, 64],
      (nv) => computeTrapecio(f, a, b, nv).integral,
      exact,
    ));

    return {
      integral: run.integral,
      iterations: run.iterations,
      converged: true,
      error: errInfo.bound,
      exact,
      relativeErrorPercent: errRelPct,
      truncationBound: errInfo.bound,
      truncationOrder: 2,
      maxDerivative: errInfo.max,
      xiApprox: errInfo.xAtMax,
      derivativeExpr: errInfo.derivativeExpr ?? undefined,
      message: msgParts.join(' · '),
      theoremPanels: panels,
    };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const n = Math.max(1, result.iterations.length - 1) || (parseInt(params.n) || 10);
    const h = (b - a) / n;

    const pad = (b - a) * 0.1;
    const xs = linspace(a - pad, b + pad, 500);
    const ys = xs.map(x => f(x));

    const trapX: number[] = [];
    const trapY: number[] = [];
    const xPts: number[] = [];
    const yPts: number[] = [];
    for (let i = 0; i < n; i++) {
      const xL = a + i * h;
      const xR = a + (i + 1) * h;
      trapX.push(xL, xL, xR, xR, xL);
      trapY.push(0, f(xL), f(xR), 0, 0);
      trapX.push(NaN);
      trapY.push(NaN);
    }
    for (let i = 0; i <= n; i++) {
      const xi = a + i * h;
      xPts.push(xi);
      yPts.push(f(xi));
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

    const chart2: ChartData = {
      title: 'Puntos de evaluacion',
      type: 'scatter',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa', pointRadius: 0 },
        { label: 'x_i', x: xPts, y: yPts, color: '#fab387', pointRadius: 4, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    const iterIdx = result.iterations.map(r => r.i as number);
    const cumContrib: number[] = [];
    let cum = 0;
    for (const r of result.iterations) {
      cum += (r.contrib as number) || 0;
      cumContrib.push((h / 2) * cum);
    }
    const chart3: ChartData = {
      title: 'Suma parcial de Σ c_i·f(x_i) · h/2',
      type: 'line',
      datasets: [{ label: 'Parcial', x: iterIdx, y: cumContrib, color: '#cba6f7', pointRadius: 3 }],
      xLabel: 'i', yLabel: 'Suma parcial',
    };

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
