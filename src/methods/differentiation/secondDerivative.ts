import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

export const secondDerivative: MethodDefinition = {
  id: 'secondDerivative',
  name: 'Segunda Derivada (Central)',
  category: 'differentiation',
  formula: "f''(x) ≈ (f(x+h) - 2f(x) + f(x-h)) / h²",
  latexFormula: "f''(x) \\approx \\frac{f(x+h) - 2f(x) + f(x-h)}{h^2} \\quad \\mathcal{O}(h^2)",
  description: 'Aproximacion de segundo orden O(h²) de la segunda derivada usando diferencia central.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'sin(x)', defaultValue: 'sin(x)' },
    { id: 'x0', label: 'x₀ (punto de evaluacion)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'h', label: 'h (paso)', placeholder: '0.1', defaultValue: '0.1' },
    { id: 'ddfx', label: "f''(x) exacta (opcional)", placeholder: '-sin(x)', defaultValue: '-sin(x)' },
  ],
  tableColumns: [
    { key: 'step', label: 'Paso' },
    { key: 'h', label: 'h' },
    { key: 'approx', label: "f''(x) aprox" },
    { key: 'exact', label: "f''(x) exacta" },
    { key: 'error', label: 'Error absoluto' },
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const x0 = parseFloat(params.x0);
    const hStart = parseFloat(params.h) || 0.1;
    const ddfExpr = params.ddfx?.trim();
    const ddf = ddfExpr ? parseExpression(ddfExpr) : null;

    if (isNaN(x0)) throw new Error('x₀ debe ser un numero valido');

    const iterations: MethodResult['iterations'] = [];
    let h = hStart;
    let lastApprox = 0;

    for (let step = 1; step <= 12; step++) {
      // f''(x) ≈ (f(x+h) - 2f(x) + f(x-h)) / h²
      const approx = (f(x0 + h) - 2 * f(x0) + f(x0 - h)) / (h * h);
      const exact = ddf ? ddf(x0) : NaN;
      const error = ddf ? Math.abs(approx - exact) : (step > 1 ? Math.abs(approx - lastApprox) : NaN);

      iterations.push({ step, h, approx, exact, error: isNaN(error) ? 0 : error });
      lastApprox = approx;
      h /= 2;
    }

    const finalApprox = iterations[0].approx as number;
    const finalError = ddf ? Math.abs(finalApprox - ddf(x0)) : 0;

    return {
      derivative: finalApprox,
      iterations, converged: true, error: finalError,
      message: `f''(${x0}) ≈ ${finalApprox.toPrecision(10)}`,
    };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const x0 = parseFloat(params.x0);
    const h = parseFloat(params.h) || 0.1;

    const pad = 2;
    const xs = linspace(x0 - pad, x0 + pad, 500);
    const ys = xs.map(x => f(x));

    const chart1: ChartData = {
      title: 'f(x) y puntos de evaluacion',
      type: 'scatter',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa', pointRadius: 0 },
        { label: 'f(x₀-h)', x: [x0 - h], y: [f(x0 - h)], color: '#f38ba8', pointRadius: 6, showLine: false },
        { label: 'f(x₀)', x: [x0], y: [f(x0)], color: '#fab387', pointRadius: 6, showLine: false },
        { label: 'f(x₀+h)', x: [x0 + h], y: [f(x0 + h)], color: '#94e2d5', pointRadius: 6, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    const hValues = result.iterations.map(r => r.h as number);
    const errors = result.iterations.map(r => r.error as number).filter(e => e > 0);
    const chart2: ChartData = {
      title: 'Error vs h',
      type: 'line',
      datasets: [{ label: 'Error', x: hValues.slice(0, errors.length), y: errors, color: '#f38ba8', pointRadius: 3 }],
      xLabel: 'h', yLabel: '|Error|', yLog: true,
    };

    const approxVals = result.iterations.map(r => r.approx as number);
    const steps = result.iterations.map(r => r.step as number);
    const ddfExpr = params.ddfx?.trim();
    const ddf = ddfExpr ? parseExpression(ddfExpr) : null;
    const chart3: ChartData = {
      title: "Convergencia de f''(x)",
      type: 'line',
      datasets: [
        { label: "f'' aprox", x: steps, y: approxVals, color: '#cba6f7', pointRadius: 3 },
        ...(ddf ? [{ label: "f'' exacta", x: [steps[0], steps[steps.length - 1]], y: [ddf(x0), ddf(x0)], color: '#a6e3a1', dashed: true, pointRadius: 0 }] : []),
      ],
      xLabel: 'Paso', yLabel: "f''(x)",
    };

    // Concavity visualization
    const secondDeriv = (f(x0 + h) - 2 * f(x0) + f(x0 - h)) / (h * h);
    const chart4: ChartData = {
      title: `Concavidad en x₀ (f''≈${secondDeriv.toFixed(4)})`,
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'x₀', x: [x0], y: [f(x0)], color: '#fab387', pointRadius: 6, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    return [chart1, chart2, chart3, chart4];
  },
};
