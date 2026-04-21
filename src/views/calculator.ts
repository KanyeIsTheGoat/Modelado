import { parseExpression, linspace } from '../parser';
import { renderChart, destroyAllCharts } from '../plotter';
import { mountKeyboard, setupKeyboardListeners } from '../mathKeyboard';
import { symbolicDerivativeSteps, symbolicIntegralSteps, type SymbolicStep } from '../symbolic';
import { texBlock, tex, exprToTex } from '../latex';

export function renderCalculator(): string {
  setTimeout(bindCalcEvents, 0);

  return `
    <h2 style="font-size:1.6rem;margin-bottom:4px;">Calculadora Simbolica</h2>
    <p style="color:var(--subtext0);margin-bottom:24px;">Calcula derivadas e integrales simbolicas. Ingresa la funcion y obtene la expresion resultante.</p>

    <div style="display:flex;gap:8px;margin-bottom:20px;">
      <button class="btn btn-primary calc-tab-btn active" data-tab="derivative">Derivada</button>
      <button class="btn btn-secondary calc-tab-btn" data-tab="integral">Integral</button>
    </div>

    <!-- DERIVATIVE TAB -->
    <div id="calc-tab-derivative" class="calc-tab">
      <div class="method-inputs-bar">
        <div class="inputs-row">
          <div class="input-group" style="flex:3;min-width:280px;">
            <label>f(x)</label>
            <input id="calc-der-fx" type="text" placeholder="x^3 + 2*x^2 - 5*x + 3" value="x^3 + 2*x^2 - 5*x + 3" autocomplete="off" spellcheck="false">
            <div class="hint">Ej: 2*x, sin(x), e^x, x^2 + 3*x, log(x)</div>
          </div>
          <div class="input-group" style="flex:1;min-width:100px;">
            <label>Variable</label>
            <input id="calc-der-var" type="text" value="x" style="text-align:center">
          </div>
        </div>
        <div id="kb-container-der"></div>
        <div class="btn-row">
          <button class="btn btn-primary" id="calc-der-run">Derivar</button>
          <button class="btn btn-secondary" id="calc-der-clear">Limpiar</button>
        </div>
      </div>
      <div id="calc-der-error"></div>
      <div id="calc-der-results" style="margin-top:20px;"></div>
    </div>

    <!-- INTEGRAL TAB -->
    <div id="calc-tab-integral" class="calc-tab" style="display:none;">
      <div class="method-inputs-bar">
        <div class="inputs-row">
          <div class="input-group" style="flex:3;min-width:280px;">
            <label>f(x)</label>
            <input id="calc-int-fx" type="text" placeholder="x^2 + sin(x)" value="x^2" autocomplete="off" spellcheck="false">
            <div class="hint">Ej: x^2, 3*x, sin(x), cos(2*x), e^x, 1/x</div>
          </div>
          <div class="input-group" style="flex:1;min-width:100px;">
            <label>Variable</label>
            <input id="calc-int-var" type="text" value="x" style="text-align:center">
          </div>
        </div>
        <div id="kb-container-int"></div>
        <div class="btn-row">
          <button class="btn btn-primary" id="calc-int-run">Integrar</button>
          <button class="btn btn-secondary" id="calc-int-clear">Limpiar</button>
        </div>
      </div>
      <div id="calc-int-error"></div>
      <div id="calc-int-results" style="margin-top:20px;"></div>
    </div>

    <div style="margin-top:24px;">
      <div class="charts-grid">
        <div class="chart-panel"><canvas id="calc-chart-0"></canvas></div>
        <div class="chart-panel"><canvas id="calc-chart-1"></canvas></div>
      </div>
    </div>
  `;
}

function bindCalcEvents(): void {
  mountKeyboard('kb-container-der');
  setupKeyboardListeners();

  // Tab switching
  document.querySelectorAll('.calc-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab')!;
      document.querySelectorAll('.calc-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
      });
      btn.classList.add('active');
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');

      document.querySelectorAll('.calc-tab').forEach(t => (t as HTMLElement).style.display = 'none');
      const tabEl = document.getElementById(`calc-tab-${tab}`);
      if (tabEl) tabEl.style.display = 'block';

      mountKeyboard(tab === 'derivative' ? 'kb-container-der' : 'kb-container-int');
    });
  });

  // Buttons
  document.getElementById('calc-der-run')?.addEventListener('click', runDerivative);
  document.getElementById('calc-der-clear')?.addEventListener('click', () => {
    destroyAllCharts();
    clearEl('calc-der-results');
    clearEl('calc-der-error');
  });

  document.getElementById('calc-int-run')?.addEventListener('click', runIntegral);
  document.getElementById('calc-int-clear')?.addEventListener('click', () => {
    destroyAllCharts();
    clearEl('calc-int-results');
    clearEl('calc-int-error');
  });

  // Enter key
  document.querySelectorAll('#calc-tab-derivative input').forEach(input => {
    input.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') runDerivative(); });
  });
  document.querySelectorAll('#calc-tab-integral input').forEach(input => {
    input.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') runIntegral(); });
  });
}

function clearEl(id: string): void {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '';
}

function runDerivative(): void {
  destroyAllCharts();
  clearEl('calc-der-error');
  clearEl('calc-der-results');

  const errEl = document.getElementById('calc-der-error');
  const resEl = document.getElementById('calc-der-results');

  try {
    const fExpr = (document.getElementById('calc-der-fx') as HTMLInputElement).value.trim();
    const v = (document.getElementById('calc-der-var') as HTMLInputElement).value.trim() || 'x';

    if (!fExpr) throw new Error('Ingresa una funcion');

    const { result, steps } = symbolicDerivativeSteps(fExpr, v);

    const inputTex = exprToTex(fExpr);
    const resultTex = exprToTex(result);

    if (resEl) {
      resEl.innerHTML = `
        <div class="calc-result-card">
          <div class="calc-result-label">Derivada</div>
          <div class="calc-result-tex">
            ${texBlock(`\\frac{d}{d${v}} \\left[ ${inputTex} \\right] = ${resultTex}`)}
          </div>
          <div class="calc-result-expr">${result}</div>
        </div>
        ${renderStepsPanel('Procedimiento paso a paso', steps)}
      `;
    }

    // Plot f(x) and f'(x)
    try {
      const f = parseExpression(fExpr);
      const fPrime = parseExpression(result);
      const xs = linspace(-5, 5, 500);
      const ys = xs.map(x => f(x));
      const ysPrime = xs.map(x => fPrime(x));

      renderChart('calc-chart-0', {
        title: `f(${v}) = ${fExpr}`,
        type: 'line',
        datasets: [
          { label: `f(${v})`, x: xs, y: ys, color: '#89b4fa' },
          { label: 'y=0', x: [xs[0], xs[xs.length - 1]], y: [0, 0], color: '#585b70', dashed: true, pointRadius: 0 },
        ],
        xLabel: v, yLabel: `f(${v})`,
      });

      renderChart('calc-chart-1', {
        title: `f'(${v}) = ${result}`,
        type: 'line',
        datasets: [
          { label: `f'(${v})`, x: xs, y: ysPrime, color: '#a6e3a1' },
          { label: 'y=0', x: [xs[0], xs[xs.length - 1]], y: [0, 0], color: '#585b70', dashed: true, pointRadius: 0 },
        ],
        xLabel: v, yLabel: `f'(${v})`,
      });
    } catch {
      // Can't plot — that's fine, result is still shown
    }

  } catch (e: any) {
    if (errEl) errEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
  }
}

function renderStepsPanel(title: string, steps: SymbolicStep[]): string {
  if (!steps || steps.length === 0) return '';
  const items = steps.map((s, i) => `
    <div class="calc-step">
      <div class="calc-step-head">
        <span class="calc-step-num">${i + 1}</span>
        <span class="calc-step-rule">${escapeHtml(s.rule)}</span>
      </div>
      <div class="calc-step-explain">${escapeHtml(s.explanation)}</div>
      <div class="calc-step-math">${tex(s.latex, true)}</div>
    </div>
  `).join('');
  return `
    <div class="calc-steps-panel">
      <div class="calc-steps-title">${escapeHtml(title)}</div>
      ${items}
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function runIntegral(): void {
  destroyAllCharts();
  clearEl('calc-int-error');
  clearEl('calc-int-results');

  const errEl = document.getElementById('calc-int-error');
  const resEl = document.getElementById('calc-int-results');

  try {
    const fExpr = (document.getElementById('calc-int-fx') as HTMLInputElement).value.trim();
    const v = (document.getElementById('calc-int-var') as HTMLInputElement).value.trim() || 'x';

    if (!fExpr) throw new Error('Ingresa una funcion');

    const { result, steps } = symbolicIntegralSteps(fExpr, v);

    const inputTex = exprToTex(fExpr);
    const resultTex = exprToTex(result.replace(/\s*\+\s*C\s*$/, ''));

    if (resEl) {
      resEl.innerHTML = `
        <div class="calc-result-card">
          <div class="calc-result-label">Integral indefinida</div>
          <div class="calc-result-tex">
            ${texBlock(`\\int ${inputTex} \\, d${v} = ${resultTex} + C`)}
          </div>
          <div class="calc-result-expr">${result}</div>
        </div>
        ${renderStepsPanel('Procedimiento paso a paso', steps)}
      `;
    }

    // Plot f(x) and F(x)
    try {
      const f = parseExpression(fExpr);
      // Remove "+ C" for plotting
      const FExpr = result.replace(/\s*\+\s*C\s*$/, '');
      const F = parseExpression(FExpr);
      const xs = linspace(-5, 5, 500);
      const ys = xs.map(x => f(x));
      const Ys = xs.map(x => F(x));

      renderChart('calc-chart-0', {
        title: `f(${v}) = ${fExpr} (integrando)`,
        type: 'line',
        datasets: [
          { label: `f(${v})`, x: xs, y: ys, color: '#89b4fa' },
          { label: 'y=0', x: [xs[0], xs[xs.length - 1]], y: [0, 0], color: '#585b70', dashed: true, pointRadius: 0 },
        ],
        xLabel: v, yLabel: `f(${v})`,
      });

      renderChart('calc-chart-1', {
        title: `F(${v}) = ${FExpr} (primitiva)`,
        type: 'line',
        datasets: [
          { label: `F(${v})`, x: xs, y: Ys, color: '#a6e3a1' },
          { label: 'y=0', x: [xs[0], xs[xs.length - 1]], y: [0, 0], color: '#585b70', dashed: true, pointRadius: 0 },
        ],
        xLabel: v, yLabel: `F(${v})`,
      });
    } catch {
      // Can't plot — result is still shown
    }

  } catch (e: any) {
    if (errEl) errEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
  }
}
