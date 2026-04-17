import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, parseExpression2, linspace } from '../../parser';

export const euler: MethodDefinition = {
  id: 'euler',
  name: 'Metodo de Euler',
  category: 'ode',
  formula: "y_{n+1} = y_n + h · f(x_n, y_n)",
  description: 'Resuelve EDOs de primer orden dy/dx = f(x,y) con condicion inicial. Metodo explicito de orden 1.',
  inputs: [
    { id: 'fxy', label: "f(x, y) = dy/dx", placeholder: 'x + y', defaultValue: 'x + y' },
    { id: 'x0', label: 'x₀', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'y0', label: 'y₀', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'xEnd', label: 'x final', placeholder: '2', type: 'number', defaultValue: '2' },
    { id: 'h', label: 'h (paso)', placeholder: '0.1', type: 'number', defaultValue: '0.1' },
    { id: 'exact', label: 'Solucion exacta y(x) (opcional)', placeholder: '2*exp(x) - x - 1', hint: 'Para calcular error' },
  ],
  tableColumns: [
    { key: 'step', label: 'Paso n' },
    { key: 'xn', label: 'xₙ' },
    { key: 'yn', label: 'yₙ' },
    { key: 'fxy', label: 'f(xₙ, yₙ)' },
    { key: 'yNext', label: 'yₙ₊₁' },
    { key: 'exact', label: 'y exacta' },
    { key: 'error', label: '|Error|' },
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

    return {
      root: y,
      iterations,
      converged: true,
      error: maxError,
      message: `y(${xEnd}) ≈ ${y.toFixed(8)} | ${N} pasos, h=${h}${maxError > 0 ? ` | Error max = ${maxError.toExponential(4)}` : ''}`,
    };
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
