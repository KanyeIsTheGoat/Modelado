import type { MethodResult, MethodDefinition, MethodInput } from './methods/types';
import { texInline, texBlock, renderNumber, FORMULAS } from './latex';
import { formatNum, getPrecisionMode, setPrecisionMode, ALL_PRECISION_MODES, precisionModeLabel, PrecisionMode } from './precision';

function renderSingleInput(inp: MethodInput): string {
  if (inp.type === 'table') {
    const cols = inp.tableColumns || 2;
    const headers = inp.tableHeaders || Array.from({ length: cols }, (_, i) => `col${i + 1}`);
    const defaultRows = inp.defaultValue || '';
    return `
      <div class="input-group input-group-table" data-table-input="${inp.id}" data-cols="${cols}">
        <label>${inp.label}</label>
        <table class="data-input-table" id="input-${inp.id}">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}<th></th></tr></thead>
          <tbody data-rows-for="${inp.id}"></tbody>
        </table>
        <div class="table-input-actions">
          <button type="button" class="btn-mini" data-table-add="${inp.id}">+ fila</button>
        </div>
        <input type="hidden" data-table-default="${inp.id}" value="${defaultRows.replace(/"/g, '&quot;')}">
        ${inp.hint ? `<div class="hint">${inp.hint}</div>` : ''}
      </div>
    `;
  }
  return `
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
  `;
}

export function createInputForm(method: MethodDefinition): string {
  const inputs = method.inputs.map(renderSingleInput).join('');

  // Use LaTeX formula if available, otherwise plain text
  const latexFormula = FORMULAS[method.id];
  const formulaHtml = latexFormula
    ? texBlock(latexFormula)
    : `<div class="method-formula-plain">${method.formula}</div>`;

  const currentMode = getPrecisionMode();
  const precisionOptions = ALL_PRECISION_MODES.map(m =>
    `<option value="${m}" ${m === currentMode ? 'selected' : ''}>${precisionModeLabel(m)}</option>`
  ).join('');

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
        <button class="btn btn-secondary" id="btn-export" title="Descarga un .md con parametros, resultados y graficos">Exportar reporte</button>
        <label class="precision-select-label">
          Precision
          <select id="precision-select">${precisionOptions}</select>
        </label>
      </div>
      <div id="error-container"></div>
      <div id="theorem-panels"></div>
    </div>
  `;
}

/**
 * After the method view is mounted, initialize table inputs with their default rows
 * and wire the add/remove buttons.
 */
export function initTableInputs(method: MethodDefinition): void {
  for (const inp of method.inputs) {
    if (inp.type !== 'table') continue;
    const cols = inp.tableColumns || 2;
    const tbody = document.querySelector(`tbody[data-rows-for="${inp.id}"]`) as HTMLTableSectionElement | null;
    if (!tbody) continue;
    // Parse default as "x1,y1;x2,y2;..."
    const parsed = parseTableValue(inp.defaultValue || '', cols);
    const rows = parsed.length > 0 ? parsed : [Array(cols).fill('')];
    tbody.innerHTML = '';
    for (const r of rows) addTableRow(tbody, cols, r);
  }

  document.querySelectorAll('button[data-table-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-table-add')!;
      const container = document.querySelector(`[data-table-input="${id}"]`);
      const cols = parseInt(container?.getAttribute('data-cols') || '2', 10);
      const tbody = document.querySelector(`tbody[data-rows-for="${id}"]`) as HTMLTableSectionElement | null;
      if (tbody) addTableRow(tbody, cols, Array(cols).fill(''));
    });
  });

  // Wire precision selector
  const sel = document.getElementById('precision-select') as HTMLSelectElement | null;
  if (sel) {
    sel.addEventListener('change', () => {
      setPrecisionMode(sel.value as PrecisionMode);
      // Notify any listeners (method view re-renders table via a custom event)
      document.dispatchEvent(new CustomEvent('precision-changed'));
    });
  }
}

function addTableRow(tbody: HTMLTableSectionElement, cols: number, values: string[]): void {
  const tr = document.createElement('tr');
  for (let i = 0; i < cols; i++) {
    const td = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = values[i] ?? '';
    inp.className = 'table-cell-input';
    td.appendChild(inp);
    tr.appendChild(td);
  }
  const delTd = document.createElement('td');
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'btn-mini btn-mini-danger';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', () => tr.remove());
  delTd.appendChild(delBtn);
  tr.appendChild(delTd);
  tbody.appendChild(tr);
}

function parseTableValue(raw: string, cols: number): string[][] {
  if (!raw.trim()) return [];
  return raw.split(';').map(row => {
    const parts = row.split(',').map(s => s.trim());
    while (parts.length < cols) parts.push('');
    return parts.slice(0, cols);
  });
}

export function setInputValues(method: MethodDefinition, values: Record<string, string>): void {
  for (const inp of method.inputs) {
    const raw = values[inp.id];
    if (raw === undefined) continue;
    if (inp.type === 'table') {
      const cols = inp.tableColumns || 2;
      const tbody = document.querySelector(`tbody[data-rows-for="${inp.id}"]`) as HTMLTableSectionElement | null;
      if (!tbody) continue;
      const parsed = parseTableValue(raw, cols);
      const rows = parsed.length > 0 ? parsed : [Array(cols).fill('')];
      tbody.innerHTML = '';
      for (const r of rows) addTableRow(tbody, cols, r);
    } else {
      const el = document.getElementById(`input-${inp.id}`) as HTMLInputElement;
      if (el) el.value = raw;
    }
  }
}

export function getInputValues(method: MethodDefinition): Record<string, string> {
  const values: Record<string, string> = {};
  for (const inp of method.inputs) {
    if (inp.type === 'table') {
      const tbody = document.querySelector(`tbody[data-rows-for="${inp.id}"]`) as HTMLTableSectionElement | null;
      if (!tbody) { values[inp.id] = ''; continue; }
      const rows: string[] = [];
      tbody.querySelectorAll('tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('input.table-cell-input')).map(i => (i as HTMLInputElement).value.trim());
        if (cells.some(c => c !== '')) rows.push(cells.join(','));
      });
      values[inp.id] = rows.join(';');
    } else {
      const el = document.getElementById(`input-${inp.id}`) as HTMLInputElement;
      values[inp.id] = el?.value ?? '';
    }
  }
  return values;
}

/**
 * Parse a table-input string "x1,y1;x2,y2;..." into an array of number arrays.
 */
export function parseTableData(raw: string): number[][] {
  if (!raw || !raw.trim()) return [];
  return raw.split(';').map(row =>
    row.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
  ).filter(r => r.length > 0);
}

export function renderResultSummary(result: MethodResult): string {
  const items: string[] = [];

  if (result.root !== undefined) {
    items.push(`<div class="result-item"><span class="label">Raiz encontrada</span><span class="value">${renderNumber(result.root)}</span></div>`);
  }
  if (result.integral !== undefined) {
    items.push(`<div class="result-item"><span class="label">Integral aproximada</span><span class="value">${renderNumber(result.integral)}</span></div>`);
  }
  if (result.exact !== undefined) {
    items.push(`<div class="result-item"><span class="label">Valor exacto</span><span class="value">${renderNumber(result.exact)}</span></div>`);
  }
  if (result.relativeErrorPercent !== undefined) {
    const pctClass = result.relativeErrorPercent > 1 ? 'error' : '';
    items.push(`<div class="result-item"><span class="label">Error relativo</span><span class="value ${pctClass}">${formatNum(result.relativeErrorPercent)} %</span></div>`);
  }
  if (result.truncationBound !== undefined) {
    const order = result.truncationOrder ?? 2;
    items.push(`<div class="result-item"><span class="label">Cota de error |E| (f<sup>(${order})</sup>)</span><span class="value">${renderNumber(result.truncationBound)}</span></div>`);
  }
  if (result.maxDerivative !== undefined && result.xiApprox !== undefined) {
    const order = result.truncationOrder ?? 2;
    items.push(`<div class="result-item"><span class="label">max |f<sup>(${order})</sup>(ξ)|</span><span class="value">${formatNum(result.maxDerivative)} en ξ ≈ ${formatNum(result.xiApprox)}</span></div>`);
  }
  if (result.retried) {
    items.push(`<div class="result-item"><span class="label">Reintento</span><span class="value">Error > 1 % → n refinado</span></div>`);
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
      if (v === null || v === undefined) return `<td class="td-null">—</td>`;
      if (typeof v === 'number') return `<td>${formatNum(v)}</td>`;
      return `<td>${v}</td>`;
    }).join('');
    const highlight = typeof row._highlight === 'string' ? row._highlight : '';
    const rowClasses: string[] = [];
    if (highlight.includes('target')) rowClasses.push('row-highlight-target');
    if (highlight.includes('verify')) rowClasses.push('row-highlight-verify');
    const classAttr = rowClasses.length > 0 ? ` class="${rowClasses.join(' ')}"` : '';
    return `<tr${classAttr}>${cells}</tr>`;
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
