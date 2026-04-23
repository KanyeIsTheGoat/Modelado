import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, parseExpression2, linspace } from '../../parser';
import { commonOdeInputs, applyOdeTargetAndVerification, verifyDiffColumn } from '../../odeHelpers';
import { formatFull } from '../../precision';
import {
  runHeun,
  renderIterationSummaryPanel,
  renderErrorAnalysisPanel,
  renderMethodComparisonPanel,
} from './odeCommon';

export const heun: MethodDefinition = {
  id: 'heun',
  name: 'Metodo de Heun (RK2)',
  category: 'ode',
  formula: "y_{n+1} = y_n + (h/2)[f(x_n, y_n) + f(x_{n+1}, ỹ_{n+1})]",
  latexFormula: "\\begin{aligned} \\tilde{y}_{n+1} &= y_n + h \\cdot f(x_n, y_n) \\\\ y_{n+1} &= y_n + \\frac{h}{2}\\left[f(x_n, y_n) + f(x_{n+1}, \\tilde{y}_{n+1})\\right] \\end{aligned}",
  description: 'Metodo predictor-corrector de orden 2. Predice con Euler, corrige promediando pendientes en ambos extremos.',
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
    { key: 'yPredict', label: 'ỹ (predictor)', latex: '\\tilde{y}_{n+1}' },
    { key: 'fPredict', label: 'f(xₙ₊₁, ỹ)', latex: 'f(x_{n+1}, \\tilde{y}_{n+1})' },
    { key: 'yNext', label: 'yₙ₊₁', latex: 'y_{n+1}' },
    { key: 'exact', label: 'y exacta', latex: 'y^*(x_n)' },
    { key: 'error', label: '|Error|', latex: '|E|' },
    verifyDiffColumn,
  ],
  steps: [
    'Heun (tambien llamado <b>Euler mejorado</b> o <b>RK2</b>) es un <em>predictor-corrector</em>: primero predice con Euler, luego corrige promediando pendientes.',
    'Formato de entrada: igual que Euler. <code>f(x, y)</code>, <code>x₀</code>, <code>y₀</code>, <code>x_final</code>, <code>h</code>. Recomendado <code>h = 0.1</code>.',
    'Pulsa <b>Resolver</b>. Por cada paso, Heun ejecuta <b>dos sub-pasos</b>:<br>&nbsp;&nbsp;1. <b>Predictor</b>: <code>ỹ = yₙ + h · f(xₙ, yₙ)</code> — es <em>un paso de Euler</em>.<br>&nbsp;&nbsp;2. <b>Corrector</b>: <code>yₙ₊₁ = yₙ + (h/2)·[f(xₙ, yₙ) + f(xₙ₊₁, ỹ)]</code> — <em>promedio</em> de pendientes en ambos extremos.',
    'La tabla muestra columnas separadas: <em>ỹ (predictor)</em>, <em>f(xₙ₊₁, ỹ)</em>, <em>yₙ₊₁ (corrector)</em> — para verificar cada sub-calculo a mano en el informe.',
    '<b>Error global</b>: <code>O(h²)</code> — <em>muchisimo mejor que Euler</em>. Reducir h a la mitad reduce el error a un cuarto. Para la misma precision necesitas ~10× menos pasos que Euler.',
    'Si das la <b>solucion exacta</b> <code>y(x)</code>, la app calcula error absoluto en cada paso y grafica su evolucion.',
    'Para el informe: (1) tabla con predictor y corrector; (2) <code>y(x_final)</code>; (3) comparacion con Euler para mismo h — Heun deberia dar error ~10× menor; (4) comparacion con RK4 si pedido.',
    'Interpretacion geometrica: Euler usa solo la pendiente en <code>(xₙ, yₙ)</code>. Heun promedia la pendiente inicial y la pendiente en el punto predicho — como "mirar adelante" antes de dar el paso.',
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
      // Predictor (Euler)
      const yPred = y + h * fVal;
      // Corrector slope
      const xNext = x + h;
      const fPred = f(xNext, yPred);
      // Corrector (average of both slopes)
      const yNext = y + (h / 2) * (fVal + fPred);

      const exactVal = exactFn ? exactFn(x) : null;
      const error = exactVal !== null ? Math.abs(y - exactVal) : null;
      if (error !== null && error > maxError) maxError = error;

      iterations.push({
        step: n,
        xn: x,
        yn: y,
        fxy: fVal,
        yPredict: n < N ? yPred : null,
        fPredict: n < N ? fPred : null,
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

    const steps = runHeun(f, x0, y0, xEnd, h, exactFn);
    const panels: string[] = [];
    panels.push(renderIterationSummaryPanel('Heun (RK2)', steps, h, xEnd));
    panels.push(renderErrorAnalysisPanel('Heun (RK2)', 2, steps, h));
    panels.push(renderMethodComparisonPanel(f, x0, y0, xEnd, h, exactFn, 'heun'));
    result.theoremPanels = panels;

    return result;
  },

  getCharts(params, result) {
    const xs = result.iterations.map(r => r.xn as number);
    const ys = result.iterations.map(r => r.yn as number);
    const fxys = result.iterations.map(r => r.fxy as number);
    const hasExact = result.iterations[0]?.exact !== null;

    // Chart 1: Solution curve
    const datasets1: ChartData['datasets'] = [
      { label: 'Heun yₙ', x: xs, y: ys, color: '#94e2d5', pointRadius: 3 },
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

    // Chart 2: Predictor vs corrector
    const yPreds = result.iterations.filter(r => r.yPredict !== null).map(r => r.yPredict as number);
    const yNexts = result.iterations.filter(r => r.yNext !== null).map(r => r.yNext as number);
    const xsStep = xs.slice(0, -1);

    const chart2: ChartData = {
      title: 'Predictor (Euler) vs Corrector (Heun)',
      type: 'line',
      datasets: [
        { label: 'ỹ predictor', x: xsStep, y: yPreds, color: '#f9e2af', pointRadius: 3 },
        { label: 'yₙ₊₁ corrector', x: xsStep, y: yNexts, color: '#94e2d5', pointRadius: 3 },
      ],
      xLabel: 'x', yLabel: 'y',
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
      const deltas = xsStep.map((_, i) => Math.abs(ys[i + 1] - ys[i]));
      chart3 = {
        title: '|Δy| por paso',
        type: 'line',
        datasets: [
          { label: '|yₙ₊₁ - yₙ|', x: xsStep, y: deltas, color: '#fab387', pointRadius: 2 },
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

    const fieldXs = linspace(x0, xEnd, 15);
    const fieldYs = linspace(yMin - yPad, yMax + yPad, 12);
    const dx = (xEnd - x0) / 15 * 0.35;

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
        { label: 'Heun', x: xs, y: ys, color: '#94e2d5', pointRadius: 2 },
      ],
      xLabel: 'x', yLabel: 'y',
    };

    return [chart1, chart2, chart3, chart4];
  },
};
