import type { MethodDefinition, MethodResult, ChartData } from '../types';

/**
 * Mulberry32 seeded PRNG — uniform distribution, period 2^32.
 */
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

export const montecarloPi: MethodDefinition = {
  id: 'montecarloPi',
  name: 'Monte Carlo — Aproximacion de π',
  category: 'integration',
  formula: 'π ≈ 4 · (puntos en circulo) / (puntos totales)',
  description: 'Aproxima π por muestreo por rechazo: puntos aleatorios en un cuadrado de lado 2, se cuentan los que caen dentro del circulo unitario.',
  inputs: [
    { id: 'n', label: 'N (puntos aleatorios)', placeholder: '10000', type: 'number', defaultValue: '10000' },
    { id: 'seed', label: 'Semilla (opcional)', placeholder: 'Vacio = aleatorio', hint: 'Misma semilla = mismos resultados' },
  ],
  tableColumns: [
    { key: 'batch', label: 'Lote' },
    { key: 'nAccum', label: 'N acumulado' },
    { key: 'inside', label: 'Dentro' },
    { key: 'pHat', label: 'p = dentro/N' },
    { key: 'piEstimate', label: 'π estimado' },
    { key: 'variance', label: 'Varianza p(1-p)' },
    { key: 'stdDev', label: 'σ (desv. est.)' },
    { key: 'stdErr', label: 'SE (err. est.)' },
    { key: 'error', label: '|π_est - π|' },
    { key: 'ci95Lower', label: 'IC 95% inf' },
    { key: 'ci95Upper', label: 'IC 95% sup' },
  ],
  steps: [
    'Este es el ejemplo clasico del <b>parcial Prueba Evaluativa</b>: aproximar <code>π</code> por muestreo por rechazo. <em>No necesita funcion</em> — solo N.',
    'Elige <code>N</code> (puntos aleatorios). Recomendado: <code>N = 10000</code> como punto inicial. Para precision ~2 decimales, N ≈ 10⁴; para 3 decimales, N ≈ 10⁶.',
    '<b>Semilla</b>: usa un valor fijo (ej. <code>42</code>) para reproducir la tabla exacta en tu informe.',
    'Pulsa <b>Resolver</b>. El algoritmo:<br>&nbsp;&nbsp;1. Genera punto aleatorio <code>(x, y)</code> en el cuadrado <code>[-1, 1] × [-1, 1]</code> (lado 2).<br>&nbsp;&nbsp;2. Verifica si cae dentro del circulo unitario: <code>x² + y² ≤ 1</code>.<br>&nbsp;&nbsp;3. Cuenta <code>M</code> = puntos dentro, <code>N</code> = total.<br>&nbsp;&nbsp;4. Ratio <code>p̂ = M/N</code> aproxima <code>π/4</code>.',
    'Por lo tanto: <code>π ≈ 4 · M/N</code>. La grafica 1 visualiza el cuadrado con circulo y los puntos coloreados (verde = dentro, rojo = fuera).',
    '<b>Probabilidad</b>: cada punto es Bernoulli con <code>p = π/4 ≈ 0.7854</code>. Varianza <code>p(1-p) ≈ 0.1686</code>. Error estandar de π̂: <code>SE = 4·√(p̂(1-p̂)/N)</code>.',
    '<b>Intervalo de confianza 95%</b>: <code>π̂ ± 1.96·SE</code>. Deberia contener a <code>π = 3.14159...</code>.',
    'La convergencia es <code>O(1/√N)</code>: duplicar precision requiere 4× mas puntos. En la grafica 4 veras que <code>|error real|</code> sigue la curva teorica <code>1/√N</code>.',
    'Para el informe: reporta (a) N, (b) M, (c) p̂, (d) π̂, (e) |error|, (f) SE, (g) IC 95%, (h) semilla. Contrasta el IC con el valor verdadero π.',
  ],

  solve(params) {
    const N = parseInt(params.n) || 10000;
    if (N < 1) throw new Error('N debe ser >= 1');

    const seedVal = parseSeed(params.seed);
    const actualSeed = seedVal !== null ? seedVal : (Date.now() ^ (Math.random() * 0xFFFFFFFF));
    const rand = mulberry32(actualSeed);

    const iterations: MethodResult['iterations'] = [];
    const batchSize = Math.max(1, Math.floor(N / 20));

    let insideCount = 0;

    for (let i = 1; i <= N; i++) {
      // Punto aleatorio en cuadrado [-1, 1] x [-1, 1] (lado 2)
      const x = rand() * 2 - 1;
      const y = rand() * 2 - 1;

      // Dentro del circulo unitario? x² + y² ≤ 1
      if (x * x + y * y <= 1) {
        insideCount++;
      }

      if (i % batchSize === 0 || i === N) {
        // p̂ = proporcion de exitos (dentro del circulo)
        const pHat = insideCount / i;
        // π estimado = 4 * p̂
        const piEst = 4 * pHat;
        // Error absoluto vs π real
        const error = Math.abs(piEst - Math.PI);
        // Varianza de Bernoulli: Var(X) = p̂(1 - p̂)
        const variance = pHat * (1 - pHat);
        // Desviacion estandar de la proporcion: σ = sqrt(p̂(1-p̂))
        const stdDev = Math.sqrt(variance);
        // Error estandar de p̂: SE(p̂) = σ/√N, escalado a π: SE(π) = 4·SE(p̂)
        const stdErrP = stdDev / Math.sqrt(i);
        const stdErr = 4 * stdErrP;
        // Intervalo de confianza 95%: π̂ ± 1.96·SE(π)
        const z95 = 1.96;

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
          ci95Lower: piEst - z95 * stdErr,
          ci95Upper: piEst + z95 * stdErr,
        });
      }
    }

    const piEstimate = 4 * insideCount / N;
    const pHatFinal = insideCount / N;
    const varianceFinal = pHatFinal * (1 - pHatFinal);
    const stdDevFinal = Math.sqrt(varianceFinal);
    const stdErr = 4 * stdDevFinal / Math.sqrt(N);
    const finalError = Math.abs(piEstimate - Math.PI);

    const seedMsg = seedVal !== null ? `semilla=${seedVal}` : 'semilla aleatoria';
    return {
      root: piEstimate,
      iterations,
      converged: true,
      error: finalError,
      message: `π ≈ ${piEstimate.toFixed(8)} | ${seedMsg} | ${insideCount}/${N} dentro | σ=${stdDevFinal.toFixed(6)} | SE=${stdErr.toFixed(6)} | IC 95%: [${(piEstimate - 1.96 * stdErr).toFixed(6)}, ${(piEstimate + 1.96 * stdErr).toFixed(6)}]`,
    };
  },

  getCharts(params, result) {
    const N = parseInt(params.n) || 10000;
    const seedVal = parseSeed(params.seed);
    const chartSeed = seedVal !== null ? seedVal : (Date.now() ^ 0xABCD);
    const rand = mulberry32(chartSeed);

    // Chart 1: Scatter plot — circle inside square, colored by hit/miss
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

    // Circle outline for reference
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

    // Extracted data
    const batchNs = result.iterations.map(r => r.nAccum as number);
    const piEsts = result.iterations.map(r => r.piEstimate as number);
    const ci95Lowers = result.iterations.map(r => r.ci95Lower as number);
    const ci95Uppers = result.iterations.map(r => r.ci95Upper as number);
    const variances = result.iterations.map(r => r.variance as number);
    const stdDevs = result.iterations.map(r => r.stdDev as number);
    const stdErrs = result.iterations.map(r => r.stdErr as number);
    const errors = result.iterations.map(r => r.error as number);

    // Chart 2: Convergence of π estimate with CI band
    const chart2: ChartData = {
      title: 'Convergencia a π con IC 95%',
      type: 'line',
      datasets: [
        { label: 'IC 95% sup', x: batchNs, y: ci95Uppers, color: '#a6e3a1', dashed: true, pointRadius: 0 },
        { label: 'π estimado', x: batchNs, y: piEsts, color: '#cba6f7', pointRadius: 3 },
        { label: 'IC 95% inf', x: batchNs, y: ci95Lowers, color: '#a6e3a1', dashed: true, pointRadius: 0 },
        { label: 'π real', x: [batchNs[0], batchNs[batchNs.length - 1]], y: [Math.PI, Math.PI], color: '#f9e2af', dashed: true, pointRadius: 0 },
      ],
      xLabel: 'N', yLabel: 'π estimado',
    };

    // Chart 3: σ y Varianza (escala lineal — ambas ~0.4-0.5, misma escala)
    // σ = sqrt(p(1-p)) ≈ 0.49, Var = p(1-p) ≈ 0.24 — escalas cercanas, lineal OK
    const chart3: ChartData = {
      title: 'Varianza p̂(1-p̂) y Desviacion Estandar σ vs N',
      type: 'line',
      datasets: [
        { label: 'σ = √(p̂(1-p̂))', x: batchNs, y: stdDevs, color: '#89b4fa', pointRadius: 2 },
        { label: 'Var = p̂(1-p̂)', x: batchNs, y: variances, color: '#94e2d5', pointRadius: 2 },
      ],
      xLabel: 'N', yLabel: 'Valor',
    };

    // Chart 4: |Error| y SE — escala log (ambos decrecen con N, ~0.001-0.1)
    // SE decrece como 1/√N, |error| oscila pero tambien decrece
    const errFiltered = errors.filter(e => e > 0);
    const seFiltered = stdErrs.filter(e => e > 0);

    // Curva teorica 1/√N para referencia
    const theorN = batchNs.filter(n => n > 0);
    const theor1sqrtN = theorN.map(n => 4 * 0.5 / Math.sqrt(n)); // 4·σ_max/√N ≈ 2/√N

    const chart4: ChartData = {
      title: '|Error real| vs Error Estandar vs N (log)',
      type: 'line',
      datasets: [
        { label: '|π̂ - π|', x: batchNs.slice(0, errFiltered.length), y: errFiltered, color: '#f38ba8', pointRadius: 2 },
        { label: 'SE (error est.)', x: batchNs.slice(0, seFiltered.length), y: seFiltered, color: '#fab387', pointRadius: 2 },
        { label: '~1/√N (teorico)', x: theorN, y: theor1sqrtN, color: '#585b70', dashed: true, pointRadius: 0 },
      ],
      xLabel: 'N', yLabel: 'Error', yLog: true,
    };

    return [chart1, chart2, chart3, chart4];
  },
};
