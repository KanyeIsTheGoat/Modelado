import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace, parseScalar } from '../../parser';
import { parseStop, computeErrors, withExactErrors, hasConverged, describeStop } from '../../stoppingCriteria';

export const secondDerivative: MethodDefinition = {
  id: 'secondDerivative',
  name: 'Segunda Derivada (Central)',
  category: 'differentiation',
  formula: "f''(x) ≈ (f(x+h) - 2f(x) + f(x-h)) / h²",
  latexFormula: "f''(x) \\approx \\frac{f(x+h) - 2f(x) + f(x-h)}{h^2} \\quad \\mathcal{O}(h^2)",
  description: 'Aproximacion de segundo orden O(h²) de la segunda derivada usando diferencia central.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'sin(x)', defaultValue: 'sin(x)' },
    { id: 'x0', label: 'x₀ (punto de evaluacion)', placeholder: '1', defaultValue: '1', hint: 'Acepta pi, e, pi/4, pi/2, sqrt(2), etc.' },
    { id: 'h', label: 'h (paso inicial)', placeholder: '0.1', defaultValue: '0.1', hint: 'Acepta expresiones como pi/100.' },
    { id: 'ddfx', label: "f''(x) exacta (opcional)", placeholder: '-sin(x)', defaultValue: '-sin(x)' },
    { id: 'stop', label: 'Criterio de parada', placeholder: '1e-6', type: 'stopCriterion', defaultValue: 'tolerancia:1e-6', hint: 'Criterios por diferencia entre aproximaciones sucesivas o vs exacto (si se dio f\'\'(x)).' },
    { id: 'maxIter', label: 'Max iteraciones (h se divide por 2)', placeholder: '20', type: 'number', defaultValue: '20' },
  ],
  tableColumns: [
    { key: 'step', label: 'Paso', latex: 'n' },
    { key: 'h', label: 'h', latex: 'h' },
    { key: 'approx', label: "f''(x) aprox", latex: "f''(x)_{\\text{aprox}}" },
    { key: 'exact', label: "f''(x) exacta", latex: "f''(x)_{\\text{exacta}}" },
    { key: 'errAbs', label: '|Δaprox|', latex: "|\\Delta f''|" },
    { key: 'errRel', label: 'Err. rel.', latex: '\\varepsilon_{\\text{rel}}' },
    { key: 'errRelPct', label: 'Err. rel. %', latex: '\\varepsilon_{\\text{rel}}\\,(\\%)' },
    { key: 'errAbsExact', label: '|E| vs exacto', latex: '|E|_{\\text{exacto}}' },
    { key: 'errRelExact', label: 'Err. rel. vs exacto', latex: '\\varepsilon_{\\text{rel,ex}}' },
    { key: 'errRelPctExact', label: 'Err. rel. % vs exacto', latex: '\\varepsilon_{\\text{rel,ex}}\\,(\\%)' },
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const x0 = parseScalar(params.x0);
    const hStart = parseScalar(params.h) || 0.1;
    const ddfExpr = params.ddfx?.trim();
    const ddf = ddfExpr ? parseExpression(ddfExpr) : null;
    const stop = parseStop(params.stop);
    const maxIter = parseInt(params.maxIter) || 20;

    if (isNaN(x0)) throw new Error('x₀ debe ser un numero valido');

    const iterations: MethodResult['iterations'] = [];
    let h = hStart;
    let lastApprox = 0;
    let converged = false;
    let approx = 0;
    const exactVal = ddf ? ddf(x0) : undefined;

    for (let step = 1; step <= maxIter; step++) {
      approx = (f(x0 + h) - 2 * f(x0) + f(x0 - h)) / (h * h);
      const errs = step === 1
        ? { errAbs: 0, errRel: 0, errRelPct: 0 }
        : computeErrors(lastApprox, approx);
      const errsFull = withExactErrors(errs, approx, exactVal);

      iterations.push({
        step, h, approx,
        exact: exactVal ?? null,
        errAbs: step === 1 ? null : errs.errAbs,
        errRel: step === 1 ? null : errs.errRel,
        errRelPct: step === 1 ? null : errs.errRelPct,
        errAbsExact: errsFull.errAbsExact ?? null,
        errRelExact: errsFull.errRelExact ?? null,
        errRelPctExact: errsFull.errRelPctExact ?? null,
      });

      if (step > 1 && hasConverged(stop, errsFull)) {
        converged = true;
        break;
      }

      lastApprox = approx;
      h /= 2;
    }

    const finalError = exactVal !== undefined ? Math.abs(approx - exactVal) : 0;

    return {
      derivative: approx,
      iterations, converged, error: finalError,
      message: `f''(${x0}) ≈ ${approx.toPrecision(10)} | Criterio: ${describeStop(stop)}`,
    };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const x0 = parseScalar(params.x0);
    const h = parseScalar(params.h) || 0.1;

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
