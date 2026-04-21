import type { MethodDefinition, MethodResult, ChartData } from '../types';
import { parseExpression, linspace } from '../../parser';
import { checkBolzano, renderBolzanoPanel } from '../../theorems';
import { parseStop, computeErrors, hasConverged, describeStop, withExactErrors } from '../../stoppingCriteria';

export const falsePosition: MethodDefinition = {
  id: 'falsePosition',
  name: 'Regula Falsi (Posicion Falsa)',
  category: 'rootFinding',
  formula: 'c = a - f(a)·(b - a) / (f(b) - f(a))',
  latexFormula: 'c = a - f(a) \\cdot \\frac{b - a}{f(b) - f(a)}',
  description: 'Como biseccion pero usa la interseccion de la secante con el eje x en vez del punto medio.',
  inputs: [
    { id: 'fx', label: 'f(x)', placeholder: 'x^3 - x - 2', defaultValue: 'x^3 - x - 2' },
    { id: 'a', label: 'a (limite inferior)', placeholder: '1', type: 'number', defaultValue: '1' },
    { id: 'b', label: 'b (limite superior)', placeholder: '2', type: 'number', defaultValue: '2' },
    { id: 'stop', label: 'Criterio de parada', placeholder: '1e-6', type: 'stopCriterion', defaultValue: 'tolerancia:1e-6', hint: 'Elige el criterio que pide el ejercicio: tolerancia, error absoluto/relativo, cifras significativas, etc.' },
    { id: 'maxIter', label: 'Max iteraciones', placeholder: '100', type: 'number', defaultValue: '100' },
    { id: 'exact', label: 'Valor exacto (opcional)', placeholder: 'p.ej. 1.52138', type: 'number', hint: 'Si se provee, habilita criterios de parada vs exacto.' },
  ],
  tableColumns: [
    { key: 'iter', label: 'n', latex: 'n' },
    { key: 'a', label: 'a', latex: 'a' },
    { key: 'b', label: 'b', latex: 'b' },
    { key: 'c', label: 'c', latex: 'c' },
    { key: 'fc', label: 'f(c)', latex: 'f(c)' },
    { key: 'errAbs', label: '|Δx| abs', latex: '|\\Delta x|' },
    { key: 'errRel', label: 'Err. rel.', latex: '\\varepsilon_{\\text{rel}}' },
    { key: 'errRelPct', label: 'Err. rel. %', latex: '\\varepsilon_{\\text{rel}}\\,(\\%)' },
  ],
  steps: [
    'Escribe <code>f(x)</code> y el intervalo <code>[a, b]</code>.',
    '<b>Verifica Bolzano</b>: <code>f(a)·f(b) &lt; 0</code>. Si no se cumple, no garantiza raiz.',
    'Pulsa <b>Resolver</b>. En cada paso: <code>c = a - f(a)(b-a) / (f(b) - f(a))</code> — es la interseccion de la <em>secante</em> entre (a, f(a)) y (b, f(b)) con el eje x.',
    'Se reduce el intervalo conservando el subintervalo donde persiste el cambio de signo, igual que biseccion.',
    'Convergencia generalmente <em>mas rapida</em> que biseccion porque usa la forma de la funcion, no solo el signo. Pero puede estancarse si la funcion es muy asimetrica (uno de los extremos casi no se mueve).',
  ],

  solve(params) {
    const f = parseExpression(params.fx);
    let a = parseFloat(params.a);
    let b = parseFloat(params.b);
    const stop = parseStop(params.stop);
    const maxIter = parseInt(params.maxIter) || 100;
    const exactRaw = (params.exact ?? '').trim();
    const exact = exactRaw === '' ? undefined : parseFloat(exactRaw);

    if (isNaN(a) || isNaN(b)) throw new Error('a y b deben ser numeros validos');
    if (a >= b) throw new Error('a debe ser menor que b');

    let fa = f(a);
    let fb = f(b);
    if (fa * fb > 0) throw new Error('f(a) y f(b) deben tener signos opuestos');

    const iterations: MethodResult['iterations'] = [];
    let converged = false;
    let error = Math.abs(b - a);
    let c = a;
    let cPrev = a;

    for (let i = 1; i <= maxIter; i++) {
      const denom = fb - fa;
      if (Math.abs(denom) < 1e-14) {
        return { root: c, iterations, converged: false, error, message: 'f(b) - f(a) ≈ 0' };
      }

      c = a - fa * (b - a) / denom;
      const fc = f(c);
      const errs = i === 1
        ? { errAbs: Math.abs(b - a), errRel: 0, errRelPct: 0 }
        : computeErrors(cPrev, c);
      error = errs.errAbs;

      iterations.push({ iter: i, a, b, c, fc, errAbs: errs.errAbs, errRel: errs.errRel, errRelPct: errs.errRelPct });

      const errsFull = withExactErrors(errs, c, exact);
      if (Math.abs(fc) < 1e-15 || (i > 1 && hasConverged(stop, errsFull))) {
        converged = true;
        break;
      }

      if (fa * fc < 0) {
        b = c;
        fb = fc;
      } else {
        a = c;
        fa = fc;
      }
      cPrev = c;
    }

    const bolzano = checkBolzano(params.fx, parseFloat(params.a), parseFloat(params.b));
    return {
      root: c,
      iterations,
      converged,
      error,
      message: `Criterio: ${describeStop(stop)}`,
      theoremPanels: [renderBolzanoPanel(bolzano)],
    };
  },

  getCharts(params, result) {
    const f = parseExpression(params.fx);
    const aOrig = parseFloat(params.a);
    const bOrig = parseFloat(params.b);
    const pad = (bOrig - aOrig) * 0.3;
    const xs = linspace(aOrig - pad, bOrig + pad, 500);
    const ys = xs.map(x => f(x));
    const root = result.root ?? 0;

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

    const iters = result.iterations.map(r => r.iter as number);
    const aVals = result.iterations.map(r => r.a as number);
    const bVals = result.iterations.map(r => r.b as number);
    const chart2: ChartData = {
      title: 'Convergencia del intervalo',
      type: 'line',
      datasets: [
        { label: 'a', x: iters, y: aVals, color: '#89b4fa' },
        { label: 'b', x: iters, y: bVals, color: '#f38ba8' },
      ],
      xLabel: 'Iteracion', yLabel: 'Valor',
    };

    const cVals = result.iterations.map(r => r.c as number);
    const chart3: ChartData = {
      title: 'Valores de c_n',
      type: 'line',
      datasets: [{ label: 'c_n', x: iters, y: cVals, color: '#cba6f7', pointRadius: 3 }],
      xLabel: 'Iteracion', yLabel: 'c',
    };

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
