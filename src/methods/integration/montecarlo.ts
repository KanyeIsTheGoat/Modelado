import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';

/**
 * Mulberry32 — fast, high-quality 32-bit seeded PRNG.
 * Period: 2^32. Passes BigCrush statistical tests.
 * Returns values in [0, 1) with uniform distribution.
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

/**
 * Hash a string to a 32-bit integer (for string seeds).
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Parse the seed input: number or string.
 * Empty/undefined → null (use random seed).
 */
function parseSeed(input: string | undefined): number | null {
  if (!input || input.trim() === '') return null;
  const num = Number(input.trim());
  if (!isNaN(num)) return num;
  return hashString(input.trim());
}

export const montecarlo: MethodDefinition = {
  id: 'montecarlo',
  name: 'Monte Carlo',
  category: 'integration',
  formula: '∫f(x)dx ≈ (b-a)/N · Σ f(x_i), x_i aleatorio en [a,b]',
  latexFormula: '\\int_a^b f(x)\\,dx \\approx \\frac{b-a}{N} \\sum_{i=1}^{N} f(x_i), \\quad x_i \\sim U(a,b)',
  description: 'Aproxima la integral usando puntos aleatorios uniformes. Convergencia O(1/√N). Semilla opcional para reproducibilidad.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^2', defaultValue: 'x^2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '0', type: 'number', defaultValue: '0' },
    { id: 'b', label: 'b (limite superior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'n', label: 'N (puntos)', placeholder: '10000', type: 'number', defaultValue: '10000' },
    { id: 'seed', label: 'Semilla (opcional)', placeholder: 'Vacio = aleatorio', hint: 'Numero o texto. Misma semilla = mismos resultados.' },
  ],
  tableColumns: [
    { key: 'batch', label: 'Lote', latex: '\\text{Lote}' },
    { key: 'nAccum', label: 'N acumulado', latex: 'N_{\\text{acum}}' },
    { key: 'estimate', label: 'Estimacion', latex: '\\hat{I}' },
    { key: 'stdDev', label: 'Desv. Estandar', latex: '\\sigma(f)' },
    { key: 'stdErr', label: 'Error Estandar', latex: 'SE' },
    { key: 'ci95Lower', label: 'IC 95% inf', latex: 'IC_{95}^{\\text{inf}}' },
    { key: 'ci95Upper', label: 'IC 95% sup', latex: 'IC_{95}^{\\text{sup}}' },
  ],
  steps: [
    'Escribe <code>f(x)</code> y limites <code>[a, b]</code>. Para el <b>parcial 02/07/2025</b>: <code>exp(x^2)</code> sobre <code>[0, 2]</code>. Para <b>Prueba Evaluativa</b>: la funcion que te pidan.',
    'Elige <code>N</code> = cantidad de puntos aleatorios. Parcial tipico: <code>N = 1000</code> o <code>N = 10000</code>. <em>Mas N → menor error</em> pero la convergencia es <b>O(1/√N)</b> (lento vs Simpson <code>O(h⁴)</code>).',
    'Introduce una <b>semilla</b> (numero o texto). Misma semilla → mismos resultados, util para <em>reproducibilidad del informe</em>. Deja vacio para semilla aleatoria.',
    'Pulsa <b>Resolver</b>. La formula es: <code>I ≈ (b-a)/N · Σᵢ f(x_i)</code>, donde cada <code>x_i</code> es uniforme en <code>[a, b]</code>.',
    'La tabla muestra la estimacion en <b>lotes</b> (cada N/20 puntos) para visualizar como converge el promedio.',
    '<b>Desviacion estandar</b> σ(f): variabilidad de los valores muestreados <code>f(x_i)</code>. <b>Error estandar</b> SE = (b-a)·σ(f)/√N — es la incertidumbre de la estimacion.',
    '<b>Intervalo de confianza 95%</b>: <code>IC = estimacion ± 1.96·SE</code>. El <em>valor verdadero</em> de la integral debe caer en este rango el 95% de las veces. Si te piden K repeticiones, el IC se aproxima mejor con <code>s/√K</code> (usa el metodo <b>Monte Carlo 1D (K reps)</b>).',
    'Para el informe: reporta (a) estimacion final, (b) σ(f), (c) SE, (d) IC 95%, (e) semilla usada. Compara con Simpson del mismo ejercicio: Simpson sera <em>mucho mas preciso</em> pero Monte Carlo maneja bien dimensiones altas donde Simpson explota.',
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const N = parseInt(params.n) || 10000;

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');
    if (N < 1) throw new Error('N debe ser >= 1');

    // Setup PRNG
    const seedVal = parseSeed(params.seed);
    const actualSeed = seedVal !== null ? seedVal : (Date.now() ^ (Math.random() * 0xFFFFFFFF));
    const rand = mulberry32(actualSeed);

    const width = b - a;
    let sum = 0;
    let sumSq = 0;
    const iterations: MethodResult['iterations'] = [];
    const batchSize = Math.max(1, Math.floor(N / 20));

    for (let i = 1; i <= N; i++) {
      const xi = a + rand() * width;
      const fi = f(xi);
      sum += fi;
      sumSq += fi * fi;

      if (i % batchSize === 0 || i === N) {
        const mean = sum / i;
        const integral = width * mean;
        // Sample variance of f values: Var(f) = E[f^2] - (E[f])^2
        const varF = Math.max(0, (sumSq / i) - (mean * mean));
        // Standard deviation of f values
        const stdDevF = Math.sqrt(varF);
        // Standard deviation of the integral estimate: (b-a) * stdDev(f) / sqrt(N)
        const stdDev = width * stdDevF;
        // Standard error of the mean estimate
        const stdErr = stdDev / Math.sqrt(i);
        // 95% confidence interval: estimate ± z_{0.025} * stdErr (z = 1.96)
        const z95 = 1.96;
        const ci95Lower = integral - z95 * stdErr;
        const ci95Upper = integral + z95 * stdErr;

        iterations.push({
          batch: iterations.length + 1,
          nAccum: i,
          estimate: integral,
          stdDev: stdDevF,
          stdErr,
          ci95Lower,
          ci95Upper,
        });
      }
    }

    const finalMean = sum / N;
    const integral = width * finalMean;
    const varF = Math.max(0, (sumSq / N) - (finalMean * finalMean));
    const stdDevF = Math.sqrt(varF);
    const stdDev = width * stdDevF;
    const stdErr = stdDev / Math.sqrt(N);
    const z95 = 1.96;
    const ci95Lower = integral - z95 * stdErr;
    const ci95Upper = integral + z95 * stdErr;

    const seedMsg = seedVal !== null ? `semilla = ${seedVal}` : 'semilla aleatoria';
    return {
      integral,
      iterations,
      converged: true,
      error: stdErr,
      message: `N=${N}, ${seedMsg} | σ(f)=${stdDevF.toPrecision(6)} | IC 95%: [${ci95Lower.toPrecision(8)}, ${ci95Upper.toPrecision(8)}]`,
    };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const N = parseInt(params.n) || 10000;
    const width = b - a;

    // Use a separate seeded PRNG for charts (so charts match solve when seeded)
    const seedVal = parseSeed(params.seed);
    const chartSeed = seedVal !== null ? seedVal + 1 : (Date.now() ^ 0xABCD);
    const rand = mulberry32(chartSeed);

    const pad = width * 0.1;
    const xs = linspace(a - pad, b + pad, 500);
    const ys = xs.map(x => f(x));

    // Chart 1: f(x) with random sample points
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

    // Chart 2: Hit-or-miss visualization
    const yMin = Math.min(0, ...ys.filter(v => isFinite(v)));
    const yMax = Math.max(0, ...ys.filter(v => isFinite(v))) * 1.1;
    const hitX: number[] = [];
    const hitY: number[] = [];
    const missX: number[] = [];
    const missY: number[] = [];
    const nVis = Math.min(N, 300);
    for (let i = 0; i < nVis; i++) {
      const xi = a + rand() * width;
      const yi = yMin + rand() * (yMax - yMin);
      const fxi = f(xi);
      if ((fxi >= 0 && yi >= 0 && yi <= fxi) || (fxi < 0 && yi < 0 && yi >= fxi)) {
        hitX.push(xi);
        hitY.push(yi);
      } else {
        missX.push(xi);
        missY.push(yi);
      }
    }

    const chart2: ChartData = {
      title: 'Hit-or-Miss (puntos bajo la curva)',
      type: 'scatter',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa', pointRadius: 0 },
        { label: 'Bajo curva', x: hitX, y: hitY, color: '#a6e3a1', pointRadius: 2, showLine: false },
        { label: 'Fuera', x: missX, y: missY, color: '#f38ba8', pointRadius: 2, showLine: false },
      ],
      xLabel: 'x', yLabel: 'y',
    };

    // Chart 3: Convergence with 95% confidence interval band
    const batchNs = result.iterations.map(r => r.nAccum as number);
    const estimates = result.iterations.map(r => r.estimate as number);
    const ci95Lowers = result.iterations.map(r => r.ci95Lower as number);
    const ci95Uppers = result.iterations.map(r => r.ci95Upper as number);

    const chart3: ChartData = {
      title: 'Convergencia con intervalo de confianza 95%',
      type: 'line',
      datasets: [
        { label: 'IC 95% sup', x: batchNs, y: ci95Uppers, color: '#a6e3a1', dashed: true, pointRadius: 0 },
        { label: 'Estimacion', x: batchNs, y: estimates, color: '#cba6f7', pointRadius: 3 },
        { label: 'IC 95% inf', x: batchNs, y: ci95Lowers, color: '#a6e3a1', dashed: true, pointRadius: 0 },
      ],
      xLabel: 'N (muestras)', yLabel: 'Integral estimada',
    };

    // Chart 4: Standard deviation and standard error evolution
    const stdDevs = result.iterations.map(r => r.stdDev as number);
    const stdErrs = result.iterations.map(r => r.stdErr as number).filter(e => e > 0);

    const chart4: ChartData = {
      title: 'Desviacion estandar y error estandar vs N',
      type: 'line',
      datasets: [
        { label: 'σ(f) desv. est.', x: batchNs.slice(0, stdDevs.length), y: stdDevs, color: '#f9e2af', pointRadius: 2 },
        { label: 'SE (error est.)', x: batchNs.slice(0, stdErrs.length), y: stdErrs, color: '#fab387', pointRadius: 2 },
      ],
      xLabel: 'N', yLabel: 'Valor', yLog: true,
    };

    return [chart1, chart2, chart3, chart4];
  },
};
