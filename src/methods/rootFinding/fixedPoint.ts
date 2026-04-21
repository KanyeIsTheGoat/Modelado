import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { checkLipschitz, renderLipschitzPanel } from '../../theorems';
import { parseStop, computeErrors, hasConverged, describeStop, withExactErrors } from '../../stoppingCriteria';

export const fixedPoint: MethodDefinition = {
  id: 'fixedPoint',
  name: 'Punto Fijo',
  category: 'rootFinding',
  formula: 'x_{n+1} = g(x_n), converge si |g\'(x)| < 1',
  latexFormula: "x_{n+1} = g(x_n), \\quad \\text{converge si } |g'(x)| < 1 \\text{ en un entorno del punto fijo}",
  description: 'Iteracion de punto fijo. Reescribir f(x)=0 como x=g(x) y iterar.',
  inputs: [
    { id: 'gx', label: 'g(x)', placeholder: '(x + 2/x) / 2', hint: 'Funcion de iteracion x = g(x)', defaultValue: '(x + 2/x) / 2' },
    { id: 'x0', label: 'x₀ (valor inicial)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'stop', label: 'Criterio de parada', placeholder: '1e-6', type: 'stopCriterion', defaultValue: 'tolerancia:1e-6', hint: 'Elige el criterio que pide el ejercicio: tolerancia, error absoluto/relativo, cifras significativas, etc.' },
    { id: 'maxIter', label: 'Max iteraciones', placeholder: '100', type: 'number', defaultValue: '100' },
    { id: 'a', label: 'a (para Lipschitz, opcional)', placeholder: '0.5', type: 'number', hint: 'Extremo inferior para verificar |g\'(x)| < 1.' },
    { id: 'b', label: 'b (para Lipschitz, opcional)', placeholder: '2', type: 'number', hint: 'Extremo superior para verificar |g\'(x)| < 1.' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: 'p.ej. 1.41421356', type: 'number', hint: 'Si se provee, habilita criterios de parada vs exacto.' },
  ],
  tableColumns: [
    { key: 'iter', label: 'n', latex: 'n' },
    { key: 'xn', label: 'x_n', latex: 'x_n' },
    { key: 'gxn', label: 'g(x_n)', latex: 'g(x_n)' },
    { key: 'errAbs', label: '|Δx| abs', latex: '|\\Delta x|' },
    { key: 'errRel', label: 'Err. rel.', latex: '\\varepsilon_{\\text{rel}}' },
    { key: 'errRelPct', label: 'Err. rel. %', latex: '\\varepsilon_{\\text{rel}}\\,(\\%)' },
  ],
  steps: [
    'Parti de <code>f(x) = 0</code> y <b>despeja</b> una funcion <code>g(x)</code> equivalente: <code>x = g(x)</code>. Para <code>x² = 2</code> → <code>g(x) = (x + 2/x)/2</code>. Casi siempre hay multiples formas validas; conviene la que sea <em>contractiva</em>.',
    '<b>Verifica Lipschitz</b>: <code>|g\'(x)| &lt; 1</code> en un intervalo [a, b] que contenga la semilla y el punto fijo. Completa los campos <em>a</em> y <em>b</em> — la app calcula <code>max |g\'(x)|</code> numericamente y te dice si el metodo va a converger.',
    'Elegi semilla <code>x₀</code> cerca del punto fijo (lo mas cerca posible para acelerar la convergencia).',
    'Tolerancia: <code>1e-6</code> si el parcial pide 6 cifras.',
    'Pulsa <b>Resolver</b>. Cada fila es simplemente <code>x_{n+1} = g(x_n)</code>. La convergencia es <em>lineal</em>: el error se multiplica por <code>|g\'(x*)|</code> en cada paso.',
    'Si converge pero lento, usa <b>Aitken</b> (acelera la sucesion completa) o <b>Steffensen</b> (acelera dentro de cada paso → cuadratico).',
    'Si diverge u oscila, tu <code>g(x)</code> no es contractiva cerca de la raiz. Probar otra forma de despeje.',
  ],

  solve(params) {
    const g = parseExpression(params.gx);
    let x = parseFloat(params.x0);
    const stop = parseStop(params.stop);
    const maxIter = parseInt(params.maxIter) || 100;
    const exactRaw = (params.exact ?? '').trim();
    const exact = exactRaw === '' ? undefined : parseFloat(exactRaw);

    if (isNaN(x)) throw new Error('x₀ debe ser un numero valido');

    const iterations: MethodResult['iterations'] = [];
    let converged = false;
    let error = Infinity;

    for (let i = 1; i <= maxIter; i++) {
      const xNew = g(x);
      const errs = computeErrors(x, xNew);
      error = errs.errAbs;

      iterations.push({ iter: i, xn: x, gxn: xNew, errAbs: errs.errAbs, errRel: errs.errRel, errRelPct: errs.errRelPct });

      if (isNaN(xNew) || !isFinite(xNew)) {
        return { root: x, iterations, converged: false, error, message: 'Divergencia detectada' };
      }

      const errsFull = withExactErrors(errs, xNew, exact);
      if (hasConverged(stop, errsFull)) {
        converged = true;
        x = xNew;
        break;
      }
      x = xNew;
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
    return { root: x, iterations, converged, error, theoremPanels, message: `Criterio: ${describeStop(stop)}` };
  },

  getCharts(params, result) {
    const g = parseExpression(params.gx);
    const x0 = parseFloat(params.x0);
    const root = result.root ?? x0;

    // Determine plot range
    const allX = result.iterations.map(r => r.xn as number);
    const minX = Math.min(...allX, root) - 1;
    const maxX = Math.max(...allX, root) + 1;
    const xs = linspace(minX, maxX, 500);
    const gys = xs.map(x => g(x));
    const fys = xs.map(x => g(x) - x);

    // Chart 1: f(x) = g(x) - x with root marked
    const chart1: ChartData = {
      title: 'f(x) = g(x) − x  (raiz ≡ punto fijo)',
      type: 'line',
      datasets: [
        { label: 'f(x) = g(x) − x', x: xs, y: fys, color: '#89b4fa' },
        { label: 'y=0', x: [xs[0], xs[xs.length - 1]], y: [0, 0], color: '#585b70', dashed: true },
        ...(result.root !== undefined ? [{
          label: 'Raiz', x: [root], y: [0], color: '#a6e3a1', pointRadius: 6, showLine: false as const,
        }] : []),
      ],
      xLabel: 'x',
      yLabel: 'f(x)',
    };

    // Chart 1b: g(x) and y=x (kept for fixed-point visualization via cobweb chart below)
    const chartGx: ChartData = {
      title: 'g(x) y y = x',
      type: 'line',
      datasets: [
        { label: 'g(x)', x: xs, y: gys, color: '#89b4fa' },
        { label: 'y = x', x: xs, y: [...xs], color: '#585b70', dashed: true },
        ...(result.root !== undefined ? [{
          label: 'Punto fijo', x: [root], y: [root], color: '#a6e3a1', pointRadius: 6, showLine: false as const,
        }] : []),
      ],
      xLabel: 'x',
      yLabel: 'y',
    };

    // Chart 2: Cobweb diagram
    const cobwebX: number[] = [];
    const cobwebY: number[] = [];
    let cx = x0;
    cobwebX.push(cx);
    cobwebY.push(0);
    for (let i = 0; i < Math.min(result.iterations.length, 30); i++) {
      const gcx = g(cx);
      cobwebX.push(cx);
      cobwebY.push(gcx);
      cobwebX.push(gcx);
      cobwebY.push(gcx);
      cx = gcx;
    }

    const chart2: ChartData = {
      title: 'Diagrama de Telarana (Cobweb)',
      type: 'line',
      datasets: [
        { label: 'g(x)', x: xs, y: gys, color: '#89b4fa' },
        { label: 'y = x', x: xs, y: [...xs], color: '#585b70', dashed: true },
        { label: 'Cobweb', x: cobwebX, y: cobwebY, color: '#fab387', pointRadius: 0 },
      ],
      xLabel: 'x',
      yLabel: 'y',
    };

    // Chart 3: x_n convergence
    const iters = result.iterations.map(r => r.iter as number);
    const xnVals = result.iterations.map(r => r.xn as number);
    const chart3: ChartData = {
      title: 'Convergencia de x_n',
      type: 'line',
      datasets: [
        { label: 'x_n', x: iters, y: xnVals, color: '#cba6f7', pointRadius: 3 },
      ],
      xLabel: 'Iteracion',
      yLabel: 'x_n',
    };

    // Chart 4: Error
    const errors = result.iterations.map(r => r.errAbs as number).filter(e => e > 0);
    const chart4: ChartData = {
      title: 'Convergencia del error',
      type: 'line',
      datasets: [
        { label: '|error|', x: iters.slice(0, errors.length), y: errors, color: '#fab387', pointRadius: 2 },
      ],
      xLabel: 'Iteracion',
      yLabel: 'Error',
      yLog: true,
    };

    return [chart1, chartGx, chart2, chart4];
  },
};
