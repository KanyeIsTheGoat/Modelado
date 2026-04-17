import type { MethodDefinition } from '../methods/types';
import { createInputForm, getInputValues, renderResultSummary, renderIterationTable, showError, clearError } from '../ui';
import { renderChart, destroyAllCharts } from '../plotter';
import { mountKeyboard, setupKeyboardListeners } from '../mathKeyboard';

export function renderMethodView(method: MethodDefinition): string {
  const form = createInputForm(method);

  // Bind events after render
  setTimeout(() => bindMethodEvents(method), 0);

  return `
    <div class="method-view-full">
      ${form}
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

function bindMethodEvents(method: MethodDefinition): void {
  // Mount math keyboard into #kb-container
  mountKeyboard('kb-container');
  setupKeyboardListeners();

  const solveBtn = document.getElementById('btn-solve');
  const clearBtn = document.getElementById('btn-clear');

  if (solveBtn) {
    solveBtn.addEventListener('click', () => runSolve(method));
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      destroyAllCharts();
      const summary = document.getElementById('result-summary');
      const table = document.getElementById('iter-table');
      if (summary) summary.innerHTML = '';
      if (table) table.innerHTML = '';
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

function runSolve(method: MethodDefinition): void {
  clearError();
  destroyAllCharts();

  const params = getInputValues(method);

  try {
    const result = method.solve(params);

    const summaryEl = document.getElementById('result-summary');
    if (summaryEl) summaryEl.innerHTML = renderResultSummary(result);

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
