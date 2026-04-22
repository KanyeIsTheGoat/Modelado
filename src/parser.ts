import { create, all, MathNode } from 'mathjs';
import { registerMathAliases } from './mathAliases';

const math = create(all);
registerMathAliases(math);

// Compile and cache expressions for performance
const cache = new Map<string, (scope: Record<string, number>) => number>();

/**
 * Intenta hallar el limite numerico de fn en x via muestreo simetrico (L'Hopital numerico).
 * Si los limites izquierdo y derecho coinciden razonablemente, devuelve su promedio.
 * Si solo uno existe (p.ej. dominio), devuelve ese. Si no, devuelve NaN.
 */
function numericalLimit(
  fn: (scope: Record<string, number>) => number,
  x: number,
): number {
  // Epsilons en escala relativa al punto; si x=0, usamos valores absolutos pequenos.
  const scale = Math.max(Math.abs(x), 1);
  const eps = [1e-6 * scale, 1e-8 * scale, 1e-10 * scale];
  for (const e of eps) {
    let left: number | null = null;
    let right: number | null = null;
    try {
      const lv = fn({ x: x - e, e: Math.E, pi: Math.PI });
      if (typeof lv === 'number' && isFinite(lv)) left = lv;
    } catch {}
    try {
      const rv = fn({ x: x + e, e: Math.E, pi: Math.PI });
      if (typeof rv === 'number' && isFinite(rv)) right = rv;
    } catch {}
    if (left !== null && right !== null) {
      const scale2 = Math.max(Math.abs(left), Math.abs(right), 1);
      if (Math.abs(left - right) / scale2 < 1e-3) return (left + right) / 2;
    } else if (right !== null) {
      return right;
    } else if (left !== null) {
      return left;
    }
  }
  return NaN;
}

export function parseExpression(expr: string): (x: number) => number {
  const key = expr.trim();
  if (!cache.has(key)) {
    try {
      const compiled = math.compile(key);
      cache.set(key, (scope) => compiled.evaluate(scope) as number);
    } catch (e: any) {
      throw new Error(`Error de sintaxis en "${expr}": ${e.message}`);
    }
  }
  const fn = cache.get(key)!;
  return (x: number) => {
    let result: number;
    try {
      result = fn({ x, e: Math.E, pi: Math.PI });
    } catch {
      return numericalLimit(fn, x);
    }
    if (typeof result === 'number' && isFinite(result)) return result;
    return numericalLimit(fn, x);
  };
}

/**
 * Evalua una expresion en x y reporta si se uso el limite numerico (L'Hopital).
 * Util para mostrar al usuario cuando hay una singularidad removible.
 */
export interface EvalInfo {
  value: number;
  usedLimit: boolean;
  directValue: number;
  leftLimit: number;
  rightLimit: number;
}

export function evaluateAt(expr: string, x: number): EvalInfo {
  const key = expr.trim();
  if (!cache.has(key)) {
    try {
      const compiled = math.compile(key);
      cache.set(key, (scope) => compiled.evaluate(scope) as number);
    } catch (e: any) {
      throw new Error(`Error de sintaxis en "${expr}": ${e.message}`);
    }
  }
  const fn = cache.get(key)!;
  let direct = NaN;
  try {
    const r = fn({ x, e: Math.E, pi: Math.PI });
    if (typeof r === 'number') direct = r;
  } catch {}
  const scale = Math.max(Math.abs(x), 1);
  const eps = 1e-8 * scale;
  let left = NaN, right = NaN;
  try {
    const lv = fn({ x: x - eps, e: Math.E, pi: Math.PI });
    if (typeof lv === 'number') left = lv;
  } catch {}
  try {
    const rv = fn({ x: x + eps, e: Math.E, pi: Math.PI });
    if (typeof rv === 'number') right = rv;
  } catch {}
  if (isFinite(direct)) {
    return { value: direct, usedLimit: false, directValue: direct, leftLimit: left, rightLimit: right };
  }
  const limit = numericalLimit(fn, x);
  return { value: limit, usedLimit: isFinite(limit), directValue: direct, leftLimit: left, rightLimit: right };
}

export function evalExpr(expr: string, x: number): number {
  return parseExpression(expr)(x);
}

// Generate x values for plotting
export function linspace(a: number, b: number, n: number = 500): number[] {
  const step = (b - a) / (n - 1);
  return Array.from({ length: n }, (_, i) => a + i * step);
}

// Parse a two-variable expression f(x, y) — used by ODE solvers
const cache2 = new Map<string, (scope: Record<string, number>) => number>();

export function parseExpression2(expr: string): (x: number, y: number) => number {
  const key = expr.trim();
  if (!cache2.has(key)) {
    try {
      const compiled = math.compile(key);
      cache2.set(key, (scope) => compiled.evaluate(scope) as number);
    } catch (e: any) {
      throw new Error(`Error de sintaxis en "${expr}": ${e.message}`);
    }
  }
  const fn = cache2.get(key)!;
  return (x: number, y: number) => {
    const result = fn({ x, y, e: Math.E, pi: Math.PI });
    if (typeof result !== 'number' || !isFinite(result)) return NaN;
    return result;
  };
}

// Numerical derivative using central difference
export function numericalDerivative(f: (x: number) => number, x: number, h: number = 1e-8): number {
  return (f(x + h) - f(x - h)) / (2 * h);
}

/**
 * Evaluate a math expression to a scalar number.
 * Used by the "normal" (arithmetic) calculator mode.
 * Supports all math.js functions: sin, cos, log, sqrt, !, factorials, etc.
 * Constants e and pi are pre-loaded.
 */
/**
 * Parses a user-provided numeric input that may be a number ("1.5"), a constant
 * ("pi", "e"), or an expression ("pi/4", "2*pi", "sqrt(2)"). Returns NaN on
 * failure instead of throwing — use when gating with isNaN().
 */
export function parseScalar(raw: string | undefined | null): number {
  if (raw === undefined || raw === null) return NaN;
  const s = raw.trim();
  if (!s) return NaN;
  const direct = parseFloat(s);
  if (!isNaN(direct) && /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return direct;
  try {
    return evaluateScalar(s);
  } catch {
    return NaN;
  }
}

export function evaluateScalar(expr: string): number {
  const raw = expr.trim();
  if (!raw) throw new Error('Expresion vacia');
  try {
    const compiled = math.compile(raw);
    const result = compiled.evaluate({ e: Math.E, pi: Math.PI });
    if (typeof result !== 'number') {
      if (result && typeof (result as any).toNumber === 'function') {
        return (result as any).toNumber();
      }
      if (result && typeof (result as any).re === 'number') {
        throw new Error('El resultado es un numero complejo');
      }
      throw new Error('El resultado no es un numero');
    }
    if (!isFinite(result)) throw new Error('Resultado no finito (division por cero o desbordamiento)');
    return result;
  } catch (e: any) {
    throw new Error(e.message || 'Error al evaluar la expresion');
  }
}
