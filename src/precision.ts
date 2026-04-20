/**
 * Global precision formatter. Supports decimal-places and significant-figures modes.
 * Exams request specific precisions: 4/6/8 decimals or 6/8 cifras significativas.
 */

export type PrecisionMode =
  | 'decimals-4'
  | 'decimals-6'
  | 'decimals-8'
  | 'decimals-10'
  | 'sig-4'
  | 'sig-6'
  | 'sig-8';

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
  return [
    'decimals-4', 'decimals-6', 'decimals-8', 'decimals-10',
    'sig-4', 'sig-6', 'sig-8',
  ].includes(v);
}

export function parseMode(mode: PrecisionMode): { kind: 'decimals' | 'sig'; n: number } {
  const [kind, nStr] = mode.split('-');
  return { kind: kind as 'decimals' | 'sig', n: parseInt(nStr, 10) };
}

/**
 * Format a number using the active precision mode.
 * Falls back to scientific notation for very small/large magnitudes when using decimals.
 */
export function formatNum(n: number, mode?: PrecisionMode): string {
  if (n === null || n === undefined || isNaN(n)) return String(n);
  if (!isFinite(n)) return n > 0 ? '∞' : '-∞';

  const m = mode ?? getPrecisionMode();
  const { kind, n: prec } = parseMode(m);

  const abs = Math.abs(n);

  if (kind === 'sig') {
    return n.toPrecision(prec);
  }

  // decimals mode — but use scientific for tiny or huge values to avoid 0.00000000
  if (abs !== 0 && (abs < Math.pow(10, -prec) || abs >= 1e6)) {
    return n.toExponential(prec);
  }
  return n.toFixed(prec);
}

export function precisionModeLabel(mode: PrecisionMode): string {
  const { kind, n } = parseMode(mode);
  return kind === 'decimals' ? `${n} decimales` : `${n} cifras sig.`;
}

export const ALL_PRECISION_MODES: PrecisionMode[] = [
  'decimals-4', 'decimals-6', 'decimals-8', 'decimals-10',
  'sig-4', 'sig-6', 'sig-8',
];
