import type { MethodDefinition } from './methods/types';

// Root Finding
import { bisection } from './methods/rootFinding/bisection';
import { fixedPoint } from './methods/rootFinding/fixedPoint';
import { newtonRaphson } from './methods/rootFinding/newtonRaphson';
import { secant } from './methods/rootFinding/secant';
import { falsePosition } from './methods/rootFinding/falsePosition';
import { aitken } from './methods/rootFinding/aitken';

// Integration
import { midpoint } from './methods/integration/midpoint';
import { trapezoidal } from './methods/integration/trapezoidal';
import { trapezoidalComp } from './methods/integration/trapezoidalComp';
import { simpson13 } from './methods/integration/simpson13';
import { simpson13Comp } from './methods/integration/simpson13Comp';
import { simpson38 } from './methods/integration/simpson38';
import { simpson38Comp } from './methods/integration/simpson38Comp';
import { montecarlo } from './methods/integration/montecarlo';
import { montecarloPi } from './methods/integration/montecarloPi';

// ODE
import { euler } from './methods/ode/euler';
import { heun } from './methods/ode/heun';
import { rungeKutta } from './methods/ode/rungeKutta';

// Differentiation
import { forward } from './methods/differentiation/forward';
import { backward } from './methods/differentiation/backward';
import { central } from './methods/differentiation/central';
import { secondDerivative } from './methods/differentiation/secondDerivative';
import { richardson } from './methods/differentiation/richardson';

export interface Category {
  id: string;
  name: string;
  cssClass: string;
  methods: MethodDefinition[];
}

export const categories: Category[] = [
  {
    id: 'rootFinding',
    name: 'Busqueda de Raices',
    cssClass: '',
    methods: [bisection, fixedPoint, newtonRaphson, secant, falsePosition, aitken],
  },
  {
    id: 'integration',
    name: 'Integracion Numerica (Newton-Cotes)',
    cssClass: 'integration',
    methods: [midpoint, trapezoidal, trapezoidalComp, simpson13, simpson13Comp, simpson38, simpson38Comp, montecarlo, montecarloPi],
  },
  {
    id: 'ode',
    name: 'Ecuaciones Diferenciales Ordinarias',
    cssClass: 'ode',
    methods: [euler, heun, rungeKutta],
  },
  {
    id: 'differentiation',
    name: 'Diferenciacion Numerica',
    cssClass: 'differentiation',
    methods: [forward, backward, central, secondDerivative, richardson],
  },
];

export const allMethods: MethodDefinition[] = categories.flatMap(c => c.methods);

export function getMethod(id: string): MethodDefinition | undefined {
  return allMethods.find(m => m.id === id);
}

export function getCategoryForMethod(id: string): Category | undefined {
  return categories.find(c => c.methods.some(m => m.id === id));
}
