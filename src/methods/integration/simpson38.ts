import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const simpson38: MethodDefinition = {
  id: 'simpson38',
  name: 'Simpson 3/8 (Simple)',
  category: 'integration',
  formula: '∫f(x)dx ≈ (b-a)/8 · [f(a) + 3f(x₁) + 3f(x₂) + f(b)]',
  latexFormula: '\\int_a^b f(x)\\,dx \\approx \\frac{b-a}{8}\\left[f(a) + 3f(x_1) + 3f(x_2) + f(b)\\right], \\quad x_i = a + i\\cdot\\frac{b-a}{3}',
  description: 'Aproxima la integral usando un polinomio cubico que pasa por 4 puntos equiespaciados.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
  ],
  tableColumns: [
    { key: 'punto', label: 'Punto', latex: '\\text{Punto}' },
    { key: 'x', label: 'x', latex: 'x' },
    { key: 'fx', label: 'f(x)', latex: 'f(x)' },
    { key: 'coeff', label: 'Coeficiente', latex: 'c_i' },
  ],
  steps: [
    'Version <em>simple</em> de Simpson 3/8: usa <b>4 puntos</b> equiespaciados — <code>a</code>, <code>x_1</code>, <code>x_2</code>, <code>b</code> con <code>h = (b-a)/3</code> — y ajusta un <b>polinomio cubico</b>.',
    'Escribe <code>f(x)</code> y los limites <code>a</code>, <code>b</code>.',
    'Formula: <code>I ≈ (b-a)/8 · [f(a) + 3·f(x_1) + 3·f(x_2) + f(b)]</code>. Pesos: <b>1, 3, 3, 1</b>. Viene de integrar el polinomio cubico de Lagrange en [a, b].',
    'Pulsa <b>Resolver</b>. La grafica muestra la cubica ajustada contra <code>f(x)</code>.',
    'Error: <code>|E| = -3(b-a)⁵/6480 · f⁽⁴⁾(ξ)</code> — tambien <code>O(h⁵)</code> como Simpson 1/3, pero la constante es un poco peor. Exacto para polinomios de grado ≤ 3 (igual que 1/3).',
    'Se usa principalmente cuando el <b>numero de subintervalos no es par</b> (requisito de Simpson 1/3). Si <code>n = 5</code>, podes aplicar 3/8 en los primeros 3 y 1/3 en los ultimos 2.',
    'Para n multiple de 3, usa <b>Simpson 3/8 compuesto</b>.',
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');

    const h = (b - a) / 3;
    const x1 = a + h;
    const x2 = a + 2 * h;

    const fa = f(a);
    const f1 = f(x1);
    const f2 = f(x2);
    const fb = f(b);

    // Simpson 3/8: (b-a)/8 * [f(a) + 3*f(x1) + 3*f(x2) + f(b)]
    const integral = (b - a) / 8 * (fa + 3 * f1 + 3 * f2 + fb);

    const iterations: MethodResult['iterations'] = [
      { punto: 'x₀ = a', x: a, fx: fa, coeff: 1 },
      { punto: 'x₁', x: x1, fx: f1, coeff: 3 },
      { punto: 'x₂', x: x2, fx: f2, coeff: 3 },
      { punto: 'x₃ = b', x: b, fx: fb, coeff: 1 },
    ];

    return { integral, iterations, converged: true, error: 0 };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const h = (b - a) / 3;
    const x1 = a + h;
    const x2 = a + 2 * h;

    const fa = f(a);
    const f1 = f(x1);
    const f2 = f(x2);
    const fb = f(b);

    const pad = (b - a) * 0.3;
    const xs = linspace(a - pad, b + pad, 500);
    const ys = xs.map(x => f(x));

    // Cubic interpolation through 4 points
    const cubicXs = linspace(a, b, 200);
    const cubicYs = cubicXs.map(x => {
      const L0 = ((x - x1) * (x - x2) * (x - b)) / ((a - x1) * (a - x2) * (a - b));
      const L1 = ((x - a) * (x - x2) * (x - b)) / ((x1 - a) * (x1 - x2) * (x1 - b));
      const L2 = ((x - a) * (x - x1) * (x - b)) / ((x2 - a) * (x2 - x1) * (x2 - b));
      const L3 = ((x - a) * (x - x1) * (x - x2)) / ((b - a) * (b - x1) * (b - x2));
      return fa * L0 + f1 * L1 + f2 * L2 + fb * L3;
    });

    const chart1: ChartData = {
      title: 'Simpson 3/8 - Interpolacion cubica',
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'Cubica', x: cubicXs, y: cubicYs, color: '#a6e3a1', dashed: true },
        { label: 'Puntos', x: [a, x1, x2, b], y: [fa, f1, f2, fb], color: '#fab387', pointRadius: 6, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    // Area
    const areaX = [...cubicXs, b, a];
    const areaY = [...cubicYs, 0, 0];
    const chart2: ChartData = {
      title: 'Area bajo la cubica',
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'Area', x: areaX, y: areaY, color: '#a6e3a1', fill: true },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    // Convergence with composite
    const nValues = [3, 6, 9, 12, 15, 30, 60, 120];
    const integrals = nValues.map(n => {
      const hv = (b - a) / n;
      let s = f(a) + f(b);
      for (let i = 1; i < n; i++) {
        s += (i % 3 === 0 ? 2 : 3) * f(a + i * hv);
      }
      return (3 * hv / 8) * s;
    });
    const chart3: ChartData = {
      title: 'Convergencia Simpson 3/8 Compuesto',
      type: 'line',
      datasets: [{ label: 'Integral', x: nValues, y: integrals, color: '#f9e2af', pointRadius: 3 }],
      xLabel: 'n', yLabel: 'Valor',
    };

    const chart4: ChartData = {
      title: 'Coeficientes (1-3-3-1)',
      type: 'scatter',
      datasets: [{
        label: 'Coef × f(x)',
        x: [a, x1, x2, b],
        y: [fa, 3 * f1, 3 * f2, fb],
        color: '#cba6f7', pointRadius: 6, showLine: false,
      }],
      xLabel: 'x', yLabel: 'Contribucion',
    };

    return [chart1, chart2, chart3, chart4];
  },
};
