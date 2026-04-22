import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import {
  mulberry32,
  parseSeed,
  zForConfidence,
  parseConfPct,
  fmtNum,
  renderKRepsPanel,
  renderSummaryPanel,
  renderErrorHalvingPanel,
  renderAnalyticalPanel1D,
} from './monteCarloCommon';

/**
 * Run one Monte Carlo simulation: N uniform samples on [a,b], return estimate and stats.
 */
function runMC(f: (x: number) => number, a: number, b: number, N: number, seed: number): {
  integral: number;
  varF: number;
  stdDevF: number;
  stdErr: number;
} {
  const rand = mulberry32(seed);
  const width = b - a;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < N; i++) {
    const xi = a + rand() * width;
    const fi = f(xi);
    sum += fi;
    sumSq += fi * fi;
  }
  const mean = sum / N;
  const integral = width * mean;
  const varF = Math.max(0, (sumSq / N) - (mean * mean));
  const stdDevF = Math.sqrt(varF);
  const stdErr = width * stdDevF / Math.sqrt(N);
  return { integral, varF, stdDevF, stdErr };
}

export const montecarlo: MethodDefinition = {
  id: 'montecarlo',
  name: 'Monte Carlo',
  category: 'integration',
  formula: '∫f(x)dx ≈ (b-a)/N · Σ f(x_i), x_i aleatorio en [a,b]',
  latexFormula: '\\int_a^b f(x)\\,dx \\approx \\frac{b-a}{N} \\sum_{i=1}^{N} f(x_i), \\quad x_i \\sim U(a,b)',
  description: 'Aproxima la integral usando puntos aleatorios uniformes. Convergencia O(1/√N). Soporta K repeticiones y nivel de confianza configurable.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'N (puntos por repeticion)', placeholder: '10000', type: 'number', defaultValue: '10000' },
    { id: 'K', label: 'K (repeticiones, 1 = sin promediar)', placeholder: '1', type: 'number', defaultValue: '1', hint: 'Si K>1 se promedian K simulaciones independientes.' },
    { id: 'conf', label: 'Nivel de confianza (%)', placeholder: '95', type: 'number', defaultValue: '95', hint: 'Ej: 90, 95, 99. La app calcula el z critico correspondiente.' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: 'p.ej. 0.333333', type: 'number', hint: 'Si se provee, se calcula el error relativo vs exacto.' },
    { id: 'seed', label: 'Semilla (opcional)', placeholder: 'Vacio = aleatorio', hint: 'Numero o texto. Misma semilla = mismos resultados.' },
  ],
  tableColumns: [
    { key: 'batch', label: 'Lote', latex: '\\text{Lote}' },
    { key: 'nAccum', label: 'N acumulado', latex: 'N_{\\text{acum}}' },
    { key: 'estimate', label: 'Estimacion', latex: '\\hat{I}' },
    { key: 'stdDev', label: 'σ(f)', latex: '\\sigma(f)' },
    { key: 'stdErr', label: 'SE', latex: 'SE' },
    { key: 'ciLower', label: 'IC inf', latex: 'IC^{\\text{inf}}' },
    { key: 'ciUpper', label: 'IC sup', latex: 'IC^{\\text{sup}}' },
  ],
  steps: [
    'Escribe <code>f(x)</code> y limites <code>[a, b]</code>. Para el <b>parcial 02/07/2025</b>: <code>exp(x^2)</code> sobre <code>[0, 2]</code>.',
    'Elige <code>N</code> = puntos aleatorios por repeticion. Tipico: <code>1000</code> o <code>10000</code>. Convergencia <b>O(1/√N)</b>.',
    '<b>K</b>: numero de repeticiones independientes. Si <code>K = 1</code>, solo corre una simulacion (usa SE "dentro de muestra"). Si <code>K > 1</code>, corre K simulaciones y promedia — el error estandar se calcula <em>entre repeticiones</em>.',
    '<b>Nivel de confianza</b>: 90, 95 (default) o 99. La app calcula automaticamente <code>z_{α/2}</code>: 90→1.645, 95→1.96, 99→2.576.',
    'Pulsa <b>Resolver</b>. Se muestran: (1) <b>Solucion analitica paso a paso</b> (primitiva + Barrow); (2) tabla de repeticiones (si K>1); (3) <b>Resumen estadistico</b> con media, varianza, SE, IC; (4) <b>demostracion de reduccion 1/√n</b> con simulacion a 4N.',
    'Para el informe: reporta (a) estimacion; (b) media y σ entre repeticiones; (c) IC al nivel elegido; (d) comparacion vs valor analitico; (e) evidencia de que doblar la precision requiere 4× muestras.',
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const N = parseInt(params.n) || 10000;
    const K = Math.max(1, parseInt(params.K) || 1);
    const confPct = parseConfPct(params.conf, 95);

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');
    if (N < 1) throw new Error('N debe ser >= 1');

    const exactRaw = (params.exact ?? '').trim();
    const exact = exactRaw === '' ? undefined : parseFloat(exactRaw);

    const seedVal = parseSeed(params.seed);
    const baseSeed = seedVal !== null ? seedVal : (Date.now() ^ (Math.random() * 0xFFFFFFFF));
    const z = zForConfidence(confPct);
    const width = b - a;

    // ---- First pass: build batch-based iterations from a single long simulation ----
    const rand0 = mulberry32(baseSeed);
    let sum = 0;
    let sumSq = 0;
    const iterations: MethodResult['iterations'] = [];
    const batchSize = Math.max(1, Math.floor(N / 20));

    for (let i = 1; i <= N; i++) {
      const xi = a + rand0() * width;
      const fi = f(xi);
      sum += fi;
      sumSq += fi * fi;
      if (i % batchSize === 0 || i === N) {
        const mean = sum / i;
        const integral = width * mean;
        const varF = Math.max(0, (sumSq / i) - mean * mean);
        const stdDevF = Math.sqrt(varF);
        const stdErr = width * stdDevF / Math.sqrt(i);
        iterations.push({
          batch: iterations.length + 1,
          nAccum: i,
          estimate: integral,
          stdDev: stdDevF,
          stdErr,
          ciLower: integral - z * stdErr,
          ciUpper: integral + z * stdErr,
        });
      }
    }
    const mean1 = sum / N;
    const integral1 = width * mean1;
    const varF1 = Math.max(0, (sumSq / N) - mean1 * mean1);
    const stdDevF1 = Math.sqrt(varF1);
    const stdErr1 = width * stdDevF1 / Math.sqrt(N);

    // ---- K-reps simulation ----
    const reps: { k: number; estimate: number; runningMean: number; runningStd: number }[] = [];
    let finalMean = integral1;
    let finalSE = stdErr1;
    let finalVar = Math.pow(width * stdDevF1, 2);
    let finalStd = width * stdDevF1;
    let basis: 'within' | 'reps' = 'within';

    if (K > 1) {
      let sumK = 0;
      let sumKSq = 0;
      for (let k = 1; k <= K; k++) {
        const run = runMC(f, a, b, N, baseSeed + k * 10007);
        sumK += run.integral;
        sumKSq += run.integral * run.integral;
        const runningMean = sumK / k;
        const varRun = k > 1 ? Math.max(0, (sumKSq - k * runningMean * runningMean) / (k - 1)) : 0;
        const runningStd = Math.sqrt(varRun);
        reps.push({ k, estimate: run.integral, runningMean, runningStd });
      }
      finalMean = reps[K - 1].runningMean;
      const sampleVarK = Math.max(0, (sumKSq - K * finalMean * finalMean) / (K - 1));
      finalStd = Math.sqrt(sampleVarK);
      finalVar = sampleVarK;
      finalSE = finalStd / Math.sqrt(K);
      basis = 'reps';
    }

    const ciLower = finalMean - z * finalSE;
    const ciUpper = finalMean + z * finalSE;

    const errRelPct = exact !== undefined && !isNaN(exact) && exact !== 0
      ? Math.abs((finalMean - exact) / exact) * 100
      : undefined;

    // ---- Build panels ----
    const panels: string[] = [];
    panels.push(renderAnalyticalPanel1D(params.fx, a, b));
    if (K > 1) panels.push(renderKRepsPanel(reps, '\\hat{I}'));
    panels.push(renderSummaryPanel({
      N, K,
      mean: finalMean, varianceEst: finalVar, stdDev: finalStd,
      stdErr: finalSE, confPct, z, ciLower, ciUpper, basis,
      symbol: '\\hat{I}',
    }));
    panels.push(renderErrorHalvingPanel({
      runner: (Nn, seed) => {
        const r = runMC(f, a, b, Nn, seed);
        return { estimate: r.integral, stdErr: r.stdErr };
      },
      N, baseSeed, currentStdErr: finalSE,
      constantLabel: '(b-a)\\cdot \\sigma(f)',
      constantValue: width * stdDevF1,
    }));

    const seedMsg = seedVal !== null ? `semilla = ${seedVal}` : 'semilla aleatoria';
    const msgParts = [
      `N=${N}`,
      K > 1 ? `K=${K}` : null,
      seedMsg,
      `σ(f)=${fmtNum(stdDevF1, 6)}`,
      `IC ${confPct}%: [${fmtNum(ciLower, 8)}, ${fmtNum(ciUpper, 8)}]`,
      errRelPct !== undefined ? `error vs exacto: ${fmtNum(errRelPct, 4)}%` : null,
    ].filter(Boolean);

    return {
      integral: finalMean,
      iterations,
      converged: true,
      error: finalSE,
      exact,
      relativeErrorPercent: errRelPct,
      message: msgParts.join(' | '),
      theoremPanels: panels,
    };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const N = parseInt(params.n) || 10000;
    const K = Math.max(1, parseInt(params.K) || 1);
    const confPct = parseConfPct(params.conf, 95);
    const z = zForConfidence(confPct);
    const width = b - a;

    const seedVal = parseSeed(params.seed);
    const chartSeed = seedVal !== null ? seedVal + 1 : (Date.now() ^ 0xABCD);
    const rand = mulberry32(chartSeed);

    const pad = width * 0.1;
    const xs = linspace(a - pad, b + pad, 500);
    const ys = xs.map(x => f(x));

    const nShow = Math.min(N, 500);
    const sampleX: number[] = [];
    const sampleY: number[] = [];
    for (let i = 0; i < nShow; i++) {
      const xi = a + rand() * width;
      sampleX.push(xi);
      sampleY.push(f(xi));
    }

    const chart1: ChartData = {
      title: `Monte Carlo — ${nShow} puntos aleatorios`,
      type: 'scatter',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa', pointRadius: 0 },
        { label: 'Muestras', x: sampleX, y: sampleY, color: '#a6e3a1', pointRadius: 2, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    const batchNs = result.iterations.map(r => r.nAccum as number);
    const estimates = result.iterations.map(r => r.estimate as number);
    const stdErrs = result.iterations.map(r => r.stdErr as number);
    const ciLowers = estimates.map((e, i) => e - z * stdErrs[i]);
    const ciUppers = estimates.map((e, i) => e + z * stdErrs[i]);

    const chart2: ChartData = {
      title: `Convergencia con IC ${confPct}%`,
      type: 'line',
      datasets: [
        { label: `IC ${confPct}% sup`, x: batchNs, y: ciUppers, color: '#a6e3a1', dashed: true, pointRadius: 0 },
        { label: 'Estimacion', x: batchNs, y: estimates, color: '#cba6f7', pointRadius: 3 },
        { label: `IC ${confPct}% inf`, x: batchNs, y: ciLowers, color: '#a6e3a1', dashed: true, pointRadius: 0 },
      ],
      xLabel: 'N (muestras)', yLabel: 'Integral estimada',
    };

    const seTheoretical = batchNs.map(n => (stdErrs.length > 0 ? stdErrs[0] * Math.sqrt(batchNs[0] / n) : 0));
    const chart3: ChartData = {
      title: 'Error estandar SE vs N (pendiente teorica 1/√N)',
      type: 'line',
      datasets: [
        { label: 'SE observado', x: batchNs, y: stdErrs, color: '#fab387', pointRadius: 2 },
        { label: 'SE teorico (∝ 1/√N)', x: batchNs, y: seTheoretical, color: '#94e2d5', dashed: true, pointRadius: 0 },
      ],
      xLabel: 'N', yLabel: 'SE', yLog: true,
    };

    let chart4: ChartData;
    if (K > 1) {
      const reps: { k: number; est: number; mean: number }[] = [];
      let sumK = 0;
      for (let k = 1; k <= K; k++) {
        const run = runMC(f, a, b, N, (seedVal ?? chartSeed) + k * 10007);
        sumK += run.integral;
        reps.push({ k, est: run.integral, mean: sumK / k });
      }
      chart4 = {
        title: `K = ${K} repeticiones y promedio acumulado`,
        type: 'line',
        datasets: [
          { label: 'Î_k', x: reps.map(r => r.k), y: reps.map(r => r.est), color: '#f38ba8', pointRadius: 4, showLine: false },
          { label: 'Promedio 1..k', x: reps.map(r => r.k), y: reps.map(r => r.mean), color: '#cba6f7', pointRadius: 2 },
        ],
        xLabel: 'k', yLabel: 'Î',
      };
    } else {
      const stdDevs = result.iterations.map(r => r.stdDev as number);
      chart4 = {
        title: 'σ(f) y SE vs N',
        type: 'line',
        datasets: [
          { label: 'σ(f)', x: batchNs, y: stdDevs, color: '#f9e2af', pointRadius: 2 },
          { label: 'SE', x: batchNs, y: stdErrs, color: '#fab387', pointRadius: 2 },
        ],
        xLabel: 'N', yLabel: 'Valor', yLog: true,
      };
    }

    return [chart1, chart2, chart3, chart4];
  },
};
