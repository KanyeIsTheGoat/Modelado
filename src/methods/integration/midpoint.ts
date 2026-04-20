import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { midpointError, relativeErrorPercent } from '../../integrationHelpers';

function computeMidpoint(f: (x: number) => number, a: number, b: number, n: number): { integral: number; iterations: MethodResult['iterations']; h: number } {
  const h = (b - a) / n;
  const iterations: MethodResult['iterations'] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const xMid = a + (i + 0.5) * h;
    const fxMid = f(xMid);
    const area = h * fxMid;
    sum += fxMid;
    iterations.push({ i: i + 1, xi_mid: xMid, fxi: fxMid, area });
  }
  return { integral: h * sum, iterations, h };
}

export const midpoint: MethodDefinition = {
  id: 'midpoint',
  name: 'Regla del Rectangulo (Punto Medio)',
  category: 'integration',
  formula: '∫f(x)dx ≈ (b-a) · f((a+b)/2)',
  description: 'Aproxima la integral usando el valor de f en el punto medio del intervalo.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'n (subintervalos)', placeholder: '10', type: 'number', defaultValue: '10' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: 'p.ej. 0.333333', type: 'number', hint: 'Si se provee, se calcula error relativo y se reintenta con n=20 si supera 1%.' },
  ],
  tableColumns: [
    { key: 'i', label: 'i' },
    { key: 'xi_mid', label: 'x_i (medio)' },
    { key: 'fxi', label: 'f(x_i)' },
    { key: 'area', label: 'Area parcial' },
  ],
  steps: [
    'Escribe <code>f(x)</code> — ej. <code>exp(x^2)</code> para el ejercicio del parcial ∫₀² e^(x²) dx.',
    'Completa limites <code>a</code> y <code>b</code>. Para el parcial 02/07/2025: <code>a=0</code>, <code>b=2</code>.',
    'Pone <code>n = 10</code> como arranca el parcial. <b>Auto-retry</b>: si el "error relativo" supera 1 %, la app reintenta sola con <code>n = 20</code> y te lo marca en el resumen.',
    'Para poder medir error: calcula o pone <b>valor exacto</b>. Para ∫₀² e^(x²) dx el exacto es <code>≈ 16.45262776</code> (usa Wolfram, Python <code>scipy.integrate.quad</code>, o una corrida con Simpson y n grande como referencia).',
    'Pulsa <b>Resolver</b>. En cada subintervalo <code>[x_i, x_{i+1}]</code> la app evalua <code>f</code> en el <em>punto medio</em> <code>x_mid = (x_i + x_{i+1})/2</code> y suma <code>h · f(x_mid)</code> con <code>h = (b-a)/n</code>.',
    'Revisa la <b>cota de truncamiento</b>: <code>|E| ≤ (b-a)·h²/24 · M₂</code> donde <code>M₂ = max |f\'\'(ξ)|</code> en [a, b]. La app calcula f\'\' simbolicamente y encuentra M₂ numericamente; te muestra ξ aproximado.',
    'Para comparacion con Simpson (parte b del parcial): toma nota de <em>iteraciones</em>, <em>error relativo %</em>, y la cota de E. Simpson con el mismo n da error mucho menor porque converge mas rapido (O(h⁴) vs O(h²)).',
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    let n = parseInt(params.n) || 10;
    const exactRaw = (params.exact ?? '').trim();
    const exact = exactRaw === '' ? undefined : parseFloat(exactRaw);

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');
    if (n < 1) throw new Error('n debe ser >= 1');

    let run = computeMidpoint(f, a, b, n);
    let retried = false;
    let relErr: number | undefined;

    if (exact !== undefined && !isNaN(exact)) {
      relErr = relativeErrorPercent(run.integral, exact);
      if (relErr > 1 && n < 20) {
        n = 20;
        run = computeMidpoint(f, a, b, n);
        relErr = relativeErrorPercent(run.integral, exact);
        retried = true;
      }
    }

    const errInfo = midpointError(params.fx, a, b, run.h);

    const msgParts = [`h = ${run.h.toPrecision(6)}, n = ${n}`];
    if (errInfo.derivativeExpr) msgParts.push(`f''(x) = ${errInfo.derivativeExpr}`);
    if (retried) msgParts.push('reintento automatico con n=20 tras error > 1%');

    return {
      integral: run.integral,
      iterations: run.iterations,
      converged: true,
      error: errInfo.bound,
      exact,
      relativeErrorPercent: relErr,
      truncationBound: errInfo.bound,
      truncationOrder: 2,
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
    let n = parseInt(params.n) || 10;
    if (result.retried) n = 20;
    const h = (b - a) / n;

    const pad = (b - a) * 0.1;
    const xs = linspace(a - pad, b + pad, 500);
    const ys = xs.map(x => f(x));

    const rectX: number[] = [];
    const rectY: number[] = [];
    for (let i = 0; i < n; i++) {
      const xL = a + i * h;
      const xR = a + (i + 1) * h;
      const xM = (xL + xR) / 2;
      const fM = f(xM);
      rectX.push(xL, xL, xR, xR, xL);
      rectY.push(0, fM, fM, 0, 0);
      rectX.push(NaN);
      rectY.push(NaN);
    }

    const chart1: ChartData = {
      title: 'Regla del Punto Medio',
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'Rectangulos', x: rectX, y: rectY, color: '#a6e3a1', fill: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    const iters = result.iterations.map(r => r.i as number);
    let cumSum = 0;
    const cumAreas = result.iterations.map(r => { cumSum += r.area as number; return cumSum; });
    const chart2: ChartData = {
      title: 'Area acumulada',
      type: 'line',
      datasets: [{ label: 'Area acumulada', x: iters, y: cumAreas, color: '#cba6f7', pointRadius: 3 }],
      xLabel: 'Subintervalo', yLabel: 'Area',
    };

    const fvals = result.iterations.map(r => r.fxi as number);
    const xmids = result.iterations.map(r => r.xi_mid as number);
    const chart3: ChartData = {
      title: 'Valores f(x_i) en puntos medios',
      type: 'scatter',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa', pointRadius: 0 },
        { label: 'f(x_i)', x: xmids, y: fvals, color: '#fab387', pointRadius: 4, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    const nValues = [1, 2, 4, 8, 16, 32, 64, 128];
    const integrals = nValues.map(nv => {
      const hv = (b - a) / nv;
      let s = 0;
      for (let i = 0; i < nv; i++) s += f(a + (i + 0.5) * hv);
      return hv * s;
    });
    const chart4: ChartData = {
      title: 'Convergencia con n',
      type: 'line',
      datasets: [{ label: 'Integral', x: nValues, y: integrals, color: '#f9e2af', pointRadius: 3 }],
      xLabel: 'n (subintervalos)', yLabel: 'Valor integral',
    };

    return [chart1, chart2, chart3, chart4];
  },
};
