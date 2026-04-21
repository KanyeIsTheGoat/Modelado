import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, parseExpression2, linspace } from '../../parser';
import { commonOdeInputs, applyOdeTargetAndVerification, verifyDiffColumn } from '../../odeHelpers';
import { formatFull } from '../../precision';

export const euler: MethodDefinition = {
  id: 'euler',
  name: 'Metodo de Euler',
  category: 'ode',
  formula: "y_{n+1} = y_n + h · f(x_n, y_n)",
  latexFormula: "y_{n+1} = y_n + h \\cdot f(x_n, y_n)",
  description: 'Resuelve EDOs de primer orden dy/dx = f(x,y) con condicion inicial. Metodo explicito de orden 1.',
  inputs: [
    { id: 'fxy', label: "f(x, y) = dy/dx", placeholder: 'x + y', defaultValue: 'x + y' },
    { id: 'x0', label: 'x₀', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'y0', label: 'y₀', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'xEnd', label: 'x final', placeholder: '2', type: 'number', defaultValue: '2' },
    { id: 'h', label: 'h (paso)', placeholder: '0.1', type: 'number', defaultValue: '0.1' },
    { id: 'exact', label: 'Solucion exacta y(x) (opcional)', placeholder: '2*exp(x) - x - 1', hint: 'Para calcular error' },
    ...commonOdeInputs,
  ],
  tableColumns: [
    { key: 'step', label: 'Paso n', latex: 'n' },
    { key: 'xn', label: 'xₙ', latex: 'x_n' },
    { key: 'yn', label: 'yₙ', latex: 'y_n' },
    { key: 'fxy', label: 'f(xₙ, yₙ)', latex: 'f(x_n, y_n)' },
    { key: 'yNext', label: 'yₙ₊₁', latex: 'y_{n+1}' },
    { key: 'exact', label: 'y exacta', latex: 'y^*(x_n)' },
    { key: 'error', label: '|Error|', latex: '|E|' },
    verifyDiffColumn,
  ],
  steps: [
    'Identifica la EDO: debe tener la forma <code>dy/dx = f(x, y)</code>. Ejemplo parcial tipico: <code>dy/dx = x + y</code> con <code>y(0) = 1</code>, resolver hasta <code>x = 2</code>.',
    'Escribe <code>f(x, y)</code> en el primer campo. Usa sintaxis <code>math.js</code>: <code>x + y</code>, <code>x*y - sin(x)</code>, <code>exp(-x)*y</code>, etc.',
    'Completa: <code>x₀</code> (valor inicial de x), <code>y₀</code> (condicion inicial), <code>x_final</code> (donde termina), <code>h</code> (paso). <em>Mas pequeño h → mas preciso pero mas pasos</em>. Tipico: <code>h = 0.1</code> o <code>h = 0.05</code>.',
    'Si tenes la <b>solucion analitica</b> <code>y(x)</code> (obtenida con separacion de variables o factor integrante), ponla en <em>Solucion exacta</em> para comparar. Ej: para <code>y\' = x + y</code>, <code>y(0) = 1</code>: solucion exacta <code>y(x) = 2·eˣ - x - 1</code>.',
    'Pulsa <b>Resolver</b>. Por cada paso la tabla muestra:<br>&nbsp;&nbsp;• <code>xₙ = x₀ + n·h</code><br>&nbsp;&nbsp;• <code>yₙ</code> (aproximacion)<br>&nbsp;&nbsp;• <code>f(xₙ, yₙ)</code> (pendiente)<br>&nbsp;&nbsp;• <code>yₙ₊₁ = yₙ + h·f(xₙ, yₙ)</code> <em>(formula de Euler)</em><br>&nbsp;&nbsp;• <code>y(xₙ)</code> exacta (si se dio)<br>&nbsp;&nbsp;• <code>|error|</code> absoluto.',
    '<b>Error global</b>: Euler es <code>O(h)</code> — si reduces h a la mitad, el error se reduce a la mitad (lineal). Por eso es poco preciso. Usa Heun (O(h²)) o RK4 (O(h⁴)) para mejor precision.',
    'Interpretacion visual: el <em>campo de pendientes</em> (grafica 4) muestra en cada punto la direccion <code>(1, f(x,y))</code>. La trayectoria de Euler sigue estas pendientes con pasos rectos de longitud h.',
    'Para el informe: (1) tabla completa de pasos; (2) <code>y(x_final)</code> estimado; (3) si hay exacta: <code>|y_N - y(x_final)|</code>; (4) observacion de error creciente con n (acumulacion). Menciona la limitacion de Euler: asume pendiente constante en todo el intervalo [xₙ, xₙ₊₁].',
  ],

  solve(params) {
    const f = parseExpression2(params.fxy);
    const x0 = parseFloat(params.x0);
    const y0 = parseFloat(params.y0);
    const xEnd = parseFloat(params.xEnd);
    const h = parseFloat(params.h);

    if (isNaN(x0) || isNaN(y0) || isNaN(xEnd) || isNaN(h)) {
      throw new Error('Todos los parametros numericos deben ser validos');
    }
    if (h <= 0) throw new Error('h debe ser > 0');
    if (xEnd <= x0) throw new Error('x final debe ser > x₀');

    let exactFn: ((x: number) => number) | null = null;
    if (params.exact && params.exact.trim() !== '') {
      exactFn = parseExpression(params.exact);
    }

    const iterations: MethodResult['iterations'] = [];
    const N = Math.ceil((xEnd - x0) / h);
    let x = x0;
    let y = y0;
    let maxError = 0;

    for (let n = 0; n <= N; n++) {
      x = x0 + n * h;
      if (x > xEnd) x = xEnd;

      const fVal = f(x, y);
      const yNext = y + h * fVal;
      const exactVal = exactFn ? exactFn(x) : null;
      const error = exactVal !== null ? Math.abs(y - exactVal) : null;
      if (error !== null && error > maxError) maxError = error;

      iterations.push({
        step: n,
        xn: x,
        yn: y,
        fxy: fVal,
        yNext: n < N ? yNext : null,
        exact: exactVal,
        error,
      });

      if (n < N) y = yNext;
    }

    const result: MethodResult = {
      root: y,
      iterations,
      converged: true,
      error: maxError,
      message: `y(${xEnd}) ≈ ${y.toFixed(8)} | ${N} pasos, h=${h}${maxError > 0 ? ` | Error max = ${formatFull(maxError)}` : ''}`,
    };
    applyOdeTargetAndVerification(result, params);
    return result;
  },

  getCharts(params, result) {
    const xs = result.iterations.map(r => r.xn as number);
    const ys = result.iterations.map(r => r.yn as number);
    const fxys = result.iterations.map(r => r.fxy as number);
    const hasExact = result.iterations[0]?.exact !== null;

    // Chart 1: Solution curve y(x)
    const datasets1: ChartData['datasets'] = [
      { label: 'Euler yₙ', x: xs, y: ys, color: '#89b4fa', pointRadius: 3 },
    ];
    if (hasExact) {
      let exactFn: ((x: number) => number) | null = null;
      if (params.exact && params.exact.trim() !== '') {
        try { exactFn = parseExpression(params.exact); } catch { /* ignore */ }
      }
      if (exactFn) {
        const xSmooth = linspace(xs[0], xs[xs.length - 1], 200);
        const ySmooth = xSmooth.map(x => exactFn!(x));
        datasets1.unshift({ label: 'Exacta y(x)', x: xSmooth, y: ySmooth, color: '#a6e3a1', pointRadius: 0 });
      }
    }

    const chart1: ChartData = {
      title: 'Solucion y(x)',
      type: 'line',
      datasets: datasets1,
      xLabel: 'x', yLabel: 'y',
    };

    // Chart 2: f(x, y) along trajectory
    const chart2: ChartData = {
      title: "f(x, y) = dy/dx a lo largo de la trayectoria",
      type: 'line',
      datasets: [
        { label: "f(xₙ, yₙ)", x: xs, y: fxys, color: '#f9e2af', pointRadius: 3 },
      ],
      xLabel: 'x', yLabel: "f(x, y)",
    };

    // Chart 3: Error or delta-y
    let chart3: ChartData;
    if (hasExact) {
      const errors = result.iterations.map(r => r.error as number).filter(e => e > 0);
      const xsErr = result.iterations.filter(r => (r.error as number) > 0).map(r => r.xn as number);
      chart3 = {
        title: '|Error| vs x',
        type: 'line',
        datasets: [
          { label: '|yₙ - y(xₙ)|', x: xsErr, y: errors, color: '#f38ba8', pointRadius: 2 },
        ],
        xLabel: 'x', yLabel: '|Error|',
        yLog: errors.length > 2 && errors[errors.length - 1] / errors[0] > 100,
      };
    } else {
      const steps = xs.slice(0, -1);
      const deltas = steps.map((_, i) => Math.abs(ys[i + 1] - ys[i]));
      chart3 = {
        title: '|Δy| por paso',
        type: 'line',
        datasets: [
          { label: '|yₙ₊₁ - yₙ|', x: steps, y: deltas, color: '#fab387', pointRadius: 2 },
        ],
        xLabel: 'x', yLabel: '|Δy|',
      };
    }

    // Chart 4: Slope field with trajectory
    const f = parseExpression2(params.fxy);
    const x0 = parseFloat(params.x0);
    const xEnd = parseFloat(params.xEnd);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const yPad = (yMax - yMin) * 0.3 || 1;

    const nFieldX = 15;
    const nFieldY = 12;
    const fieldXs = linspace(x0, xEnd, nFieldX);
    const fieldYs = linspace(yMin - yPad, yMax + yPad, nFieldY);
    const dx = (xEnd - x0) / nFieldX * 0.35;

    const segX: number[] = [];
    const segY: number[] = [];
    for (const gx of fieldXs) {
      for (const gy of fieldYs) {
        const slope = f(gx, gy);
        if (!isFinite(slope)) continue;
        const dy = slope * dx;
        segX.push(gx - dx / 2, gx + dx / 2, NaN);
        segY.push(gy - dy / 2, gy + dy / 2, NaN);
      }
    }

    const chart4: ChartData = {
      title: 'Campo de pendientes con trayectoria',
      type: 'scatter',
      datasets: [
        { label: 'Pendientes', x: segX, y: segY, color: '#585b70', pointRadius: 0 },
        { label: 'Euler', x: xs, y: ys, color: '#89b4fa', pointRadius: 2 },
      ],
      xLabel: 'x', yLabel: 'y',
    };

    return [chart1, chart2, chart3, chart4];
  },
};
