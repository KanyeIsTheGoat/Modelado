import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { simpson13Error, relativeErrorPercent } from '../../integrationHelpers';

function computeSimpson13(f: (x: number) => number, a: number, b: number, n: number): { integral: number; iterations: MethodResult['iterations']; h: number; n: number } {
  if (n % 2 !== 0) n = n + 1;
  const h = (b - a) / n;
  const iterations: MethodResult['iterations'] = [];
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const xi = a + i * h;
    const fxi = f(xi);
    let coeff: number;
    if (i === 0 || i === n) coeff = 1;
    else if (i % 2 === 1) coeff = 4;
    else coeff = 2;
    const contrib = coeff * fxi;
    sum += contrib;
    iterations.push({ i, xi, fxi, coeff, contrib });
  }
  return { integral: (h / 3) * sum, iterations, h, n };
}

export const simpson13Comp: MethodDefinition = {
  id: 'simpson13Comp',
  name: 'Simpson 1/3 Compuesta',
  category: 'integration',
  formula: '∫f(x)dx ≈ h/3 · [f(x₀) + 4f(x₁) + 2f(x₂) + 4f(x₃) + ... + f(xₙ)]',
  latexFormula: '\\int_a^b f(x)\\,dx \\approx \\frac{h}{3}\\left[f(x_0) + 4\\!\\!\\!\\sum_{i\\,\\text{impar}}\\!\\!\\! f(x_i) + 2\\!\\!\\!\\sum_{i\\,\\text{par}}\\!\\!\\! f(x_i) + f(x_n)\\right], \\quad h = \\frac{b-a}{n}',
  description: 'Aplica Simpson 1/3 en cada par de subintervalos. Requiere n par.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'n (subintervalos, debe ser par)', placeholder: '10', type: 'number', defaultValue: '10' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: 'p.ej. 0.333333', type: 'number', hint: 'Si se provee, se calcula error relativo y se reintenta con n=20 si supera 1%.' },
  ],
  tableColumns: [
    { key: 'i', label: 'i', latex: 'i' },
    { key: 'xi', label: 'x_i', latex: 'x_i' },
    { key: 'fxi', label: 'f(x_i)', latex: 'f(x_i)' },
    { key: 'coeff', label: 'Coeficiente', latex: 'c_i' },
    { key: 'contrib', label: 'Contribucion', latex: 'c_i \\cdot f(x_i)' },
  ],
  steps: [
    'Escribe <code>f(x)</code>. Para el <b>parcial 02/07/2025</b> (parte b): <code>exp(x^2)</code> sobre <code>[0, 2]</code> con <code>n = 10</code>. Para <b>parcial 2025-I</b>: <code>ln(x+1)/x</code> sobre <code>[0, 1]</code> con <code>n = 4</code>.',
    'Llena <code>a</code>, <code>b</code>, y <code>n</code>. <b>Importante</b>: <code>n</code> debe ser <b>par</b> (la regla ajusta una parabola por cada par de subintervalos). Si pones impar, la app lo incrementa a <code>n+1</code> y lo avisa.',
    'Paso <code>h = (b - a) / n</code>. Puntos: <code>x_i = a + i·h</code> para <code>i = 0, 1, ..., n</code>.',
    'Formula compuesta: <code>I ≈ h/3 · [f(x_0) + 4·f(x_1) + 2·f(x_2) + 4·f(x_3) + ... + 4·f(x_{n-1}) + f(x_n)]</code>. Patron de pesos: <b>1, 4, 2, 4, 2, ..., 4, 1</b>. La columna <em>Coeficiente</em> en la tabla te lo confirma.',
    'Pulsa <b>Resolver</b>. La columna <em>Contribucion = coef · f(x_i)</em>. Suma total × <code>h/3</code> = integral.',
    '<b>Error de truncamiento</b>: <code>|E| = -(b-a)·h⁴/180 · f⁽⁴⁾(ξ)</code> para algun <code>ξ ∈ (a,b)</code>. Es <code>O(h⁴)</code> — mucho mas preciso que trapecio <code>O(h²)</code>. La app calcula <code>f⁽⁴⁾</code> simbolicamente y su maximo en [a,b].',
    'Si el parcial te fija <code>ξ</code> especifico, puedes comparar contra la cota reportada (peor caso). Para funciones suaves, Simpson da error <em>casi nulo</em> con n moderado.',
    'Si diste <b>valor exacto</b>: app calcula error relativo y reintenta con <code>n = 20</code> si > 1%. Usa el exacto de Wolfram o <code>scipy.integrate.quad</code> — para ∫₀² e^(x²) dx: <code>≈ 16.45262776</code>.',
    '<b>Comparacion vs Trapecio</b> (cierre del parcial): anota (1) integral, (2) error relativo %, (3) cota teorica. Simpson debe ser varios ordenes de magnitud mejor. Menciona en el informe: "Simpson O(h⁴) domina a Trapecio O(h²)".',
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    let nReq = parseInt(params.n) || 10;
    const exactRaw = (params.exact ?? '').trim();
    const exact = exactRaw === '' ? undefined : parseFloat(exactRaw);

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');
    if (nReq < 2) throw new Error('n debe ser >= 2');

    let run = computeSimpson13(f, a, b, nReq);
    let retried = false;
    let relErr: number | undefined;

    if (exact !== undefined && !isNaN(exact)) {
      relErr = relativeErrorPercent(run.integral, exact);
      if (relErr > 1 && run.n < 20) {
        run = computeSimpson13(f, a, b, 20);
        relErr = relativeErrorPercent(run.integral, exact);
        retried = true;
      }
    }

    const errInfo = simpson13Error(params.fx, a, b, run.h);

    const msgParts = [`h = ${run.h.toPrecision(6)}, n = ${run.n} (par)`];
    if (errInfo.derivativeExpr) msgParts.push(`f⁴(x) = ${errInfo.derivativeExpr}`);
    if (retried) msgParts.push('reintento automatico con n=20 tras error > 1%');

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
    let n = parseInt(params.n) || 10;
    if (result.retried) n = 20;
    if (n % 2 !== 0) n++;
    const h = (b - a) / n;

    const pad = (b - a) * 0.1;
    const xs = linspace(a - pad, b + pad, 500);
    const ys = xs.map(x => f(x));

    const parabolaX: number[] = [];
    const parabolaY: number[] = [];
    for (let i = 0; i < n; i += 2) {
      const x0 = a + i * h;
      const x1 = a + (i + 1) * h;
      const x2 = a + (i + 2) * h;
      const f0 = f(x0);
      const f1 = f(x1);
      const f2 = f(x2);
      const pxs = linspace(x0, x2, 50);
      pxs.forEach(px => {
        const L0 = ((px - x1) * (px - x2)) / ((x0 - x1) * (x0 - x2));
        const L1 = ((px - x0) * (px - x2)) / ((x1 - x0) * (x1 - x2));
        const L2 = ((px - x0) * (px - x1)) / ((x2 - x0) * (x2 - x1));
        parabolaX.push(px);
        parabolaY.push(f0 * L0 + f1 * L1 + f2 * L2);
      });
      parabolaX.push(NaN);
      parabolaY.push(NaN);
    }

    const chart1: ChartData = {
      title: `Simpson 1/3 Compuesta (n=${n})`,
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'Parabolas', x: parabolaX, y: parabolaY, color: '#a6e3a1' },
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
      title: 'Patron de coeficientes (1-4-2-4-...-1)',
      type: 'scatter',
      datasets: [{ label: 'Coeficiente', x: xPts, y: coeffs, color: '#cba6f7', pointRadius: 4, showLine: false }],
      xLabel: 'x_i', yLabel: 'Coeficiente',
    };

    const nValues = [2, 4, 6, 8, 10, 20, 50, 100];
    const integrals = nValues.map(nv => {
      const hv = (b - a) / nv;
      let s = f(a) + f(b);
      for (let i = 1; i < nv; i++) s += (i % 2 === 0 ? 2 : 4) * f(a + i * hv);
      return (hv / 3) * s;
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
