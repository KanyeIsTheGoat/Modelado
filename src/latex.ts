import katex from 'katex';
import { create, all } from 'mathjs';

const math = create(all);

/**
 * Render a LaTeX string to HTML using KaTeX.
 * Returns an HTML string with rendered math.
 */
export function tex(latex: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      trust: true,
    });
  } catch {
    return `<span style="color:var(--red)">${latex}</span>`;
  }
}

/**
 * Render inline math: $...$
 */
export function texInline(latex: string): string {
  return tex(latex, false);
}

/**
 * Render display math (centered, larger)
 */
export function texBlock(latex: string): string {
  return tex(latex, true);
}

/**
 * Convert a math.js expression string to LaTeX.
 */
export function exprToTex(expr: string): string {
  try {
    const node = math.parse(expr);
    return node.toTex({ parenthesis: 'auto' });
  } catch {
    return expr;
  }
}

/**
 * Render a math expression string as inline KaTeX HTML.
 * Parses with math.js → LaTeX → KaTeX render.
 */
export function renderExpr(expr: string): string {
  return texInline(exprToTex(expr));
}

/**
 * Render a math expression string as display (block) KaTeX HTML.
 */
export function renderExprBlock(expr: string): string {
  return texBlock(exprToTex(expr));
}

/**
 * Format a number nicely as LaTeX.
 */
export function renderNumber(n: number, precision: number = 10): string {
  if (!isFinite(n)) return texInline(n > 0 ? '\\infty' : '-\\infty');
  if (isNaN(n)) return texInline('\\text{NaN}');

  // Scientific notation for very small/large
  if (Math.abs(n) < 1e-4 && n !== 0 || Math.abs(n) >= 1e6) {
    const exp = Math.floor(Math.log10(Math.abs(n)));
    const mantissa = n / Math.pow(10, exp);
    return texInline(`${mantissa.toPrecision(6)} \\times 10^{${exp}}`);
  }

  return texInline(n.toPrecision(precision));
}

/**
 * Build a LaTeX formula string for common method formulas.
 */
export const FORMULAS: Record<string, string> = {
  bisection: 'c = \\frac{a + b}{2}',
  fixedPoint: 'x_{n+1} = g(x_n)',
  newtonRaphson: "x_{n+1} = x_n - \\frac{f(x_n)}{f'(x_n)}",
  secant: 'x_{n+1} = x_n - f(x_n) \\cdot \\frac{x_n - x_{n-1}}{f(x_n) - f(x_{n-1})}',
  falsePosition: 'c = a - f(a) \\cdot \\frac{b - a}{f(b) - f(a)}',
  aitken: '\\hat{x}_n = x_n - \\frac{(x_{n+1} - x_n)^2}{x_{n+2} - 2x_{n+1} + x_n}',

  midpoint: '\\int_a^b f(x)\\,dx \\approx (b-a) \\cdot f\\!\\left(\\frac{a+b}{2}\\right)',
  trapezoidal: '\\int_a^b f(x)\\,dx \\approx \\frac{b-a}{2}\\left[f(a) + f(b)\\right]',
  trapezoidalComp: '\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\left[f(a) + 2\\sum f(x_i) + f(b)\\right]',
  simpson13: '\\int_a^b f(x)\\,dx \\approx \\frac{b-a}{6}\\left[f(a) + 4f(m) + f(b)\\right]',
  simpson13Comp: '\\int_a^b f(x)\\,dx \\approx \\frac{h}{3}\\left[f(x_0) + 4f(x_1) + 2f(x_2) + \\cdots + f(x_n)\\right]',
  simpson38: '\\int_a^b f(x)\\,dx \\approx \\frac{b-a}{8}\\left[f(a) + 3f(x_1) + 3f(x_2) + f(b)\\right]',
  simpson38Comp: '\\int_a^b f(x)\\,dx \\approx \\frac{3h}{8}\\left[f(x_0) + 3f(x_1) + 3f(x_2) + 2f(x_3) + \\cdots\\right]',
  montecarlo: '\\int_a^b f(x)\\,dx \\approx \\frac{b-a}{N} \\sum_{i=1}^{N} f(x_i), \\quad x_i \\sim U(a,b)',
  montecarloPi: '\\pi \\approx 4 \\cdot \\frac{\\#\\{x^2+y^2 \\le 1\\}}{N}, \\quad (x,y) \\sim U([-1,1]^2)',

  euler: 'y_{n+1} = y_n + h \\cdot f(x_n, y_n)',
  heun: 'y_{n+1} = y_n + \\frac{h}{2}\\left[f(x_n, y_n) + f(x_{n+1}, \\tilde{y}_{n+1})\\right]',
  rungeKutta: 'y_{n+1} = y_n + \\frac{h}{6}(k_1 + 2k_2 + 2k_3 + k_4)',

  forward: "f'(x) \\approx \\frac{f(x+h) - f(x)}{h}",
  backward: "f'(x) \\approx \\frac{f(x) - f(x-h)}{h}",
  central: "f'(x) \\approx \\frac{f(x+h) - f(x-h)}{2h}",
  secondDerivative: "f''(x) \\approx \\frac{f(x+h) - 2f(x) + f(x-h)}{h^2}",
  richardson: "D = \\frac{4D(h/2) - D(h)}{3}",
};
