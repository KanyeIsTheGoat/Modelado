import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { trapecioError, relativeErrorPercent } from '../../integrationHelpers';

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
  description: 'Divide [a,b] en n subintervalos y aplica la regla del trapecio en cada uno.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'n (subintervalos)', placeholder: '10', type: 'number', defaultValue: '10' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: 'p.ej. 0.333333', type: 'number', hint: 'Si se provee, se calcula error relativo y se reintenta con n=20 si supera 1%.' },
  ],
  tableColumns: [
    { key: 'i', label: 'i' },
    { key: 'xi', label: 'x_i' },
    { key: 'fxi', label: 'f(x_i)' },
    { key: 'coeff', label: 'Coeficiente' },
    { key: 'contrib', label: 'Contribucion' },
  ],
  steps: [
    'Escribe <code>f(x)</code>. Para el <b>parcial 2025-I</b>: <code>ln(x+1)/x</code> sobre <code>[0, 1]</code>. Ojo, en <code>x=0</code> la funcion tiene singularidad removible — el parser lanzaria <code>NaN</code>; usa <code>a = 1e-10</code> (≈ 0) o redefine como <code>ln(x+1)/x</code> y prueba primero n=4. Para <b>parcial 30/04/2025</b>: <code>sqrt(2)·exp(x^2)</code> sobre <code>[0, 1]</code>.',
    'Completa <code>a</code>, <code>b</code>, y <code>n</code>. El parcial te pide <code>n = 4</code> (y luego <code>n = 10</code> en el de 30/04 para comparar). El paso es <code>h = (b - a)/n</code>.',
    'Formula compuesta: <code>I ≈ h/2 · [f(a) + 2·Σ f(x_i) + f(b)]</code> con pesos <b>1, 2, 2, ..., 2, 1</b>. La tabla te muestra en la columna <em>Coeficiente</em> exactamente esto: 1 en los extremos y 2 en los puntos interiores.',
    'Pulsa <b>Resolver</b>. La columna <em>Contribucion = coef · f(x_i)</em> y la suma total multiplicada por <code>h/2</code> da la integral aproximada.',
    '<b>Error de truncamiento</b>: <code>|E| = -(b-a)·h²/12 · f\'\'(ξ)</code> para algun <code>ξ ∈ (a, b)</code>. La app calcula <code>f\'\'(x)</code> simbolicamente y halla el <code>ξ</code> que maximiza <code>|f\'\'|</code> en [a,b] (peor caso — cota superior).',
    'Si el parcial te fija <code>ξ = 0.5</code> (como en 30/04/2025), evalua a mano <code>f\'\'(0.5)</code> y calcula la cota con ese valor concreto: <code>|E| = (b-a)h²/12 · |f\'\'(0.5)|</code>. La app siempre reporta el peor caso; puedes usarlo de referencia.',
    'Si das <b>valor exacto</b>: la app calcula <em>error relativo %</em> y si supera 1% reintenta con <code>n = 20</code> (te lo indica en el resumen).',
    'Para la <b>comparacion con Simpson 1/3</b> (ultima parte del parcial): anota el <em>valor integral</em>, <em>error relativo</em> y la <em>cota</em>. Simpson con mismo n baja el error porque converge <code>O(h⁴)</code> vs <code>O(h²)</code> del trapecio — se ve claramente en la grafica de convergencia.',
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

    let run = computeTrapecio(f, a, b, n);
    let retried = false;
    let relErr: number | undefined;

    if (exact !== undefined && !isNaN(exact)) {
      relErr = relativeErrorPercent(run.integral, exact);
      if (relErr > 1 && n < 20) {
        n = 20;
        run = computeTrapecio(f, a, b, n);
        relErr = relativeErrorPercent(run.integral, exact);
        retried = true;
      }
    }

    const errInfo = trapecioError(params.fx, a, b, run.h);

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

    const trapX: number[] = [];
    const trapY: number[] = [];
    for (let i = 0; i < n; i++) {
      const xL = a + i * h;
      const xR = a + (i + 1) * h;
      trapX.push(xL, xL, xR, xR, xL);
      trapY.push(0, f(xL), f(xR), 0, 0);
      trapX.push(NaN);
      trapY.push(NaN);
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

    const iters = result.iterations.map(r => r.i as number);
    let cumSum = 0;
    const hHalf = h / 2;
    const cumAreas = result.iterations.map(r => { cumSum += (r.contrib as number); return hHalf * cumSum; });
    const chart3: ChartData = {
      title: 'Integral acumulada',
      type: 'line',
      datasets: [{ label: 'Integral parcial', x: iters, y: cumAreas, color: '#cba6f7', pointRadius: 2 }],
      xLabel: 'Punto i', yLabel: 'Integral parcial',
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
