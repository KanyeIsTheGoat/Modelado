import { categories, allMethods } from '../categories';
import type { MethodDefinition, MethodResult } from '../methods/types';
import { renderChart, destroyAllCharts } from '../plotter';
import { parseExpression } from '../parser';
import { renderResultSummary } from '../ui';

interface CompareResult {
  method: MethodDefinition;
  result: MethodResult;
}

export function renderCompareView(): string {
  const categoryTabs = categories.map(cat => `
    <div style="margin-bottom:8px;">
      <strong style="color:var(--subtext1);font-size:0.82rem">${cat.name}:</strong><br>
      ${cat.methods.map(m => `
        <button class="method-chip" data-compare-method="${m.id}">${m.name}</button>
      `).join('')}
    </div>
  `).join('');

  setTimeout(bindCompareEvents, 0);

  return `
    <div class="compare-header">
      <h2>Comparar Metodos</h2>
      <p style="color:var(--subtext0)">Selecciona metodos de la misma categoria, ingresa los parametros y compara resultados.</p>
    </div>
    <div class="compare-config">
      <div class="input-group">
        <label>Funcion f(x)</label>
        <input id="compare-fx" type="text" placeholder="x^3 - x - 2" value="x^3 - x - 2" style="font-family:Consolas,monospace">
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <div class="input-group" style="flex:1;min-width:120px;">
          <label>a / x₀</label>
          <input id="compare-a" type="number" value="1">
        </div>
        <div class="input-group" style="flex:1;min-width:120px;">
          <label>b / x₁</label>
          <input id="compare-b" type="number" value="2">
        </div>
        <div class="input-group" style="flex:1;min-width:120px;">
          <label>Tolerancia</label>
          <input id="compare-tol" value="1e-6">
        </div>
        <div class="input-group" style="flex:1;min-width:120px;">
          <label>Max iter / n</label>
          <input id="compare-max" type="number" value="100">
        </div>
      </div>
      <div>
        <label style="font-size:0.82rem;color:var(--subtext0);display:block;margin-bottom:6px;">Seleccionar metodos:</label>
        <div class="compare-methods-select">${categoryTabs}</div>
      </div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" id="btn-compare-run">Comparar</button>
        <button class="btn btn-secondary" id="btn-compare-clear">Limpiar</button>
      </div>
    </div>
    <div id="compare-error"></div>
    <div id="compare-results" class="compare-results"></div>
  `;
}

function bindCompareEvents(): void {
  // Method chip toggle
  document.querySelectorAll('.method-chip[data-compare-method]').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });

  document.getElementById('btn-compare-run')?.addEventListener('click', runComparison);
  document.getElementById('btn-compare-clear')?.addEventListener('click', () => {
    destroyAllCharts();
    const el = document.getElementById('compare-results');
    if (el) el.innerHTML = '';
    document.querySelectorAll('.method-chip.selected').forEach(c => c.classList.remove('selected'));
  });
}

function runComparison(): void {
  destroyAllCharts();
  const errEl = document.getElementById('compare-error');
  const resultsEl = document.getElementById('compare-results');
  if (errEl) errEl.innerHTML = '';
  if (resultsEl) resultsEl.innerHTML = '';

  const fx = (document.getElementById('compare-fx') as HTMLInputElement)?.value || '';
  const a = (document.getElementById('compare-a') as HTMLInputElement)?.value || '1';
  const b = (document.getElementById('compare-b') as HTMLInputElement)?.value || '2';
  const tol = (document.getElementById('compare-tol') as HTMLInputElement)?.value || '1e-6';
  const maxIter = (document.getElementById('compare-max') as HTMLInputElement)?.value || '100';

  const selectedIds: string[] = [];
  document.querySelectorAll('.method-chip.selected').forEach(chip => {
    const id = chip.getAttribute('data-compare-method');
    if (id) selectedIds.push(id);
  });

  if (selectedIds.length < 2) {
    if (errEl) errEl.innerHTML = '<div class="error-msg">Selecciona al menos 2 metodos para comparar</div>';
    return;
  }

  const results: CompareResult[] = [];

  for (const id of selectedIds) {
    const method = allMethods.find(m => m.id === id);
    if (!method) continue;

    // Build params based on method inputs
    const params: Record<string, string> = {};
    for (const inp of method.inputs) {
      if (inp.id === 'fx' || inp.id === 'gx') params[inp.id] = fx;
      else if (inp.id === 'a') params[inp.id] = a;
      else if (inp.id === 'b') params[inp.id] = b;
      else if (inp.id === 'x0') params[inp.id] = a;
      else if (inp.id === 'x1') params[inp.id] = b;
      else if (inp.id === 'tol') params[inp.id] = tol;
      else if (inp.id === 'maxIter') params[inp.id] = maxIter;
      else if (inp.id === 'n') params[inp.id] = maxIter;
      else if (inp.id === 'h') params[inp.id] = '0.1';
      else if (inp.id === 'dfx') params[inp.id] = '';
      else if (inp.id === 'ddfx') params[inp.id] = '';
      else if (inp.id === 'levels') params[inp.id] = '4';
      else params[inp.id] = inp.defaultValue || '';
    }

    try {
      const result = method.solve(params);
      results.push({ method, result });
    } catch (e: any) {
      results.push({
        method,
        result: { iterations: [], converged: false, error: Infinity, message: e.message },
      });
    }
  }

  if (!resultsEl) return;

  // Summary cards
  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:20px;">';
  for (const { method, result } of results) {
    html += `
      <div style="background:var(--mantle);border:1px solid var(--surface0);border-radius:var(--radius);padding:16px;">
        <h4 style="margin-bottom:8px;color:var(--blue)">${method.name}</h4>
        ${renderResultSummary(result)}
      </div>
    `;
  }
  html += '</div>';

  // Convergence comparison chart
  html += '<div class="chart-panel" style="margin-bottom:16px;"><canvas id="compare-chart-convergence" style="max-height:350px;"></canvas></div>';
  html += '<div class="chart-panel"><canvas id="compare-chart-error" style="max-height:350px;"></canvas></div>';

  resultsEl.innerHTML = html;

  // Render convergence chart
  const COLORS = ['#89b4fa', '#a6e3a1', '#fab387', '#cba6f7', '#f38ba8', '#94e2d5', '#f9e2af', '#f5c2e7'];

  const convDatasets = results.filter(r => r.result.iterations.length > 0).map(({ method, result }, i) => {
    const iters = result.iterations.map((_, idx) => idx + 1);
    // Try to get the "value" column - root convergence
    const values = result.iterations.map(row => {
      return (row.c ?? row.xn ?? row.gxn ?? row.xn_aitken ?? row.approx ?? row.fxi ?? 0) as number;
    });
    return { label: method.name, x: iters, y: values, color: COLORS[i % COLORS.length], pointRadius: 2 };
  });

  if (convDatasets.length > 0) {
    try {
      renderChart('compare-chart-convergence', {
        title: 'Convergencia de valores',
        type: 'line',
        datasets: convDatasets,
        xLabel: 'Iteracion', yLabel: 'Valor',
      });
    } catch {}
  }

  // Error comparison
  const errDatasets = results.filter(r => r.result.iterations.length > 0).map(({ method, result }, i) => {
    const iters = result.iterations.map((_, idx) => idx + 1);
    const errors = result.iterations.map(row => {
      return (row.error ?? row.error_aitken ?? 0) as number;
    }).filter(e => e > 0);
    return { label: method.name, x: iters.slice(0, errors.length), y: errors, color: COLORS[i % COLORS.length], pointRadius: 2 };
  }).filter(ds => ds.y.length > 0);

  if (errDatasets.length > 0) {
    try {
      renderChart('compare-chart-error', {
        title: 'Comparacion de errores',
        type: 'line',
        datasets: errDatasets,
        xLabel: 'Iteracion', yLabel: 'Error', yLog: true,
      });
    } catch {}
  }
}
