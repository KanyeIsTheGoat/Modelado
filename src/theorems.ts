import { parseExpression, numericalDerivative, linspace } from './parser';
import { formatNum } from './precision';

export interface BolzanoResult {
  passes: boolean;
  fa: number;
  fb: number;
  product: number;
  message: string;
}

/**
 * Teorema de Bolzano: si f es continua en [a,b] y f(a)·f(b) < 0, existe al menos
 * una raiz en (a,b). This function does not verify continuity — it assumes continuity
 * of the parsed expression on the interval and checks the sign-change condition.
 */
export function checkBolzano(fxExpr: string, a: number, b: number): BolzanoResult {
  const f = parseExpression(fxExpr);
  const fa = f(a);
  const fb = f(b);
  const product = fa * fb;
  const passes = isFinite(fa) && isFinite(fb) && product < 0;
  let message: string;
  if (!isFinite(fa) || !isFinite(fb)) {
    message = `f(a) o f(b) no son finitos — revisar dominio o expresion.`;
  } else if (product < 0) {
    message = `f(${a})·f(${b}) = ${formatNum(product)} < 0 → existe al menos una raiz en (${a}, ${b}).`;
  } else if (product === 0) {
    message = `f(${a})·f(${b}) = 0 → uno de los extremos es raiz exacta.`;
  } else {
    message = `f(${a})·f(${b}) = ${formatNum(product)} > 0 → Bolzano no garantiza raiz.`;
  }
  return { passes, fa, fb, product, message };
}

export interface LipschitzResult {
  passes: boolean;
  maxAbsDerivative: number;
  samples: number;
  xAtMax: number;
  message: string;
}

/**
 * Condicion de Lipschitz para contraccion: |g'(x)| ≤ L < 1 en [a,b].
 * Si L < 1, g es contractiva y el punto fijo converge. Aproxima el maximo de
 * |g'(x)| por muestreo denso y derivada central numerica.
 */
export function checkLipschitz(
  gxExpr: string,
  a: number,
  b: number,
  nSamples: number = 400,
): LipschitzResult {
  const g = parseExpression(gxExpr);
  const xs = linspace(a, b, nSamples);
  let maxAbs = 0;
  let xAtMax = a;
  for (const x of xs) {
    const gp = numericalDerivative(g, x);
    if (isFinite(gp) && Math.abs(gp) > maxAbs) {
      maxAbs = Math.abs(gp);
      xAtMax = x;
    }
  }
  const passes = maxAbs < 1;
  const message = passes
    ? `max |g'(x)| ≈ ${formatNum(maxAbs)} en x ≈ ${formatNum(xAtMax)} < 1 → g es contractiva (Lipschitz con L = ${formatNum(maxAbs)}).`
    : `max |g'(x)| ≈ ${formatNum(maxAbs)} en x ≈ ${formatNum(xAtMax)} ≥ 1 → no se garantiza contraccion; la iteracion puede divergir.`;
  return { passes, maxAbsDerivative: maxAbs, samples: nSamples, xAtMax, message };
}

/**
 * HTML panel for the Bolzano verification result.
 */
export function renderBolzanoPanel(result: BolzanoResult): string {
  const statusClass = result.passes ? 'theorem-pass' : 'theorem-fail';
  const icon = result.passes ? '✓' : '✗';
  return `
    <div class="theorem-panel ${statusClass}">
      <div class="theorem-header"><span class="theorem-icon">${icon}</span> Teorema de Bolzano</div>
      <div class="theorem-body">
        <div>f(a) = ${formatNum(result.fa)}, f(b) = ${formatNum(result.fb)}</div>
        <div>f(a) · f(b) = ${formatNum(result.product)}</div>
        <div class="theorem-message">${result.message}</div>
      </div>
    </div>
  `;
}

/**
 * HTML panel for the Lipschitz verification result.
 */
export function renderLipschitzPanel(result: LipschitzResult): string {
  const statusClass = result.passes ? 'theorem-pass' : 'theorem-fail';
  const icon = result.passes ? '✓' : '✗';
  return `
    <div class="theorem-panel ${statusClass}">
      <div class="theorem-header"><span class="theorem-icon">${icon}</span> Condicion de Lipschitz (contraccion)</div>
      <div class="theorem-body">
        <div>max |g'(x)| ≈ ${formatNum(result.maxAbsDerivative)} (muestreo ${result.samples} puntos)</div>
        <div>x del maximo ≈ ${formatNum(result.xAtMax)}</div>
        <div class="theorem-message">${result.message}</div>
      </div>
    </div>
  `;
}
