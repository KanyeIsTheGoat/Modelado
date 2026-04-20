import type { MethodResult, IterationRow } from './methods/types';
import { formatNum } from './precision';

/**
 * Common optional inputs for ODE methods: x target (highlight step near this x)
 * and a verification pair (iter number + expected value).
 */
export const commonOdeInputs = [
  { id: 'xTarget', label: 'x objetivo (opcional)', placeholder: '0.5', type: 'number' as const, hint: 'Resalta el paso cuyo xₙ se acerca mas a este valor.' },
  { id: 'verifyStep', label: 'Iteracion a verificar (opcional)', placeholder: '1', type: 'number' as const, hint: 'Indice del paso para comparar con un valor esperado.' },
  { id: 'verifyValue', label: 'Valor esperado yₙ en esa iter (opcional)', placeholder: '1.1', type: 'number' as const, hint: 'Se muestra diferencia absoluta en la tabla.' },
];

/**
 * Annotates iterations with _highlight and attaches a summary message showing
 * the closest step to x_target and the verification check.
 */
export function applyOdeTargetAndVerification(
  result: MethodResult,
  params: Record<string, string>,
): void {
  const xTargetRaw = (params.xTarget ?? '').trim();
  const verifyStepRaw = (params.verifyStep ?? '').trim();
  const verifyValueRaw = (params.verifyValue ?? '').trim();

  const notes: string[] = [];

  if (xTargetRaw !== '') {
    const xTarget = parseFloat(xTargetRaw);
    if (!isNaN(xTarget)) {
      let bestIdx = -1;
      let bestDiff = Infinity;
      result.iterations.forEach((row, idx) => {
        const xn = row.xn;
        if (typeof xn === 'number') {
          const d = Math.abs(xn - xTarget);
          if (d < bestDiff) {
            bestDiff = d;
            bestIdx = idx;
          }
        }
      });
      if (bestIdx >= 0) {
        const row = result.iterations[bestIdx];
        row._highlight = 'target';
        const yn = row.yn as number;
        notes.push(`y(${formatNum(xTarget)}) ≈ ${formatNum(yn)} (paso ${row.step ?? bestIdx})`);
      }
    }
  }

  if (verifyStepRaw !== '' && verifyValueRaw !== '') {
    const step = parseInt(verifyStepRaw);
    const expected = parseFloat(verifyValueRaw);
    if (!isNaN(step) && !isNaN(expected)) {
      const match = result.iterations.find(r => r.step === step);
      if (match) {
        const yn = match.yn as number;
        const diff = Math.abs(yn - expected);
        match._highlight = (match._highlight as string | undefined) ? `${match._highlight},verify` : 'verify';
        match.verifyDiff = diff;
        notes.push(`Verificacion iter ${step}: |yₙ - esperado| = ${formatNum(diff)}`);
      }
    }
  }

  if (notes.length > 0) {
    result.message = result.message ? `${result.message} · ${notes.join(' · ')}` : notes.join(' · ');
  }
}

/** Extra table column shown when verifyStep/verifyValue is used */
export const verifyDiffColumn = { key: 'verifyDiff', label: '|yₙ − esperado|' };
