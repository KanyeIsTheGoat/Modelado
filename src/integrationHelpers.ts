import { create, all, MathNode } from 'mathjs';
import { parseExpression, linspace } from './parser';

const math = create(all);

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
