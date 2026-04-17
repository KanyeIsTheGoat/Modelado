import type { MethodResult, MethodDefinition } from './methods/types';
import { texInline, texBlock, renderNumber, FORMULAS } from './latex';

export function createInputForm(method: MethodDefinition): string {
  const inputs = method.inputs.map(inp => `
    <div class="input-group">
      <label for="input-${inp.id}">${inp.label}</label>
      <input
        id="input-${inp.id}"
        type="${inp.type || 'text'}"
        placeholder="${inp.placeholder}"
        value="${inp.defaultValue || ''}"
        autocomplete="off"
        spellcheck="false"
      >
      ${inp.hint ? `<div class="hint">${inp.hint}</div>` : ''}
    </div>
  `).join('');

  // Use LaTeX formula if available, otherwise plain text
  const latexFormula = FORMULAS[method.id];
  const formulaHtml = latexFormula
    ? texBlock(latexFormula)
    : `<div class="method-formula-plain">${method.formula}</div>`;

  return `
    <div class="method-header">
      <h2 class="method-title">${method.name}</h2>
      <div class="method-formula-block">${formulaHtml}</div>
    </div>
    <div class="method-inputs-bar">
      <div class="inputs-row">
        ${inputs}
      </div>
      <div id="kb-container"></div>
      <div class="btn-row">
        <button class="btn btn-primary" id="btn-solve">Resolver</button>
        <button class="btn btn-secondary" id="btn-clear">Limpiar</button>
      </div>
      <div id="error-container"></div>
    </div>
  `;
}

export function getInputValues(method: MethodDefinition): Record<string, string> {
  const values: Record<string, string> = {};
  for (const inp of method.inputs) {
    const el = document.getElementById(`input-${inp.id}`) as HTMLInputElement;
    values[inp.id] = el?.value ?? '';
  }
  return values;
}

export function renderResultSummary(result: MethodResult): string {
  const items: string[] = [];

  if (result.root !== undefined) {
    items.push(`<div class="result-item"><span class="label">Raiz encontrada</span><span class="value">${renderNumber(result.root)}</span></div>`);
  }
  if (result.integral !== undefined) {
    items.push(`<div class="result-item"><span class="label">Integral aproximada</span><span class="value">${renderNumber(result.integral)}</span></div>`);
  }
  if (result.derivative !== undefined) {
    items.push(`<div class="result-item"><span class="label">Derivada aproximada</span><span class="value">${renderNumber(result.derivative)}</span></div>`);
  }

  items.push(`<div class="result-item"><span class="label">Iteraciones</span><span class="value">${texInline(String(result.iterations.length))}</span></div>`);

  // Error in scientific notation with LaTeX
  const errExp = Math.floor(Math.log10(Math.abs(result.error)));
  const errMant = result.error / Math.pow(10, errExp);
  const errTex = result.error === 0
    ? texInline('0')
    : texInline(`${errMant.toFixed(4)} \\times 10^{${errExp}}`);
  items.push(`<div class="result-item"><span class="label">Error</span><span class="value">${errTex}</span></div>`);

  items.push(`<div class="result-item"><span class="label">Estado</span><span class="value ${result.converged ? '' : 'error'}">${result.converged ? 'Convergido' : 'No convergido'}</span></div>`);

  if (result.message) {
    items.push(`<div class="result-item"><span class="label">Nota</span><span class="value" style="font-size:0.85rem;color:var(--subtext0)">${result.message}</span></div>`);
  }

  return `<div class="result-summary">${items.join('')}</div>`;
}

export function renderIterationTable(result: MethodResult, columns: { key: string; label: string }[]): string {
  const header = columns.map(c => `<th>${c.label}</th>`).join('');
  const rows = result.iterations.map(row => {
    const cells = columns.map(c => {
      const v = row[c.key];
      if (typeof v === 'number') return `<td>${v.toPrecision(10)}</td>`;
      return `<td>${v}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <div class="iter-table-container">
      <h4>Tabla de Iteraciones</h4>
      <div class="iter-table-wrap">
        <table class="iter-table">
          <thead><tr>${header}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

export function showError(msg: string): void {
  const container = document.getElementById('error-container');
  if (container) {
    container.innerHTML = `<div class="error-msg">${msg}</div>`;
  }
}

export function clearError(): void {
  const container = document.getElementById('error-container');
  if (container) container.innerHTML = '';
}
