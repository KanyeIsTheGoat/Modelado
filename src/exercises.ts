export interface Exercise {
  id: string;
  methodId: string;
  label: string;
  description?: string;
  params: Record<string, string>;
}

export const EXERCISES: Exercise[] = [
  // Grupo 1 — Raices
  {
    id: 'r-bis-1', methodId: 'bisection',
    label: 'x³ - x - 2 en [1, 2]  (raiz ≈ 1.5214)',
    description: 'Bolzano OK: f(1) = -2, f(2) = 4',
    params: { fx: 'x^3 - x - 2', a: '1', b: '2', tol: '1e-6', maxIter: '50' },
  },
  {
    id: 'r-bis-2', methodId: 'bisection',
    label: 'cos(x) - x en [0, 1]  (raiz ≈ 0.7391)',
    params: { fx: 'cos(x) - x', a: '0', b: '1', tol: '1e-8', maxIter: '60' },
  },
  {
    id: 'r-fp-1', methodId: 'fixedPoint',
    label: 'g(x) = (x + 2)^(1/3) desde x₀ = 1  (punto fijo ≈ 1.5214)',
    description: 'Lipschitz OK en [1, 2]: max|g\'(x)| < 1',
    params: { gx: '(x + 2)^(1/3)', x0: '1', a: '1', b: '2', tol: '1e-8', maxIter: '40' },
  },
  {
    id: 'r-nr-1', methodId: 'newtonRaphson',
    label: 'cos(x) - x desde x₀ = 0.5  (exacto = 0.73908513)',
    params: { fx: 'cos(x) - x', dfx: '', x0: '0.5', tol: '1e-10', maxIter: '20', exact: '0.73908513321516' },
  },
  {
    id: 'r-nr-2', methodId: 'newtonRaphson',
    label: 'x³ - 2x - 5 desde x₀ = 2  (exacto ≈ 2.0945515)',
    params: { fx: 'x^3 - 2*x - 5', dfx: '', x0: '2', tol: '1e-10', maxIter: '20', exact: '2.09455148154233' },
  },
  {
    id: 'r-sec-1', methodId: 'secant',
    label: 'eˣ - 3x con x₀ = 0, x₁ = 1  (raiz ≈ 0.6190)',
    params: { fx: 'exp(x) - 3*x', x0: '0', x1: '1', tol: '1e-8', maxIter: '30' },
  },
  {
    id: 'r-fp-2', methodId: 'falsePosition',
    label: 'x² - 2 en [1, 2]  (√2)',
    params: { fx: 'x^2 - 2', a: '1', b: '2', tol: '1e-8', maxIter: '50' },
  },
  {
    id: 'r-ait-1', methodId: 'aitken',
    label: 'Aitken Δ² sobre g(x) = cos(x) desde x₀ = 0.5',
    params: { gx: 'cos(x)', x0: '0.5', a: '0', b: '1', tol: '1e-10', maxIter: '25', exact: '0.73908513321516' },
  },
  {
    id: 'r-stef-1', methodId: 'steffensen',
    label: 'Steffensen sobre g(x) = cos(x) desde x₀ = 0.5',
    description: 'Aceleracion cuadratica sobre punto fijo',
    params: { gx: 'cos(x)', x0: '0.5', a: '0', b: '1', tol: '1e-10', maxIter: '10', exact: '0.73908513321516' },
  },

  // Grupo 2 — Interpolacion
  {
    id: 'i-lag-1', methodId: 'lagrange',
    label: 'Lagrange: (0,1), (1,3), (2,2), (3,5) en x = 1.5',
    params: { points: '0,1;1,3;2,2;3,5', xQuery: '1.5', fx: '' },
  },
  {
    id: 'i-lag-2', methodId: 'lagrange',
    label: 'Lagrange: sin(x) en x = π/4 con nodos 0, π/6, π/3, π/2',
    description: 'Compara con f(x) = sin(x) para ver error',
    params: { points: '0,0;0.5235987756,0.5;1.0471975512,0.8660254038;1.5707963268,1', xQuery: '0.7853981634', fx: 'sin(x)' },
  },
  {
    id: 'i-ndd-1', methodId: 'newtonDD',
    label: 'Newton DD: (0,1), (1,3), (2,2), (3,5) en x = 1.5',
    params: { points: '0,1;1,3;2,2;3,5', xQuery: '1.5', fx: '' },
  },
  {
    id: 'i-ndd-2', methodId: 'newtonDD',
    label: 'Newton DD: ln(x) en x = 1.5 con nodos 1, 2, 3, 4',
    params: { points: '1,0;2,0.6931471806;3,1.0986122887;4,1.3862943611', xQuery: '1.5', fx: 'log(x)' },
  },

  // Grupo 3 — Integracion
  {
    id: 'int-trap-1', methodId: 'trapezoidalComp',
    label: 'Trapecio comp.: ∫₀^π sin(x) dx con n = 10  (exacto = 2)',
    params: { fx: 'sin(x)', a: '0', b: '3.14159265358979', n: '10', exact: '2' },
  },
  {
    id: 'int-s13-1', methodId: 'simpson13Comp',
    label: 'Simpson 1/3 comp.: ∫₀¹ x² dx con n = 4  (exacto = 1/3)',
    params: { fx: 'x^2', a: '0', b: '1', n: '4', exact: '0.33333333333333' },
  },
  {
    id: 'int-s38-1', methodId: 'simpson38Comp',
    label: 'Simpson 3/8 comp.: ∫₀¹ eˣ dx con n = 6  (exacto = e - 1)',
    params: { fx: 'exp(x)', a: '0', b: '1', n: '6', exact: '1.71828182845905' },
  },
  {
    id: 'int-mid-1', methodId: 'midpoint',
    label: 'Punto medio: ∫₁² 1/x dx con n = 8  (exacto = ln 2)',
    params: { fx: '1/x', a: '1', b: '2', n: '8', exact: '0.69314718055995' },
  },

  // Grupo 4 — Monte Carlo
  {
    id: 'mc-1d-1', methodId: 'montecarlo',
    label: 'MC 1D: ∫₀¹ x² dx con N = 10000, seed = 42  (exacto = 1/3)',
    params: { fx: 'x^2', a: '0', b: '1', n: '10000', seed: '42' },
  },
  {
    id: 'mc-pi-1', methodId: 'montecarloPi',
    label: 'MC π con N = 10000, seed = 42',
    params: { n: '10000', seed: '42' },
  },
  {
    id: 'mc-2d-1', methodId: 'montecarlo2D',
    label: 'MC 2D: ∫∫(x² + y²) dA en [0,1]² con K = 10  (exacto = 2/3)',
    params: { fxy: 'x^2 + y^2', a: '0', b: '1', c: '0', d: '1', n: '10000', K: '10', exact: '0.66666666666667', seed: '42' },
  },
  {
    id: 'mc-area-1', methodId: 'montecarloArea',
    label: 'MC area entre x y x² en [0, 1]  (exacto = 1/6)',
    params: { fx: 'x', gx: 'x^2', a: '0', b: '1', n: '10000', K: '10', exact: '0.16666666666667', seed: '42' },
  },

  // Grupo 5 — EDOs
  {
    id: 'ode-eu-1', methodId: 'euler',
    label: "Euler: dy/dx = x + y, y(0)=1, x∈[0,2], h=0.1  (exacto: 2eˣ - x - 1)",
    params: { fxy: 'x + y', x0: '0', y0: '1', xEnd: '2', h: '0.1', exact: '2*exp(x) - x - 1' },
  },
  {
    id: 'ode-heun-1', methodId: 'heun',
    label: "Heun RK2: dy/dx = x + y, y(0)=1, x∈[0,2], h=0.1",
    params: { fxy: 'x + y', x0: '0', y0: '1', xEnd: '2', h: '0.1', exact: '2*exp(x) - x - 1' },
  },
  {
    id: 'ode-rk4-1', methodId: 'rungeKutta',
    label: "RK4: dy/dx = x + y, y(0)=1, x∈[0,2], h=0.1",
    params: { fxy: 'x + y', x0: '0', y0: '1', xEnd: '2', h: '0.1', exact: '2*exp(x) - x - 1' },
  },
  {
    id: 'ode-rk4-2', methodId: 'rungeKutta',
    label: "RK4: dy/dx = y, y(0)=1, x∈[0,1], h=0.1  (exacto: eˣ)",
    params: { fxy: 'y', x0: '0', y0: '1', xEnd: '1', h: '0.1', exact: 'exp(x)' },
  },

  // Derivacion (bonus)
  {
    id: 'd-cen-1', methodId: 'central',
    label: 'Diferencia central: sin(x) en x = 1, h = 0.1  (exacto: cos(1))',
    params: { fx: 'sin(x)', x: '1', h: '0.1', exact: 'cos(x)' },
  },
  {
    id: 'd-rich-1', methodId: 'richardson',
    label: 'Richardson: eˣ en x = 0, h = 0.5  (exacto: 1)',
    params: { fx: 'exp(x)', x: '0', h: '0.5', levels: '4', exact: 'exp(x)' },
  },
];

export function getExercisesForMethod(methodId: string): Exercise[] {
  return EXERCISES.filter(e => e.methodId === methodId);
}
