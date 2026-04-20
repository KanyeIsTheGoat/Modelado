import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { checkLipschitz, renderLipschitzPanel } from '../../theorems';

export const steffensen: MethodDefinition = {
  id: 'steffensen',
  name: 'Steffensen (aceleracion Δ² en cada iteracion)',
  category: 'rootFinding',
  formula: 'p_{n+1} = p_n - (g(p_n) - p_n)² / (g(g(p_n)) - 2g(p_n) + p_n)',
  description: 'Aplica la extrapolacion delta-cuadrado de Aitken dentro de cada iteracion de punto fijo, alcanzando convergencia cuadratica cuando g es C² cerca del punto fijo.',
  inputs: [
    { id: 'gx', label: 'g(x)', placeholder: '(x + 2/x) / 2', hint: 'Funcion de iteracion x = g(x)', defaultValue: '(x + 2/x) / 2' },
    { id: 'x0', label: 'p₀ (valor inicial)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'tol', label: 'Tolerancia', placeholder: '1e-8', defaultValue: '1e-8' },
    { id: 'maxIter', label: 'Max iteraciones', placeholder: '50', type: 'number', defaultValue: '50' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: 'p.ej. 1.41421356', type: 'number', hint: 'Si se provee, agrega columna de error relativo %.' },
    { id: 'a', label: 'a (para Lipschitz, opcional)', placeholder: '0.5', type: 'number', hint: 'Extremo inferior para verificar |g\'(x)| < 1.' },
    { id: 'b', label: 'b (para Lipschitz, opcional)', placeholder: '2', type: 'number', hint: 'Extremo superior para verificar |g\'(x)| < 1.' },
  ],
  tableColumns: [
    { key: 'iter', label: 'n' },
    { key: 'p', label: 'p_n' },
    { key: 'gp', label: 'g(p_n)' },
    { key: 'ggp', label: 'g(g(p_n))' },
    { key: 'pNext', label: 'p_{n+1}' },
    { key: 'error', label: '|p_{n+1} − p_n|' },
    { key: 'relErrPct', label: 'Err. rel. %' },
  ],
  steps: [
    'Primero verifica <b>Bolzano</b>: el parcial suele pedir "demostrar que existe al menos una raiz en [a, b]". Evalua <code>f(a)</code> y <code>f(b)</code> — si tienen signos opuestos (<code>f(a)·f(b) &lt; 0</code>) y <code>f</code> es continua, hay raiz. Para <code>f(x) = x³ - sin(x) - 5</code> en [0, 2]: <code>f(0) = -5</code>, <code>f(2) = 8 - sin(2) - 5 ≈ 2.09</code>. Signos opuestos → Bolzano OK.',
    '<b>Despeja g(x)</b> a partir de <code>f(x) = 0</code>. Para <code>x³ - sin(x) - 5 = 0</code> podes usar <code>g(x) = (sin(x) + 5)^(1/3)</code>. La idea es que <code>x = g(x)</code> sea equivalente a <code>f(x) = 0</code>.',
    'Verifica <b>Lipschitz</b> en un compacto alrededor de la semilla: <code>|g\'(x)| &lt; 1</code> para todo x en [a, b]. Completa los campos <em>a</em> y <em>b</em> con el intervalo del parcial (ej. [0, 2]) y la app calcula <code>max |g\'(x)|</code> y muestra un panel con el chequeo.',
    'Escribe <code>g(x)</code> en el primer campo y la semilla <code>p₀</code> del parcial (ej. <code>2</code>). Tolerancia tipica: <code>1e-8</code> para 8 decimales o <code>1e-6</code> para 6 cifras significativas.',
    'Opcional pero recomendado: corre Newton-Raphson primero para obtener una raiz de referencia y pegala en "Valor exacto". Asi podes mostrar el error relativo % que decae cuadraticamente.',
    'Pulsa <b>Resolver</b>. En cada iteracion la app calcula <code>g(p_n)</code>, luego <code>g(g(p_n))</code>, y aplica la formula Δ² de Steffensen: <code>p_{n+1} = p_n - (g(p_n) - p_n)² / (g(g(p_n)) - 2·g(p_n) + p_n)</code>. El resultado se <em>reinyecta</em> como nuevo <code>p_n</code>.',
    'Analiza: Steffensen alcanza <b>convergencia cuadratica</b> (error decae como el cuadrado del anterior) con solo 2 evaluaciones de g por paso — sin necesitar <code>f\'(x)</code>. En el parcial se compara contra Newton: Steffensen llega a la misma precision con parecido numero de iteraciones pero sin derivada.',
    'Si la columna <code>g(g(p_n)) - 2g(p_n) + p_n</code> se acerca a cero, es buena señal (convergencia casi exacta) pero puede causar inestabilidad numerica — la app detecta este caso y muestra un mensaje.',
    'Para el informe: tabla con <code>p_n, g(p_n), g(g(p_n)), p_{n+1}, error</code>, grafica <code>g(x)</code> vs <code>y = x</code> con el punto fijo marcado, y comparativa Newton vs Aitken vs Steffensen (iteraciones, precision, complejidad).',
  ],

  solve(params) {
    const g = parseExpression(params.gx);
    let p = parseFloat(params.x0);
    const tol = parseFloat(params.tol) || 1e-8;
    const maxIter = parseInt(params.maxIter) || 50;
    const exactRaw = (params.exact ?? '').trim();
    const exact = exactRaw === '' ? undefined : parseFloat(exactRaw);

    if (isNaN(p)) throw new Error('p₀ debe ser un numero valido');

    const iterations: MethodResult['iterations'] = [];
    let converged = false;
    let error = Infinity;
    let message: string | undefined;

    for (let i = 1; i <= maxIter; i++) {
      const gp = g(p);
      const ggp = g(gp);
      const denom = ggp - 2 * gp + p;

      let pNext: number;
      if (Math.abs(denom) < 1e-15) {
        pNext = ggp;
        message = 'Denominador Δ² ≈ 0 — convergencia exacta o estancamiento';
      } else {
        pNext = p - Math.pow(gp - p, 2) / denom;
      }

      error = Math.abs(pNext - p);
      const relErrPct: number | null = exact !== undefined && !isNaN(exact) && exact !== 0
        ? Math.abs(pNext - exact) / Math.abs(exact) * 100
        : null;

      iterations.push({ iter: i, p, gp, ggp, pNext, error, relErrPct });

      if (!isFinite(pNext)) {
        return { root: p, iterations, converged: false, error, message: 'Divergencia detectada' };
      }

      p = pNext;
      if (error < tol) {
        converged = true;
        break;
      }
    }

    // Lipschitz panel (optional, only if a/b supplied)
    const theoremPanels: string[] = [];
    const aRaw = (params.a ?? '').trim();
    const bRaw = (params.b ?? '').trim();
    if (aRaw !== '' && bRaw !== '') {
      const a = parseFloat(aRaw);
      const b = parseFloat(bRaw);
      if (!isNaN(a) && !isNaN(b) && a < b) {
        const lip = checkLipschitz(params.gx, a, b);
        theoremPanels.push(renderLipschitzPanel(lip));
      }
    }

    return {
      root: p,
      iterations,
      converged,
      error,
      exact,
      relativeErrorPercent: exact !== undefined && !isNaN(exact)
        ? (exact !== 0 ? Math.abs(p - exact) / Math.abs(exact) * 100 : Math.abs(p - exact) * 100)
        : undefined,
      theoremPanels,
      message,
    };
  },

  getCharts(params, result) {
    const g = parseExpression(params.gx);
    const x0 = parseFloat(params.x0);
    const root = result.root ?? x0;

    const ps = result.iterations.map(r => r.p as number);
    const minX = Math.min(...ps, root) - 1;
    const maxX = Math.max(...ps, root) + 1;
    const xs = linspace(minX, maxX, 500);
    const gys = xs.map(x => g(x));

    const chart1: ChartData = {
      title: 'g(x) y y = x',
      type: 'line',
      datasets: [
        { label: 'g(x)', x: xs, y: gys, color: '#89b4fa' },
        { label: 'y = x', x: xs, y: [...xs], color: '#585b70', dashed: true },
        { label: 'p*', x: [root], y: [root], color: '#a6e3a1', pointRadius: 6, showLine: false },
      ],
      xLabel: 'x', yLabel: 'y',
    };

    const iters = result.iterations.map(r => r.iter as number);
    const pVals = result.iterations.map(r => r.p as number);
    const pNextVals = result.iterations.map(r => r.pNext as number);

    const chart2: ChartData = {
      title: 'Convergencia p_n y p_{n+1}',
      type: 'line',
      datasets: [
        { label: 'p_n', x: iters, y: pVals, color: '#f38ba8', pointRadius: 3 },
        { label: 'p_{n+1}', x: iters, y: pNextVals, color: '#a6e3a1', pointRadius: 3 },
      ],
      xLabel: 'Iteracion', yLabel: 'Valor',
    };

    const errs = result.iterations.map(r => r.error as number).filter(e => e > 0);
    const chart3: ChartData = {
      title: 'Error por iteracion',
      type: 'line',
      datasets: [{ label: '|p_{n+1} - p_n|', x: iters.slice(0, errs.length), y: errs, color: '#fab387', pointRadius: 2 }],
      xLabel: 'Iteracion', yLabel: 'Error', yLog: true,
    };

    const relErrs = result.iterations.map(r => r.relErrPct).filter(v => v !== null && v !== undefined) as number[];
    const chart4: ChartData = relErrs.length > 0
      ? {
          title: 'Error relativo % (vs valor exacto)',
          type: 'line',
          datasets: [{ label: '% error', x: iters.slice(0, relErrs.length), y: relErrs, color: '#cba6f7', pointRadius: 3 }],
          xLabel: 'Iteracion', yLabel: '% error', yLog: true,
        }
      : {
          title: 'g(g(x)) y g(x)',
          type: 'line',
          datasets: [
            { label: 'g(x)', x: xs, y: gys, color: '#89b4fa' },
            { label: 'g(g(x))', x: xs, y: xs.map(x => g(g(x))), color: '#cba6f7' },
            { label: 'y = x', x: xs, y: [...xs], color: '#585b70', dashed: true },
          ],
          xLabel: 'x', yLabel: 'y',
        };

    return [chart1, chart2, chart3, chart4];
  },
};
