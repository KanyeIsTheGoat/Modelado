import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { parseTableData } from '../../ui';
import { maxAbsDerivative } from '../../integrationHelpers';
import { texBlock } from '../../latex';

function evalLagrange(xs: number[], ys: number[], x: number): { value: number; basis: number[] } {
  const n = xs.length;
  const basis: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let Li = 1;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      Li *= (x - xs[j]) / (xs[i] - xs[j]);
    }
    basis.push(Li);
    sum += ys[i] * Li;
  }
  return { value: sum, basis };
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// ---- Polinomio symbolico ----
type Poly = number[]; // coef[k] es el coeficiente de x^k

function polyMul(a: Poly, b: Poly): Poly {
  const res: Poly = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      res[i + j] += a[i] * b[j];
    }
  }
  return res;
}

function polyAdd(a: Poly, b: Poly): Poly {
  const res: Poly = new Array(Math.max(a.length, b.length)).fill(0);
  for (let i = 0; i < a.length; i++) res[i] += a[i];
  for (let i = 0; i < b.length; i++) res[i] += b[i];
  return res;
}

function polyScale(a: Poly, k: number): Poly {
  return a.map(c => c * k);
}

function numToLatex(n: number): string {
  if (!isFinite(n)) return n > 0 ? '\\infty' : '-\\infty';
  if (Math.abs(n) < 1e-14) return '0';
  if (Math.abs(n - Math.round(n)) < 1e-10) return Math.round(n).toString();
  for (let d = 2; d <= 1000; d++) {
    const numer = n * d;
    if (Math.abs(numer - Math.round(numer)) < 1e-9) {
      const num = Math.round(numer);
      const sign = (num < 0) !== (d < 0) ? '-' : '';
      return `${sign}\\frac{${Math.abs(num)}}{${Math.abs(d)}}`;
    }
  }
  let s = n.toPrecision(6);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

function polyToLatex(p: Poly, variable: string = 'x'): string {
  const terms: string[] = [];
  for (let k = p.length - 1; k >= 0; k--) {
    const c = p[k];
    if (Math.abs(c) < 1e-12) continue;
    const isFirst = terms.length === 0;
    const sign = c < 0 ? '-' : '+';
    const absC = Math.abs(c);
    let coefStr: string;
    if (k === 0) {
      coefStr = numToLatex(absC);
    } else if (Math.abs(absC - 1) < 1e-12) {
      coefStr = '';
    } else {
      coefStr = numToLatex(absC);
    }
    let varStr: string;
    if (k === 0) varStr = '';
    else if (k === 1) varStr = variable;
    else varStr = `${variable}^{${k}}`;
    const term = coefStr + varStr;
    if (isFirst) {
      terms.push(c < 0 ? '-' + term : term);
    } else {
      terms.push(`${sign} ${term}`);
    }
  }
  return terms.length > 0 ? terms.join(' ') : '0';
}

/** Construye num = ∏_{j≠i}(x - x_j) y den = ∏_{j≠i}(x_i - x_j) */
function buildLagrangeBasis(xs: number[], i: number): { numPoly: Poly; den: number; factors: string[]; denFactors: string[] } {
  let numPoly: Poly = [1];
  let den = 1;
  const factors: string[] = [];
  const denFactors: string[] = [];
  for (let j = 0; j < xs.length; j++) {
    if (j === i) continue;
    numPoly = polyMul(numPoly, [-xs[j], 1]);
    den *= (xs[i] - xs[j]);
    const xj = xs[j];
    factors.push(xj >= 0 ? `(x - ${numToLatex(xj)})` : `(x + ${numToLatex(-xj)})`);
    const diff = xs[i] - xj;
    denFactors.push(`(${numToLatex(xs[i])} - ${numToLatex(xj)})`);
    void diff;
  }
  return { numPoly, den, factors, denFactors };
}

/** Busca max|∏(x - x_i)| en [a, b] por muestreo. */
function maxAbsProduct(xs: number[], a: number, b: number, samples: number = 2000): { max: number; xAtMax: number } {
  let best = 0;
  let xAt = a;
  for (let k = 0; k <= samples; k++) {
    const x = a + (b - a) * (k / samples);
    let p = 1;
    for (const xi of xs) p *= (x - xi);
    const abs = Math.abs(p);
    if (abs > best) { best = abs; xAt = x; }
  }
  return { max: best, xAtMax: xAt };
}

/** Renderiza el panel HTML con el analisis paso a paso del error local y la cota global. */
function renderErrorAnalysisPanel(
  xs: number[],
  fxExpr: string,
  derivativeExpr: string | null,
  M: number,
  xAtM: number,
  aInt: number,
  bInt: number,
  xiVal: number | null,
  pAtXi: number | null,
  fAtXi: number | null,
  pnAtXi: number | null,
  localBound: number | null,
  localActual: number | null,
): string {
  const n = xs.length - 1;
  const order = n + 1;
  const fact = factorial(order);
  const { max: maxProd, xAtMax: xAtProd } = maxAbsProduct(xs, aInt, bInt);
  const globalBound = (M / fact) * maxProd;

  const nodesList = xs.map(v => numToLatex(v)).join(',\\; ');

  const productFactors = (xi: number) => xs.map(xj => {
    const diff = xi - xj;
    return xj >= 0 ? `(${numToLatex(xi)} - ${numToLatex(xj)})` : `(${numToLatex(xi)} + ${numToLatex(-xj)})`;
  }).join('\\,');

  const productNumbers = (xi: number) => xs.map(xj => {
    const d = xi - xj;
    return d < 0 ? `(${numToLatex(d)})` : numToLatex(d);
  }).join(' \\cdot ');

  let localSection = '';
  if (xiVal !== null && pAtXi !== null) {
    const prodLatex = `${productFactors(xiVal)} = ${productNumbers(xiVal)} = ${numToLatex(pAtXi)}`;
    const boundLatex = `|E_{${n}}(\\xi)| \\leq \\frac{M}{(n+1)!} \\cdot \\left|\\prod_{i=0}^{${n}} (\\xi - x_i)\\right| = \\frac{${numToLatex(M)}}{${fact}} \\cdot ${numToLatex(Math.abs(pAtXi))} = ${numToLatex(localBound ?? 0)}`;
    const actualLatex = (fAtXi !== null && pnAtXi !== null)
      ? `|f(\\xi) - P_{${n}}(\\xi)| = |${numToLatex(fAtXi)} - ${numToLatex(pnAtXi)}| = ${numToLatex(localActual ?? 0)}`
      : '';

    localSection = `
      <div style="margin-top:10px"><b>Error local en ξ = ${numToLatex(xiVal)}</b></div>
      <div><em>Paso 1:</em> calcular el producto de nodos evaluado en ξ:</div>
      ${texBlock(`\\prod_{i=0}^{${n}}(\\xi - x_i) = ${prodLatex}`)}
      <div><em>Paso 2:</em> aplicar la cota de error (reemplazar en la formula general):</div>
      ${texBlock(boundLatex)}
      ${actualLatex ? `<div><em>Paso 3:</em> error real (ya que conocemos f):</div>${texBlock(actualLatex)}` : ''}
    `;
  } else {
    localSection = `
      <div style="margin-top:10px"><b>Error local</b></div>
      <div><em>Ingresa un valor en el campo <code>ξ</code> para calcular el error local paso a paso.</em></div>
    `;
  }

  const prodMaxLatex = `\\max_{x \\in [${numToLatex(aInt)}, ${numToLatex(bInt)}]} \\left|\\prod_{i=0}^{${n}}(x - x_i)\\right| = ${numToLatex(maxProd)} \\quad (\\text{alcanzado en } x \\approx ${numToLatex(xAtProd)})`;
  const globalLatex = `\\max_{x \\in [a,b]} |E_{${n}}(x)| \\leq \\frac{M}{(n+1)!} \\cdot \\max \\left|\\prod(x - x_i)\\right| = \\frac{${numToLatex(M)}}{${fact}} \\cdot ${numToLatex(maxProd)} = ${numToLatex(globalBound)}`;

  return `
    <div class="theorem-panel theorem-pass">
      <div class="theorem-header"><span class="theorem-icon">Δ</span> Analisis de error de Lagrange — paso a paso</div>
      <div class="theorem-body">
        <div><b>Formula general del error</b> (teorema del resto de interpolacion):</div>
        ${texBlock(`E_{${n}}(x) = f(x) - P_{${n}}(x) = \\frac{f^{(${order})}(\\eta(x))}{(n+1)!} \\cdot \\prod_{i=0}^{${n}}(x - x_i), \\quad \\eta(x) \\in [a, b]`)}
        <div><b>Datos del problema:</b> nodos <code>x_i = {${nodesList}}</code>, intervalo <code>[${numToLatex(aInt)}, ${numToLatex(bInt)}]</code>, <code>f(x) = ${fxExpr}</code>, grado <code>n = ${n}</code>, <code>(n+1)! = ${fact}</code>.</div>

        <div style="margin-top:10px"><b>Paso A — derivada de orden n+1</b></div>
        ${derivativeExpr ? texBlock(`f^{(${order})}(x) = ${derivativeExpr.replace(/\*/g, '\\cdot ')}`) : '<div><em>No se pudo derivar simbolicamente; se usa diferenciacion numerica.</em></div>'}

        <div style="margin-top:10px"><b>Paso B — cota M = max|f⁽ⁿ⁺¹⁾| en el intervalo</b></div>
        ${texBlock(`M = \\max_{x \\in [${numToLatex(aInt)}, ${numToLatex(bInt)}]} |f^{(${order})}(x)| = ${numToLatex(M)} \\quad (\\text{en } x \\approx ${numToLatex(xAtM)})`)}

        ${localSection}

        <div style="margin-top:10px"><b>Cota de error GLOBAL en [a, b]</b></div>
        <div><em>Paso 1:</em> maximizar el producto de nodos sobre todo el intervalo:</div>
        ${texBlock(prodMaxLatex)}
        <div><em>Paso 2:</em> multiplicar por M/(n+1)!:</div>
        ${texBlock(globalLatex)}
        <div style="margin-top:6px"><em>Interpretacion:</em> para <b>cualquier</b> x en [${numToLatex(aInt)}, ${numToLatex(bInt)}], el error de interpolacion no supera <b>${numToLatex(globalBound)}</b>.</div>
      </div>
    </div>
  `;
}

/** Renderiza el panel HTML con la derivacion simbolica de Lagrange. */
function renderLagrangeDerivationPanel(xs: number[], ys: number[]): string {
  const n = xs.length;
  const deg = n - 1;
  let finalPoly: Poly = [0];
  const liLines: string[] = [];

  for (let i = 0; i < n; i++) {
    const { numPoly, den, factors, denFactors } = buildLagrangeBasis(xs, i);
    const numFactored = factors.join('');
    const denFactored = denFactors.join('');
    const numExpanded = polyToLatex(numPoly);
    const scaled = polyScale(numPoly, 1 / den);
    const liExpanded = polyToLatex(scaled);
    // P(x) += y_i * L_i(x)
    finalPoly = polyAdd(finalPoly, polyScale(scaled, ys[i]));
    liLines.push(
      `${texBlock(`L_{${i}}(x) = \\frac{${numFactored}}{${denFactored}} = \\frac{${numExpanded}}{${numToLatex(den)}} = ${liExpanded}`)}`
    );
  }

  const sumLine = xs
    .map((_, i) => `${numToLatex(ys[i])} \\cdot L_{${i}}(x)`)
    .join(' + ');
  const finalExpanded = polyToLatex(finalPoly);

  return `
    <div class="theorem-panel theorem-pass">
      <div class="theorem-header"><span class="theorem-icon">∑</span> Derivacion simbolica del polinomio de Lagrange</div>
      <div class="theorem-body">
        <div><b>Grado del polinomio:</b> n − 1 = ${deg} (con ${n} nodos)</div>
        <div style="margin-top:8px"><b>Bases de Lagrange</b> &nbsp; <code>L_i(x) = ∏_{j≠i} (x − x_j)/(x_i − x_j)</code>:</div>
        ${liLines.join('')}
        <div style="margin-top:8px"><b>Polinomio interpolante:</b></div>
        ${texBlock(`P_{${deg}}(x) = ${sumLine}`)}
        ${texBlock(`P_{${deg}}(x) = ${finalExpanded}`)}
      </div>
    </div>
  `;
}

export const lagrange: MethodDefinition = {
  id: 'lagrange',
  name: 'Interpolacion de Lagrange',
  category: 'interpolation',
  formula: 'P_n(x) = Σ y_i · L_i(x), L_i(x) = ∏_{j≠i} (x - x_j)/(x_i - x_j)',
  latexFormula: 'P_n(x) = \\sum_{i=0}^{n} y_i\\,L_i(x), \\quad L_i(x) = \\prod_{\\substack{j=0 \\\\ j \\neq i}}^{n} \\frac{x - x_j}{x_i - x_j}',
  description: 'Construye el polinomio interpolante de grado ≤ n que pasa por n+1 puntos. Si se provee f(x), calcula error local y cota global.',
  inputs: [
    {
      id: 'points',
      label: 'Puntos (x, y)',
      placeholder: '',
      type: 'table',
      tableColumns: 2,
      tableHeaders: ['x_i', 'y_i'],
      defaultValue: '0,1;1,3;2,2;3,5',
    },
    { id: 'xQuery', label: 'x objetivo (opcional, donde evaluar P_n(x))', placeholder: 'Vacio = solo polinomio', type: 'number', hint: 'Dejalo vacio si solo queres el polinomio (parte a del parcial).' },
    { id: 'fx', label: 'f(x) real (opcional, para error)', placeholder: 'p.ej. sin(x)', hint: 'Funcion subyacente para calcular error local y cota global.' },
    { id: 'xi', label: 'ξ para error local (opcional)', placeholder: 'p.ej. 0.45', type: 'number', hint: 'Punto donde evaluar el error local |f(ξ) - P_n(ξ)|. Distinto de x objetivo.' },
  ],
  tableColumns: [
    { key: 'i', label: 'i', latex: 'i' },
    { key: 'xi', label: 'x_i', latex: 'x_i' },
    { key: 'yi', label: 'y_i', latex: 'y_i' },
    { key: 'Li', label: 'L_i(x)', latex: 'L_i(x)' },
    { key: 'yiLi', label: 'y_i · L_i(x)', latex: 'y_i \\cdot L_i(x)' },
  ],
  steps: [
    'Carga la <b>tabla de puntos</b> (x_i, y_i) en el primer input. Podes:<br>&nbsp;&nbsp;• Pegar tabla discreta tal cual viene del parcial, ej: <code>0,1;1,3;3,0</code> (puntos (0,1), (1,3), (3,0)).<br>&nbsp;&nbsp;• Construirla evaluando <code>f(x)</code> en cada nodo. Ej: para <code>f(x) = sin(πx)</code> en nodos 0, 0.5, 1, 1.5 → <code>0,0;0.5,1;1,0;1.5,-1</code>.',
    'El <b>grado</b> del polinomio interpolante sera <code>n - 1</code> donde n es la cantidad de puntos. Con 4 puntos → polinomio cubico.',
    'En "x objetivo" pone donde queres <b>evaluar</b> <code>P_n(x*)</code>. Ej: x = 2 para la tabla (0,1)(1,3)(3,0); o x = 0.45 o x = 0.75 segun el parcial.',
    'Si el parcial da una <code>f(x)</code> original (no solo tabla), escribila en el campo "f(x) real". La app calcula:<br>&nbsp;&nbsp;• <b>Error local</b> en x*: <code>|f(x*) - P_n(x*)|</code>.<br>&nbsp;&nbsp;• <b>Cota global</b>: <code>|E| ≤ max|f⁽ⁿ⁺¹⁾(ξ)| / (n+1)! · |∏(x - x_i)|</code>. La app deriva <code>f</code> simbolicamente orden n+1 y encuentra <code>max|f⁽ⁿ⁺¹⁾|</code> en [min(x_i), max(x_i)] numericamente. ξ es el punto donde ese maximo se alcanza.',
    'Pulsa <b>Resolver</b>. La tabla muestra por nodo: <code>i, x_i, y_i, L_i(x*), y_i·L_i(x*)</code>. La suma de la ultima columna es <code>P_n(x*)</code>. Cada <code>L_i(x)</code> es <code>∏_{j≠i} (x - x_j) / (x_i - x_j)</code>: vale 1 en x_i y 0 en los demas nodos.',
    'Revisa los graficos:<br>&nbsp;&nbsp;1. <em>Polinomio interpolante</em> con nodos marcados y, si diste f(x), la curva real superpuesta para ver donde divergen.<br>&nbsp;&nbsp;2. <em>Polinomios base L_i(x)</em> — cada L_i vale 1 en un solo nodo.<br>&nbsp;&nbsp;3. <em>Error |f - P_n|</em> o el factor <code>∏(x - x_i)</code>.<br>&nbsp;&nbsp;4. <em>Contribuciones y_i·L_i(x*)</em>.',
    'Para el <b>punto b del parcial</b> (derivar en x*): copia <code>P_n(x*)</code> como <code>y_0</code> y usa <b>diferencias centrales</b> con paso chico sobre el polinomio. O mejor: re-evalua <code>P_n</code> en <code>x* ± h</code> directamente con Lagrange y aplica <code>f\'(x*) ≈ [P_n(x*+h) - P_n(x*-h)] / (2h)</code>. La guia del metodo <em>Diferencia central</em> te indica como.',
    'Informe: polinomio resultante, grafica, error local en ξ, cota global, y justificacion de que <code>|error| &lt; 1 %</code>.',
  ],

  solve(params) {
    const table = parseTableData(params.points);
    if (table.length < 2) throw new Error('Se requieren al menos 2 puntos');
    const xs = table.map(r => r[0]);
    const ys = table.map(r => r[1]);

    const uniqueXs = new Set(xs);
    if (uniqueXs.size !== xs.length) throw new Error('Los valores de x_i deben ser distintos');

    const xQueryRaw = (params.xQuery ?? '').trim();
    const hasQuery = xQueryRaw !== '';
    const xQuery = hasQuery ? parseFloat(xQueryRaw) : NaN;
    if (hasQuery && isNaN(xQuery)) throw new Error('x objetivo invalido');

    const n = xs.length - 1;

    let value: number | undefined;
    let basis: number[] = [];
    if (hasQuery) {
      const ev = evalLagrange(xs, ys, xQuery);
      value = ev.value;
      basis = ev.basis;
    }

    const iterations: MethodResult['iterations'] = xs.map((xi, i) => ({
      i,
      xi,
      yi: ys[i],
      Li: hasQuery ? basis[i] : null,
      yiLi: hasQuery ? ys[i] * basis[i] : null,
    }));

    // Error analysis
    let relativeErrorPercent: number | undefined;
    let truncationBound: number | undefined;
    let maxDerivative: number | undefined;
    let xiApprox: number | undefined;
    let derivativeExpr: string | undefined;
    let message = hasQuery
      ? `P_${n}(${xQuery}) = ${value!.toPrecision(8)} | grado ${n}`
      : `Polinomio de grado ${n} construido (sin evaluacion en x objetivo)`;

    const fxExpr = (params.fx ?? '').trim();
    const xiRaw = (params.xi ?? '').trim();
    const hasXi = xiRaw !== '';
    const xiVal = hasXi ? parseFloat(xiRaw) : NaN;
    if (hasXi && isNaN(xiVal)) throw new Error('ξ invalido');

    let errorPanel: string | null = null;

    if (fxExpr !== '') {
      try {
        const f = parseExpression(fxExpr);
        const aInt = Math.min(...xs);
        const bInt = Math.max(...xs);
        const d = maxAbsDerivative(fxExpr, n + 1, aInt, bInt);
        maxDerivative = d.max;
        xiApprox = d.xAtMax;
        derivativeExpr = d.derivativeExpr ?? undefined;

        // Error local at ξ (if provided)
        let pAtXi: number | null = null;
        let fAtXi: number | null = null;
        let pnAtXi: number | null = null;
        let localBound: number | null = null;
        let localActual: number | null = null;
        if (hasXi) {
          let prod = 1;
          for (const xj of xs) prod *= (xiVal - xj);
          pAtXi = prod;
          fAtXi = f(xiVal);
          pnAtXi = evalLagrange(xs, ys, xiVal).value;
          localBound = (d.max / factorial(n + 1)) * Math.abs(prod);
          localActual = Math.abs(fAtXi - pnAtXi);
        }

        // Retrocompatibilidad con xQuery
        if (hasQuery) {
          const fVal = f(xQuery);
          relativeErrorPercent = Math.abs(fVal) > 1e-14
            ? Math.abs(value! - fVal) / Math.abs(fVal) * 100
            : Math.abs(value! - fVal) * 100;
          let prodQ = 1;
          for (const xj of xs) prodQ *= (xQuery - xj);
          truncationBound = (d.max / factorial(n + 1)) * Math.abs(prodQ);
          message += ` · f(${xQuery}) = ${fVal.toPrecision(8)} · |error| = ${Math.abs(value! - fVal).toPrecision(6)}`;
        }
        if (hasXi) {
          message += ` · ξ=${xiVal}: |E_local| ≤ ${localBound!.toPrecision(6)}${localActual !== null ? ` (real: ${localActual.toPrecision(6)})` : ''}`;
        }
        if (derivativeExpr) message += ` · f⁽${n + 1}⁾(x) = ${derivativeExpr}`;

        errorPanel = renderErrorAnalysisPanel(
          xs, fxExpr, derivativeExpr ?? null, d.max, d.xAtMax, aInt, bInt,
          hasXi ? xiVal : null, pAtXi, fAtXi, pnAtXi, localBound, localActual,
        );
      } catch (e: any) {
        message += ` · (no se pudo evaluar f(x): ${e.message})`;
      }
    } else if (hasXi) {
      message += ` · (para calcular error local en ξ=${xiVal} falta definir f(x))`;
    }

    const theoremPanels = [renderLagrangeDerivationPanel(xs, ys)];
    if (errorPanel) theoremPanels.push(errorPanel);

    return {
      root: value,
      iterations,
      converged: true,
      error: truncationBound ?? 0,
      exact: fxExpr !== '' && hasQuery ? parseExpression(fxExpr)(xQuery) : undefined,
      relativeErrorPercent,
      truncationBound,
      truncationOrder: truncationBound !== undefined ? n + 1 : undefined,
      maxDerivative,
      xiApprox,
      derivativeExpr,
      theoremPanels,
      message,
    };
  },

  getCharts(params, result) {
    const table = parseTableData(params.points);
    const xs = table.map(r => r[0]);
    const ys = table.map(r => r[1]);
    const xQueryRaw = (params.xQuery ?? '').trim();
    const hasQuery = xQueryRaw !== '' && !isNaN(parseFloat(xQueryRaw));
    const xQuery = hasQuery ? parseFloat(xQueryRaw) : NaN;
    const n = xs.length - 1;

    const aInt = Math.min(...xs);
    const bInt = Math.max(...xs);
    const pad = (bInt - aInt) * 0.15 + 1e-6;
    const xsPlot = linspace(aInt - pad, bInt + pad, 400);
    const ysPoly = xsPlot.map(x => evalLagrange(xs, ys, x).value);

    const fxExpr = (params.fx ?? '').trim();
    const datasetsCurve: ChartData['datasets'] = [
      { label: 'P_n(x)', x: xsPlot, y: ysPoly, color: '#cba6f7' },
      { label: 'Nodos', x: xs, y: ys, color: '#f9e2af', pointRadius: 5, showLine: false },
    ];
    if (hasQuery) {
      datasetsCurve.push({ label: 'P_n(x*)', x: [xQuery], y: [result.root ?? 0], color: '#a6e3a1', pointRadius: 6, showLine: false });
    }
    if (fxExpr !== '') {
      try {
        const f = parseExpression(fxExpr);
        datasetsCurve.unshift({ label: 'f(x)', x: xsPlot, y: xsPlot.map(x => f(x)), color: '#89b4fa', dashed: true });
      } catch {}
    }
    const chart1: ChartData = {
      title: `Polinomio interpolante (grado ${n})`,
      type: 'line',
      datasets: datasetsCurve,
      xLabel: 'x', yLabel: 'y',
    };

    // Lagrange basis polynomials L_i(x)
    const basisDatasets: ChartData['datasets'] = xs.map((_, i) => ({
      label: `L_${i}(x)`,
      x: xsPlot,
      y: xsPlot.map(x => evalLagrange(xs, ys, x).basis[i]),
      color: `hsl(${(i * 360) / xs.length}, 70%, 65%)`,
      pointRadius: 0,
    }));
    const chart2: ChartData = {
      title: 'Polinomios base L_i(x)',
      type: 'line',
      datasets: basisDatasets,
      xLabel: 'x', yLabel: 'L_i(x)',
    };

    // Error curve or product ∏(x - x_i)
    let chart3: ChartData;
    if (fxExpr !== '') {
      try {
        const f = parseExpression(fxExpr);
        const err = xsPlot.map(x => Math.abs(f(x) - evalLagrange(xs, ys, x).value));
        const errDatasets: ChartData['datasets'] = [
          { label: '|error|', x: xsPlot, y: err, color: '#f38ba8' },
        ];
        if (hasQuery) {
          errDatasets.push({ label: 'x objetivo', x: [xQuery, xQuery], y: [0, Math.max(...err)], color: '#a6e3a1', dashed: true, pointRadius: 0 });
        }
        chart3 = {
          title: '|f(x) - P_n(x)| — error absoluto',
          type: 'line',
          datasets: errDatasets,
          xLabel: 'x', yLabel: '|error|',
        };
      } catch {
        chart3 = productChart(xsPlot, xs, hasQuery ? xQuery : null);
      }
    } else {
      chart3 = productChart(xsPlot, xs, hasQuery ? xQuery : null);
    }

    // Contributions y_i·L_i at x* (solo si se dio x objetivo)
    const iterRows = result.iterations;
    const contribX = iterRows.map(r => r.i as number);
    const contribY = iterRows.map(r => (r.yiLi ?? 0) as number);
    const chart4: ChartData = hasQuery
      ? {
          title: `Contribuciones y_i · L_i(x*) con x* = ${xQuery}`,
          type: 'bar',
          datasets: [
            { label: 'y_i · L_i(x*)', x: contribX, y: contribY, color: '#94e2d5' },
          ],
          xLabel: 'i', yLabel: 'Contribucion',
        }
      : {
          title: 'Valores y_i en los nodos',
          type: 'bar',
          datasets: [
            { label: 'y_i', x: xs, y: ys, color: '#94e2d5' },
          ],
          xLabel: 'x_i', yLabel: 'y_i',
        };

    return [chart1, chart2, chart3, chart4];
  },
};

function productChart(xsPlot: number[], xs: number[], xQuery: number | null): ChartData {
  const prodY = xsPlot.map(x => xs.reduce((acc, xi) => acc * (x - xi), 1));
  const datasets: ChartData['datasets'] = [
    { label: '∏(x - x_i)', x: xsPlot, y: prodY, color: '#fab387' },
  ];
  if (xQuery !== null) {
    datasets.push({ label: 'x objetivo', x: [xQuery], y: [xs.reduce((acc, xi) => acc * (xQuery - xi), 1)], color: '#a6e3a1', pointRadius: 6, showLine: false });
  }
  return {
    title: '∏ (x - x_i) — factor del error',
    type: 'line',
    datasets,
    xLabel: 'x', yLabel: 'producto',
  };
}
