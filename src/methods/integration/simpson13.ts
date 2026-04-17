import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const simpson13: MethodDefinition = {
  id: 'simpson13',
  name: 'Simpson 1/3 (Simple)',
  category: 'integration',
  formula: '∫f(x)dx ≈ (b-a)/6 · [f(a) + 4·f(m) + f(b)]',
  description: 'Aproxima la integral usando una parabola que pasa por 3 puntos: a, (a+b)/2, b.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
  ],
  tableColumns: [
    { key: 'punto', label: 'Punto' },
    { key: 'x', label: 'x' },
    { key: 'fx', label: 'f(x)' },
    { key: 'coeff', label: 'Coeficiente' },
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');

    const m = (a + b) / 2;
    const fa = f(a);
    const fm = f(m);
    const fb = f(b);

    // Simpson 1/3: (b-a)/6 * [f(a) + 4*f(m) + f(b)]
    const integral = (b - a) / 6 * (fa + 4 * fm + fb);

    const iterations: MethodResult['iterations'] = [
      { punto: 'a', x: a, fx: fa, coeff: 1 },
      { punto: 'm = (a+b)/2', x: m, fx: fm, coeff: 4 },
      { punto: 'b', x: b, fx: fb, coeff: 1 },
    ];

    return { integral, iterations, converged: true, error: 0 };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const m = (a + b) / 2;
    const fa = f(a);
    const fm = f(m);
    const fb = f(b);

    const pad = (b - a) * 0.3;
    const xs = linspace(a - pad, b + pad, 500);
    const ys = xs.map(x => f(x));

    // Lagrange interpolation parabola through (a,fa), (m,fm), (b,fb)
    const parXs = linspace(a, b, 200);
    const parYs = parXs.map(x => {
      const L0 = ((x - m) * (x - b)) / ((a - m) * (a - b));
      const L1 = ((x - a) * (x - b)) / ((m - a) * (m - b));
      const L2 = ((x - a) * (x - m)) / ((b - a) * (b - m));
      return fa * L0 + fm * L1 + fb * L2;
    });

    const chart1: ChartData = {
      title: 'Simpson 1/3 - Parabola interpolante',
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'Parabola', x: parXs, y: parYs, color: '#a6e3a1', dashed: true },
        { label: 'Puntos', x: [a, m, b], y: [fa, fm, fb], color: '#fab387', pointRadius: 6, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    // Area under parabola
    const areaX = [...parXs, b, a];
    const areaY = [...parYs, 0, 0];
    const chart2: ChartData = {
      title: 'Area bajo la parabola',
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'Area Simpson', x: areaX, y: areaY, color: '#a6e3a1', fill: true },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    // Convergence with composite Simpson
    const nValues = [2, 4, 6, 8, 10, 20, 50, 100];
    const integrals = nValues.map(n => {
      const h = (b - a) / n;
      let s = f(a) + f(b);
      for (let i = 1; i < n; i++) {
        s += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
      }
      return (h / 3) * s;
    });
    const chart3: ChartData = {
      title: 'Convergencia Simpson 1/3 Compuesto',
      type: 'line',
      datasets: [{ label: 'Integral', x: nValues, y: integrals, color: '#f9e2af', pointRadius: 3 }],
      xLabel: 'n', yLabel: 'Valor',
    };

    const chart4: ChartData = {
      title: 'Coeficientes',
      type: 'bar',
      datasets: [{ label: 'Coef × f(x)', x: [a, m, b], y: [fa, 4 * fm, fb], color: '#cba6f7', pointRadius: 4, showLine: false }],
      xLabel: 'x', yLabel: 'Contribucion',
    };

    return [chart1, chart2, chart3, chart4];
  },
};
