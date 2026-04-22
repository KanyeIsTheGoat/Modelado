import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression2 } from '../../parser';
import {
  mulberry32,
  parseSeed,
  zForConfidence,
  parseConfPct,
  fmtNum,
  renderKRepsPanel,
  renderSummaryPanel,
  renderErrorHalvingPanel,
  renderAnalyticalPanel2D,
} from './monteCarloCommon';

/**
 * Run one 2D Monte Carlo simulation on [a,b]×[c,d]. Returns estimate and within-sample SE.
 */
function run2D(
  f: (x: number, y: number) => number,
  a: number, b: number, c: number, d: number,
  N: number, seed: number,
): { estimate: number; stdErr: number; stdDevF: number } {
  const rand = mulberry32(seed);
  const wx = b - a, wy = d - c;
  const area = wx * wy;
  let sum = 0, sumSq = 0;
  for (let i = 0; i < N; i++) {
    const xi = a + rand() * wx;
    const yi = c + rand() * wy;
    const fi = f(xi, yi);
    sum += fi;
    sumSq += fi * fi;
  }
  const mean = sum / N;
  const estimate = area * mean;
  const varF = Math.max(0, (sumSq / N) - mean * mean);
  const stdDevF = Math.sqrt(varF);
  const stdErr = area * stdDevF / Math.sqrt(N);
  return { estimate, stdErr, stdDevF };
}

export const montecarlo2D: MethodDefinition = {
  id: 'montecarlo2D',
  name: 'Monte Carlo 2D (Integral Doble)',
  category: 'integration',
  formula: '∫∫f(x,y)dA ≈ (Area)/N · Σ f(x_i,y_i) — promedio de K repeticiones',
  latexFormula: '\\iint_R f(x,y)\\,dA \\approx \\frac{(b-a)(d-c)}{N}\\sum_{i=1}^{N} f(x_i, y_i), \\quad (x_i, y_i) \\sim U([a,b]\\times[c,d])',
  description: 'Aproxima ∫∫f(x,y)dA en un rectangulo [a,b]×[c,d]. Ejecuta K repeticiones independientes y promedia para reducir varianza. Convergencia O(1/√N).',
  inputs: [
    { id: 'fxy', label: 'f(x, y)', placeholder: 'x^2 + y^2', defaultValue: 'x^2 + y^2' },
    { id: 'a', label: 'a (x min)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (x max)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'c', label: 'c (y min)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'd', label: 'd (y max)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'N (puntos por repeticion)', placeholder: '10000', type: 'number', defaultValue: '10000' },
    { id: 'K', label: 'K (repeticiones a promediar)', placeholder: '10', type: 'number', defaultValue: '10' },
    { id: 'conf', label: 'Nivel de confianza (%)', placeholder: '95', type: 'number', defaultValue: '95', hint: 'Ej: 90, 95, 99.' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: '', hint: 'Para comparar con el promedio.' },
    { id: 'seed', label: 'Semilla (opcional)', placeholder: 'Vacio = aleatorio', hint: 'Numero o texto. Misma semilla = mismos resultados.' },
  ],
  tableColumns: [
    { key: 'k', label: 'k (repeticion)', latex: 'k' },
    { key: 'estimate', label: 'I_k', latex: 'I_k' },
    { key: 'runningMean', label: 'Promedio 1..k', latex: '\\bar{I}_{1..k}' },
    { key: 'stdDevRun', label: 'σ entre lotes', latex: '\\sigma_{\\text{lotes}}' },
    { key: 'exactDiff', label: '|I_k - Exacto|', latex: '|I_k - I^*|' },
  ],
  steps: [
    'Para el <b>parcial 2025-I (IMG_5755)</b> — integral doble Monte Carlo: introduce <code>f(x, y)</code>. Ejemplo: <code>x^2 + y^2</code> o la funcion que pida el parcial.',
    'Define el dominio rectangular: <code>x ∈ [a, b]</code> y <code>y ∈ [c, d]</code>. Area = <code>(b-a)(d-c)</code>.',
    'Configura <code>N</code> (puntos por repeticion), <code>K</code> (repeticiones independientes) y <b>nivel de confianza</b> (90/95/99).',
    'Formula: <code>I_k ≈ (Area)/N · Σᵢ f(x_i, y_i)</code>. Estimador final <code>Î = (1/K) Σₖ I_k</code>.',
    'Pulsa <b>Resolver</b>. Se muestran: (1) <b>Solucion analitica paso a paso</b> (integral iterada por Fubini); (2) tabla de K repeticiones; (3) <b>Resumen estadistico</b> con media, varianza, SE e IC al nivel configurado; (4) <b>demostracion 1/√n</b> con simulacion a 4N.',
    'Para el informe: (1) <code>N, K</code>, semilla, nivel de confianza; (2) tabla de <code>I_k</code>; (3) promedio <code>Î</code>; (4) σ entre repeticiones; (5) IC; (6) si hay exacto, error relativo.',
  ],

  solve(params) {
    const f = parseExpression2(params.fxy);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const c = parseFloat(params.c);
    const d = parseFloat(params.d);
    const N = parseInt(params.n) || 10000;
    const K = Math.max(1, parseInt(params.K) || 10);
    const confPct = parseConfPct(params.conf, 95);

    if ([a, b, c, d].some(isNaN)) throw new Error('a, b, c, d deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');
    if (c >= d) throw new Error('c debe ser menor que d');
    if (N < 1) throw new Error('N debe ser >= 1');

    const area = (b - a) * (d - c);
    const widthX = b - a;
    const heightY = d - c;
    const z = zForConfidence(confPct);

    let exactVal: number | undefined;
    if (params.exact && params.exact.trim() !== '') {
      const parsed = parseFloat(params.exact);
      if (!isNaN(parsed)) exactVal = parsed;
    }

    const seedVal = parseSeed(params.seed);
    const baseSeed = seedVal !== null ? seedVal : (Date.now() ^ (Math.random() * 0xFFFFFFFF));

    const iterations: MethodResult['iterations'] = [];
    const reps: { k: number; estimate: number; runningMean: number; runningStd: number }[] = [];
    let sumEst = 0;
    let sumEstSq = 0;
    let lastStdDevF = 0;

    for (let k = 1; k <= K; k++) {
      const rand = mulberry32(baseSeed + k * 10007);
      let sum = 0;
      let sumSq = 0;
      for (let i = 0; i < N; i++) {
        const xi = a + rand() * widthX;
        const yi = c + rand() * heightY;
        const fi = f(xi, yi);
        sum += fi;
        sumSq += fi * fi;
      }
      const meanF = sum / N;
      const I_k = area * meanF;
      const varFk = Math.max(0, (sumSq / N) - meanF * meanF);
      lastStdDevF = Math.sqrt(varFk);

      sumEst += I_k;
      sumEstSq += I_k * I_k;

      const runningMean = sumEst / k;
      const varRun = k > 1 ? Math.max(0, (sumEstSq - k * runningMean * runningMean) / (k - 1)) : 0;
      const runningStd = Math.sqrt(varRun);
      const exactDiff = exactVal !== undefined ? Math.abs(I_k - exactVal) : null;

      iterations.push({
        k,
        estimate: I_k,
        runningMean,
        stdDevRun: runningStd,
        exactDiff,
      });
      reps.push({ k, estimate: I_k, runningMean, runningStd });
    }

    const avgEstimate = sumEst / K;
    // Variance and SE between the K repetitions (when K>1). Fallback to within-sample SE when K=1.
    let varK: number;
    let stdDevK: number;
    let stdErrK: number;
    let basis: 'within' | 'reps';
    if (K > 1) {
      varK = Math.max(0, (sumEstSq - K * avgEstimate * avgEstimate) / (K - 1));
      stdDevK = Math.sqrt(varK);
      stdErrK = stdDevK / Math.sqrt(K);
      basis = 'reps';
    } else {
      stdErrK = area * lastStdDevF / Math.sqrt(N);
      stdDevK = area * lastStdDevF;
      varK = stdDevK * stdDevK;
      basis = 'within';
    }

    const ciLower = avgEstimate - z * stdErrK;
    const ciUpper = avgEstimate + z * stdErrK;

    let relativeErrorPercent: number | undefined;
    let message = `I ≈ ${fmtNum(avgEstimate, 8)} (promedio de K=${K}) | σ entre repeticiones = ${fmtNum(stdDevK, 6)} | SE = ${fmtNum(stdErrK, 6)} | IC ${confPct}%: [${fmtNum(ciLower, 8)}, ${fmtNum(ciUpper, 8)}]`;
    if (exactVal !== undefined) {
      const absErr = Math.abs(avgEstimate - exactVal);
      relativeErrorPercent = Math.abs(exactVal) > 1e-14 ? absErr / Math.abs(exactVal) * 100 : absErr * 100;
      message += ` | Exacto = ${fmtNum(exactVal, 8)} | |error| = ${fmtNum(absErr, 6)}`;
    }

    const panels: string[] = [];
    panels.push(renderAnalyticalPanel2D(params.fxy, a, b, c, d));
    if (K > 1) panels.push(renderKRepsPanel(reps, '\\hat{I}'));
    panels.push(renderSummaryPanel({
      N, K,
      mean: avgEstimate, varianceEst: varK, stdDev: stdDevK,
      stdErr: stdErrK, confPct, z, ciLower, ciUpper, basis,
      symbol: '\\hat{I}',
    }));
    panels.push(renderErrorHalvingPanel({
      runner: (Nn, seed) => {
        const r = run2D(f, a, b, c, d, Nn, seed);
        return { estimate: r.estimate, stdErr: r.stdErr };
      },
      N, baseSeed, currentStdErr: stdErrK,
      constantLabel: '(b-a)(d-c)\\cdot \\sigma(f)',
      constantValue: area * lastStdDevF,
    }));

    return {
      integral: avgEstimate,
      iterations,
      converged: true,
      error: stdErrK,
      exact: exactVal,
      relativeErrorPercent,
      message,
      theoremPanels: panels,
    };
  },

  getCharts(params, result) {
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const c = parseFloat(params.c);
    const d = parseFloat(params.d);
    const N = parseInt(params.n) || 10000;

    const seedVal = parseSeed(params.seed);
    const baseSeed = seedVal !== null ? seedVal : (Date.now() ^ 0xABCD);

    const ks = result.iterations.map(r => r.k as number);
    const estimates = result.iterations.map(r => r.estimate as number);
    const runningMeans = result.iterations.map(r => r.runningMean as number);
    const finalMean = runningMeans[runningMeans.length - 1];

    const datasets1: ChartData['datasets'] = [
      { label: 'I_k (repeticion)', x: ks, y: estimates, color: '#f38ba8', pointRadius: 4, showLine: false },
      { label: 'Promedio acumulado', x: ks, y: runningMeans, color: '#cba6f7', pointRadius: 2 },
      { label: 'Promedio final', x: [ks[0], ks[ks.length - 1]], y: [finalMean, finalMean], color: '#a6e3a1', dashed: true, pointRadius: 0 },
    ];
    if (result.exact !== undefined) {
      datasets1.push({ label: 'Exacto', x: [ks[0], ks[ks.length - 1]], y: [result.exact, result.exact], color: '#89b4fa', dashed: true, pointRadius: 0 });
    }
    const chart1: ChartData = {
      title: 'K repeticiones y promedio acumulado',
      type: 'line',
      datasets: datasets1,
      xLabel: 'k (repeticion)', yLabel: 'I',
    };

    const rand = mulberry32(baseSeed + 1);
    const nShow = Math.min(N, 500);
    const sampleX: number[] = [];
    const sampleY: number[] = [];
    for (let i = 0; i < nShow; i++) {
      sampleX.push(a + rand() * (b - a));
      sampleY.push(c + rand() * (d - c));
    }
    const rectX = [a, b, b, a, a];
    const rectY = [c, c, d, d, c];
    const chart2: ChartData = {
      title: `Muestras uniformes en [${a},${b}]×[${c},${d}]`,
      type: 'scatter',
      datasets: [
        { label: 'Dominio', x: rectX, y: rectY, color: '#89b4fa', pointRadius: 0 },
        { label: 'Muestras', x: sampleX, y: sampleY, color: '#a6e3a1', pointRadius: 2, showLine: false },
      ],
      xLabel: 'x', yLabel: 'y',
    };

    const stdDevRuns = result.iterations.map(r => r.stdDevRun as number);
    const chart3: ChartData = {
      title: 'Desviacion estandar acumulada σ(I_1..I_k)',
      type: 'line',
      datasets: [
        { label: 'σ entre repeticiones', x: ks, y: stdDevRuns, color: '#fab387', pointRadius: 2 },
      ],
      xLabel: 'k', yLabel: 'σ',
    };

    let chart4: ChartData;
    if (result.exact !== undefined) {
      const absErrs = result.iterations.map(r => Math.abs((r.runningMean as number) - result.exact!));
      chart4 = {
        title: '|Promedio_k - Exacto|  vs  k',
        type: 'line',
        datasets: [
          { label: '|error|', x: ks, y: absErrs, color: '#f38ba8', pointRadius: 2 },
        ],
        xLabel: 'k', yLabel: '|error|', yLog: absErrs.length > 2 && absErrs[0] / Math.max(absErrs[absErrs.length - 1], 1e-18) > 100,
      };
    } else {
      const diffs = ks.map((_, i) => i > 0 ? Math.abs(estimates[i] - estimates[i - 1]) : 0).slice(1);
      chart4 = {
        title: '|I_k - I_{k-1}|  vs  k',
        type: 'line',
        datasets: [
          { label: '|diff|', x: ks.slice(1), y: diffs, color: '#fab387', pointRadius: 2 },
        ],
        xLabel: 'k', yLabel: '|diff|',
      };
    }

    return [chart1, chart2, chart3, chart4];
  },
};
