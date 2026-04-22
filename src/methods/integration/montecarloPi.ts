import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { texBlock } from '../../latex';
import {
  mulberry32,
  parseSeed,
  zForConfidence,
  parseConfPct,
  fmtNum,
  renderKRepsPanel,
  renderSummaryPanel,
  renderErrorHalvingPanel,
} from './monteCarloCommon';

/**
 * Run one π-approximation simulation with N Hit-or-Miss points. Returns π estimate and Bernoulli SE.
 */
function runPi(N: number, seed: number): { estimate: number; stdErr: number; pHat: number } {
  const rand = mulberry32(seed);
  let inside = 0;
  for (let i = 0; i < N; i++) {
    const x = rand() * 2 - 1;
    const y = rand() * 2 - 1;
    if (x * x + y * y <= 1) inside++;
  }
  const pHat = inside / N;
  const estimate = 4 * pHat;
  // Bernoulli variance for p̂: p(1-p)/N, scaled by 4 for π.
  const stdErr = 4 * Math.sqrt(pHat * (1 - pHat) / N);
  return { estimate, stdErr, pHat };
}

export const montecarloPi: MethodDefinition = {
  id: 'montecarloPi',
  name: 'Monte Carlo — Aproximacion de π',
  category: 'integration',
  formula: 'π ≈ 4 · (puntos en circulo) / (puntos totales)',
  latexFormula: '\\pi \\approx 4 \\cdot \\frac{\\#\\{(x_i, y_i) : x_i^2 + y_i^2 \\le 1\\}}{N}, \\quad (x_i, y_i) \\sim U([-1,1]^2)',
  description: 'Aproxima π por muestreo por rechazo: puntos aleatorios en un cuadrado de lado 2, se cuentan los que caen dentro del circulo unitario. Soporta K repeticiones y nivel de confianza configurable.',
  inputs: [
    { id: 'n', label: 'N (puntos por repeticion)', placeholder: '10000', type: 'number', defaultValue: '10000' },
    { id: 'K', label: 'K (repeticiones, 1 = sin promediar)', placeholder: '1', type: 'number', defaultValue: '1', hint: 'Si K>1 se promedian K simulaciones independientes.' },
    { id: 'conf', label: 'Nivel de confianza (%)', placeholder: '95', type: 'number', defaultValue: '95', hint: 'Ej: 90, 95, 99.' },
    { id: 'seed', label: 'Semilla (opcional)', placeholder: 'Vacio = aleatorio', hint: 'Misma semilla = mismos resultados' },
  ],
  tableColumns: [
    { key: 'batch', label: 'Lote', latex: '\\text{Lote}' },
    { key: 'nAccum', label: 'N acumulado', latex: 'N_{\\text{acum}}' },
    { key: 'inside', label: 'Dentro', latex: 'M' },
    { key: 'pHat', label: 'p = dentro/N', latex: '\\hat{p} = M/N' },
    { key: 'piEstimate', label: 'π estimado', latex: '\\hat{\\pi} = 4\\hat{p}' },
    { key: 'variance', label: 'Varianza p(1-p)', latex: '\\hat{p}(1-\\hat{p})' },
    { key: 'stdDev', label: 'σ (desv. est.)', latex: '\\sigma' },
    { key: 'stdErr', label: 'SE (err. est.)', latex: 'SE' },
    { key: 'error', label: '|π_est - π|', latex: '|\\hat{\\pi} - \\pi|' },
    { key: 'ci95Lower', label: 'IC inf', latex: 'IC^{\\text{inf}}' },
    { key: 'ci95Upper', label: 'IC sup', latex: 'IC^{\\text{sup}}' },
  ],
  steps: [
    'Ejemplo clasico del <b>parcial Prueba Evaluativa</b>: aproximar <code>π</code> por muestreo por rechazo. <em>No necesita funcion</em> — solo N, K y nivel de confianza.',
    'Elige <code>N</code> (puntos por repeticion). Recomendado: <code>10000</code>. Para 3 decimales, N ≈ 10⁶.',
    '<b>K</b>: repeticiones independientes. Si K=1 usa SE de Bernoulli de una sola muestra; si K>1 promedia y calcula SE entre repeticiones.',
    '<b>Nivel de confianza</b>: 90, 95 (default) o 99. Se calcula <code>z_{α/2}</code> automaticamente.',
    'Pulsa <b>Resolver</b>. Se muestran: (1) solucion analitica del problema; (2) tabla de K repeticiones (si K>1); (3) <b>Resumen estadistico</b> (p̂, σ, SE, IC); (4) <b>demostracion 1/√n</b> con simulacion a 4N.',
    'Para el informe: reporta (a) N, K, semilla; (b) M y p̂ finales; (c) π̂; (d) |error|; (e) SE; (f) IC al nivel elegido.',
  ],

  solve(params) {
    const N = parseInt(params.n) || 10000;
    const K = Math.max(1, parseInt(params.K) || 1);
    const confPct = parseConfPct(params.conf, 95);
    const z = zForConfidence(confPct);
    if (N < 1) throw new Error('N debe ser >= 1');

    const seedVal = parseSeed(params.seed);
    const baseSeed = seedVal !== null ? seedVal : (Date.now() ^ (Math.random() * 0xFFFFFFFF));

    // ---- First pass: single long simulation for batched iteration table ----
    const rand = mulberry32(baseSeed);
    const iterations: MethodResult['iterations'] = [];
    const batchSize = Math.max(1, Math.floor(N / 20));
    let insideCount = 0;
    for (let i = 1; i <= N; i++) {
      const x = rand() * 2 - 1;
      const y = rand() * 2 - 1;
      if (x * x + y * y <= 1) insideCount++;
      if (i % batchSize === 0 || i === N) {
        const pHat = insideCount / i;
        const piEst = 4 * pHat;
        const error = Math.abs(piEst - Math.PI);
        const variance = pHat * (1 - pHat);
        const stdDev = Math.sqrt(variance);
        const stdErr = 4 * stdDev / Math.sqrt(i);
        iterations.push({
          batch: iterations.length + 1,
          nAccum: i,
          inside: insideCount,
          pHat,
          piEstimate: piEst,
          variance,
          stdDev,
          stdErr,
          error,
          ci95Lower: piEst - z * stdErr,
          ci95Upper: piEst + z * stdErr,
        });
      }
    }
    const piEstimate1 = 4 * insideCount / N;
    const pHat1 = insideCount / N;
    const stdErr1 = 4 * Math.sqrt(pHat1 * (1 - pHat1) / N);

    // ---- K-reps (if K>1): run K independent π-simulations with distinct seeds ----
    const reps: { k: number; estimate: number; runningMean: number; runningStd: number }[] = [];
    let finalMean = piEstimate1;
    let finalVar = pHat1 * (1 - pHat1);
    let finalStd = Math.sqrt(finalVar);
    let finalSE = stdErr1;
    let basis: 'bernoulli' | 'reps' = 'bernoulli';

    if (K > 1) {
      let sumK = 0, sumKSq = 0;
      for (let k = 1; k <= K; k++) {
        const run = runPi(N, baseSeed + k * 10007);
        sumK += run.estimate;
        sumKSq += run.estimate * run.estimate;
        const runningMean = sumK / k;
        const varRun = k > 1 ? Math.max(0, (sumKSq - k * runningMean * runningMean) / (k - 1)) : 0;
        const runningStd = Math.sqrt(varRun);
        reps.push({ k, estimate: run.estimate, runningMean, runningStd });
      }
      finalMean = reps[K - 1].runningMean;
      finalVar = Math.max(0, (sumKSq - K * finalMean * finalMean) / (K - 1));
      finalStd = Math.sqrt(finalVar);
      finalSE = finalStd / Math.sqrt(K);
      basis = 'reps';
    }

    const ciLower = finalMean - z * finalSE;
    const ciUpper = finalMean + z * finalSE;
    const finalError = Math.abs(finalMean - Math.PI);

    // ---- Analytical explanation panel (why π ≈ 4·M/N) ----
    const analyticalPanel = `
      <div class="theorem-panel theorem-pass">
        <div class="theorem-header"><span class="theorem-icon">∫</span> Solucion analitica — ¿por que π ≈ 4·M/N?</div>
        <div class="theorem-body">
          <div>El cuadrado <code>[-1, 1] × [-1, 1]</code> tiene area <code>4</code>. El circulo unitario inscrito tiene area <code>π·1² = π</code>.</div>
          ${texBlock('P\\bigl((X, Y) \\in \\text{circulo}\\bigr) = \\frac{\\text{area del circulo}}{\\text{area del cuadrado}} = \\frac{\\pi}{4}')}
          <div>Para puntos <code>(x<sub>i</sub>, y<sub>i</sub>) ~ U([-1, 1]²)</code>, la variable indicadora</div>
          ${texBlock('Z_i = \\begin{cases} 1 & \\text{si } x_i^2 + y_i^2 \\le 1 \\\\ 0 & \\text{en otro caso} \\end{cases}')}
          <div>es Bernoulli con parametro <code>p = π/4</code>. Por la Ley de los Grandes Numeros:</div>
          ${texBlock('\\hat{p} = \\frac{1}{N}\\sum_{i=1}^{N} Z_i \\;\\xrightarrow{\\,N\\to\\infty\\,}\\; p = \\frac{\\pi}{4}')}
          <div>Por lo tanto <code>π ≈ 4·p̂ = 4·M/N</code> donde M es el numero de puntos dentro del circulo.</div>
          <div style="margin-top:8px"><b>Varianza de Bernoulli:</b> <code>Var(Z) = p(1-p) ≈ 0.7854·0.2146 ≈ 0.1686</code>.</div>
          ${texBlock('SE(\\hat{\\pi}) = 4 \\cdot SE(\\hat{p}) = 4 \\cdot \\sqrt{\\frac{\\hat{p}(1-\\hat{p})}{N}}')}
        </div>
      </div>
    `;

    const panels: string[] = [];
    panels.push(analyticalPanel);
    if (K > 1) panels.push(renderKRepsPanel(reps, '\\hat{\\pi}'));
    panels.push(renderSummaryPanel({
      N, K,
      mean: finalMean, varianceEst: finalVar, stdDev: finalStd,
      stdErr: finalSE, confPct, z, ciLower, ciUpper, basis,
      symbol: '\\hat{\\pi}',
    }));
    panels.push(renderErrorHalvingPanel({
      runner: (Nn, seed) => {
        const r = runPi(Nn, seed);
        return { estimate: r.estimate, stdErr: r.stdErr };
      },
      N, baseSeed, currentStdErr: finalSE,
      constantLabel: '4\\cdot \\sqrt{p(1-p)}',
      constantValue: 4 * Math.sqrt(pHat1 * (1 - pHat1)),
    }));

    const seedMsg = seedVal !== null ? `semilla=${seedVal}` : 'semilla aleatoria';
    const message = `π ≈ ${fmtNum(finalMean, 8)} | N=${N}${K > 1 ? `, K=${K}` : ''} | ${seedMsg} | |error|=${fmtNum(finalError, 6)} | SE=${fmtNum(finalSE, 6)} | IC ${confPct}%: [${fmtNum(ciLower, 6)}, ${fmtNum(ciUpper, 6)}]`;

    return {
      root: finalMean,
      iterations,
      converged: true,
      error: finalError,
      message,
      theoremPanels: panels,
    };
  },

  getCharts(params, result) {
    const N = parseInt(params.n) || 10000;
    const K = Math.max(1, parseInt(params.K) || 1);
    const confPct = parseConfPct(params.conf, 95);
    const z = zForConfidence(confPct);
    const seedVal = parseSeed(params.seed);
    const chartSeed = seedVal !== null ? seedVal : (Date.now() ^ 0xABCD);
    const rand = mulberry32(chartSeed);

    const nShow = Math.min(N, 3000);
    const hitX: number[] = [];
    const hitY: number[] = [];
    const missX: number[] = [];
    const missY: number[] = [];

    for (let i = 0; i < nShow; i++) {
      const x = rand() * 2 - 1;
      const y = rand() * 2 - 1;
      if (x * x + y * y <= 1) {
        hitX.push(x);
        hitY.push(y);
      } else {
        missX.push(x);
        missY.push(y);
      }
    }

    const circleX: number[] = [];
    const circleY: number[] = [];
    for (let i = 0; i <= 200; i++) {
      const theta = (2 * Math.PI * i) / 200;
      circleX.push(Math.cos(theta));
      circleY.push(Math.sin(theta));
    }

    const chart1: ChartData = {
      title: `Cuadrado lado 2, circulo r=1 (${nShow} puntos)`,
      type: 'scatter',
      datasets: [
        { label: 'Circulo', x: circleX, y: circleY, color: '#f9e2af', pointRadius: 0 },
        { label: `Dentro (${hitX.length})`, x: hitX, y: hitY, color: '#a6e3a1', pointRadius: 1.5, showLine: false },
        { label: `Fuera (${missX.length})`, x: missX, y: missY, color: '#f38ba8', pointRadius: 1.5, showLine: false },
      ],
      xLabel: 'x', yLabel: 'y',
    };

    const batchNs = result.iterations.map(r => r.nAccum as number);
    const piEsts = result.iterations.map(r => r.piEstimate as number);
    const stdErrs = result.iterations.map(r => r.stdErr as number);
    const ciLowers = piEsts.map((e, i) => e - z * stdErrs[i]);
    const ciUppers = piEsts.map((e, i) => e + z * stdErrs[i]);
    const variances = result.iterations.map(r => r.variance as number);
    const stdDevs = result.iterations.map(r => r.stdDev as number);
    const errors = result.iterations.map(r => r.error as number);

    const chart2: ChartData = {
      title: `Convergencia a π con IC ${confPct}%`,
      type: 'line',
      datasets: [
        { label: `IC ${confPct}% sup`, x: batchNs, y: ciUppers, color: '#a6e3a1', dashed: true, pointRadius: 0 },
        { label: 'π estimado', x: batchNs, y: piEsts, color: '#cba6f7', pointRadius: 3 },
        { label: `IC ${confPct}% inf`, x: batchNs, y: ciLowers, color: '#a6e3a1', dashed: true, pointRadius: 0 },
        { label: 'π real', x: [batchNs[0], batchNs[batchNs.length - 1]], y: [Math.PI, Math.PI], color: '#f9e2af', dashed: true, pointRadius: 0 },
      ],
      xLabel: 'N', yLabel: 'π estimado',
    };

    const chart3: ChartData = {
      title: 'Varianza p̂(1-p̂) y Desviacion Estandar σ vs N',
      type: 'line',
      datasets: [
        { label: 'σ = √(p̂(1-p̂))', x: batchNs, y: stdDevs, color: '#89b4fa', pointRadius: 2 },
        { label: 'Var = p̂(1-p̂)', x: batchNs, y: variances, color: '#94e2d5', pointRadius: 2 },
      ],
      xLabel: 'N', yLabel: 'Valor',
    };

    // Chart 4: if K > 1 show K reps; else |error| vs SE in log scale
    let chart4: ChartData;
    if (K > 1) {
      const repsSim: { k: number; est: number; mean: number }[] = [];
      let sumK = 0;
      for (let k = 1; k <= K; k++) {
        const r = runPi(N, (seedVal ?? chartSeed) + k * 10007);
        sumK += r.estimate;
        repsSim.push({ k, est: r.estimate, mean: sumK / k });
      }
      chart4 = {
        title: `K = ${K} repeticiones y promedio acumulado`,
        type: 'line',
        datasets: [
          { label: 'π̂_k', x: repsSim.map(r => r.k), y: repsSim.map(r => r.est), color: '#f38ba8', pointRadius: 4, showLine: false },
          { label: 'Promedio 1..k', x: repsSim.map(r => r.k), y: repsSim.map(r => r.mean), color: '#cba6f7', pointRadius: 2 },
          { label: 'π real', x: [1, K], y: [Math.PI, Math.PI], color: '#f9e2af', dashed: true, pointRadius: 0 },
        ],
        xLabel: 'k', yLabel: 'π̂',
      };
    } else {
      const errFiltered = errors.filter(e => e > 0);
      const seFiltered = stdErrs.filter(e => e > 0);
      const theorN = batchNs.filter(n => n > 0);
      const theor1sqrtN = theorN.map(n => 4 * 0.5 / Math.sqrt(n));
      chart4 = {
        title: '|Error real| vs Error Estandar vs N (log)',
        type: 'line',
        datasets: [
          { label: '|π̂ - π|', x: batchNs.slice(0, errFiltered.length), y: errFiltered, color: '#f38ba8', pointRadius: 2 },
          { label: 'SE (error est.)', x: batchNs.slice(0, seFiltered.length), y: seFiltered, color: '#fab387', pointRadius: 2 },
          { label: '~1/√N (teorico)', x: theorN, y: theor1sqrtN, color: '#585b70', dashed: true, pointRadius: 0 },
        ],
        xLabel: 'N', yLabel: 'Error', yLog: true,
      };
    }

    return [chart1, chart2, chart3, chart4];
  },
};
