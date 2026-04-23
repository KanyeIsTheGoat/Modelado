import { texBlock } from '../../latex';
import { formatFull } from '../../precision';

// ---------- Generic simulation runners ----------

export type OdeFn = (x: number, y: number) => number;

export interface OdeStep {
  n: number;
  xn: number;
  yn: number;
  exact: number | null;
  error: number | null;
}

export function runEuler(
  f: OdeFn, x0: number, y0: number, xEnd: number, h: number,
  exactFn: ((x: number) => number) | null,
): OdeStep[] {
  const N = Math.ceil((xEnd - x0) / h);
  const steps: OdeStep[] = [];
  let x = x0, y = y0;
  for (let n = 0; n <= N; n++) {
    x = x0 + n * h;
    if (x > xEnd) x = xEnd;
    const exact = exactFn ? exactFn(x) : null;
    const error = exact !== null ? Math.abs(y - exact) : null;
    steps.push({ n, xn: x, yn: y, exact, error });
    if (n < N) y = y + h * f(x, y);
  }
  return steps;
}

export function runHeun(
  f: OdeFn, x0: number, y0: number, xEnd: number, h: number,
  exactFn: ((x: number) => number) | null,
): OdeStep[] {
  const N = Math.ceil((xEnd - x0) / h);
  const steps: OdeStep[] = [];
  let x = x0, y = y0;
  for (let n = 0; n <= N; n++) {
    x = x0 + n * h;
    if (x > xEnd) x = xEnd;
    const exact = exactFn ? exactFn(x) : null;
    const error = exact !== null ? Math.abs(y - exact) : null;
    steps.push({ n, xn: x, yn: y, exact, error });
    if (n < N) {
      const k1 = f(x, y);
      const yPred = y + h * k1;
      const k2 = f(x + h, yPred);
      y = y + (h / 2) * (k1 + k2);
    }
  }
  return steps;
}

export function runRK4(
  f: OdeFn, x0: number, y0: number, xEnd: number, h: number,
  exactFn: ((x: number) => number) | null,
): OdeStep[] {
  const N = Math.ceil((xEnd - x0) / h);
  const steps: OdeStep[] = [];
  let x = x0, y = y0;
  for (let n = 0; n <= N; n++) {
    x = x0 + n * h;
    if (x > xEnd) x = xEnd;
    const exact = exactFn ? exactFn(x) : null;
    const error = exact !== null ? Math.abs(y - exact) : null;
    steps.push({ n, xn: x, yn: y, exact, error });
    if (n < N) {
      const k1 = f(x, y);
      const k2 = f(x + h / 2, y + (h / 2) * k1);
      const k3 = f(x + h / 2, y + (h / 2) * k2);
      const k4 = f(x + h, y + h * k3);
      y = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
  }
  return steps;
}

// ---------- Panels ----------

function fmt(n: number | null, p: number = 8): string {
  if (n === null || !isFinite(n as number)) return '—';
  return formatFull(n as number).slice(0, p + 6);
}

/**
 * Summary panel: per-step iteration table with absolute error when exact is known.
 */
export function renderIterationSummaryPanel(
  methodLabel: string,
  steps: OdeStep[],
  h: number,
  xEnd: number,
): string {
  const hasExact = steps.some(s => s.exact !== null);
  const rows = steps.map(s => `
    <tr>
      <td>${s.n}</td>
      <td>${fmt(s.xn, 6)}</td>
      <td>${fmt(s.yn, 10)}</td>
      ${hasExact ? `<td>${fmt(s.exact, 10)}</td><td>${fmt(s.error, 10)}</td>` : ''}
    </tr>
  `).join('');

  const errors = steps.map(s => s.error).filter((e): e is number => e !== null);
  const maxErr = errors.length > 0 ? Math.max(...errors) : 0;
  const finalErr = errors.length > 0 ? errors[errors.length - 1] : 0;
  const avgErr = errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : 0;
  const yFinal = steps[steps.length - 1].yn;

  const summaryStats = hasExact ? `
    <div class="iter-table-wrap" style="margin-top:8px">
      <table class="iter-table">
        <thead><tr><th>Estadistico</th><th>Valor</th></tr></thead>
        <tbody>
          <tr><td>y(${fmt(xEnd, 6)}) aproximado</td><td><b>${fmt(yFinal, 10)}</b></td></tr>
          <tr><td>y(${fmt(xEnd, 6)}) exacto</td><td>${fmt(steps[steps.length - 1].exact, 10)}</td></tr>
          <tr><td>|Error| final</td><td><b>${fmt(finalErr, 10)}</b></td></tr>
          <tr><td>|Error| maximo</td><td>${fmt(maxErr, 10)}</td></tr>
          <tr><td>|Error| promedio</td><td>${fmt(avgErr, 10)}</td></tr>
          <tr><td>Numero de pasos</td><td>${steps.length - 1}</td></tr>
          <tr><td>Paso h</td><td>${fmt(h, 8)}</td></tr>
        </tbody>
      </table>
    </div>
  ` : '';

  return `
    <div class="theorem-panel theorem-pass">
      <div class="theorem-header"><span class="theorem-icon">Σ</span> Cuadro resumen — iteraciones y error absoluto (${methodLabel})</div>
      <div class="theorem-body">
        <div>Cada fila es una iteracion del metodo. El error absoluto se define como <code>|E_n| = |y_n − y*(x_n)|</code>, donde <code>y*(x)</code> es la solucion exacta.</div>
        <div class="iter-table-wrap" style="margin-top:8px; max-height: 400px; overflow-y: auto">
          <table class="iter-table">
            <thead>
              <tr>
                <th>n</th><th>x_n</th><th>y_n (aprox)</th>
                ${hasExact ? '<th>y*(x_n) exacto</th><th>|E_n|</th>' : ''}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${summaryStats}
      </div>
    </div>
  `;
}

/**
 * Error analysis panel: discusses how the error grows/decays.
 */
export function renderErrorAnalysisPanel(
  methodLabel: string,
  methodOrder: number, // 1 = Euler, 2 = RK2, 4 = RK4
  steps: OdeStep[],
  h: number,
): string {
  const errs = steps.map(s => s.error).filter((e): e is number => e !== null);
  if (errs.length < 2) {
    return `
      <div class="theorem-panel theorem-pass">
        <div class="theorem-header"><span class="theorem-icon">ε</span> Analisis del comportamiento del error</div>
        <div class="theorem-body">
          <div>No se proporciono la solucion exacta, por lo que no se puede calcular el error absoluto por paso.</div>
          <div>Error global teorico de ${methodLabel}: <code>O(h<sup>${methodOrder}</sup>)</code> = <code>O(${h}<sup>${methodOrder}</sup>)</code> = <code>O(${fmt(Math.pow(h, methodOrder), 6)})</code>.</div>
        </div>
      </div>
    `;
  }

  const ratios: number[] = [];
  for (let i = 1; i < errs.length; i++) {
    if (errs[i - 1] > 1e-18) ratios.push(errs[i] / errs[i - 1]);
  }
  const avgRatio = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : NaN;
  const maxErr = Math.max(...errs);
  const finalErr = errs[errs.length - 1];
  let monotonic: 'creciente' | 'decreciente' | 'oscilante' = 'oscilante';
  let up = 0, down = 0;
  for (let i = 1; i < errs.length; i++) {
    if (errs[i] > errs[i - 1]) up++;
    else if (errs[i] < errs[i - 1]) down++;
  }
  if (up === errs.length - 1) monotonic = 'creciente';
  else if (down === errs.length - 1) monotonic = 'decreciente';

  const interpretation = monotonic === 'creciente'
    ? 'El error crece monotonamente: es el comportamiento tipico. Cada paso acumula un error local O(h<sup>' + (methodOrder + 1) + '</sup>) que se suma sobre N ≈ (b−a)/h pasos, dando error global O(h<sup>' + methodOrder + '</sup>).'
    : monotonic === 'decreciente'
    ? 'El error decrece — esto ocurre cuando la EDO tiene solucion estable que "atrae" la aproximacion, compensando errores locales.'
    : 'El error oscila entre pasos: hay cancelacion parcial de errores locales. El error maximo alcanzado es lo que importa para la precision.';

  const ratioRows = steps.map((s, i) => {
    if (i === 0 || s.error === null || steps[i - 1].error === null || steps[i - 1].error === 0) {
      return `<tr><td>${s.n}</td><td>${fmt(s.xn, 6)}</td><td>${fmt(s.error, 10)}</td><td>—</td></tr>`;
    }
    const ratio = s.error! / steps[i - 1].error!;
    return `<tr><td>${s.n}</td><td>${fmt(s.xn, 6)}</td><td>${fmt(s.error, 10)}</td><td>${fmt(ratio, 6)}</td></tr>`;
  }).join('');

  // Theoretical reduction of error if h were halved
  const hHalved = h / 2;
  const factor = Math.pow(2, methodOrder);
  const predictedMaxErrHalved = maxErr / factor;

  return `
    <div class="theorem-panel theorem-pass">
      <div class="theorem-header"><span class="theorem-icon">ε</span> Analisis del comportamiento del error (${methodLabel})</div>
      <div class="theorem-body">
        <div><b>Comportamiento observado:</b> el error es <b>${monotonic}</b>.</div>
        <div style="margin-top:4px">${interpretation}</div>

        <div class="iter-table-wrap" style="margin-top:10px; max-height: 300px; overflow-y: auto">
          <table class="iter-table">
            <thead><tr><th>n</th><th>x_n</th><th>|E_n|</th><th>|E_n|/|E_{n-1}|</th></tr></thead>
            <tbody>${ratioRows}</tbody>
          </table>
        </div>

        <div style="margin-top:10px"><b>Estadistica del error:</b></div>
        <ul style="margin:4px 0; padding-left:20px">
          <li>|Error| maximo: <code>${fmt(maxErr, 10)}</code></li>
          <li>|Error| final en x_N: <code>${fmt(finalErr, 10)}</code></li>
          <li>Razon promedio |E_{n+1}|/|E_n|: <code>${fmt(avgRatio, 6)}</code> ${avgRatio > 1 ? '(>1: error crece)' : avgRatio < 1 ? '(<1: error decrece)' : ''}</li>
        </ul>

        <div style="margin-top:10px"><b>Teoria — orden global de ${methodLabel}:</b></div>
        ${texBlock(`|E_n| = O(h^{${methodOrder}}) \\;\\Longleftrightarrow\\; \\frac{|E(h/2)|}{|E(h)|} \\approx \\frac{1}{2^{${methodOrder}}} = \\frac{1}{${factor}}`)}
        <div>Si repitieras la simulacion con <code>h/2 = ${fmt(hHalved, 8)}</code>, el error maximo predicho seria aproximadamente <code>${fmt(predictedMaxErrHalved, 10)}</code> (factor ${factor}× menor que el actual).</div>
      </div>
    </div>
  `;
}

/**
 * Comparison panel: run Euler, RK2, RK4 simultaneously and show a side-by-side table.
 */
export function renderMethodComparisonPanel(
  f: OdeFn,
  x0: number, y0: number, xEnd: number, h: number,
  exactFn: ((x: number) => number) | null,
  highlightMethod: 'euler' | 'heun' | 'rk4',
): string {
  const eulerSteps = runEuler(f, x0, y0, xEnd, h, exactFn);
  const heunSteps = runHeun(f, x0, y0, xEnd, h, exactFn);
  const rk4Steps = runRK4(f, x0, y0, xEnd, h, exactFn);
  const hasExact = exactFn !== null;

  const maxN = Math.max(eulerSteps.length, heunSteps.length, rk4Steps.length);

  const rows: string[] = [];
  for (let i = 0; i < maxN; i++) {
    const e = eulerSteps[i];
    const h2 = heunSteps[i];
    const r4 = rk4Steps[i];
    if (!e || !h2 || !r4) continue;

    const mark = (m: 'euler' | 'heun' | 'rk4') => m === highlightMethod ? ' style="background: var(--surface1, #45475a); font-weight: 600"' : '';

    rows.push(`
      <tr>
        <td>${e.n}</td>
        <td>${fmt(e.xn, 6)}</td>
        ${hasExact ? `<td>${fmt(e.exact, 10)}</td>` : ''}
        <td${mark('euler')}>${fmt(e.yn, 10)}</td>
        ${hasExact ? `<td${mark('euler')}>${fmt(e.error, 10)}</td>` : ''}
        <td${mark('heun')}>${fmt(h2.yn, 10)}</td>
        ${hasExact ? `<td${mark('heun')}>${fmt(h2.error, 10)}</td>` : ''}
        <td${mark('rk4')}>${fmt(r4.yn, 10)}</td>
        ${hasExact ? `<td${mark('rk4')}>${fmt(r4.error, 10)}</td>` : ''}
      </tr>
    `);
  }

  const errorsEuler = eulerSteps.map(s => s.error).filter((e): e is number => e !== null);
  const errorsHeun = heunSteps.map(s => s.error).filter((e): e is number => e !== null);
  const errorsRK4 = rk4Steps.map(s => s.error).filter((e): e is number => e !== null);
  const maxEuler = errorsEuler.length > 0 ? Math.max(...errorsEuler) : 0;
  const maxHeun = errorsHeun.length > 0 ? Math.max(...errorsHeun) : 0;
  const maxRK4 = errorsRK4.length > 0 ? Math.max(...errorsRK4) : 0;

  const summary = hasExact ? `
    <div style="margin-top:10px"><b>Comparacion de errores maximos (mismo h = ${fmt(h, 6)}):</b></div>
    <div class="iter-table-wrap" style="margin-top:6px">
      <table class="iter-table">
        <thead><tr><th>Metodo</th><th>Orden global</th><th>|E_max|</th><th>Razon vs RK4</th></tr></thead>
        <tbody>
          <tr><td>Euler</td><td>O(h)</td><td>${fmt(maxEuler, 10)}</td><td>${maxRK4 > 0 ? fmt(maxEuler / maxRK4, 4) : '—'}×</td></tr>
          <tr><td>Heun (RK2)</td><td>O(h²)</td><td>${fmt(maxHeun, 10)}</td><td>${maxRK4 > 0 ? fmt(maxHeun / maxRK4, 4) : '—'}×</td></tr>
          <tr><td>RK4</td><td>O(h⁴)</td><td>${fmt(maxRK4, 10)}</td><td>1×</td></tr>
        </tbody>
      </table>
    </div>
    <div style="margin-top:8px">
      <b>Conclusion:</b> a mayor orden, menor error por el mismo costo en h.
      Para la <em>misma precision</em> RK4 puede usar <code>h</code> mucho mayor que Euler, lo que compensa las 4 evaluaciones de <code>f</code> por paso.
    </div>
  ` : '';

  return `
    <div class="theorem-panel theorem-pass">
      <div class="theorem-header"><span class="theorem-icon">⚖</span> Comparacion Euler vs Heun (RK2) vs RK4</div>
      <div class="theorem-body">
        <div>Las tres simulaciones usan <b>mismo paso h = ${fmt(h, 6)}</b>, <b>misma condicion inicial</b> y <b>mismo intervalo</b>. Comparamos <code>y</code> y el error absoluto por iteracion. La columna resaltada corresponde al metodo actual.</div>
        <div class="iter-table-wrap" style="margin-top:8px; max-height: 400px; overflow-y: auto">
          <table class="iter-table">
            <thead>
              <tr>
                <th>n</th>
                <th>x_n</th>
                ${hasExact ? '<th>y*(x_n) exacta</th>' : ''}
                <th>y Euler</th>
                ${hasExact ? '<th>|E| Euler</th>' : ''}
                <th>y Heun (RK2)</th>
                ${hasExact ? '<th>|E| RK2</th>' : ''}
                <th>y RK4</th>
                ${hasExact ? '<th>|E| RK4</th>' : ''}
              </tr>
            </thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>
        ${summary}
      </div>
    </div>
  `;
}
