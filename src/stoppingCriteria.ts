/**
 * Criterios de parada unificados para metodos iterativos.
 * Soporta multiples criterios combinados: se detiene cuando TODOS se cumplen.
 *
 * Tipos soportados:
 *   - err_abs:            |x_{n+1} - x_n| < value
 *   - err_rel:            |x_{n+1} - x_n| / |x_{n+1}| < value      (fraccion)
 *   - err_rel_pct:        (|x_{n+1} - x_n| / |x_{n+1}|) * 100 < value   (porcentaje)
 *   - cifras_sig:         Scarborough — err_rel_pct < 0.5 * 10^(2 - n)
 *   - tolerancia:         alias de err_abs (mismo comportamiento)
 *
 *   Frente al valor exacto (requieren que el metodo conozca el exacto):
 *   - err_abs_exact:      |x_n - exacto| < value
 *   - err_rel_exact:      |x_n - exacto| / |exacto| < value  (fraccion)
 *   - err_rel_pct_exact:  (|x_n - exacto| / |exacto|) * 100 < value  (porcentaje)
 */

export type StopCriterionKind =
  | 'err_abs'
  | 'err_rel'
  | 'err_rel_pct'
  | 'cifras_sig'
  | 'tolerancia'
  | 'err_abs_exact'
  | 'err_rel_exact'
  | 'err_rel_pct_exact';

export interface StopConfig {
  kind: StopCriterionKind;
  value: number;
}

/** Lista de criterios combinados con AND. */
export type StopConfigList = StopConfig[];

export const STOP_CRITERION_LABELS: Record<StopCriterionKind, string> = {
  tolerancia: 'Tolerancia',
  err_abs: 'Error absoluto',
  err_rel: 'Error relativo (fraccion)',
  err_rel_pct: 'Error relativo %',
  cifras_sig: 'Cifras significativas',
  err_abs_exact: 'Error absoluto vs exacto',
  err_rel_exact: 'Error relativo vs exacto (fraccion)',
  err_rel_pct_exact: 'Error relativo vs exacto %',
};

export const STOP_CRITERION_HINTS: Record<StopCriterionKind, string> = {
  tolerancia: 'Para cuando |x_{n+1} - x_n| < valor. Ej: 1e-6',
  err_abs: 'Para cuando |x_{n+1} - x_n| < valor. Ej: 0.000001',
  err_rel: 'Para cuando |(x_{n+1} - x_n) / x_{n+1}| < valor. Ej: 0.0001',
  err_rel_pct: 'Para cuando el error relativo en % es menor al valor. Ej: 0.5',
  cifras_sig: 'Scarborough: garantiza n cifras. Ej: 4 → ε_s = 0.005 %',
  err_abs_exact: 'Para cuando |x_n - exacto| < valor. Requiere cargar el "Valor exacto".',
  err_rel_exact: 'Para cuando |x_n - exacto| / |exacto| < valor (fraccion). Requiere "Valor exacto".',
  err_rel_pct_exact: 'Para cuando el error relativo vs exacto en % es menor al valor. Requiere "Valor exacto".',
};

/**
 * Formato de valor guardado en un input 'stopCriterion':
 *   "kind1:value1;kind2:value2;..."   — ej. "err_abs:1e-6;cifras_sig:4"
 * Un solo criterio tambien es valido: "tolerancia:1e-6".
 */
export function encodeStop(cfgs: StopConfigList): string {
  return cfgs.map(c => `${c.kind}:${c.value}`).join(';');
}

export function parseStop(raw: string | undefined): StopConfigList {
  const def: StopConfigList = [{ kind: 'tolerancia', value: 1e-6 }];
  if (!raw || raw.trim() === '') return def;
  const parts = raw.split(';').map(s => s.trim()).filter(s => s.length > 0);
  const out: StopConfigList = [];
  for (const part of parts) {
    const [kindRaw, valRaw] = part.split(':');
    const kind = (kindRaw || '').trim() as StopCriterionKind;
    if (!STOP_CRITERION_LABELS[kind]) continue;
    const value = parseFloat((valRaw || '').trim());
    if (isNaN(value) || value <= 0) continue;
    out.push({ kind, value });
  }
  return out.length > 0 ? out : def;
}

/**
 * Computa las 3 representaciones del error entre dos iteraciones consecutivas.
 * Si curr es 0 y prev tambien, devuelve 0 para relativo.
 * Opcionalmente agrega los errores frente a un valor exacto.
 */
export interface ErrorBreakdown {
  errAbs: number;
  errRel: number;
  errRelPct: number;
  errAbsExact?: number;
  errRelExact?: number;
  errRelPctExact?: number;
}

export function computeErrors(prev: number, curr: number): ErrorBreakdown {
  const errAbs = Math.abs(curr - prev);
  const denom = Math.abs(curr);
  const errRel = denom > 1e-14 ? errAbs / denom : errAbs;
  const errRelPct = errRel * 100;
  return { errAbs, errRel, errRelPct };
}

/**
 * Devuelve un nuevo ErrorBreakdown con los campos exactos agregados.
 * Si exact es undefined/NaN, devuelve err sin modificar.
 */
export function withExactErrors(err: ErrorBreakdown, curr: number, exact: number | undefined): ErrorBreakdown {
  if (exact === undefined || isNaN(exact)) return err;
  const errAbsExact = Math.abs(curr - exact);
  const denom = Math.abs(exact) > 1e-14 ? Math.abs(exact) : 1;
  const errRelExact = errAbsExact / denom;
  const errRelPctExact = errRelExact * 100;
  return { ...err, errAbsExact, errRelExact, errRelPctExact };
}

/**
 * Target absoluto (umbral de |x_{n+1} - x_n|) asumiendo que la magnitud
 * del valor actual es del orden de `currentMagnitude`. Util para metodos
 * que comparan contra error absoluto internamente.
 *
 * Con multiples criterios devuelve el umbral MAS ESTRICTO (el minimo).
 * Los criterios "vs exacto" se ignoran aqui (no son umbrales de Δx).
 */
export function toAbsThreshold(cfgs: StopConfigList, currentMagnitude: number = 1): number {
  const mag = Math.max(Math.abs(currentMagnitude), 1e-14);
  const one = (cfg: StopConfig): number => {
    switch (cfg.kind) {
      case 'err_abs':
      case 'tolerancia':
        return cfg.value;
      case 'err_rel':
        return cfg.value * mag;
      case 'err_rel_pct':
        return (cfg.value / 100) * mag;
      case 'cifras_sig': {
        const relFrac = 0.5 * Math.pow(10, -cfg.value);
        return relFrac * mag;
      }
      // Exact-based: no tienen umbral de Δx, ignorar aqui.
      case 'err_abs_exact':
      case 'err_rel_exact':
      case 'err_rel_pct_exact':
        return Infinity;
    }
  };
  if (cfgs.length === 0) return Infinity;
  return Math.min(...cfgs.map(one));
}

/** ¿Es un criterio que depende del valor exacto? */
export function isExactCriterion(cfg: StopConfig): boolean {
  return cfg.kind === 'err_abs_exact' || cfg.kind === 'err_rel_exact' || cfg.kind === 'err_rel_pct_exact';
}

function convergedSingle(cfg: StopConfig, err: ErrorBreakdown): boolean {
  switch (cfg.kind) {
    case 'err_abs':
    case 'tolerancia':
      return err.errAbs < cfg.value;
    case 'err_rel':
      return err.errRel < cfg.value;
    case 'err_rel_pct':
      return err.errRelPct < cfg.value;
    case 'cifras_sig': {
      const eps_s_pct = 0.5 * Math.pow(10, 2 - cfg.value);
      return err.errRelPct < eps_s_pct;
    }
    case 'err_abs_exact':
      return err.errAbsExact !== undefined && err.errAbsExact < cfg.value;
    case 'err_rel_exact':
      return err.errRelExact !== undefined && err.errRelExact < cfg.value;
    case 'err_rel_pct_exact':
      return err.errRelPctExact !== undefined && err.errRelPctExact < cfg.value;
  }
}

/**
 * Devuelve true cuando TODOS los criterios se cumplen.
 */
export function hasConverged(cfgs: StopConfigList, err: ErrorBreakdown): boolean {
  if (cfgs.length === 0) return false;
  return cfgs.every(cfg => convergedSingle(cfg, err));
}

function describeSingle(cfg: StopConfig): string {
  switch (cfg.kind) {
    case 'tolerancia': return `Tolerancia = ${cfg.value}`;
    case 'err_abs':    return `|x_{n+1} - x_n| < ${cfg.value}`;
    case 'err_rel':    return `Error relativo (fraccion) < ${cfg.value}`;
    case 'err_rel_pct': return `Error relativo % < ${cfg.value} %`;
    case 'cifras_sig': {
      const eps = 0.5 * Math.pow(10, 2 - cfg.value);
      return `${cfg.value} cifras (Scarborough: ε_s = ${eps} %)`;
    }
    case 'err_abs_exact':     return `|x_n - exacto| < ${cfg.value}`;
    case 'err_rel_exact':     return `|x_n - exacto| / |exacto| < ${cfg.value}`;
    case 'err_rel_pct_exact': return `Err. vs exacto % < ${cfg.value} %`;
  }
}

/**
 * Descripcion humana de los criterios activos unidos por AND.
 */
export function describeStop(cfgs: StopConfigList): string {
  if (cfgs.length === 0) return '(sin criterio)';
  return cfgs.map(describeSingle).join(' y ');
}
