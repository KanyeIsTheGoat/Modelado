import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const simpson13Comp: MethodDefinition = {
  id: 'simpson13Comp',
  name: 'Simpson 1/3 Compuesta',
  category: 'integration',
  formula: '∫f(x)dx ≈ h/3 · [f(x₀) + 4f(x₁) + 2f(x₂) + 4f(x₃) + ... + f(xₙ)]',
  description: 'Aplica Simpson 1/3 en cada par de subintervalos. Requiere n par.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'n (subintervalos, debe ser par)', placeholder: '10', type: 'number', defaultValue: '10' },
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
    let n = parseInt(params.n) || 10;

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');
    if (n < 2) throw new Error('n debe ser >= 2');
    if (n % 2 !== 0) {
      n = n + 1; // Force even
    }

    const h = (b - a) / n;
    const iterations: MethodResult['iterations'] = [];
    let sum = 0;

    // Simpson 1/3 composite: h/3 * [f(x0) + 4*f(x1) + 2*f(x2) + 4*f(x3) + ... + f(xn)]
    for (let i = 0; i <= n; i++) {
      const xi = a + i * h;
      const fxi = f(xi);
      let coeff: number;
      if (i === 0 || i === n) {
        coeff = 1;
      } else if (i % 2 === 1) {
        coeff = 4;
      } else {
        coeff = 2;
      }
      const contrib = coeff * fxi;
      sum += contrib;
      iterations.push({ i, xi, fxi, coeff, contrib });
    }

    const integral = (h / 3) * sum;
    return {
      integral, iterations, converged: true, error: 0,
      message: `h = ${h.toPrecision(6)}, n = ${n} (par)`,
    };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    let n = parseInt(params.n) || 10;
    if (n % 2 !== 0) n++;
    const h = (b - a) / n;

    const pad = (b - a) * 0.1;
    const xs = linspace(a - pad, b + pad, 500);
    const ys = xs.map(x => f(x));

    // Parabolas for each pair of subintervals
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

    // Evaluation points with coefficients
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

    // Coefficients
    const coeffs = result.iterations.map(r => r.coeff as number);
    const chart3: ChartData = {
      title: 'Patron de coeficientes (1-4-2-4-...-1)',
      type: 'scatter',
      datasets: [{ label: 'Coeficiente', x: xPts, y: coeffs, color: '#cba6f7', pointRadius: 4, showLine: false }],
      xLabel: 'x_i', yLabel: 'Coeficiente',
    };

    // Convergence
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
