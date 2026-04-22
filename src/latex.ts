import katex from 'katex';
import { create, all } from 'mathjs';
import { registerMathAliases } from './mathAliases';

const math = create(all);
registerMathAliases(math);

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
 * Format a number nicely as LaTeX. Nunca usa notacion cientifica.
 */
export function renderNumber(n: number, precision: number = 10): string {
  if (!isFinite(n)) return texInline(n > 0 ? '\\infty' : '-\\infty');
  if (isNaN(n)) return texInline('\\text{NaN}');
  if (n === 0) return texInline('0');

  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  // Construye una cadena decimal plana con hasta 20 decimales; recorta ceros.
  let s: string;
  if (abs < Math.pow(10, -precision)) {
    const needed = Math.ceil(-Math.log10(abs)) + precision - 1;
    s = abs.toFixed(Math.min(needed, 20));
  } else {
    s = abs.toPrecision(precision);
    if (/e/i.test(s)) s = abs.toFixed(20);
  }
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return texInline(sign + s);
}

// Note: LaTeX formulas for each method now live on `MethodDefinition.latexFormula`
// in each method's own file (see src/methods/**/*.ts).
