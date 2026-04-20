import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { checkLipschitz, renderLipschitzPanel } from '../../theorems';

export const aitken: MethodDefinition = {
  id: 'aitken',
  name: 'Aceleracion de Aitken (Δ²)',
  category: 'rootFinding',
  formula: 'x̂_n = x_n - (x_{n+1} - x_n)² / (x_{n+2} - 2x_{n+1} + x_n)',
  description: 'Acelera la convergencia de punto fijo usando extrapolacion delta-cuadrado de Aitken.',
  inputs: [
    { id: 'gx', label: 'g(x)', placeholder: '(x + 2/x) / 2', hint: 'Funcion de iteracion x = g(x)', defaultValue: '(x + 2/x) / 2' },
    { id: 'x0', label: 'x₀ (valor inicial)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'tol', label: 'Tolerancia', placeholder: '1e-6', defaultValue: '1e-6' },
    { id: 'maxIter', label: 'Max iteraciones', placeholder: '100', type: 'number', defaultValue: '100' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: 'p.ej. 1.41421356', type: 'number', hint: 'Si se provee, agrega columna de error relativo %.' },
    { id: 'a', label: 'a (para Lipschitz, opcional)', placeholder: '0.5', type: 'number', hint: 'Extremo inferior para verificar |g\'(x)| < 1.' },
    { id: 'b', label: 'b (para Lipschitz, opcional)', placeholder: '2', type: 'number', hint: 'Extremo superior para verificar |g\'(x)| < 1.' },
  ],
  tableColumns: [
    { key: 'iter', label: 'n' },
    { key: 'xn', label: 'x_n (plain)' },
    { key: 'xn_aitken', label: 'x̂_n (Aitken)' },
    { key: 'error_plain', label: 'Error plain' },
    { key: 'error_aitken', label: 'Error Aitken' },
    { key: 'relErrPct', label: 'Err. rel. %' },
  ],
  steps: [
    'Parti de <code>f(x) = 0</code> y <b>despeja una funcion auxiliar</b> <code>g(x)</code> tal que <code>x = g(x)</code>. Para <code>f(x) = cos(x) - x</code>, la auxiliar directa es <code>g(x) = cos(x)</code>. Para <code>f(x) = eˣ - 3x²</code>, podes usar <code>g(x) = sqrt(exp(x)/3)</code> u otra que converja.',
    'Verifica <b>condicion de Lipschitz</b> en un compacto [a, b] alrededor de la raiz: <code>|g\'(x)| &lt; 1</code> para todo x en [a, b]. Si no se cumple, el punto fijo no converge — proba otra <code>g(x)</code> equivalente. Completa los campos <em>a</em> y <em>b</em>; la app te muestra un panel con el chequeo y el grafico de <code>|g\'(x)|</code>.',
    'Escribe <code>g(x)</code> en el primer campo. Semilla <code>x₀</code>: el parcial la especifica (ej. <code>0.5</code> para cos(x) - x en [0, 1]).',
    'Configura tolerancia: el parcial pide <em>6 cifras de precision</em>, usa <code>1e-6</code>.',
    'Opcional para el analisis: pega el valor exacto (calculalo con Newton-Raphson primero si no lo sabes) en "Valor exacto".',
    'Pulsa <b>Resolver</b>. La tabla compara dos columnas: <code>x_n (plain)</code> = iteracion cruda <code>g(g(...g(x₀)))</code>, y <code>x̂_n (Aitken)</code> = iteracion acelerada por formula Δ²: <code>x̂_n = x_n - (x_{n+1}-x_n)² / (x_{n+2} - 2x_{n+1} + x_n)</code>.',
    'Analisis para el informe: <em>Aitken reduce drasticamente el numero de iteraciones</em> respecto a punto fijo crudo. Mostra ambos errores en la misma tabla para justificar la aceleracion. Si punto fijo crudo tarda ~30 iter y Aitken converge en ~5, es el numero que hay que reportar.',
    'Comparacion de metodos para el parcial: <b>Aitken</b> necesita solo <code>g(x)</code> (no derivada), pero la convergencia depende de cuan chico es <code>|g\'(x*)|</code>. <b>Newton</b> necesita <code>f\'(x)</code> pero siempre es cuadratico cerca de la raiz. <b>Steffensen</b> es Aitken aplicado <em>dentro</em> de cada paso → convergencia cuadratica sin derivada.',
  ],

  solve(params) {
    const g = parseExpression(params.gx);
    const x0 = parseFloat(params.x0);
    const tol = parseFloat(params.tol) || 1e-6;
    const maxIter = parseInt(params.maxIter) || 100;
    const exactRaw = (params.exact ?? '').trim();
    const exact = exactRaw === '' ? undefined : parseFloat(exactRaw);

    if (isNaN(x0)) throw new Error('x₀ debe ser un numero valido');

    const relErrOf = (val: number): number | null => {
      if (exact === undefined || isNaN(exact)) return null;
      const denom = Math.abs(exact) > 1e-14 ? Math.abs(exact) : 1;
      return Math.abs(val - exact) / denom * 100;
    };

    const iterations: MethodResult['iterations'] = [];
    let converged = false;
    let error = Infinity;

    // Generate plain fixed-point sequence
    const plain: number[] = [x0];
    let x = x0;
    for (let i = 0; i < maxIter + 2; i++) {
      x = g(x);
      if (isNaN(x) || !isFinite(x)) break;
      plain.push(x);
    }

    // Apply Aitken acceleration: x̂_n = x_n - (x_{n+1} - x_n)^2 / (x_{n+2} - 2*x_{n+1} + x_n)
    let lastAitken = x0;
    for (let n = 0; n < plain.length - 2 && n < maxIter; n++) {
      const xn = plain[n];
      const xn1 = plain[n + 1];
      const xn2 = plain[n + 2];

      const denom = xn2 - 2 * xn1 + xn;
      let aitkenVal: number;

      if (Math.abs(denom) < 1e-14) {
        aitkenVal = xn2; // Can't accelerate, use plain value
      } else {
        aitkenVal = xn - (xn1 - xn) ** 2 / denom;
      }

      const errorPlain = n > 0 ? Math.abs(plain[n] - plain[n - 1]) : Math.abs(xn1 - xn);
      const errorAitken = Math.abs(aitkenVal - lastAitken);
      error = errorAitken;

      iterations.push({
        iter: n + 1,
        xn: plain[n + 1],
        xn_aitken: aitkenVal,
        error_plain: errorPlain,
        error_aitken: errorAitken,
        relErrPct: relErrOf(aitkenVal),
      });

      if (errorAitken < tol) {
        converged = true;
        lastAitken = aitkenVal;
        break;
      }
      lastAitken = aitkenVal;
    }

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

    const relFinal = relErrOf(lastAitken);
    return {
      root: lastAitken,
      iterations,
      converged,
      error,
      exact,
      relativeErrorPercent: relFinal ?? undefined,
      theoremPanels,
    };
  },

  getCharts(params, result) {
    const g = parseExpression(params.gx);
    const x0 = parseFloat(params.x0);
    const root = result.root ?? x0;

    const allX = result.iterations.flatMap(r => [r.xn as number, r.xn_aitken as number]);
    const minX = Math.min(...allX, root) - 1;
    const maxX = Math.max(...allX, root) + 1;
    const xs = linspace(minX, maxX, 500);
    const gys = xs.map(x => g(x));

    const chart1: ChartData = {
      title: 'g(x) y y = x',
      type: 'line',
      datasets: [
        { label: 'g(x)', x: xs, y: gys, color: '#89b4fa' },
        { label: 'y = x', x: xs, y: [...xs], color: '#585b70', dashed: true },
        { label: 'Punto fijo', x: [root], y: [root], color: '#a6e3a1', pointRadius: 6, showLine: false },
      ],
      xLabel: 'x', yLabel: 'y',
    };

    const iters = result.iterations.map(r => r.iter as number);
    const plainVals = result.iterations.map(r => r.xn as number);
    const aitkenVals = result.iterations.map(r => r.xn_aitken as number);

    const chart2: ChartData = {
      title: 'Comparacion: Plain vs Aitken',
      type: 'line',
      datasets: [
        { label: 'Punto fijo', x: iters, y: plainVals, color: '#f38ba8', pointRadius: 3 },
        { label: 'Aitken', x: iters, y: aitkenVals, color: '#a6e3a1', pointRadius: 3 },
      ],
      xLabel: 'Iteracion', yLabel: 'x_n',
    };

    const errPlain = result.iterations.map(r => r.error_plain as number).filter(e => e > 0);
    const errAitken = result.iterations.map(r => r.error_aitken as number).filter(e => e > 0);
    const minLen = Math.min(errPlain.length, errAitken.length);

    const chart3: ChartData = {
      title: 'Comparacion de errores',
      type: 'line',
      datasets: [
        { label: 'Error plain', x: iters.slice(0, errPlain.length), y: errPlain, color: '#f38ba8', pointRadius: 2 },
        { label: 'Error Aitken', x: iters.slice(0, errAitken.length), y: errAitken, color: '#a6e3a1', pointRadius: 2 },
      ],
      xLabel: 'Iteracion', yLabel: 'Error', yLog: true,
    };

    const chart4: ChartData = {
      title: 'Secuencia Aitken',
      type: 'line',
      datasets: [{ label: 'x̂_n', x: iters, y: aitkenVals, color: '#cba6f7', pointRadius: 3 }],
      xLabel: 'Iteracion', yLabel: 'x̂_n',
    };

    return [chart1, chart2, chart3, chart4];
  },
};
