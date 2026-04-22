import { create, all, MathNode } from 'mathjs';
import { parseExpression, linspace } from './parser';
import { texBlock } from './latex';

const math = create(all);

function fmtNum(n: number, p: number = 8): string {
  if (!isFinite(n)) return 'NaN';
  if (n === 0) return '0';
  let s = Math.abs(n) < 1e-4 || Math.abs(n) >= 1e8 ? n.toExponential(p - 1) : n.toPrecision(p);
  if (s.indexOf('.') >= 0 && !/e/i.test(s)) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

/**
 * Evalua simbolicamente la derivada n-esima de expr en x = xi.
 * Si no es posible derivar simbolicamente, cae a central differences numericas.
 */
export function evaluateDerivativeAt(
  expr: string,
  order: number,
  xi: number,
): { value: number; derivativeExpr: string | null } {
  try {
    let node: MathNode = math.parse(expr);
    for (let k = 0; k < order; k++) {
      node = math.derivative(node, 'x');
    }
    const simplified = math.simplify(node);
    const derivativeExpr = simplified.toString();
    const compiled = math.compile(derivativeExpr);
    const v = compiled.evaluate({ x: xi, e: Math.E, pi: Math.PI }) as number;
    return { value: typeof v === 'number' ? v : NaN, derivativeExpr };
  } catch {
    const f = parseExpression(expr);
    return { value: numericalHighOrderDerivative(f, xi, order), derivativeExpr: null };
  }
}

/**
 * Returns an approximation of max |f^(order)(x)| on the interval [a, b].
 * Uses math.js symbolic derivative when possible; falls back to repeated
 * numerical central differences.
 */
export function maxAbsDerivative(
  expr: string,
  order: number,
  a: number,
  b: number,
  samples: number = 400,
): { max: number; xAtMax: number; derivativeExpr: string | null } {
  let derivedFn: ((x: number) => number) | null = null;
  let derivedStr: string | null = null;

  try {
    let node: MathNode = math.parse(expr);
    for (let k = 0; k < order; k++) {
      node = math.derivative(node, 'x');
    }
    derivedStr = math.simplify(node).toString();
    const compiled = math.compile(derivedStr);
    derivedFn = (x: number) => {
      const v = compiled.evaluate({ x, e: Math.E, pi: Math.PI }) as number;
      return typeof v === 'number' ? v : NaN;
    };
  } catch {
    const f = parseExpression(expr);
    derivedFn = (x: number) => numericalHighOrderDerivative(f, x, order);
  }

  const xs = linspace(a, b, samples);
  let maxAbs = 0;
  let xAtMax = a;
  for (const x of xs) {
    const v = derivedFn(x);
    if (isFinite(v) && Math.abs(v) > maxAbs) {
      maxAbs = Math.abs(v);
      xAtMax = x;
    }
  }
  return { max: maxAbs, xAtMax, derivativeExpr: derivedStr };
}

/**
 * Higher-order numerical derivative via repeated central differences.
 * Adequate for order <= 4. h tuned to balance truncation and round-off.
 */
export function numericalHighOrderDerivative(
  f: (x: number) => number,
  x: number,
  order: number,
  h: number = 1e-3,
): number {
  if (order === 0) return f(x);
  if (order === 1) return (f(x + h) - f(x - h)) / (2 * h);
  if (order === 2) return (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
  if (order === 3) {
    return (f(x + 2 * h) - 2 * f(x + h) + 2 * f(x - h) - f(x - 2 * h)) / (2 * h * h * h);
  }
  if (order === 4) {
    return (f(x + 2 * h) - 4 * f(x + h) + 6 * f(x) - 4 * f(x - h) + f(x - 2 * h)) / (h * h * h * h);
  }
  // Fallback: recursive differencing (less accurate for high orders)
  const g = (t: number) => numericalHighOrderDerivative(f, t, order - 1, h);
  return (g(x + h) - g(x - h)) / (2 * h);
}

/**
 * Relative error in percent between approximate and exact values.
 * Uses |exact| in the denominator when non-zero, otherwise |approx|.
 */
export function relativeErrorPercent(approx: number, exact: number): number {
  const denom = Math.abs(exact) > 1e-14 ? Math.abs(exact) : Math.abs(approx);
  if (denom === 0) return 0;
  return Math.abs(approx - exact) / denom * 100;
}

/**
 * Truncation error bounds for the common integration rules.
 * Each returns the upper bound |E| using max|f^(k)| on the interval.
 */
export function trapecioError(fxExpr: string, a: number, b: number, h: number) {
  const d = maxAbsDerivative(fxExpr, 2, a, b);
  const bound = ((b - a) * h * h / 12) * d.max;
  return { bound, max: d.max, xAtMax: d.xAtMax, derivativeExpr: d.derivativeExpr, order: 2 };
}

export function midpointError(fxExpr: string, a: number, b: number, h: number) {
  const d = maxAbsDerivative(fxExpr, 2, a, b);
  const bound = ((b - a) * h * h / 24) * d.max;
  return { bound, max: d.max, xAtMax: d.xAtMax, derivativeExpr: d.derivativeExpr, order: 2 };
}

export function simpson13Error(fxExpr: string, a: number, b: number, h: number) {
  const d = maxAbsDerivative(fxExpr, 4, a, b);
  const bound = ((b - a) * Math.pow(h, 4) / 180) * d.max;
  return { bound, max: d.max, xAtMax: d.xAtMax, derivativeExpr: d.derivativeExpr, order: 4 };
}

export function simpson38Error(fxExpr: string, a: number, b: number, h: number) {
  const d = maxAbsDerivative(fxExpr, 4, a, b);
  const bound = ((b - a) * Math.pow(h, 4) / 80) * d.max;
  return { bound, max: d.max, xAtMax: d.xAtMax, derivativeExpr: d.derivativeExpr, order: 4 };
}

/**
 * Build a convergence panel for composite integration methods.
 * Runs the quadrature for a series of n values (typically doubling) and shows
 * all relevant error types in a table: |ΔI|, ε_rel, ε_rel %, cifras sig,
 * y si hay valor exacto, también vs exacto.
 */
/**
 * Panel HTML con la tabla de la formula de cuadratura evaluada punto por punto
 * al n final (coeficientes, contribuciones y suma total × prefactor = integral).
 */
export function renderPerPointBreakdownPanel(opts: {
  methodName: string;
  n: number;
  h: number;
  prefactor: number;
  prefactorLabel: string;
  integral: number;
  points: { i: number; xi: number; fxi: number; coeff: number; contrib: number }[];
}): string {
  const { methodName, n, h, prefactor, prefactorLabel, integral, points } = opts;
  const rows = points.map(p => `
    <tr>
      <td>${p.i}</td>
      <td>${fmtNum(p.xi, 8)}</td>
      <td>${fmtNum(p.fxi, 8)}</td>
      <td>${p.coeff}</td>
      <td>${fmtNum(p.contrib, 8)}</td>
    </tr>
  `).join('');
  const sum = points.reduce((s, p) => s + p.contrib, 0);
  return `
    <div class="theorem-panel theorem-pass">
      <div class="theorem-header"><span class="theorem-icon">Σ</span> Desglose por puntos — ${methodName} (n = ${n})</div>
      <div class="theorem-body">
        <div>Paso <code>h = ${fmtNum(h, 8)}</code>. Formula: <code>I ≈ ${prefactorLabel} · Σ c_i · f(x_i)</code>.</div>
        <div class="iter-table-wrap" style="margin-top:8px">
          <table class="iter-table">
            <thead>
              <tr><th>i</th><th>x_i</th><th>f(x_i)</th><th>c_i</th><th>c_i · f(x_i)</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="margin-top:6px">
          <code>Σ c_i · f(x_i) = ${fmtNum(sum, 8)}</code> &nbsp; ⇒ &nbsp;
          <code>I = ${prefactorLabel} · Σ = ${fmtNum(prefactor, 8)} · ${fmtNum(sum, 8)} = ${fmtNum(integral, 10)}</code>
        </div>
      </div>
    </div>
  `;
}

/**
 * Panel paso a paso para el error de truncamiento evaluado en un ξ fijo.
 * Aplicable a las reglas de cuadratura cuyo error local tiene la forma:
 *   E = sign · (b-a) · h^p / K · f^(order)(ξ)
 * con order = 2 (trapecio, punto medio) o order = 4 (Simpson 1/3, 3/8).
 */
export function renderIntegrationTruncationAtXi(opts: {
  methodName: string;
  fxExpr: string;
  a: number;
  b: number;
  h: number;
  n: number;
  xi: number;
  order: 2 | 4;
  denom: number;
  sign: '+' | '-';
}): string {
  const { methodName, fxExpr, a, b, h, n, xi, order, denom, sign } = opts;
  if (!isFinite(xi)) return '';

  if (xi < Math.min(a, b) || xi > Math.max(a, b)) {
    return `
      <div class="theorem-panel theorem-fail">
        <div class="theorem-header"><span class="theorem-icon">ξ</span> Error de truncamiento en ξ — ${methodName}</div>
        <div class="theorem-body">
          <div>El valor <code>ξ = ${xi}</code> no pertenece al intervalo <code>[${a}, ${b}]</code>. El teorema del resto exige <code>ξ ∈ (a, b)</code>.</div>
        </div>
      </div>
    `;
  }

  const { value: fnAtXi, derivativeExpr } = evaluateDerivativeAt(fxExpr, order, xi);
  const orderLatex = order === 2 ? "f''" : 'f^{(4)}';
  const hExpLatex = order === 2 ? 'h^{2}' : 'h^{4}';
  const generalFormulaLatex =
    order === 2
      ? `E = ${sign === '-' ? '-' : ''}\\frac{(b-a)\\,h^{2}}{${denom}}\\, f''(\\xi), \\quad \\xi \\in (a, b)`
      : `E = ${sign === '-' ? '-' : ''}\\frac{(b-a)\\,h^{4}}{${denom}}\\, f^{(4)}(\\xi), \\quad \\xi \\in (a, b)`;

  if (!isFinite(fnAtXi)) {
    return `
      <div class="theorem-panel theorem-fail">
        <div class="theorem-header"><span class="theorem-icon">ξ</span> Error de truncamiento en ξ = ${xi} — ${methodName}</div>
        <div class="theorem-body">
          <div><b>Formula general:</b></div>
          ${texBlock(generalFormulaLatex)}
          <div>No se pudo evaluar ${orderLatex}(ξ) en ξ = ${xi} (posible singularidad o derivada no disponible).</div>
          ${derivativeExpr ? `<div>Derivada obtenida: <code>${orderLatex.replace(/[{}]/g, '')}(x) = ${derivativeExpr}</code></div>` : ''}
        </div>
      </div>
    `;
  }

  const ba = b - a;
  const hp = Math.pow(h, order);
  const prefactor = (ba * hp) / denom;
  const signMul = sign === '-' ? -1 : 1;
  const signedE = signMul * prefactor * fnAtXi;
  const absE = Math.abs(signedE);

  const derivativeLine = derivativeExpr
    ? `${texBlock(`${orderLatex}(x) = ${derivativeExpr.replace(/\*/g, '\\cdot ')}`)}`
    : `<div><em>No se pudo derivar simbolicamente; se uso diferenciacion numerica.</em></div>`;

  const evalLine = `${orderLatex}(${fmtNum(xi, 6)}) = ${fmtNum(fnAtXi, 8)}`;
  const plugInLatex =
    order === 2
      ? `E = ${sign === '-' ? '-' : ''}\\frac{(${fmtNum(ba, 6)})\\,(${fmtNum(h, 6)})^{2}}{${denom}}\\,(${fmtNum(fnAtXi, 6)}) = ${fmtNum(signedE, 8)}`
      : `E = ${sign === '-' ? '-' : ''}\\frac{(${fmtNum(ba, 6)})\\,(${fmtNum(h, 6)})^{4}}{${denom}}\\,(${fmtNum(fnAtXi, 6)}) = ${fmtNum(signedE, 8)}`;

  return `
    <div class="theorem-panel theorem-pass">
      <div class="theorem-header"><span class="theorem-icon">ξ</span> Error de truncamiento en ξ = ${fmtNum(xi, 6)} — ${methodName}</div>
      <div class="theorem-body">
        <div><b>Formula general</b> (teorema del resto para ${methodName}):</div>
        ${texBlock(generalFormulaLatex)}
        <div><b>Datos:</b> <code>f(x) = ${fxExpr}</code>, <code>a = ${fmtNum(a, 6)}</code>, <code>b = ${fmtNum(b, 6)}</code>, <code>n = ${n}</code>, <code>h = (b-a)/n = ${fmtNum(h, 8)}</code>.</div>

        <div style="margin-top:10px"><b>Paso 1 — Derivar ${order} veces y evaluar en ξ</b></div>
        ${derivativeLine}
        ${texBlock(evalLine)}

        <div style="margin-top:10px"><b>Paso 2 — Reemplazar en la formula del error</b></div>
        ${texBlock(plugInLatex)}

        <div style="margin-top:10px"><b>Paso 3 — Cota del error en ese punto</b></div>
        ${texBlock(`|E| = ${fmtNum(absE, 8)}`)}

        <div class="result-highlight result-local">
          <div class="result-label">Error de truncamiento en ξ = ${fmtNum(xi, 6)}</div>
          <div class="result-value">E ≈ ${fmtNum(signedE, 8)}</div>
          <div class="result-label" style="margin-top:4px">|E| ≈ ${fmtNum(absE, 8)}</div>
        </div>

        <div style="margin-top:8px; font-size:0.85rem; color: var(--subtext0);">
          El signo proviene de la formula teorica; lo que se reporta como <b>cota</b> siempre es <code>|E|</code>. Compara este valor contra la <b>cota global</b> (peor caso sobre todo el intervalo) que ya aparece en el resumen.
        </div>
      </div>
    </div>
  `;
}

export function renderIntegrationConvergencePanel(
  methodName: string,
  a: number,
  b: number,
  nValues: number[],
  quadrature: (n: number) => number,
  exact: number | undefined,
): string {
  type Row = {
    n: number; h: number; integral: number;
    dI: number | null; errRel: number | null; errRelPct: number | null;
    errAbsEx: number | null; errRelEx: number | null; errRelPctEx: number | null;
    sigDigits: number | null;
  };
  const rows: Row[] = [];
  let prevI: number | null = null;
  for (const n of nValues) {
    const I = quadrature(n);
    if (!isFinite(I)) continue;
    const h = (b - a) / n;
    const dI = prevI === null ? null : Math.abs(I - prevI);
    const errRel = (prevI === null || Math.abs(I) < 1e-14) ? null : (dI! / Math.abs(I));
    const errRelPct = errRel === null ? null : errRel * 100;
    let errAbsEx: number | null = null;
    let errRelEx: number | null = null;
    let errRelPctEx: number | null = null;
    let sigDigits: number | null = null;
    if (exact !== undefined && isFinite(exact)) {
      errAbsEx = Math.abs(I - exact);
      const denom = Math.abs(exact) > 1e-14 ? Math.abs(exact) : Math.abs(I);
      errRelEx = denom === 0 ? 0 : errAbsEx / denom;
      errRelPctEx = errRelEx * 100;
      if (errRelEx > 0 && errRelEx < 1) {
        const d = Math.floor(-Math.log10(2 * errRelEx));
        sigDigits = d >= 0 ? d : null;
      }
    }
    rows.push({ n, h, integral: I, dI, errRel, errRelPct, errAbsEx, errRelEx, errRelPctEx, sigDigits });
    prevI = I;
  }

  const hasExact = exact !== undefined && isFinite(exact);
  const fmt = (v: number | null, digits = 8) => v === null ? '—' : (isFinite(v) ? v.toPrecision(digits) : '—');

  const exactCols = hasExact
    ? `<th>|I<sub>n</sub> − exacto|</th><th>ε<sub>rel</sub> vs exacto</th><th>ε<sub>rel</sub> % vs exacto</th><th>Cifras sig.</th>`
    : '';

  const tableRows = rows.map(r => `
    <tr>
      <td>${r.n}</td>
      <td>${fmt(r.h, 6)}</td>
      <td>${fmt(r.integral)}</td>
      <td>${fmt(r.dI)}</td>
      <td>${fmt(r.errRel)}</td>
      <td>${fmt(r.errRelPct, 6)}</td>
      ${hasExact ? `<td>${fmt(r.errAbsEx)}</td><td>${fmt(r.errRelEx)}</td><td>${fmt(r.errRelPctEx, 6)}</td><td>${r.sigDigits === null ? '—' : r.sigDigits}</td>` : ''}
    </tr>
  `).join('');

  return `
    <div class="theorem-panel theorem-pass">
      <div class="theorem-header"><span class="theorem-icon">Δ</span> Convergencia y tipos de error — ${methodName}</div>
      <div class="theorem-body">
        <div>Se repite la cuadratura duplicando <code>n</code>. Entre estimaciones sucesivas se calculan los errores <b>sin conocer el exacto</b>. Si ingresás valor exacto, tambien se comparan contra el.</div>
        <div class="iter-table-wrap" style="margin-top:8px">
          <table class="iter-table">
            <thead>
              <tr>
                <th>n</th>
                <th>h</th>
                <th>I<sub>n</sub></th>
                <th>|I<sub>n</sub> − I<sub>n/2</sub>|</th>
                <th>ε<sub>rel</sub></th>
                <th>ε<sub>rel</sub> %</th>
                ${exactCols}
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
        <div style="margin-top:6px; font-size:0.85rem; color: var(--subtext0);">
          <b>|I<sub>n</sub> − I<sub>n/2</sub>|</b>: error absoluto entre estimaciones sucesivas (se usa como criterio de parada cuando no hay exacto).
          <b>ε<sub>rel</sub></b> = |ΔI| / |I<sub>n</sub>|. <b>ε<sub>rel</sub> %</b> = ε<sub>rel</sub> × 100.
          ${hasExact ? '<b>vs exacto</b>: |I<sub>n</sub> − exacto|, su fraccion y %. <b>Cifras sig.</b> = cifras significativas correctas respecto al exacto.' : ''}
        </div>
      </div>
    </div>
  `;
}
