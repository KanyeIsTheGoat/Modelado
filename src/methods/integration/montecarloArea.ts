import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { texBlock, exprToTex } from '../../latex';
import { symbolicIntegralSteps } from '../../symbolic';
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
 * Find intersection points of f(x) = g(x) in [a, b] by scanning sign changes of f-g
 * and refining each one via bisection. Returns sorted roots within [a, b].
 */
function findIntersections(
  f: (x: number) => number, g: (x: number) => number,
  a: number, b: number,
): number[] {
  const samples = 600;
  const roots: number[] = [];
  const h = (b - a) / samples;
  const diff = (x: number) => f(x) - g(x);
  let prev = diff(a);
  if (Math.abs(prev) < 1e-10) roots.push(a);
  for (let i = 1; i <= samples; i++) {
    const x = a + i * h;
    const v = diff(x);
    if (isFinite(prev) && isFinite(v) && prev * v < 0) {
      let lo = x - h, hi = x;
      let vLo = prev, vHi = v;
      for (let k = 0; k < 80 && hi - lo > 1e-12; k++) {
        const mid = 0.5 * (lo + hi);
        const vm = diff(mid);
        if (!isFinite(vm)) break;
        if (Math.abs(vm) < 1e-14) { lo = hi = mid; break; }
        if (vLo * vm < 0) { hi = mid; vHi = vm; }
        else { lo = mid; vLo = vm; }
      }
      const root = 0.5 * (lo + hi);
      if (roots.length === 0 || Math.abs(root - roots[roots.length - 1]) > 1e-7) {
        roots.push(root);
      }
    } else if (Math.abs(v) < 1e-10) {
      if (roots.length === 0 || Math.abs(x - roots[roots.length - 1]) > 1e-7) {
        roots.push(x);
      }
    }
    prev = v;
  }
  return roots.sort((p, q) => p - q);
}

/**
 * Simpson 1/3 rule for numerical fallback when symbolic integration fails on a sub-interval.
 */
function simpsonNumerical(fn: (x: number) => number, a: number, b: number, n: number): number {
  if (n % 2 !== 0) n += 1;
  const h = (b - a) / n;
  let sum = fn(a) + fn(b);
  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * fn(x);
  }
  return (h / 3) * sum;
}

/**
 * Geometric analysis panel: find intersections, identify which curve is on top per sub-interval,
 * integrate each sub-interval exactly, and sum to get total exact area.
 */
function renderGeometricAnalysisPanel(
  fxExpr: string, gxExpr: string,
  f: (x: number) => number, g: (x: number) => number,
  a: number, b: number,
): string {
  const ints = findIntersections(f, g, a, b);
  const boundariesRaw: number[] = [a];
  for (const r of ints) {
    if (r > a + 1e-9 && r < b - 1e-9) boundariesRaw.push(r);
  }
  boundariesRaw.push(b);
  const boundaries = boundariesRaw.filter((v, i, arr) => i === 0 || Math.abs(v - arr[i - 1]) > 1e-8);

  const subintervals: { xi: number; xj: number; topExpr: string; botExpr: string; area: number; method: string }[] = [];
  let totalArea = 0;

  for (let i = 0; i < boundaries.length - 1; i++) {
    const xi = boundaries[i], xj = boundaries[i + 1];
    const mid = 0.5 * (xi + xj);
    const fv = f(mid), gv = g(mid);
    const fTop = fv >= gv;
    const topExpr = fTop ? fxExpr : gxExpr;
    const botExpr = fTop ? gxExpr : fxExpr;
    const diffExpr = `(${topExpr}) - (${botExpr})`;
    let subArea = NaN;
    let method = 'simbolica';
    try {
      const { result } = symbolicIntegralSteps(diffExpr, 'x');
      const F = parseExpression(result.replace(/\s*\+\s*C\s*$/, ''));
      const v = F(xj) - F(xi);
      if (isFinite(v)) { subArea = v; }
      else { throw new Error('no finito'); }
    } catch {
      method = 'Simpson n=200';
      subArea = simpsonNumerical(x => Math.abs(f(x) - g(x)), xi, xj, 200);
    }
    totalArea += subArea;
    subintervals.push({ xi, xj, topExpr, botExpr, area: subArea, method });
  }

  // Build HTML pieces
  const eqRoots = ints.length > 0
    ? ints.map(r => `x = ${fmtNum(r, 8)}`).join(', ')
    : 'ninguna en el interior del intervalo';
  const rowsHtml = subintervals.map(s => `
    <tr>
      <td>[${fmtNum(s.xi, 6)}, ${fmtNum(s.xj, 6)}]</td>
      <td><code>${s.topExpr}</code></td>
      <td><code>${s.botExpr}</code></td>
      <td>${fmtNum(s.area, 10)}</td>
      <td style="color:var(--subtext0); font-size:0.85rem">${s.method}</td>
    </tr>
  `).join('');

  // Visual preview: for the first sub-interval, show the full symbolic steps as example
  let exampleSteps = '';
  if (subintervals.length > 0) {
    const s0 = subintervals[0];
    try {
      const diffExpr = `(${s0.topExpr}) - (${s0.botExpr})`;
      const { result, steps } = symbolicIntegralSteps(diffExpr, 'x');
      const Fclean = result.replace(/\s*\+\s*C\s*$/, '');
      exampleSteps = `
        <div style="margin-top:12px"><b>Ejemplo — primer sub-intervalo [${fmtNum(s0.xi, 6)}, ${fmtNum(s0.xj, 6)}]:</b></div>
        ${texBlock(`\\int (${exprToTex(s0.topExpr)} - ${exprToTex(s0.botExpr)})\\, dx = ${exprToTex(Fclean)} + C`)}
        ${steps.map((st, i) => `
          <div style="margin-top:6px; padding-left:10px; border-left:2px solid var(--surface1, #45475a);">
            <div><b>${i + 1}. ${st.rule}</b> — <span style="color:var(--subtext0)">${st.explanation}</span></div>
            ${texBlock(st.latex)}
          </div>
        `).join('')}
        ${texBlock(`A_1 = \\Big[${exprToTex(Fclean)}\\Big]_{${fmtNum(s0.xi, 6)}}^{${fmtNum(s0.xj, 6)}} = ${fmtNum(s0.area, 10)}`)}
      `;
    } catch {
      exampleSteps = '';
    }
  }

  return `
    <div class="theorem-panel theorem-pass">
      <div class="theorem-header"><span class="theorem-icon">△</span> Analisis geometrico — intersecciones y region encerrada</div>
      <div class="theorem-body">
        <div><b>Paso 1 — Encontrar intersecciones:</b> resolvemos <code>f(x) = g(x)</code> en <code>[${fmtNum(a, 6)}, ${fmtNum(b, 6)}]</code>.</div>
        ${texBlock(`${exprToTex(fxExpr)} = ${exprToTex(gxExpr)} \\;\\Longleftrightarrow\\; ${exprToTex(fxExpr)} - ${exprToTex(gxExpr)} = 0`)}
        <div>Raices detectadas numericamente (bisecta sobre cambios de signo): <b>${eqRoots}</b>.</div>
        <div>Junto con los limites <code>a = ${fmtNum(a, 6)}</code> y <code>b = ${fmtNum(b, 6)}</code>, se forman <b>${subintervals.length} sub-intervalo(s)</b>.</div>

        <div style="margin-top:12px"><b>Paso 2 — Identificar la curva superior en cada sub-intervalo</b> (evaluando en el punto medio):</div>
        <div class="iter-table-wrap" style="margin-top:8px">
          <table class="iter-table">
            <thead>
              <tr>
                <th>Sub-intervalo</th>
                <th>Curva superior</th>
                <th>Curva inferior</th>
                <th>Area (∫(top−bot)dx)</th>
                <th>Metodo</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>

        <div style="margin-top:12px"><b>Paso 3 — Sumar las areas parciales</b>:</div>
        ${texBlock(`A_{\\text{total}} = \\sum_{i} \\int_{x_i}^{x_{i+1}} \\bigl(\\text{top}_i(x) - \\text{bot}_i(x)\\bigr)\\, dx = \\boxed{\\; ${fmtNum(totalArea, 10)} \\;}`)}

        ${exampleSteps}

        <div style="margin-top:8px; color:var(--subtext0); font-size:0.85rem">
          El metodo Hit-or-Miss aproxima precisamente esta misma area: lanza puntos en el rectangulo circunscrito y cuenta los que caen en la region <code>bot(x) ≤ y ≤ top(x)</code>. Si las curvas se cruzan, la region se descompone automaticamente en los sub-intervalos mostrados arriba.
        </div>
      </div>
    </div>
  `;
}

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
    { id: 'fx', label: 'f(x) (una curva)', placeholder: 'sqrt(x)', defaultValue: 'sqrt(x)', hint: 'La app detecta automaticamente intersecciones y que curva va arriba en cada sub-intervalo.' },
    { id: 'gx', label: 'g(x) (otra curva)', placeholder: 'x^2', defaultValue: 'x^2', hint: 'Si f y g se cruzan, se descompone la region y se suman las areas parciales.' },
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
    'Escribe las dos curvas <code>f(x)</code> y <code>g(x)</code>. <b>No importa cual es superior</b> — la app detecta las intersecciones en <code>[a, b]</code> y decide en cada sub-intervalo cual curva queda arriba. Ejemplo: <code>f = sqrt(x)</code>, <code>g = x²</code> en <code>[0, 1]</code> → se cruzan en 0 y 1, forman una "lente".',
    'Define <code>[a, b]</code> como intervalo de busqueda. Si las curvas se cruzan en el interior, la region se descompone automaticamente en sub-intervalos y se suman las areas parciales.',
    'Configura <code>N</code>, <code>K</code> y el <b>nivel de confianza</b> (90/95/99).',
    '<b>Estrategia Hit-or-Miss</b>: rectangulo circunscrito <code>[a, b] × [y_min, y_max]</code>. Puntos uniformes, cuenta los que caen entre las curvas. <code>A ≈ (Area rect) · (hits / N)</code>.',
    'Pulsa <b>Resolver</b>. Se muestran: (1) <b>Analisis geometrico</b> — intersecciones, sub-intervalos y cual curva va arriba en cada uno, con area exacta por sub-intervalo; (2) <b>Solucion analitica</b> con primitiva; (3) K repeticiones; (4) <b>Resumen estadistico</b> con IC; (5) <b>demostracion 1/√n</b>.',
    'Para el informe: (1) intersecciones detectadas; (2) tabla de sub-intervalos con curva superior/inferior y area parcial; (3) area total exacta; (4) tabla de A_k; (5) promedio Monte Carlo, σ entre repeticiones, IC; (6) comparacion con exacto.',
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
    panels.push(renderGeometricAnalysisPanel(params.fx, params.gx, f, g, a, b));
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
