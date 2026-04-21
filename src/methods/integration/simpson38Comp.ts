import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { simpson38Error, relativeErrorPercent } from '../../integrationHelpers';

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
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: 'p.ej. 0.333333', type: 'number', hint: 'Si se provee, se calcula error relativo y se reintenta con n=21 si supera 1%.' },
  ],
  tableColumns: [
    { key: 'i', label: 'i', latex: 'i' },
    { key: 'xi', label: 'x_i', latex: 'x_i' },
    { key: 'fxi', label: 'f(x_i)', latex: 'f(x_i)' },
    { key: 'coeff', label: 'Coeficiente', latex: 'c_i' },
    { key: 'contrib', label: 'Contribucion', latex: 'c_i \\cdot f(x_i)' },
  ],
  steps: [
    'Escribe <code>f(x)</code>, limites <code>a</code>, <code>b</code>, y subintervalos <code>n</code>. <b>Importante</b>: <code>n</code> debe ser <b>multiplo de 3</b> (la regla agrupa los puntos de 3 en 3). Si no lo es, la app lo redondea al siguiente multiplo (y te avisa).',
    'Paso <code>h = (b - a) / n</code>. Puntos <code>x_i = a + i·h</code> para <code>i = 0, 1, ..., n</code>.',
    'Formula: <code>I ≈ 3h/8 · [f(x_0) + 3f(x_1) + 3f(x_2) + 2f(x_3) + 3f(x_4) + 3f(x_5) + 2f(x_6) + ... + f(x_n)]</code>. Patron: <b>1, 3, 3, 2, 3, 3, 2, ..., 3, 3, 1</b>.',
    'Pulsa <b>Resolver</b>. La tabla muestra cada punto con su coeficiente; verifica el patron visualmente en la grafica de coeficientes.',
    '<b>Error de truncamiento</b>: <code>|E| ≤ (b-a)·h⁴/80 · M₄</code> con <code>M₄ = max|f⁽⁴⁾|</code>. Orden <code>O(h⁴)</code> igual que Simpson 1/3, pero la constante (<code>1/80</code>) es peor que <code>1/180</code>.',
    'En practica <em>Simpson 1/3 es preferible</em>. Usa 3/8 cuando <code>n</code> no sea par, o como complemento: por ejemplo, si <code>n = 7</code>, aplica 1/3 con <code>n = 4</code> y 3/8 con <code>n = 3</code>.',
    'Si diste <b>valor exacto</b>: calcula error relativo y reintenta con <code>n = 21</code> si > 1%.',
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

    let run = runSimpson38(f, a, b, nReq);
    let retried = false;
    let relErr: number | undefined;

    if (exact !== undefined && !isNaN(exact)) {
      relErr = relativeErrorPercent(run.integral, exact);
      if (relErr > 1 && run.n < 21) {
        run = runSimpson38(f, a, b, 21);
        relErr = relativeErrorPercent(run.integral, exact);
        retried = true;
      }
    }

    const errInfo = simpson38Error(params.fx, a, b, run.h);

    const msgParts = [`h = ${run.h.toPrecision(6)}, n = ${run.n} (multiplo de 3)`];
    if (errInfo.derivativeExpr) msgParts.push(`f⁴(x) = ${errInfo.derivativeExpr}`);
    if (retried) msgParts.push('reintento automatico con n=21 tras error > 1%');

    return {
      integral: run.integral,
      iterations: run.iterations,
      converged: true,
      error: errInfo.bound,
      exact,
      relativeErrorPercent: relErr,
      truncationBound: errInfo.bound,
      truncationOrder: 4,
      maxDerivative: errInfo.max,
      xiApprox: errInfo.xAtMax,
      derivativeExpr: errInfo.derivativeExpr ?? undefined,
      retried,
      message: msgParts.join(' · '),
    };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    let n = parseInt(params.n) || 9;
    if (result.retried) n = 21;
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

    const xPts = result.iterations.map(r => r.xi as number);
    const yPts = result.iterations.map(r => r.fxi as number);
    const chart2: ChartData = {
      title: 'Puntos de evaluacion',
      type: 'scatter',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa', pointRadius: 0 },
        { label: 'x_i', x: xPts, y: yPts, color: '#fab387', pointRadius: 4, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    const coeffs = result.iterations.map(r => r.coeff as number);
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
