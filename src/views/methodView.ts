import type { MethodDefinition } from '../methods/types';
import { createInputForm, getInputValues, setInputValues, renderResultSummary, renderIterationTable, showError, clearError, initTableInputs } from '../ui';
import { renderChart, destroyAllCharts } from '../plotter';
import { mountKeyboard, setupKeyboardListeners } from '../mathKeyboard';
import { downloadMarkdownReport } from '../exportReport';
import { getExercisesForMethod } from '../exercises';

export function renderMethodView(method: MethodDefinition): string {
  const form = createInputForm(method);

  // Bind events after render
  setTimeout(() => bindMethodEvents(method), 0);

  const stepsHtml = method.steps && method.steps.length > 0 ? `
    <details class="method-steps" open>
      <summary>📋 Paso a paso sugerido para resolver este metodo</summary>
      <ol>
        ${method.steps.map(s => `<li>${s}</li>`).join('')}
      </ol>
    </details>
  ` : '';

  return `
    <div class="method-view-full">
      ${form}
      ${stepsHtml}
      <div id="result-summary"></div>
      <div class="charts-grid">
        <div class="chart-panel"><canvas id="chart-0"></canvas></div>
        <div class="chart-panel"><canvas id="chart-1"></canvas></div>
        <div class="chart-panel"><canvas id="chart-2"></canvas></div>
        <div class="chart-panel"><canvas id="chart-3"></canvas></div>
      </div>
      <div id="iter-table"></div>
    </div>
  `;
}

let lastResult: import('../methods/types').MethodResult | null = null;
let lastParams: Record<string, string> | null = null;

function bindMethodEvents(method: MethodDefinition): void {
  // Mount math keyboard into #kb-container
  mountKeyboard('kb-container');
  setupKeyboardListeners();
  initTableInputs(method);
  mountExerciseDropdown(method);

  // Re-render iteration table when precision changes (no need to re-solve)
  document.addEventListener('precision-changed', () => {
    if (!lastResult) return;
    const tableEl = document.getElementById('iter-table');
    if (tableEl) tableEl.innerHTML = renderIterationTable(lastResult, method.tableColumns);
  });

  const solveBtn = document.getElementById('btn-solve');
  const clearBtn = document.getElementById('btn-clear');
  const exportBtn = document.getElementById('btn-export');

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (!lastResult || !lastParams) {
        showError('Primero resuelve el problema antes de exportar.');
        return;
      }
      try {
        downloadMarkdownReport(method, lastParams, lastResult);
      } catch (e: any) {
        showError(e.message || 'Error al exportar reporte');
      }
    });
  }

  if (solveBtn) {
    solveBtn.addEventListener('click', () => runSolve(method));
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      destroyAllCharts();
      const summary = document.getElementById('result-summary');
      const table = document.getElementById('iter-table');
      const panels = document.getElementById('theorem-panels');
      if (summary) summary.innerHTML = '';
      if (table) table.innerHTML = '';
      if (panels) panels.innerHTML = '';
      clearError();
      method.inputs.forEach(inp => {
        const el = document.getElementById(`input-${inp.id}`) as HTMLInputElement;
        if (el) el.value = inp.defaultValue || '';
      });
    });
  }

  // Enter key to solve
  document.querySelectorAll('.method-inputs-bar input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') runSolve(method);
    });
  });
}

function mountExerciseDropdown(method: MethodDefinition): void {
  const exercises = getExercisesForMethod(method.id);
  if (exercises.length === 0) return;

  const btnRow = document.querySelector('.method-inputs-bar .btn-row');
  if (!btnRow) return;

  const wrapper = document.createElement('label');
  wrapper.className = 'exercise-select-label';
  wrapper.innerHTML = `
    Cargar ejercicio
    <select id="exercise-select">
      <option value="">— Elegir ejercicio del parcial —</option>
      ${exercises.map(ex => `<option value="${ex.id}">${ex.label}</option>`).join('')}
    </select>
  `;
  btnRow.appendChild(wrapper);

  const select = wrapper.querySelector('#exercise-select') as HTMLSelectElement;
  select.addEventListener('change', () => {
    const ex = exercises.find(e => e.id === select.value);
    if (!ex) return;
    setInputValues(method, ex.params);
    clearError();
    if (ex.description) {
      // Show description as a transient hint using error container (info styling)
      const errEl = document.getElementById('error-container');
      if (errEl) errEl.innerHTML = `<div class="info-msg">${ex.description}</div>`;
    }
  });
}

function runSolve(method: MethodDefinition): void {
  clearError();
  destroyAllCharts();

  const params = getInputValues(method);

  try {
    const result = method.solve(params);
    lastResult = result;
    lastParams = params;

    const summaryEl = document.getElementById('result-summary');
    if (summaryEl) summaryEl.innerHTML = renderResultSummary(result);

    const panelsEl = document.getElementById('theorem-panels');
    if (panelsEl) panelsEl.innerHTML = (result.theoremPanels ?? []).join('');

    const charts = method.getCharts(params, result);
    charts.forEach((chartData, i) => {
      try {
        renderChart(`chart-${i}`, chartData);
      } catch (e) {
        console.warn(`Chart ${i} error:`, e);
      }
    });

    const tableEl = document.getElementById('iter-table');
    if (tableEl) tableEl.innerHTML = renderIterationTable(result, method.tableColumns);

  } catch (e: any) {
    showError(e.message || 'Error al resolver');
  }
}
