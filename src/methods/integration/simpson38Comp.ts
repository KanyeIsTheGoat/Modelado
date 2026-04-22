import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { simpson38Error, renderIntegrationConvergencePanel, renderIntegrationTruncationAtXi, renderPerPointBreakdownPanel, detectRemovableSingularities, renderLhopitalPanel } from '../../integrationHelpers';

function runSimpson38(f: (x: number) => number, a: number, b: number, nReq: number): { integral: number; iterations: MethodResult['iterations']; h: number; n: number } {
  let n = nReq;
  if (n % 3 !== 0) n = n + (3 - n % 3);
  const h = (b - a) / n;
  const iterations: MethodResult['iterations'] = [];
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const xi = a + i * h;
    const fxi = f(xi);
    let coeff: number;
    if (i === 0 || i === n) coeff = 1;
    else if (i % 3 === 0) coeff = 2;
    else coeff = 3;
    const contrib = coeff * fxi;
    sum += contrib;
    iterations.push({ i, xi, fxi, coeff, contrib });
  }
  return { integral: (3 * h / 8) * sum, iterations, h, n };
}

export const simpson38Comp: MethodDefinition = {
  id: 'simpson38Comp',
  name: 'Simpson 3/8 Compuesta',
  category: 'integration',
  formula: '∫f(x)dx ≈ 3h/8 · [f(x₀) + 3f(x₁) + 3f(x₂) + 2f(x₃) + 3f(x₄) + ...]',
  latexFormula: '\\int_a^b f(x)\\,dx \\approx \\frac{3h}{8}\\left[f(x_0) + 3f(x_1) + 3f(x_2) + 2f(x_3) + 3f(x_4) + 3f(x_5) + \\cdots + f(x_n)\\right], \\quad h = \\frac{b-a}{n}',
  description: 'Aplica Simpson 3/8 en cada grupo de 3 subintervalos. Requiere n multiplo de 3.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'n (subintervalos, multiplo de 3)', placeholder: '9', type: 'number', defaultValue: '9' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: 'p.ej. 0.333333', type: 'number', hint: 'Si se provee, se calcula el error relativo vs exacto.' },
    { id: 'xi', label: 'ξ para error de truncamiento (opcional)', placeholder: 'p.ej. 0.5', type: 'number', hint: 'Punto donde evaluar E = -(b-a)h⁴/80 · f⁽⁴⁾(ξ). Dejar vacio para mostrar solo la cota del peor caso.' },
  ],
  tableColumns: [
    { key: 'i', label: 'i', latex: 'i' },
    { key: 'xi', label: 'x_i', latex: 'x_i' },
    { key: 'fxi', label: 'f(x_i)', latex: 'f(x_i)' },
    { key: 'coeff', label: 'Coef', latex: 'c_i' },
    { key: 'contrib', label: 'c_i·f(x_i)', latex: 'c_i \\cdot f(x_i)' },
  ],
  steps: [
    'Escribe <code>f(x)</code>, limites <code>a</code>, <code>b</code>, y subintervalos <code>n</code>. <b>Importante</b>: <code>n</code> debe ser <b>multiplo de 3</b> (la regla agrupa los puntos de 3 en 3). Si no lo es, la app lo redondea al siguiente multiplo (y te avisa).',
    'Paso <code>h = (b - a) / n</code>. Puntos <code>x_i = a + i·h</code> para <code>i = 0, 1, ..., n</code>.',
    'Formula: <code>I ≈ 3h/8 · [f(x_0) + 3f(x_1) + 3f(x_2) + 2f(x_3) + 3f(x_4) + 3f(x_5) + 2f(x_6) + ... + f(x_n)]</code>. Patron: <b>1, 3, 3, 2, 3, 3, 2, ..., 3, 3, 1</b>.',
    'Pulsa <b>Resolver</b>. La tabla muestra cada punto con su coeficiente; verifica el patron visualmente en la grafica de coeficientes.',
    '<b>Error de truncamiento</b>: <code>|E| ≤ (b-a)·h⁴/80 · M₄</code> con <code>M₄ = max|f⁽⁴⁾|</code>. Orden <code>O(h⁴)</code> igual que Simpson 1/3, pero la constante (<code>1/80</code>) es peor que <code>1/180</code>.',
    'En practica <em>Simpson 1/3 es preferible</em>. Usa 3/8 cuando <code>n</code> no sea par, o como complemento: por ejemplo, si <code>n = 7</code>, aplica 1/3 con <code>n = 4</code> y 3/8 con <code>n = 3</code>.',
    'Si diste <b>valor exacto</b>: la app calcula el error relativo vs ese exacto. No reintenta con otro n — si queres mas precision, cambia <code>n</code> manualmente.',
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const nReq = parseInt(params.n) || 9;
    const exactRaw = (params.exact ?? '').trim();
    const exact = exactRaw === '' ? undefined : parseFloat(exactRaw);

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');
    if (nReq < 3) throw new Error('n debe ser >= 3');

    const run = runSimpson38(f, a, b, nReq);
    const errInfo = simpson38Error(params.fx, a, b, run.h);

    const errRelPct = exact !== undefined && !isNaN(exact) && exact !== 0
      ? Math.abs((run.integral - exact) / exact) * 100
      : undefined;

    const msgParts = [`h = ${run.h.toPrecision(6)}, n = ${run.n} (multiplo de 3)`];
    if (run.n !== nReq) msgParts.push(`n ajustado de ${nReq} a ${run.n} (debe ser multiplo de 3)`);
    if (errInfo.derivativeExpr) msgParts.push(`f⁴(x) = ${errInfo.derivativeExpr}`);
    if (errRelPct !== undefined) msgParts.push(`error relativo vs exacto: ${errRelPct.toPrecision(4)}%`);

    const panels: string[] = [];

    const xsForDetect = run.iterations.map(r => r.xi as number);
    const singularities = detectRemovableSingularities(params.fx, xsForDetect);
    if (singularities.length > 0) {
      panels.push(renderLhopitalPanel(singularities, params.fx));
    }

    panels.push(renderPerPointBreakdownPanel({
      methodName: 'Simpson 3/8 Compuesta',
      n: run.n, h: run.h, prefactor: 3 * run.h / 8, prefactorLabel: '3h/8',
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
          methodName: 'Simpson 3/8 Compuesta',
          fxExpr: params.fx, a, b, h: run.h, n: run.n, xi: xiVal,
          order: 4, denom: 80, sign: '-',
        }));
      }
    }

    panels.push(renderIntegrationConvergencePanel(
      'Simpson 3/8 Compuesta', a, b,
      [3, 6, 12, 24, 48, 96],
      (nv) => runSimpson38(f, a, b, nv).integral,
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
      truncationOrder: 4,
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
    let n = Math.max(3, result.iterations.length - 1) || (parseInt(params.n) || 9);
    if (n % 3 !== 0) n = n + (3 - n % 3);
    const h = (b - a) / n;

    const pad = (b - a) * 0.1;
    const xs = linspace(a - pad, b + pad, 500);
    const ys = xs.map(x => f(x));

    // Cubic segments
    const cubicX: number[] = [];
    const cubicY: number[] = [];
    for (let i = 0; i < n; i += 3) {
      const pts = [0, 1, 2, 3].map(j => {
        const xj = a + (i + j) * h;
        return { x: xj, y: f(xj) };
      });
      const segXs = linspace(pts[0].x, pts[3].x, 50);
      segXs.forEach(x => {
        const L0 = ((x - pts[1].x) * (x - pts[2].x) * (x - pts[3].x)) / ((pts[0].x - pts[1].x) * (pts[0].x - pts[2].x) * (pts[0].x - pts[3].x));
        const L1 = ((x - pts[0].x) * (x - pts[2].x) * (x - pts[3].x)) / ((pts[1].x - pts[0].x) * (pts[1].x - pts[2].x) * (pts[1].x - pts[3].x));
        const L2 = ((x - pts[0].x) * (x - pts[1].x) * (x - pts[3].x)) / ((pts[2].x - pts[0].x) * (pts[2].x - pts[1].x) * (pts[2].x - pts[3].x));
        const L3 = ((x - pts[0].x) * (x - pts[1].x) * (x - pts[2].x)) / ((pts[3].x - pts[0].x) * (pts[3].x - pts[1].x) * (pts[3].x - pts[2].x));
        cubicX.push(x);
        cubicY.push(pts[0].y * L0 + pts[1].y * L1 + pts[2].y * L2 + pts[3].y * L3);
      });
      cubicX.push(NaN);
      cubicY.push(NaN);
    }

    const chart1: ChartData = {
      title: `Simpson 3/8 Compuesta (n=${n})`,
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'Cubicas', x: cubicX, y: cubicY, color: '#a6e3a1' },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    const xPts: number[] = [];
    const yPts: number[] = [];
    const coeffs: number[] = [];
    for (let i = 0; i <= n; i++) {
      const xi = a + i * h;
      xPts.push(xi);
      yPts.push(f(xi));
      const c = (i === 0 || i === n) ? 1 : (i % 3 === 0 ? 2 : 3);
      coeffs.push(c);
    }
    const chart2: ChartData = {
      title: 'Puntos de evaluacion',
      type: 'scatter',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa', pointRadius: 0 },
        { label: 'x_i', x: xPts, y: yPts, color: '#fab387', pointRadius: 4, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    const chart3: ChartData = {
      title: 'Patron de coeficientes (1-3-3-2-3-3-...-1)',
      type: 'scatter',
      datasets: [{ label: 'Coef', x: xPts, y: coeffs, color: '#cba6f7', pointRadius: 4, showLine: false }],
      xLabel: 'x_i', yLabel: 'Coeficiente',
    };

    const nValues = [3, 6, 9, 12, 15, 30, 60, 120];
    const integrals = nValues.map(nv => {
      const hv = (b - a) / nv;
      let s = f(a) + f(b);
      for (let i = 1; i < nv; i++) s += (i % 3 === 0 ? 2 : 3) * f(a + i * hv);
      return (3 * hv / 8) * s;
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
