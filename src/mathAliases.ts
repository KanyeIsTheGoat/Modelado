import type { MathJsInstance } from 'mathjs';

/**
 * Registra aliases de nombres de funciones que mathjs no trae por defecto
 * pero que aparecen en la notacion matematica de los parciales.
 *   - ln(x)     -> logaritmo natural (mathjs usa log(x); ln es mas familiar).
 *   - arctan/arcsin/arccos -> alias de atan/asin/acos.
 *   - sen(x)    -> alias de sin(x) (notacion espanola).
 * Llamar una sola vez por cada instancia de math que evalue expresiones del usuario.
 */
export function registerMathAliases(math: MathJsInstance): void {
  math.import(
    {
      ln: (x: number) => Math.log(x),
      arctan: (x: number) => Math.atan(x),
      arcsin: (x: number) => Math.asin(x),
      arccos: (x: number) => Math.acos(x),
      sen: (x: number) => Math.sin(x),
    },
    { override: false },
  );
}
