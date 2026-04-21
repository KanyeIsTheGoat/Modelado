/**
 * Global precision formatter. Solo modo por decimales.
 * Exams request precisions like 4/6/8 decimals.
 *
 * IMPORTANT: Never emits scientific (e-notation) output. Very small numbers are
 * rendered with enough decimals to be legible; use `formatFull()` for the full
 * precision string (intended for tooltips).
 */

export type PrecisionMode =
  | 'decimals-4'
  | 'decimals-6'
  | 'decimals-8'
  | 'decimals-10';

const STORAGE_KEY = 'modelado.precision';
const DEFAULT_MODE: PrecisionMode = 'decimals-6';

export function getPrecisionMode(): PrecisionMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && isValidMode(v)) return v as PrecisionMode;
  } catch { /* ignore */ }
  return DEFAULT_MODE;
}

export function setPrecisionMode(mode: PrecisionMode): void {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
}

function isValidMode(v: string): boolean {
  return ['decimals-4', 'decimals-6', 'decimals-8', 'decimals-10'].includes(v);
}

export function parseMode(mode: PrecisionMode): { kind: 'decimals'; n: number } {
  const [kind, nStr] = mode.split('-');
  return { kind: kind as 'decimals', n: parseInt(nStr, 10) };
}

/**
 * Convierte una cadena tipo "1.23e-7" producida por toString/toPrecision
 * en notacion decimal plana: "0.000000123".
 */
function stripExponent(s: string): string {
  if (!/e/i.test(s)) return s;
  const n = Number(s);
  if (!isFinite(n) || isNaN(n)) return s;
  return decimalString(n, 20);
}

/**
 * Convierte un numero a cadena decimal plana con hasta `maxFrac` decimales,
 * recortando ceros finales. Nunca usa notacion cientifica.
 */
function decimalString(n: number, maxFrac: number): string {
  if (n === 0) return '0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  // toFixed admite hasta 100 decimales en la mayoria de runtimes
  const cap = Math.min(Math.max(maxFrac, 1), 100);
  let s = abs.toFixed(cap);
  if (s.indexOf('.') >= 0) {
    s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  return sign + (s === '' || s === '-' ? '0' : s);
}

/**
 * Formatea un numero segun la precision activa (decimales). Nunca emite
 * notacion cientifica.
 */
export function formatNum(n: number, mode?: PrecisionMode): string {
  if (n === null || n === undefined || Number.isNaN(n)) return String(n);
  if (!isFinite(n)) return n > 0 ? '∞' : '-∞';

  const m = mode ?? getPrecisionMode();
  const { n: prec } = parseMode(m);
  const abs = Math.abs(n);

  // Si el valor es muy pequeño, mostramos suficientes decimales para que
  // se vea el numero, sin notacion cientifica.
  if (abs !== 0 && abs < Math.pow(10, -prec)) {
    const needed = Math.ceil(-Math.log10(abs)) + prec - 1;
    return decimalString(n, Math.min(needed, 20));
  }
  return decimalString(n, prec);
}

/**
 * Formatea el numero con la maxima precision posible (uso: tooltip `title=...`).
 * Siempre en notacion decimal plana, sin exponentes.
 */
export function formatFull(n: number): string {
  if (n === null || n === undefined || Number.isNaN(n)) return String(n);
  if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
  if (n === 0) return '0';
  // 17 digitos significativos preservan la precision IEEE 754; luego lo
  // convertimos a decimal plana.
  return stripExponent(n.toPrecision(17));
}

export function precisionModeLabel(mode: PrecisionMode): string {
  const { n } = parseMode(mode);
  return `${n} decimales`;
}

export const ALL_PRECISION_MODES: PrecisionMode[] = [
  'decimals-4', 'decimals-6', 'decimals-8', 'decimals-10',
];
