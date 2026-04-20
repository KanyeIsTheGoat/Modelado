import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

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

export const montecarloArea: MethodDefinition = {
  id: 'montecarloArea',
  name: 'Monte Carlo — Area entre curvas',
  category: 'integration',
  formula: 'A = ∫_a^b (f(x) - g(x)) dx — Hit-or-Miss sobre rectangulo circunscrito',
  description: 'Estima el area entre f(x) y g(x) sobre [a,b] lanzando puntos aleatorios y contando cuantos caen en la region. Promedia K repeticiones.',
  inputs: [
    { id: 'fx', label: 'f(x) (curva superior)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'gx', label: 'g(x) (curva inferior)', placeholder: 'x^3', defaultValue: 'x^3' },
    { id: 'a', label: 'a (limite inferior x)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior x)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'N (puntos por repeticion)', placeholder: '10000', type: 'number', defaultValue: '10000' },
    { id: 'K', label: 'K (repeticiones a promediar)', placeholder: '10', type: 'number', defaultValue: '10' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: '', hint: 'Para comparar con el promedio.' },
    { id: 'seed', label: 'Semilla (opcional)', placeholder: 'Vacio = aleatorio', hint: 'Numero o texto.' },
  ],
  tableColumns: [
    { key: 'k', label: 'k (repeticion)' },
    { key: 'hits', label: 'Aciertos' },
    { key: 'estimate', label: 'A_k' },
    { key: 'runningMean', label: 'Promedio 1..k' },
    { key: 'stdDevRun', label: 'σ entre repeticiones' },
    { key: 'exactDiff', label: '|A_k - Exacto|' },
  ],
  steps: [
    'Para el <b>parcial 30/04/2025</b> (area entre curvas por Monte Carlo): escribe <code>f(x)</code> (curva <em>superior</em>) y <code>g(x)</code> (curva <em>inferior</em>). Ejemplo parcial: <code>f(x) = x²</code>, <code>g(x) = x³</code> en <code>[0, 1]</code>.',
    'Define <code>[a, b]</code>. <em>Consejo</em>: verifica graficamente que <code>f ≥ g</code> en todo el intervalo antes de correr — si se cruzan, la app usa <code>|f - g|</code> automaticamente.',
    'Configura <code>N</code> (puntos por repeticion) y <code>K</code> (cantidad de repeticiones). Tipico: <code>N = 10000</code>, <code>K = 10</code>.',
    '<b>Estrategia Hit-or-Miss</b>: la app construye un rectangulo circunscrito <code>[a, b] × [y_min, y_max]</code> que contiene ambas curvas. Lanza puntos uniformes en ese rectangulo y cuenta los que caen <em>entre</em> las curvas. Area ≈ <code>(Area rect) · (hits / N)</code>.',
    'Pulsa <b>Resolver</b>. Se muestran K repeticiones independientes, cada una con distintas semillas. Promedio de las K da la estimacion final.',
    'Si tienes <b>valor exacto</b>: pone el valor analitico <code>A = ∫(f - g) dx</code>. Para <code>x² - x³</code> en <code>[0, 1]</code>: <code>A = 1/3 - 1/4 = 1/12 ≈ 0.0833</code>.',
    '<b>Error estandar</b>: <code>SE = σ_K / √K</code> donde <code>σ_K</code> es la desviacion estandar entre las K estimaciones.',
    'Para el informe: (1) tabla de <code>A_k</code>; (2) promedio final; (3) σ entre repeticiones; (4) IC 95%: <code>Â ± 1.96·SE</code>; (5) comparacion con exacto si se tiene. Discutir por que N=10000 suele dar precision ~3 decimales.',
    'Interpretacion visual: la grafica Hit-or-Miss muestra <em>verde</em> = puntos entre las curvas (cuentan), <em>rojo</em> = puntos fuera (no cuentan). Mientras mas verdes aciertos proporcionales, mejor la estimacion.',
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const g = parseExpression(params.gx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const N = parseInt(params.n) || 10000;
    const K = Math.max(1, parseInt(params.K) || 10);

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
    let sumEst = 0;
    let sumEstSq = 0;

    for (let k = 1; k <= K; k++) {
      const rand = mulberry32(baseSeed + k * 10007);
      let hits = 0;
      for (let i = 0; i < N; i++) {
        const xi = a + rand() * (b - a);
        const yi = yMin + rand() * (yMax - yMin);
        const fv = f(xi);
        const gv = g(xi);
        const top = Math.max(fv, gv);
        const bot = Math.min(fv, gv);
        if (yi >= bot && yi <= top) hits++;
      }
      const A_k = rectArea * (hits / N);
      sumEst += A_k;
      sumEstSq += A_k * A_k;

      const runningMean = sumEst / k;
      const varRun = k > 1 ? Math.max(0, (sumEstSq / k) - runningMean * runningMean) : 0;
      const stdDevRun = Math.sqrt(varRun);
      const exactDiff = exactVal !== undefined ? Math.abs(A_k - exactVal) : null;

      iterations.push({
        k,
        hits,
        estimate: A_k,
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
    let message = `A ≈ ${avgEstimate.toPrecision(8)} (promedio K=${K}, N=${N}) | σ repeticiones = ${stdDevK.toPrecision(6)} | rect area = ${rectArea.toPrecision(6)}`;
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

    // Chart 1: Region with hit/miss points
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

    // Chart 2: Repetitions and running mean
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

    // Chart 3: σ running
    const stdDevRuns = result.iterations.map(r => r.stdDevRun as number);
    const chart3: ChartData = {
      title: 'σ(A_1..A_k) — dispersion entre repeticiones',
      type: 'line',
      datasets: [
        { label: 'σ', x: ks, y: stdDevRuns, color: '#fab387', pointRadius: 2 },
      ],
      xLabel: 'k', yLabel: 'σ',
    };

    // Chart 4: |error| vs k
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
