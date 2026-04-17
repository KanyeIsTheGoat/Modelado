import { create, all, MathNode } from 'mathjs';

const math = create(all);

// Compile and cache expressions for performance
const cache = new Map<string, (scope: Record<string, number>) => number>();

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
    const result = fn({ x, e: Math.E, pi: Math.PI });
    if (typeof result !== 'number' || !isFinite(result)) return NaN;
    return result;
  };
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
