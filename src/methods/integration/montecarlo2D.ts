import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression2 } from '../../parser';

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function parseSeed(input: string | undefined): number | null {
  if (!input || input.trim() === '') return null;
  const num = Number(input.trim());
  if (!isNaN(num)) return num;
  return hashString(input.trim());
}

export const montecarlo2D: MethodDefinition = {
  id: 'montecarlo2D',
  name: 'Monte Carlo 2D (Integral Doble)',
  category: 'integration',
  formula: '∫∫f(x,y)dA ≈ (Area)/N · Σ f(x_i,y_i) — promedio de K repeticiones',
  description: 'Aproxima ∫∫f(x,y)dA en un rectangulo [a,b]×[c,d]. Ejecuta K repeticiones independientes y promedia para reducir varianza. Convergencia O(1/√N).',
  inputs: [
    { id: 'fxy', label: 'f(x, y)', placeholder: 'x^2 + y^2', defaultValue: 'x^2 + y^2' },
    { id: 'a', label: 'a (x min)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (x max)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'c', label: 'c (y min)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'd', label: 'd (y max)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'N (puntos por repeticion)', placeholder: '10000', type: 'number', defaultValue: '10000' },
    { id: 'K', label: 'K (repeticiones a promediar)', placeholder: '10', type: 'number', defaultValue: '10' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: '', hint: 'Para comparar con el promedio.' },
    { id: 'seed', label: 'Semilla (opcional)', placeholder: 'Vacio = aleatorio', hint: 'Numero o texto. Misma semilla = mismos resultados.' },
  ],
  tableColumns: [
    { key: 'k', label: 'k (repeticion)' },
    { key: 'estimate', label: 'I_k' },
    { key: 'runningMean', label: 'Promedio 1..k' },
    { key: 'stdDevRun', label: 'σ entre lotes' },
    { key: 'exactDiff', label: '|I_k - Exacto|' },
  ],
  steps: [
    'Para el <b>parcial 2025-I (IMG_5755)</b> — integral doble Monte Carlo: introduce <code>f(x, y)</code>. Ejemplo: <code>x^2 + y^2</code> o la funcion que pida el parcial.',
    'Define el dominio rectangular: <code>x ∈ [a, b]</code> y <code>y ∈ [c, d]</code>. Area = <code>(b-a)(d-c)</code>.',
    'Configura <code>N</code> (puntos por repeticion) y <code>K</code> (numero de repeticiones independientes). Tipico del parcial: <code>N = 10000</code>, <code>K = 10</code>. Cada repeticion usa <b>semilla distinta</b> para ser estadisticamente independiente.',
    'Formula: <code>I_k ≈ (Area)/N · Σᵢ f(x_i, y_i)</code> con <code>x_i</code>, <code>y_i</code> uniformes en [a,b] y [c,d]. El estimador final es <code>Î = (1/K) Σₖ I_k</code>.',
    'Si tienes <b>valor exacto</b>, ponlo para comparar cada <code>I_k</code> y el promedio. Exacto de <code>x² + y²</code> en <code>[0,1]²</code>: <code>2/3 ≈ 0.6667</code>.',
    'Pulsa <b>Resolver</b>. La tabla muestra por cada repeticion <code>k</code>:<br>&nbsp;&nbsp;• <code>I_k</code>: estimacion individual.<br>&nbsp;&nbsp;• <em>Promedio acumulado</em>: media de <code>I_1, ..., I_k</code> (se estabiliza).<br>&nbsp;&nbsp;• <em>σ entre repeticiones</em>: variabilidad (deberia ser pequeña si N es grande).',
    '<b>Error estandar del promedio</b>: <code>SE = s / √K</code> donde <code>s = σ</code> entre repeticiones. <em>Este es el estimador correcto cuando repites K veces</em>.',
    'Ventaja de K repeticiones: reduce la varianza global y permite <em>intervalo de confianza empirico</em>. Dobla K → SE se reduce √2 ≈ 1.41× (mas realista que asumir distribucion normal).',
    'Para el informe: (1) <code>N</code>, <code>K</code>, semilla base; (2) tabla de <code>I_k</code>; (3) promedio final <code>Î</code>; (4) σ entre repeticiones; (5) SE; (6) si hay exacto: |error| y error relativo %.',
  ],

  solve(params) {
    const f = parseExpression2(params.fxy);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const c = parseFloat(params.c);
    const d = parseFloat(params.d);
    const N = parseInt(params.n) || 10000;
    const K = Math.max(1, parseInt(params.K) || 10);

    if ([a, b, c, d].some(isNaN)) throw new Error('a, b, c, d deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');
    if (c >= d) throw new Error('c debe ser menor que d');
    if (N < 1) throw new Error('N debe ser >= 1');

    const area = (b - a) * (d - c);
    const widthX = b - a;
    const heightY = d - c;

    let exactVal: number | undefined;
    if (params.exact && params.exact.trim() !== '') {
      const parsed = parseFloat(params.exact);
      if (!isNaN(parsed)) exactVal = parsed;
    }

    const seedVal = parseSeed(params.seed);
    const baseSeed = seedVal !== null ? seedVal : (Date.now() ^ (Math.random() * 0xFFFFFFFF));

    const iterations: MethodResult['iterations'] = [];
    const estimates: number[] = [];
    let sumEst = 0;
    let sumEstSq = 0;

    for (let k = 1; k <= K; k++) {
      const rand = mulberry32(baseSeed + k * 10007);
      let sum = 0;
      for (let i = 0; i < N; i++) {
        const xi = a + rand() * widthX;
        const yi = c + rand() * heightY;
        sum += f(xi, yi);
      }
      const I_k = area * (sum / N);
      estimates.push(I_k);
      sumEst += I_k;
      sumEstSq += I_k * I_k;

      const runningMean = sumEst / k;
      const varRun = k > 1 ? Math.max(0, (sumEstSq / k) - runningMean * runningMean) : 0;
      const stdDevRun = Math.sqrt(varRun);
      const exactDiff = exactVal !== undefined ? Math.abs(I_k - exactVal) : null;

      iterations.push({
        k,
        estimate: I_k,
        runningMean,
        stdDevRun,
        exactDiff,
      });
    }

    const avgEstimate = sumEst / K;
    const varK = K > 1 ? Math.max(0, (sumEstSq / K) - avgEstimate * avgEstimate) : 0;
    const stdDevK = Math.sqrt(varK);
    const stdErrK = stdDevK / Math.sqrt(K);

    let relativeErrorPercent: number | undefined;
    let message = `I ≈ ${avgEstimate.toPrecision(8)} (promedio de K=${K}) | σ entre repeticiones = ${stdDevK.toPrecision(6)} | SE = ${stdErrK.toPrecision(6)}`;
    if (exactVal !== undefined) {
      const absErr = Math.abs(avgEstimate - exactVal);
      relativeErrorPercent = Math.abs(exactVal) > 1e-14 ? absErr / Math.abs(exactVal) * 100 : absErr * 100;
      message += ` | Exacto = ${exactVal.toPrecision(8)} | |error| = ${absErr.toPrecision(6)}`;
    }

    return {
      integral: avgEstimate,
      iterations,
      converged: true,
      error: stdErrK,
      exact: exactVal,
      relativeErrorPercent,
      message,
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

    // Chart 1: Individual estimates vs running mean
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

    // Chart 2: Sampled points in [a,b]×[c,d]
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

    // Chart 3: σ entre lotes (running) vs k
    const stdDevRuns = result.iterations.map(r => r.stdDevRun as number);
    const chart3: ChartData = {
      title: 'Desviacion estandar acumulada σ(I_1..I_k)',
      type: 'line',
      datasets: [
        { label: 'σ entre repeticiones', x: ks, y: stdDevRuns, color: '#fab387', pointRadius: 2 },
      ],
      xLabel: 'k', yLabel: 'σ',
    };

    // Chart 4: |error| vs k (if exact given)
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
