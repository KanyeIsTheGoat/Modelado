import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace, numericalDerivative } from '../../parser';
import { parseStop, computeErrors, hasConverged, describeStop, withExactErrors } from '../../stoppingCriteria';

export const newtonRaphson: MethodDefinition = {
  id: 'newtonRaphson',
  name: 'Newton-Raphson',
  category: 'rootFinding',
  formula: 'x_{n+1} = x_n - f(x_n) / f\'(x_n)',
  latexFormula: "x_{n+1} = x_n - \\frac{f(x_n)}{f'(x_n)}",
  description: 'Metodo de la tangente. Convergencia cuadratica cerca de la raiz. Requiere f\'(x).',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^3 - x - 2', defaultValue: 'x^3 - x - 2' },
    { id: 'dfx', label: "f'(x) (dejar vacio para derivada numerica)", placeholder: '3*x^2 - 1', hint: 'Derivada analitica. Si se deja vacio se usa derivada numerica central.', defaultValue: '3*x^2 - 1' },
    { id: 'x0', label: 'x₀ (valor inicial)', placeholder: '2', type: 'number', defaultValue: '2' },
    { id: 'stop', label: 'Criterio de parada', placeholder: '1e-6', type: 'stopCriterion', defaultValue: 'tolerancia:1e-6', hint: 'Elige el criterio que pide el ejercicio: tolerancia, error absoluto/relativo, cifras significativas, etc.' },
    { id: 'maxIter', label: 'Max iteraciones', placeholder: '100', type: 'number', defaultValue: '100' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: 'p.ej. 1.52138', type: 'number', hint: 'Si se provee, agrega columna de error relativo %.' },
  ],
  tableColumns: [
    { key: 'iter', label: 'n' },
    { key: 'xn', label: 'x_n' },
    { key: 'fxn', label: 'f(x_n)' },
    { key: 'dfxn', label: "f'(x_n)" },
    { key: 'xNext', label: 'x_{n+1}' },
    { key: 'errAbs', label: '|Δx| abs' },
    { key: 'errRel', label: 'Err. rel.' },
    { key: 'errRelPct', label: 'Err. rel. %' },
    { key: 'errAbsExact', label: '|x-exacto| abs' },
    { key: 'errRelExact', label: 'Err. rel. vs exacto' },
    { key: 'relErrExactPct', label: 'Err. vs exacto %' },
  ],
  steps: [
    'Escribi la funcion <code>f(x)</code> en el primer campo. Ej: <code>x^3 - 3x - 4</code>.',
    'Calcula <b>f\'(x)</b> analiticamente (derivada simbolica) y escribila en el segundo campo. Para <code>x^3 - 3x - 4</code> la derivada es <code>3*x^2 - 3</code>. Si dejas el campo vacio, el metodo usa derivada numerica central como respaldo — no recomendado para el parcial porque pierde precision.',
    'Ubica la <b>raiz aproximada</b>: mira la grafica de <code>f(x)</code> o aplica <em>Bolzano</em>: si <code>f(a)·f(b) &lt; 0</code> en el intervalo pedido, hay al menos una raiz adentro. Elegi <code>x₀</code> cerca de la raiz (tipicamente el extremo donde el signo cambia o el punto medio).',
    'Configura la <b>tolerancia</b>: en el parcial suele pedirse <code>1e-8</code> (8 cifras) o "error menor al 1 %". Si piden 6 cifras significativas, usa <code>1e-6</code>.',
    'Opcional pero recomendado para el parcial: en "Valor exacto" pega la raiz conocida (si viene en el enunciado) o una corrida previa con alta precision. Asi la tabla muestra el <em>error relativo %</em> por iteracion para demostrar que cae por debajo del 1 %.',
    'Pulsa <b>Resolver</b>. La tabla genera las columnas <code>n, x_n, f(x_n), f\'(x_n), |x_{n+1}-x_n|, Err. rel. %</code>. Cada fila aplica <code>x_{n+1} = x_n - f(x_n)/f\'(x_n)</code>.',
    'Analiza convergencia: Newton-Raphson tiene <em>convergencia cuadratica</em> cerca de la raiz. El error deberia mas o menos duplicar sus cifras por iteracion (3 → 6 → 12 decimales correctos). Si se estanca o diverge, la semilla esta lejos o <code>f\'(x₀) ≈ 0</code>.',
    'Para el informe: captura la tabla, la grafica con la raiz marcada, exporta con <b>Exportar reporte</b>, y agrega un breve analisis de velocidad de convergencia comparando con Aitken/Steffensen si el parcial lo pide.',
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    const dfExpr = params.dfx?.trim();
    const df = dfExpr ? parseExpression(dfExpr) : (x: number) => numericalDerivative(f, x);

    let x = parseFloat(params.x0);
    const stop = parseStop(params.stop);
    const maxIter = parseInt(params.maxIter) || 100;
    const exactRaw = (params.exact ?? '').trim();
    const exact = exactRaw === '' ? undefined : parseFloat(exactRaw);

    if (isNaN(x)) throw new Error('x₀ debe ser un numero valido');

    const iterations: MethodResult['iterations'] = [];
    let converged = false;
    let error = Infinity;

    const exactErrorsOf = (val: number): { errAbsExact: number | null; errRelExact: number | null; relErrExactPct: number | null } => {
      if (exact === undefined || isNaN(exact)) return { errAbsExact: null, errRelExact: null, relErrExactPct: null };
      const diff = Math.abs(val - exact);
      const denom = Math.abs(exact) > 1e-14 ? Math.abs(exact) : 1;
      const rel = diff / denom;
      return { errAbsExact: diff, errRelExact: rel, relErrExactPct: rel * 100 };
    };

    for (let i = 1; i <= maxIter; i++) {
      const fxn = f(x);
      const dfxn = df(x);

      if (Math.abs(dfxn) < 1e-14) {
        const ex = exactErrorsOf(x);
        iterations.push({ iter: i, xn: x, fxn, dfxn, xNext: null, errAbs: error, errRel: 0, errRelPct: 0, ...ex });
        return { root: x, iterations, converged: false, error, exact, message: "f'(x) ≈ 0, division por cero" };
      }

      const xNew = x - fxn / dfxn;
      const errs = i === 1
        ? { errAbs: Math.abs(xNew - x), errRel: 0, errRelPct: 0 }
        : computeErrors(x, xNew);
      error = errs.errAbs;

      const ex = exactErrorsOf(xNew);
      iterations.push({ iter: i, xn: x, fxn, dfxn, xNext: xNew, errAbs: errs.errAbs, errRel: errs.errRel, errRelPct: errs.errRelPct, ...ex });

      if (isNaN(xNew) || !isFinite(xNew)) {
        return { root: x, iterations, converged: false, error, exact, message: 'Divergencia detectada' };
      }

      const errsFull = withExactErrors(errs, xNew, exact);
      if (Math.abs(fxn) < 1e-15 || (i > 1 && hasConverged(stop, errsFull))) {
        converged = true;
        x = xNew;
        break;
      }
      x = xNew;
    }

    const relFinal = exactErrorsOf(x).relErrExactPct;
    return {
      root: x,
      iterations,
      converged,
      error,
      exact,
      relativeErrorPercent: relFinal ?? undefined,
      message: `Criterio: ${describeStop(stop)}`,
    };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const dfExpr = params.dfx?.trim();
    const df = dfExpr ? parseExpression(dfExpr) : (x: number) => numericalDerivative(f, x);
    const root = result.root ?? parseFloat(params.x0);

    const allX = result.iterations.map(r => r.xn as number);
    const minX = Math.min(...allX, root) - 1;
    const maxX = Math.max(...allX, root) + 1;
    const xs = linspace(minX, maxX, 500);
    const ys = xs.map(x => f(x));

    // Chart 1: f(x) with root
    const chart1: ChartData = {
      title: 'f(x)',
      type: 'line',
      datasets: [
        { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
        { label: 'y=0', x: [xs[0], xs[xs.length - 1]], y: [0, 0], color: '#585b70', dashed: true },
        { label: 'Raiz', x: [root], y: [0], color: '#a6e3a1', pointRadius: 6, showLine: false },
      ],
      xLabel: 'x', yLabel: 'f(x)',
    };

    // Chart 2: Tangent lines
    const tangentDatasets: ChartData['datasets'] = [
      { label: 'f(x)', x: xs, y: ys, color: '#89b4fa' },
      { label: 'y=0', x: [xs[0], xs[xs.length - 1]], y: [0, 0], color: '#585b70', dashed: true },
    ];
    const nTangents = Math.min(result.iterations.length, 6);
    for (let i = 0; i < nTangents; i++) {
      const xn = result.iterations[i].xn as number;
      const fxn = f(xn);
      const dfxn = df(xn);
      // Tangent: y = f(xn) + f'(xn)*(t - xn), find t where y=0: t = xn - f(xn)/f'(xn)
      const xInt = xn - fxn / dfxn;
      const t0 = Math.min(xn, xInt) - 0.2;
      const t1 = Math.max(xn, xInt) + 0.2;
      tangentDatasets.push({
        label: `Tangente n=${i + 1}`,
        x: [t0, t1],
        y: [fxn + dfxn * (t0 - xn), fxn + dfxn * (t1 - xn)],
        color: `hsl(${30 + i * 40}, 80%, 65%)`,
        dashed: true,
        pointRadius: 0,
      });
    }
    const chart2: ChartData = {
      title: 'Lineas tangentes',
      type: 'line',
      datasets: tangentDatasets,
      xLabel: 'x', yLabel: 'y',
    };

    // Chart 3: x_n convergence
    const iters = result.iterations.map(r => r.iter as number);
    const xnVals = result.iterations.map(r => r.xn as number);
    const chart3: ChartData = {
      title: 'Convergencia de x_n',
      type: 'line',
      datasets: [{ label: 'x_n', x: iters, y: xnVals, color: '#cba6f7', pointRadius: 3 }],
      xLabel: 'Iteracion', yLabel: 'x_n',
    };

    // Chart 4: Error
    const errors = result.iterations.map(r => r.errAbs as number).filter(e => e > 0);
    const chart4: ChartData = {
      title: 'Convergencia del error',
      type: 'line',
      datasets: [{ label: '|error|', x: iters.slice(0, errors.length), y: errors, color: '#fab387', pointRadius: 2 }],
      xLabel: 'Iteracion', yLabel: 'Error', yLog: true,
    };

    return [chart1, chart2, chart3, chart4];
  },
};
