import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, parseExpression2, linspace } from '../../parser';
import { commonOdeInputs, applyOdeTargetAndVerification, verifyDiffColumn } from '../../odeHelpers';

export const rungeKutta: MethodDefinition = {
  id: 'rungeKutta',
  name: 'Runge-Kutta (RK4)',
  category: 'ode',
  formula: "y_{n+1} = y_n + (h/6)(k₁ + 2k₂ + 2k₃ + k₄)",
  description: 'Metodo clasico de Runge-Kutta de orden 4. Resuelve dy/dx = f(x,y) con alta precision usando 4 evaluaciones por paso.',
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
    { key: 'step', label: 'Paso n' },
    { key: 'xn', label: 'xₙ' },
    { key: 'yn', label: 'yₙ' },
    { key: 'k1', label: 'k₁' },
    { key: 'k2', label: 'k₂' },
    { key: 'k3', label: 'k₃' },
    { key: 'k4', label: 'k₄' },
    { key: 'yNext', label: 'yₙ₊₁' },
    { key: 'exact', label: 'y exacta' },
    { key: 'error', label: '|Error|' },
    verifyDiffColumn,
  ],
  steps: [
    '<b>RK4 es el metodo estandar de la industria</b> para EDOs — altamente preciso, relativamente simple de implementar, estable. Si el parcial dice "resuelva con alta precision" o "sin mencionar orden", usa RK4.',
    'Escribe <code>f(x, y)</code> y las condiciones: <code>x₀</code>, <code>y₀</code>, <code>x_final</code>, <code>h</code>. Tipico: <code>h = 0.1</code> ya da error <code>~10⁻⁵</code>.',
    'Pulsa <b>Resolver</b>. Por cada paso, RK4 calcula <b>4 pendientes</b>:<br>&nbsp;&nbsp;• <code>k₁ = f(xₙ, yₙ)</code> — pendiente al inicio<br>&nbsp;&nbsp;• <code>k₂ = f(xₙ + h/2, yₙ + (h/2)·k₁)</code> — pendiente en el medio (usando k₁)<br>&nbsp;&nbsp;• <code>k₃ = f(xₙ + h/2, yₙ + (h/2)·k₂)</code> — pendiente en el medio (usando k₂, corregida)<br>&nbsp;&nbsp;• <code>k₄ = f(xₙ + h, yₙ + h·k₃)</code> — pendiente al final',
    'Formula combinada: <code>yₙ₊₁ = yₙ + (h/6)·(k₁ + 2·k₂ + 2·k₃ + k₄)</code>. Los pesos <b>1, 2, 2, 1</b> dan el <em>promedio ponderado</em> optimo de las 4 pendientes.',
    'La tabla muestra cada <code>k_i</code> separadamente — util para verificar a mano en el parcial. Tipicamente el parcial pide escribir explicitamente <code>k₁, k₂, k₃, k₄</code> antes de dar <code>yₙ₊₁</code>.',
    '<b>Error global</b>: <code>O(h⁴)</code> — <em>drasticamente mejor</em> que Euler (O(h)) o Heun (O(h²)). Reducir h a la mitad reduce el error por factor 16.',
    'Si das la <b>solucion exacta</b> (ej. <code>2*exp(x) - x - 1</code>), la tabla muestra error absoluto por paso. Error tipico con h=0.1: <code>|error| ~ 10⁻⁵</code> o menor.',
    'Para el informe: (1) tabla con las 4 columnas <code>k_i</code> visibles en al menos los primeros 2-3 pasos; (2) <code>y(x_final)</code>; (3) si el parcial compara metodos: RK4 debe dar error ~1000× menor que Euler para mismo h; (4) costo computacional: 4 evaluaciones de <code>f</code> por paso (vs 1 Euler, 2 Heun).',
    'Truco para entender geometricamente: las 4 pendientes son como "tomar 4 fotos" de la direccion del campo vectorial en distintos puntos del paso, y promediarlas con pesos mayores para las fotos del medio (k₂ y k₃). Esto captura la <em>curvatura</em> de la solucion.',
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

      const k1 = f(x, y);
      const k2 = f(x + h / 2, y + (h / 2) * k1);
      const k3 = f(x + h / 2, y + (h / 2) * k2);
      const k4 = f(x + h, y + h * k3);
      const yNext = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);

      const exactVal = exactFn ? exactFn(x) : null;
      const error = exactVal !== null ? Math.abs(y - exactVal) : null;
      if (error !== null && error > maxError) maxError = error;

      iterations.push({
        step: n,
        xn: x,
        yn: y,
        k1, k2, k3, k4,
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
      message: `y(${xEnd}) ≈ ${y.toFixed(8)} | ${N} pasos, h=${h}${maxError > 0 ? ` | Error max = ${maxError.toExponential(4)}` : ''}`,
    };
    applyOdeTargetAndVerification(result, params);
    return result;
  },

  getCharts(params, result) {
    const xs = result.iterations.map(r => r.xn as number);
    const ys = result.iterations.map(r => r.yn as number);
    const k1s = result.iterations.map(r => r.k1 as number);
    const k2s = result.iterations.map(r => r.k2 as number);
    const k3s = result.iterations.map(r => r.k3 as number);
    const k4s = result.iterations.map(r => r.k4 as number);
    const hasExact = result.iterations[0]?.exact !== null;

    // Chart 1: Solution curve
    const datasets1: ChartData['datasets'] = [
      { label: 'RK4 yₙ', x: xs, y: ys, color: '#cba6f7', pointRadius: 3 },
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

    // Chart 2: k1, k2, k3, k4 evolution
    const chart2: ChartData = {
      title: 'Coeficientes k₁, k₂, k₃, k₄ vs x',
      type: 'line',
      datasets: [
        { label: 'k₁', x: xs, y: k1s, color: '#89b4fa', pointRadius: 2 },
        { label: 'k₂', x: xs, y: k2s, color: '#a6e3a1', pointRadius: 2 },
        { label: 'k₃', x: xs, y: k3s, color: '#f9e2af', pointRadius: 2 },
        { label: 'k₄', x: xs, y: k4s, color: '#f38ba8', pointRadius: 2 },
      ],
      xLabel: 'x', yLabel: 'k',
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
        { label: 'RK4', x: xs, y: ys, color: '#cba6f7', pointRadius: 2 },
      ],
      xLabel: 'x', yLabel: 'y',
    };

    return [chart1, chart2, chart3, chart4];
  },
};
