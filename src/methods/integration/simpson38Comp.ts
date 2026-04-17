import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const simpson38Comp: MethodDefinition = {
  id: 'simpson38Comp',
  name: 'Simpson 3/8 Compuesta',
  category: 'integration',
  formula: '∫f(x)dx ≈ 3h/8 · [f(x₀) + 3f(x₁) + 3f(x₂) + 2f(x₃) + 3f(x₄) + ...]',
  description: 'Aplica Simpson 3/8 en cada grupo de 3 subintervalos. Requiere n multiplo de 3.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'n (subintervalos, multiplo de 3)', placeholder: '9', type: 'number', defaultValue: '9' },
  ],
  tableColumns: [
    { key: 'i', label: 'i' },
    { key: 'xi', label: 'x_i' },
    { key: 'fxi', label: 'f(x_i)' },
    { key: 'coeff', label: 'Coeficiente' },
    { key: 'contrib', label: 'Contribucion' },
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    let n = parseInt(params.n) || 9;

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');
    if (n < 3) throw new Error('n debe ser >= 3');
    // Round up to nearest multiple of 3
    if (n % 3 !== 0) {
      n = n + (3 - n % 3);
    }

    const h = (b - a) / n;
    const iterations: MethodResult['iterations'] = [];
    let sum = 0;

    // Simpson 3/8 composite: (3h/8) * [f(x0) + 3f(x1) + 3f(x2) + 2f(x3) + 3f(x4) + 3f(x5) + 2f(x6) + ... + f(xn)]
    // Pattern: 1, 3, 3, 2, 3, 3, 2, ..., 3, 3, 1
    for (let i = 0; i <= n; i++) {
      const xi = a + i * h;
      const fxi = f(xi);
      let coeff: number;
      if (i === 0 || i === n) {
        coeff = 1;
      } else if (i % 3 === 0) {
        coeff = 2;
      } else {
        coeff = 3;
      }
      const contrib = coeff * fxi;
      sum += contrib;
      iterations.push({ i, xi, fxi, coeff, contrib });
    }

    const integral = (3 * h / 8) * sum;
    return {
      integral, iterations, converged: true, error: 0,
      message: `h = ${h.toPrecision(6)}, n = ${n} (multiplo de 3)`,
    };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    let n = parseInt(params.n) || 9;
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
