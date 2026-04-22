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
  renderAnalyticalPanelDifference,
} from './monteCarloCommon';

/**
 * Run one Hit-or-Miss simulation between f and g over [a,b], within bounding rectangle [yLo, yHi].
 */
function runArea(
  f: (x: number) => number, g: (x: number) => number,
  a: number, b: number, yLo: number, yHi: number,
  N: number, seed: number,
): { estimate: number; hits: number; stdErr: number } {
  const rand = mulberry32(seed);
  const rectArea = (b - a) * (yHi - yLo);
  let hits = 0;
  for (let i = 0; i < N; i++) {
    const xi = a + rand() * (b - a);
    const yi = yLo + rand() * (yHi - yLo);
    const fv = f(xi);
    const gv = g(xi);
    const top = Math.max(fv, gv);
    const bot = Math.min(fv, gv);
    if (yi >= bot && yi <= top) hits++;
  }
  const p = hits / N;
  const estimate = rectArea * p;
  // Bernoulli SE scaled by rectangle area.
  const stdErr = rectArea * Math.sqrt(p * (1 - p) / N);
  return { estimate, hits, stdErr };
}

export const montecarloArea: MethodDefinition = {
  id: 'montecarloArea',
  name: 'Monte Carlo — Area entre curvas',
  category: 'integration',
  formula: 'A = ∫_a^b (f(x) - g(x)) dx — Hit-or-Miss sobre rectangulo circunscrito',
  latexFormula: 'A = \\int_a^b \\bigl(f(x) - g(x)\\bigr)\\,dx \\approx A_{\\text{rect}} \\cdot \\frac{\\#\\{\\text{puntos dentro}\\}}{N}',
  description: 'Estima el area entre f(x) y g(x) sobre [a,b] lanzando puntos aleatorios y contando cuantos caen en la region. Promedia K repeticiones. Nivel de confianza configurable.',
  inputs: [
    { id: 'fx', label: 'f(x) (curva superior)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'gx', label: 'g(x) (curva inferior)', placeholder: 'x^3', defaultValue: 'x^3' },
    { id: 'a', label: 'a (limite inferior x)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior x)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'N (puntos por repeticion)', placeholder: '10000', type: 'number', defaultValue: '10000' },
    { id: 'K', label: 'K (repeticiones a promediar)', placeholder: '10', type: 'number', defaultValue: '10' },
    { id: 'conf', label: 'Nivel de confianza (%)', placeholder: '95', type: 'number', defaultValue: '95', hint: 'Ej: 90, 95, 99.' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: '', hint: 'Para comparar con el promedio.' },
    { id: 'seed', label: 'Semilla (opcional)', placeholder: 'Vacio = aleatorio', hint: 'Numero o texto.' },
  ],
  tableColumns: [
    { key: 'k', label: 'k (repeticion)', latex: 'k' },
    { key: 'hits', label: 'Aciertos', latex: 'M' },
    { key: 'estimate', label: 'A_k', latex: 'A_k' },
    { key: 'runningMean', label: 'Promedio 1..k', latex: '\\bar{A}_{1..k}' },
    { key: 'stdDevRun', label: 'σ entre repeticiones', latex: '\\sigma_{\\text{reps}}' },
    { key: 'exactDiff', label: '|A_k - Exacto|', latex: '|A_k - A^*|' },
  ],
  steps: [
    'Para el <b>parcial 30/04/2025</b>: escribe <code>f(x)</code> (superior) y <code>g(x)</code> (inferior). Ej: <code>f = x²</code>, <code>g = x³</code> en <code>[0, 1]</code>.',
    'Define <code>[a, b]</code>. Si las curvas se cruzan, la app usa <code>|f - g|</code> automaticamente (toma el max y min en cada x).',
    'Configura <code>N</code>, <code>K</code> y el <b>nivel de confianza</b> (90/95/99).',
    '<b>Estrategia Hit-or-Miss</b>: rectangulo circunscrito <code>[a, b] × [y_min, y_max]</code>. Puntos uniformes, cuenta los que caen entre las curvas. <code>A ≈ (Area rect) · (hits / N)</code>.',
    'Pulsa <b>Resolver</b>. Se muestran: (1) <b>Solucion analitica paso a paso</b> (∫(f-g)dx); (2) tabla de K repeticiones; (3) <b>Resumen estadistico</b> con media, varianza, SE, IC; (4) <b>demostracion 1/√n</b> con simulacion a 4N.',
    'Para el informe: (1) tabla de A_k; (2) promedio; (3) σ entre repeticiones; (4) IC; (5) comparacion con exacto si lo hay.',
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const g = parseExpression(params.gx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const N = parseInt(params.n) || 10000;
    const K = Math.max(1, parseInt(params.K) || 10);
    const confPct = parseConfPct(params.conf, 95);
    const z = zForConfidence(confPct);

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');
    if (N < 1) throw new Error('N debe ser >= 1');

    // Find bounding rectangle [a,b] × [yMin, yMax] that contains both curves
    const sampleXs = linspace(a, b, 200);
    const fVals = sampleXs.map(x => f(x));
    const gVals = sampleXs.map(x => g(x));
    let yMin = Math.min(...fVals, ...gVals);
    let yMax = Math.max(...fVals, ...gVals);
    const yPad = (yMax - yMin) * 0.05 || 1;
    yMin -= yPad;
    yMax += yPad;

    const rectArea = (b - a) * (yMax - yMin);

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
    let lastPHat = 0;

    for (let k = 1; k <= K; k++) {
      const run = runArea(f, g, a, b, yMin, yMax, N, baseSeed + k * 10007);
      const A_k = run.estimate;
      lastPHat = run.hits / N;
      sumEst += A_k;
      sumEstSq += A_k * A_k;

      const runningMean = sumEst / k;
      const varRun = k > 1 ? Math.max(0, (sumEstSq - k * runningMean * runningMean) / (k - 1)) : 0;
      const runningStd = Math.sqrt(varRun);
      const exactDiff = exactVal !== undefined ? Math.abs(A_k - exactVal) : null;

      iterations.push({
        k,
        hits: run.hits,
        estimate: A_k,
        runningMean,
        stdDevRun: runningStd,
        exactDiff,
      });
      reps.push({ k, estimate: A_k, runningMean, runningStd });
    }

    const avgEstimate = sumEst / K;
    let varK: number;
    let stdDevK: number;
    let stdErrK: number;
    let basis: 'within' | 'reps' | 'bernoulli';
    if (K > 1) {
      varK = Math.max(0, (sumEstSq - K * avgEstimate * avgEstimate) / (K - 1));
      stdDevK = Math.sqrt(varK);
      stdErrK = stdDevK / Math.sqrt(K);
      basis = 'reps';
    } else {
      // Bernoulli SE from the single run
      stdErrK = rectArea * Math.sqrt(lastPHat * (1 - lastPHat) / N);
      stdDevK = rectArea * Math.sqrt(lastPHat * (1 - lastPHat));
      varK = stdDevK * stdDevK;
      basis = 'bernoulli';
    }

    const ciLower = avgEstimate - z * stdErrK;
    const ciUpper = avgEstimate + z * stdErrK;

    let relativeErrorPercent: number | undefined;
    let message = `A ≈ ${fmtNum(avgEstimate, 8)} (K=${K}, N=${N}) | σ reps = ${fmtNum(stdDevK, 6)} | SE = ${fmtNum(stdErrK, 6)} | IC ${confPct}%: [${fmtNum(ciLower, 8)}, ${fmtNum(ciUpper, 8)}]`;
    if (exactVal !== undefined) {
      const absErr = Math.abs(avgEstimate - exactVal);
      relativeErrorPercent = Math.abs(exactVal) > 1e-14 ? absErr / Math.abs(exactVal) * 100 : absErr * 100;
      message += ` | Exacto = ${fmtNum(exactVal, 8)} | |error| = ${fmtNum(absErr, 6)}`;
    }

    const panels: string[] = [];
    panels.push(renderAnalyticalPanelDifference(params.fx, params.gx, a, b));
    if (K > 1) panels.push(renderKRepsPanel(reps, '\\hat{A}'));
    panels.push(renderSummaryPanel({
      N, K,
      mean: avgEstimate, varianceEst: varK, stdDev: stdDevK,
      stdErr: stdErrK, confPct, z, ciLower, ciUpper, basis,
      symbol: '\\hat{A}',
    }));
    panels.push(renderErrorHalvingPanel({
      runner: (Nn, seed) => {
        const r = runArea(f, g, a, b, yMin, yMax, Nn, seed);
        return { estimate: r.estimate, stdErr: r.stdErr };
      },
      N, baseSeed, currentStdErr: stdErrK,
      constantLabel: 'A_{\\text{rect}}\\cdot \\sqrt{p(1-p)}',
      constantValue: rectArea * Math.sqrt(lastPHat * (1 - lastPHat)),
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
    const f = parseExpression(params.fx);
    const g = parseExpression(params.gx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const N = parseInt(params.n) || 10000;
    const seedVal = parseSeed(params.seed);
    const baseSeed = seedVal !== null ? seedVal : (Date.now() ^ 0xABCD);

    const xsPlot = linspace(a, b, 400);
    const fYs = xsPlot.map(x => f(x));
    const gYs = xsPlot.map(x => g(x));
    const yMin = Math.min(...fYs, ...gYs);
    const yMax = Math.max(...fYs, ...gYs);
    const yPad = (yMax - yMin) * 0.05 || 1;
    const yLo = yMin - yPad;
    const yHi = yMax + yPad;

    const rand = mulberry32(baseSeed + 1);
    const nShow = Math.min(N, 600);
    const hitX: number[] = [];
    const hitY: number[] = [];
    const missX: number[] = [];
    const missY: number[] = [];
    for (let i = 0; i < nShow; i++) {
      const xi = a + rand() * (b - a);
      const yi = yLo + rand() * (yHi - yLo);
      const fv = f(xi);
      const gv = g(xi);
      const top = Math.max(fv, gv);
      const bot = Math.min(fv, gv);
      if (yi >= bot && yi <= top) {
        hitX.push(xi); hitY.push(yi);
      } else {
        missX.push(xi); missY.push(yi);
      }
    }
    const chart1: ChartData = {
      title: 'Hit-or-Miss entre f(x) y g(x)',
      type: 'scatter',
      datasets: [
        { label: 'f(x)', x: xsPlot, y: fYs, color: '#89b4fa', pointRadius: 0 },
        { label: 'g(x)', x: xsPlot, y: gYs, color: '#fab387', pointRadius: 0 },
        { label: 'Dentro', x: hitX, y: hitY, color: '#a6e3a1', pointRadius: 2, showLine: false },
        { label: 'Fuera', x: missX, y: missY, color: '#f38ba8', pointRadius: 1.5, showLine: false },
      ],
      xLabel: 'x', yLabel: 'y',
    };

    const ks = result.iterations.map(r => r.k as number);
    const estimates = result.iterations.map(r => r.estimate as number);
    const runningMeans = result.iterations.map(r => r.runningMean as number);
    const finalMean = runningMeans[runningMeans.length - 1];
    const datasets2: ChartData['datasets'] = [
      { label: 'A_k', x: ks, y: estimates, color: '#f38ba8', pointRadius: 4, showLine: false },
      { label: 'Promedio acumulado', x: ks, y: runningMeans, color: '#cba6f7', pointRadius: 2 },
      { label: 'Promedio final', x: [ks[0], ks[ks.length - 1]], y: [finalMean, finalMean], color: '#a6e3a1', dashed: true, pointRadius: 0 },
    ];
    if (result.exact !== undefined) {
      datasets2.push({ label: 'Exacto', x: [ks[0], ks[ks.length - 1]], y: [result.exact, result.exact], color: '#89b4fa', dashed: true, pointRadius: 0 });
    }
    const chart2: ChartData = {
      title: 'K repeticiones y promedio acumulado',
      type: 'line',
      datasets: datasets2,
      xLabel: 'k (repeticion)', yLabel: 'Area',
    };

    const stdDevRuns = result.iterations.map(r => r.stdDevRun as number);
    const chart3: ChartData = {
      title: 'σ(A_1..A_k) — dispersion entre repeticiones',
      type: 'line',
      datasets: [
        { label: 'σ', x: ks, y: stdDevRuns, color: '#fab387', pointRadius: 2 },
      ],
      xLabel: 'k', yLabel: 'σ',
    };

    let chart4: ChartData;
    if (result.exact !== undefined) {
      const absErrs = runningMeans.map(v => Math.abs(v - result.exact!));
      chart4 = {
        title: '|Promedio_k - Exacto| vs k',
        type: 'line',
        datasets: [
          { label: '|error|', x: ks, y: absErrs, color: '#f38ba8', pointRadius: 2 },
        ],
        xLabel: 'k', yLabel: '|error|',
      };
    } else {
      chart4 = {
        title: 'Aciertos por repeticion',
        type: 'bar',
        datasets: [
          { label: 'hits', x: ks, y: result.iterations.map(r => r.hits as number), color: '#94e2d5' },
        ],
        xLabel: 'k', yLabel: 'hits',
      };
    }

    return [chart1, chart2, chart3, chart4];
  },
};
