import { texBlock, exprToTex } from '../../latex';
import { parseExpression, parseExpression2 } from '../../parser';
import { symbolicIntegralSteps } from '../../symbolic';

// --- PRNG & seed helpers ---

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

export function parseSeed(input: string | undefined): number | null {
  if (!input || input.trim() === '') return null;
  const num = Number(input.trim());
  if (!isNaN(num)) return num;
  return hashString(input.trim());
}

// --- Statistics ---

/**
 * Beasley-Springer-Moro inverse standard normal CDF. Accurate to ~8 decimals.
 */
export function normalInverse(p: number): number {
  if (p <= 0 || p >= 1) return NaN;
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-7.78489400243029e-3, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [7.78469570904146e-3, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const plow = 0.02425, phigh = 1 - plow;
  let q: number, r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= phigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
          ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

export function zForConfidence(confPct: number): number {
  const conf = confPct / 100;
  const alpha = 1 - conf;
  return normalInverse(1 - alpha / 2);
}

export function parseConfPct(raw: string | undefined, fallback: number = 95): number {
  const v = parseFloat(raw ?? '');
  if (isNaN(v) || v <= 0 || v >= 100) return fallback;
  return v;
}

// --- Formatting ---

export function fmtNum(n: number, p: number = 8): string {
  if (!isFinite(n)) return 'NaN';
  if (n === 0) return '0';
  let s = Math.abs(n) < 1e-4 || Math.abs(n) >= 1e8 ? n.toExponential(p - 1) : n.toPrecision(p);
  if (s.indexOf('.') >= 0 && !/e/i.test(s)) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

// --- Shared HTML panels ---

export function renderKRepsPanel(
  reps: { k: number; estimate: number; runningMean: number; runningStd: number }[],
  symbol: string = '\\hat{I}',
): string {
  if (reps.length === 0) return '';
  const rows = reps.map(r => `
    <tr>
      <td>${r.k}</td>
      <td>${fmtNum(r.estimate, 8)}</td>
      <td>${fmtNum(r.runningMean, 8)}</td>
      <td>${fmtNum(r.runningStd, 8)}</td>
    </tr>
  `).join('');
  const mean = reps[reps.length - 1].runningMean;
  return `
    <div class="theorem-panel theorem-pass">
      <div class="theorem-header"><span class="theorem-icon">K</span> K repeticiones independientes y promedio</div>
      <div class="theorem-body">
        <div>Cada repeticion <code>k</code> es una simulacion Monte Carlo completa (N puntos, semilla distinta). El promedio de las K estimaciones converge al valor esperado.</div>
        ${texBlock(`\\bar{${symbol.replace(/\\hat\{|\}/g, '')}} = \\frac{1}{K}\\sum_{k=1}^{K} ${symbol}_k`)}
        <div class="iter-table-wrap" style="margin-top:8px">
          <table class="iter-table">
            <thead>
              <tr><th>k</th><th>${symbol.replace(/\\hat\{|\}/g, '').replace(/_|\^/g, '') || 'I'}<sub>k</sub></th><th>Promedio 1..k</th><th>σ(1..k)</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="margin-top:6px">
          <code>Promedio final = ${fmtNum(mean, 10)}</code>
        </div>
      </div>
    </div>
  `;
}

export function renderSummaryPanel(opts: {
  N: number;
  K: number;
  mean: number;
  varianceEst: number;
  stdDev: number;
  stdErr: number;
  confPct: number;
  z: number;
  ciLower: number;
  ciUpper: number;
  basis: 'within' | 'reps' | 'bernoulli';
  symbol?: string;
}): string {
  const { N, K, mean, varianceEst, stdDev, stdErr, confPct, z, ciLower, ciUpper, basis } = opts;
  const symbol = opts.symbol ?? '\\hat{I}';
  const basisText =
    basis === 'reps'
      ? `Varianza y SE calculados <b>entre las K=${K} repeticiones</b>: s² = Σ(${symbol}<sub>k</sub> − promedio)²/(K−1), SE = s/√K.`
      : basis === 'bernoulli'
      ? `Varianza de Bernoulli: p̂(1−p̂). SE del estimador escalado por el factor de la formula.`
      : `Varianza y SE calculados <b>dentro de la muestra</b> de N=${N} puntos: s² = Var(f), SE = (Area)·s/√N.`;
  return `
    <div class="theorem-panel theorem-pass">
      <div class="theorem-header"><span class="theorem-icon">Σ</span> Resumen estadistico — intervalo de confianza ${confPct}%</div>
      <div class="theorem-body">
        <div>${basisText}</div>
        <div class="iter-table-wrap" style="margin-top:8px">
          <table class="iter-table">
            <thead><tr><th>Estadistico</th><th>Simbolo</th><th>Valor</th></tr></thead>
            <tbody>
              <tr><td>Tamano de muestra</td><td>N${K > 1 ? ', K' : ''}</td><td>${N}${K > 1 ? `, K = ${K}` : ''}</td></tr>
              <tr><td>Media muestral (estimacion)</td><td>x̄</td><td>${fmtNum(mean, 10)}</td></tr>
              <tr><td>Varianza muestral</td><td>s²</td><td>${fmtNum(varianceEst, 8)}</td></tr>
              <tr><td>Desviacion estandar</td><td>s</td><td>${fmtNum(stdDev, 8)}</td></tr>
              <tr><td>Error estandar</td><td>SE</td><td>${fmtNum(stdErr, 8)}</td></tr>
              <tr><td>Nivel de confianza</td><td>1 − α</td><td>${confPct}%</td></tr>
              <tr><td>z critico</td><td>z<sub>α/2</sub></td><td>${fmtNum(z, 6)}</td></tr>
              <tr><td>Margen de error</td><td>z·SE</td><td>± ${fmtNum(z * stdErr, 8)}</td></tr>
              <tr><td>IC inferior</td><td>x̄ − z·SE</td><td>${fmtNum(ciLower, 10)}</td></tr>
              <tr><td>IC superior</td><td>x̄ + z·SE</td><td>${fmtNum(ciUpper, 10)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style="margin-top:8px">
          <b>Interpretacion:</b> si repitieras este experimento muchas veces, el ${confPct}% de los intervalos asi construidos contendria el valor verdadero.
        </div>
        ${texBlock(`IC_{${confPct}\\%} = \\bar{x} \\pm z_{\\alpha/2}\\cdot SE = ${fmtNum(mean, 8)} \\pm ${fmtNum(z, 4)} \\cdot ${fmtNum(stdErr, 6)} = [${fmtNum(ciLower, 8)},\\; ${fmtNum(ciUpper, 8)}]`)}
      </div>
    </div>
  `;
}

/**
 * Generic error-halving demonstration. Caller provides a runner that takes (N, seed) and returns (estimate, SE).
 */
export function renderErrorHalvingPanel(opts: {
  runner: (N: number, seed: number) => { estimate: number; stdErr: number };
  N: number;
  baseSeed: number;
  currentStdErr: number;
  constantLabel?: string; // e.g. '(b-a)·σ(f)' or '(Area)·σ(f)'
  constantValue?: number;
}): string {
  const { runner, N, baseSeed, currentStdErr, constantLabel, constantValue } = opts;
  const Nnew = 4 * N;
  const newRun = runner(Nnew, baseSeed + 777777);
  const predicted = currentStdErr / 2;
  const ratio = currentStdErr > 0 ? newRun.stdErr / currentStdErr : NaN;
  const constLine = constantLabel && constantValue !== undefined
    ? `<div style="margin-top:8px; font-size:0.85rem; color: var(--subtext0);">Constante <code>${constantLabel}</code> = <code>${fmtNum(constantValue, 8)}</code>. Esta constante multiplica a <code>1/√n</code> en la formula del SE.</div>`
    : '';

  return `
    <div class="theorem-panel theorem-pass">
      <div class="theorem-header"><span class="theorem-icon">½</span> Reduccion del error: demostracion 1/√n</div>
      <div class="theorem-body">
        <div><b>Teorema (CLT aplicado a Monte Carlo):</b> el error estandar de la estimacion satisface</div>
        ${texBlock(`SE(\\hat{I}_n) = \\frac{C}{\\sqrt{n}} \\;\\propto\\; \\frac{1}{\\sqrt{n}}`)}
        <div>donde C es una constante que depende del problema (area del dominio × desviacion de f, o factor de Bernoulli).</div>

        <div style="margin-top:8px"><b>Demostracion matematica</b> — reducir el error a la mitad:</div>
        <div>Queremos <code>n'</code> tal que <code>SE(n') = SE(n) / 2</code>. Partiendo de la relacion:</div>
        ${texBlock(`\\frac{SE(n')}{SE(n)} = \\sqrt{\\frac{n}{n'}} = \\frac{1}{2}`)}
        ${texBlock(`\\sqrt{\\frac{n}{n'}} = \\frac{1}{2} \\;\\Longrightarrow\\; \\frac{n}{n'} = \\frac{1}{4} \\;\\Longrightarrow\\; \\boxed{\\; n' = 4n \\;}`)}
        <div><b>Conclusion:</b> para reducir el error a la mitad se debe <b>cuadruplicar</b> el tamano de la muestra. Por eso Monte Carlo converge lento (O(1/√n)).</div>

        <div style="margin-top:12px"><b>Verificacion empirica</b> — simulacion con n' = 4N:</div>
        <div class="iter-table-wrap" style="margin-top:8px">
          <table class="iter-table">
            <thead><tr><th>Caso</th><th>n</th><th>SE</th><th>Estimacion</th></tr></thead>
            <tbody>
              <tr><td>Original</td><td>${N}</td><td>${fmtNum(currentStdErr, 8)}</td><td>—</td></tr>
              <tr><td>SE predicho (SE/2)</td><td>${Nnew}</td><td>${fmtNum(predicted, 8)}</td><td>—</td></tr>
              <tr><td>Simulado con n' = 4N</td><td>${Nnew}</td><td><b>${fmtNum(newRun.stdErr, 8)}</b></td><td>${fmtNum(newRun.estimate, 10)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style="margin-top:8px">
          <code>Razon SE(4N)/SE(N) = ${fmtNum(ratio, 6)}</code> (teorico: <code>0.5</code>)
        </div>
        ${
          isFinite(ratio) && Math.abs(ratio - 0.5) < 0.2
            ? `<div style="color:var(--green,#a6e3a1); margin-top:6px">El error se redujo aproximadamente a la mitad, confirmando la relacion 1/√n.</div>`
            : `<div style="color:var(--peach,#fab387); margin-top:6px">La razon se aparta de 0.5 mas de lo esperado. Aumenta N para que σ se estabilice.</div>`
        }
        ${constLine}
      </div>
    </div>
  `;
}

// --- Analytical solution panels ---

export function renderAnalyticalPanel1D(fxExpr: string, a: number, b: number): string {
  try {
    const { result: FExpr, steps } = symbolicIntegralSteps(fxExpr, 'x');
    const Fclean = FExpr.replace(/\s*\+\s*C\s*$/, '');
    let evalBlock = '';
    try {
      const F = parseExpression(Fclean);
      const Fa = F(a);
      const Fb = F(b);
      const value = Fb - Fa;
      evalBlock = `
        <div style="margin-top:10px"><b>Evaluar en los limites</b> (regla de Barrow):</div>
        ${texBlock(`\\int_{${fmtNum(a, 6)}}^{${fmtNum(b, 6)}} ${exprToTex(fxExpr)}\\, dx = F(${fmtNum(b, 6)}) - F(${fmtNum(a, 6)}) = ${fmtNum(Fb, 8)} - (${fmtNum(Fa, 8)}) = ${fmtNum(value, 10)}`)}
      `;
    } catch {
      evalBlock = `<div><em>No se pudo evaluar numericamente la primitiva en [a, b].</em></div>`;
    }
    const stepsHtml = steps.map((s, i) => `
      <div style="margin-top:8px; padding-left:10px; border-left:2px solid var(--surface1, #45475a);">
        <div><b>${i + 1}. ${s.rule}</b> — <span style="color:var(--subtext0)">${s.explanation}</span></div>
        ${texBlock(s.latex)}
      </div>
    `).join('');
    return `
      <div class="theorem-panel theorem-pass">
        <div class="theorem-header"><span class="theorem-icon">∫</span> Solucion analitica paso a paso</div>
        <div class="theorem-body">
          <div>Integral indefinida:</div>
          ${texBlock(`\\int ${exprToTex(fxExpr)}\\, dx = ${exprToTex(Fclean)} + C`)}
          <div style="margin-top:10px"><b>Procedimiento:</b></div>
          ${stepsHtml}
          ${evalBlock}
        </div>
      </div>
    `;
  } catch (e: any) {
    return `
      <div class="theorem-panel theorem-fail">
        <div class="theorem-header"><span class="theorem-icon">∫</span> Solucion analitica</div>
        <div class="theorem-body">
          <div>No se pudo obtener la primitiva simbolica para <code>${fxExpr}</code>. ${e.message ?? ''}</div>
        </div>
      </div>
    `;
  }
}

/**
 * Analytical panel for double integrals on [a,b]×[c,d] — iterated integration.
 * Inner integral over y first (keeping x constant), then outer integral over x.
 */
export function renderAnalyticalPanel2D(
  fxyExpr: string,
  a: number, b: number, c: number, d: number,
): string {
  try {
    // Step 1: integrate over y (treating x as a constant parameter)
    const innerResult = symbolicIntegralSteps(fxyExpr, 'y');
    const Fy = innerResult.result.replace(/\s*\+\s*C\s*$/, '');

    let innerEvaluated = '';
    let outerIntegrandExpr = '';
    let finalValue = NaN;
    let outerSteps: { rule: string; explanation: string; latex: string }[] = [];
    let outerAntiExpr = '';

    try {
      const Fy_fn = parseExpression2(Fy);
      // outer integrand = F_y(x, d) - F_y(x, c)
      // Build symbolic string: substitute y=d and y=c
      const FyAtD = fxyExpr.includes('y') ? `(${Fy.replace(/\by\b/g, `(${d})`)})` : `(${Fy})`;
      const FyAtC = fxyExpr.includes('y') ? `(${Fy.replace(/\by\b/g, `(${c})`)})` : `(${Fy})`;
      outerIntegrandExpr = `${FyAtD} - ${FyAtC}`;
      innerEvaluated = `
        ${texBlock(`\\int_{${fmtNum(c, 6)}}^{${fmtNum(d, 6)}} ${exprToTex(fxyExpr)}\\, dy = \\Big[${exprToTex(Fy)}\\Big]_{y=${fmtNum(c, 6)}}^{y=${fmtNum(d, 6)}}`)}
      `;
      // Step 2: integrate outer integrand over x
      const outer = symbolicIntegralSteps(outerIntegrandExpr, 'x');
      outerAntiExpr = outer.result.replace(/\s*\+\s*C\s*$/, '');
      outerSteps = outer.steps;
      const Fx_fn = parseExpression(outerAntiExpr);
      finalValue = Fx_fn(b) - Fx_fn(a);

      // Sanity: fallback to direct numerical double integral if symbolic fails
      if (!isFinite(finalValue)) {
        // double check via Fy_fn at corners
        const top = Fy_fn(0, d);
        if (!isFinite(top)) throw new Error('invalid inner result');
      }
    } catch {
      return `
        <div class="theorem-panel theorem-fail">
          <div class="theorem-header"><span class="theorem-icon">∫∫</span> Solucion analitica (integral iterada)</div>
          <div class="theorem-body">
            <div>La primitiva simbolica respecto a <code>y</code> se obtuvo:</div>
            ${texBlock(`\\int ${exprToTex(fxyExpr)}\\, dy = ${exprToTex(Fy)} + C`)}
            <div>pero la integracion posterior respecto a <code>x</code> no fue factible simbolicamente. Usa Wolfram Alpha o una doble cuadratura numerica como referencia.</div>
          </div>
        </div>
      `;
    }

    const innerStepsHtml = innerResult.steps.map((s, i) => `
      <div style="margin-top:6px; padding-left:10px; border-left:2px solid var(--surface1, #45475a);">
        <div><b>${i + 1}. ${s.rule}</b> — <span style="color:var(--subtext0)">${s.explanation}</span></div>
        ${texBlock(s.latex)}
      </div>
    `).join('');
    const outerStepsHtml = outerSteps.map((s, i) => `
      <div style="margin-top:6px; padding-left:10px; border-left:2px solid var(--surface1, #45475a);">
        <div><b>${i + 1}. ${s.rule}</b> — <span style="color:var(--subtext0)">${s.explanation}</span></div>
        ${texBlock(s.latex)}
      </div>
    `).join('');

    return `
      <div class="theorem-panel theorem-pass">
        <div class="theorem-header"><span class="theorem-icon">∫∫</span> Solucion analitica paso a paso (integral iterada)</div>
        <div class="theorem-body">
          <div><b>Metodo:</b> por el teorema de Fubini, <code>∫∫ f dA = ∫<sub>a</sub><sup>b</sup> (∫<sub>c</sub><sup>d</sup> f dy) dx</code>.</div>
          ${texBlock(`\\iint_{[${fmtNum(a,6)},${fmtNum(b,6)}]\\times[${fmtNum(c,6)},${fmtNum(d,6)}]} ${exprToTex(fxyExpr)}\\,dA = \\int_{${fmtNum(a,6)}}^{${fmtNum(b,6)}} \\left( \\int_{${fmtNum(c,6)}}^{${fmtNum(d,6)}} ${exprToTex(fxyExpr)}\\, dy \\right) dx`)}

          <div style="margin-top:12px"><b>Paso A — integral interna respecto a y</b> (tratando x como constante):</div>
          ${texBlock(`\\int ${exprToTex(fxyExpr)}\\, dy = ${exprToTex(Fy)} + C_1`)}
          ${innerStepsHtml}
          ${innerEvaluated}

          <div style="margin-top:12px"><b>Paso B — integrar el resultado respecto a x</b>:</div>
          <div>Integrando <code>g(x) = F<sub>y</sub>(x, ${fmtNum(d,6)}) − F<sub>y</sub>(x, ${fmtNum(c,6)})</code>:</div>
          ${texBlock(`\\int ${exprToTex(outerIntegrandExpr)}\\, dx = ${exprToTex(outerAntiExpr)} + C_2`)}
          ${outerStepsHtml}

          <div style="margin-top:12px"><b>Paso C — evaluar en los limites</b>:</div>
          ${texBlock(`\\iint f\\, dA = \\Big[${exprToTex(outerAntiExpr)}\\Big]_{x=${fmtNum(a,6)}}^{x=${fmtNum(b,6)}} = ${fmtNum(finalValue, 10)}`)}
        </div>
      </div>
    `;
  } catch (e: any) {
    return `
      <div class="theorem-panel theorem-fail">
        <div class="theorem-header"><span class="theorem-icon">∫∫</span> Solucion analitica</div>
        <div class="theorem-body">
          <div>No se pudo obtener la primitiva simbolica para <code>${fxyExpr}</code>. ${e.message ?? ''}</div>
        </div>
      </div>
    `;
  }
}

export function renderAnalyticalPanelDifference(
  fxExpr: string, gxExpr: string, a: number, b: number,
): string {
  const diffExpr = `(${fxExpr}) - (${gxExpr})`;
  try {
    const { result: FExpr, steps } = symbolicIntegralSteps(diffExpr, 'x');
    const Fclean = FExpr.replace(/\s*\+\s*C\s*$/, '');
    let evalBlock = '';
    try {
      const F = parseExpression(Fclean);
      const Fa = F(a);
      const Fb = F(b);
      const value = Fb - Fa;
      evalBlock = `
        <div style="margin-top:10px"><b>Evaluar en los limites</b>:</div>
        ${texBlock(`\\int_{${fmtNum(a, 6)}}^{${fmtNum(b, 6)}} \\bigl(${exprToTex(fxExpr)} - (${exprToTex(gxExpr)})\\bigr) dx = ${fmtNum(value, 10)}`)}
      `;
    } catch {
      evalBlock = `<div><em>No se pudo evaluar numericamente la primitiva.</em></div>`;
    }
    const stepsHtml = steps.map((s, i) => `
      <div style="margin-top:6px; padding-left:10px; border-left:2px solid var(--surface1, #45475a);">
        <div><b>${i + 1}. ${s.rule}</b> — <span style="color:var(--subtext0)">${s.explanation}</span></div>
        ${texBlock(s.latex)}
      </div>
    `).join('');
    return `
      <div class="theorem-panel theorem-pass">
        <div class="theorem-header"><span class="theorem-icon">∫</span> Solucion analitica — area entre curvas</div>
        <div class="theorem-body">
          <div>Area = <code>∫<sub>a</sub><sup>b</sup> (f(x) − g(x)) dx</code> (cuando f ≥ g; si se cruzan, usar |f − g|).</div>
          ${texBlock(`\\int_{${fmtNum(a, 6)}}^{${fmtNum(b, 6)}} \\bigl(${exprToTex(fxExpr)} - ${exprToTex(gxExpr)}\\bigr)\\, dx = \\Big[${exprToTex(Fclean)}\\Big]_{${fmtNum(a, 6)}}^{${fmtNum(b, 6)}}`)}
          <div style="margin-top:10px"><b>Procedimiento:</b></div>
          ${stepsHtml}
          ${evalBlock}
        </div>
      </div>
    `;
  } catch (e: any) {
    return `
      <div class="theorem-panel theorem-fail">
        <div class="theorem-header"><span class="theorem-icon">∫</span> Solucion analitica</div>
        <div class="theorem-body">
          <div>No se pudo obtener la primitiva simbolica. ${e.message ?? ''}</div>
        </div>
      </div>
    `;
  }
}
