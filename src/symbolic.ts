import { create, all, MathNode, OperatorNode, ConstantNode, SymbolNode, FunctionNode, ParenthesisNode } from 'mathjs';
import { registerMathAliases } from './mathAliases';

const math = create(all);
registerMathAliases(math);

export interface SymbolicStep {
  rule: string;
  explanation: string;
  latex: string;
}

export interface SymbolicResult {
  result: string;
  resultTex: string;
  steps: SymbolicStep[];
}

// ─── DERIVATIVE ───

export function symbolicDerivative(expr: string, variable: string = 'x'): string {
  return symbolicDerivativeSteps(expr, variable).result;
}

export function symbolicDerivativeSteps(expr: string, variable: string = 'x'): SymbolicResult {
  try {
    const node = math.parse(expr);
    const steps: SymbolicStep[] = [];
    const derived = deriveStep(node, variable, steps);
    const simplified = math.simplify(derived);

    const derivedStr = derived.toString();
    const simpStr = simplified.toString();
    if (simpStr !== derivedStr) {
      steps.push({
        rule: 'Simplificar',
        explanation: 'Agrupamos términos semejantes y reducimos la expresión.',
        latex: `${toTex(derived)} \\;=\\; ${toTex(simplified)}`,
      });
    }

    return {
      result: simpStr,
      resultTex: toTex(simplified),
      steps,
    };
  } catch (e: any) {
    throw new Error(`No se pudo derivar: ${e.message}`);
  }
}

function deriveStep(node: MathNode, v: string, steps: SymbolicStep[]): MathNode {
  // Constant
  if (!containsVariable(node, v)) {
    const result = new ConstantNode(0);
    steps.push({
      rule: 'Derivada de una constante',
      explanation: `La derivada de cualquier constante respecto de ${v} es 0.`,
      latex: `\\frac{d}{d${v}}\\left[${toTex(node)}\\right] = 0`,
    });
    return result;
  }

  // Variable alone
  if (isSymbol(node, v)) {
    const result = new ConstantNode(1);
    steps.push({
      rule: 'Derivada de la variable',
      explanation: `La derivada de la variable respecto de sí misma es 1.`,
      latex: `\\frac{d}{d${v}}\\left[${v}\\right] = 1`,
    });
    return result;
  }

  // Sum / subtraction
  if (isOperator(node, '+') || isOperator(node, '-')) {
    const op = node as OperatorNode;
    if (op.args.length === 2) {
      const sign = op.op;
      const opName = sign === '+' ? 'add' : 'subtract';
      steps.push({
        rule: sign === '+' ? 'Regla de la suma' : 'Regla de la resta',
        explanation: `La derivada de una ${sign === '+' ? 'suma' : 'resta'} es la ${sign === '+' ? 'suma' : 'resta'} de las derivadas.`,
        latex: `\\frac{d}{d${v}}\\left[${toTex(op.args[0])} ${sign} ${toTex(op.args[1])}\\right] = \\frac{d}{d${v}}\\left[${toTex(op.args[0])}\\right] ${sign} \\frac{d}{d${v}}\\left[${toTex(op.args[1])}\\right]`,
      });
      const a = deriveStep(op.args[0], v, steps);
      const b = deriveStep(op.args[1], v, steps);
      return new OperatorNode(sign, opName, [a, b]);
    }
    // Unary minus
    if (op.args.length === 1) {
      steps.push({
        rule: 'Signo negativo',
        explanation: 'Una constante (−1) sale de la derivada.',
        latex: `\\frac{d}{d${v}}\\left[-${toTex(op.args[0])}\\right] = -\\frac{d}{d${v}}\\left[${toTex(op.args[0])}\\right]`,
      });
      const a = deriveStep(op.args[0], v, steps);
      return new OperatorNode('-', 'unaryMinus', [a]);
    }
  }

  // Product
  if (isOperator(node, '*')) {
    const op = node as OperatorNode;
    // Constant * f(x)
    if (!containsVariable(op.args[0], v)) {
      steps.push({
        rule: 'Múltiplo constante',
        explanation: 'Una constante sale de la derivada multiplicando.',
        latex: `\\frac{d}{d${v}}\\left[${toTex(op.args[0])} \\cdot ${toTex(op.args[1])}\\right] = ${toTex(op.args[0])} \\cdot \\frac{d}{d${v}}\\left[${toTex(op.args[1])}\\right]`,
      });
      const inner = deriveStep(op.args[1], v, steps);
      return new OperatorNode('*', 'multiply', [op.args[0], inner]);
    }
    if (!containsVariable(op.args[1], v)) {
      steps.push({
        rule: 'Múltiplo constante',
        explanation: 'Una constante sale de la derivada multiplicando.',
        latex: `\\frac{d}{d${v}}\\left[${toTex(op.args[0])} \\cdot ${toTex(op.args[1])}\\right] = ${toTex(op.args[1])} \\cdot \\frac{d}{d${v}}\\left[${toTex(op.args[0])}\\right]`,
      });
      const inner = deriveStep(op.args[0], v, steps);
      return new OperatorNode('*', 'multiply', [op.args[1], inner]);
    }
    // Product rule
    steps.push({
      rule: 'Regla del producto',
      explanation: `Aplicamos (f·g)' = f'·g + f·g'.`,
      latex: `\\frac{d}{d${v}}\\left[${toTex(op.args[0])} \\cdot ${toTex(op.args[1])}\\right] = \\frac{d}{d${v}}\\left[${toTex(op.args[0])}\\right]\\cdot ${toTex(op.args[1])} + ${toTex(op.args[0])}\\cdot\\frac{d}{d${v}}\\left[${toTex(op.args[1])}\\right]`,
    });
    const df = deriveStep(op.args[0], v, steps);
    const dg = deriveStep(op.args[1], v, steps);
    return new OperatorNode('+', 'add', [
      new OperatorNode('*', 'multiply', [df, op.args[1]]),
      new OperatorNode('*', 'multiply', [op.args[0], dg]),
    ]);
  }

  // Division
  if (isOperator(node, '/')) {
    const op = node as OperatorNode;
    // f(x) / c
    if (!containsVariable(op.args[1], v)) {
      steps.push({
        rule: 'División por constante',
        explanation: 'La constante del denominador sale multiplicando por su recíproco.',
        latex: `\\frac{d}{d${v}}\\left[\\frac{${toTex(op.args[0])}}{${toTex(op.args[1])}}\\right] = \\frac{1}{${toTex(op.args[1])}}\\cdot\\frac{d}{d${v}}\\left[${toTex(op.args[0])}\\right]`,
      });
      const inner = deriveStep(op.args[0], v, steps);
      return new OperatorNode('/', 'divide', [inner, op.args[1]]);
    }
    // Quotient rule
    steps.push({
      rule: 'Regla del cociente',
      explanation: `(f/g)' = (f'·g − f·g') / g²`,
      latex: `\\frac{d}{d${v}}\\left[\\frac{${toTex(op.args[0])}}{${toTex(op.args[1])}}\\right] = \\frac{\\frac{d}{d${v}}\\left[${toTex(op.args[0])}\\right]\\cdot ${toTex(op.args[1])} - ${toTex(op.args[0])}\\cdot\\frac{d}{d${v}}\\left[${toTex(op.args[1])}\\right]}{${toTex(op.args[1])}^2}`,
    });
    const df = deriveStep(op.args[0], v, steps);
    const dg = deriveStep(op.args[1], v, steps);
    return new OperatorNode('/', 'divide', [
      new OperatorNode('-', 'subtract', [
        new OperatorNode('*', 'multiply', [df, op.args[1]]),
        new OperatorNode('*', 'multiply', [op.args[0], dg]),
      ]),
      new OperatorNode('^', 'pow', [op.args[1], new ConstantNode(2)]),
    ]);
  }

  // Power
  if (isOperator(node, '^')) {
    const op = node as OperatorNode;
    const base = op.args[0];
    const exp = op.args[1];

    // x^n
    if (isSymbol(base, v) && !containsVariable(exp, v)) {
      steps.push({
        rule: 'Regla de la potencia',
        explanation: `(${v}^n)' = n·${v}^(n−1).`,
        latex: `\\frac{d}{d${v}}\\left[${v}^{${toTex(exp)}}\\right] = ${toTex(exp)}\\cdot ${v}^{${toTex(exp)}-1}`,
      });
      return new OperatorNode('*', 'multiply', [
        exp,
        new OperatorNode('^', 'pow', [new SymbolNode(v), new OperatorNode('-', 'subtract', [exp, new ConstantNode(1)])]),
      ]);
    }

    // f(x)^n — chain rule
    if (containsVariable(base, v) && !containsVariable(exp, v)) {
      steps.push({
        rule: 'Potencia con regla de la cadena',
        explanation: `(f^n)' = n·f^(n−1)·f'.`,
        latex: `\\frac{d}{d${v}}\\left[\\left(${toTex(base)}\\right)^{${toTex(exp)}}\\right] = ${toTex(exp)}\\cdot\\left(${toTex(base)}\\right)^{${toTex(exp)}-1}\\cdot\\frac{d}{d${v}}\\left[${toTex(base)}\\right]`,
      });
      const db = deriveStep(base, v, steps);
      return new OperatorNode('*', 'multiply', [
        new OperatorNode('*', 'multiply', [
          exp,
          new OperatorNode('^', 'pow', [base, new OperatorNode('-', 'subtract', [exp, new ConstantNode(1)])]),
        ]),
        db,
      ]);
    }

    // a^x
    if (!containsVariable(base, v) && isSymbol(exp, v)) {
      if (isSymbolNamed(base, 'e')) {
        steps.push({
          rule: 'Exponencial natural',
          explanation: `(e^${v})' = e^${v}.`,
          latex: `\\frac{d}{d${v}}\\left[e^{${v}}\\right] = e^{${v}}`,
        });
        return node.cloneDeep();
      }
      steps.push({
        rule: 'Exponencial general',
        explanation: `(a^${v})' = a^${v}·ln(a).`,
        latex: `\\frac{d}{d${v}}\\left[${toTex(base)}^{${v}}\\right] = ${toTex(base)}^{${v}}\\cdot\\ln\\left(${toTex(base)}\\right)`,
      });
      return new OperatorNode('*', 'multiply', [
        node.cloneDeep(),
        new FunctionNode(new SymbolNode('log'), [base.cloneDeep()]),
      ]);
    }

    // a^f(x)
    if (!containsVariable(base, v) && containsVariable(exp, v)) {
      steps.push({
        rule: 'Exponencial con cadena',
        explanation: `(a^f)' = a^f·ln(a)·f'.`,
        latex: `\\frac{d}{d${v}}\\left[${toTex(base)}^{${toTex(exp)}}\\right] = ${toTex(base)}^{${toTex(exp)}}\\cdot\\ln\\left(${toTex(base)}\\right)\\cdot\\frac{d}{d${v}}\\left[${toTex(exp)}\\right]`,
      });
      const de = deriveStep(exp, v, steps);
      return new OperatorNode('*', 'multiply', [
        new OperatorNode('*', 'multiply', [
          node.cloneDeep(),
          new FunctionNode(new SymbolNode('log'), [base.cloneDeep()]),
        ]),
        de,
      ]);
    }
  }

  // Functions
  if (node.type === 'FunctionNode') {
    const fn = node as FunctionNode;
    const fnName = fn.fn.toString();
    const arg = fn.args[0];

    const rule = elementaryDerivative(fnName, arg, v);
    if (rule) {
      if (isSymbol(arg, v)) {
        steps.push({
          rule: rule.ruleName,
          explanation: rule.explanation,
          latex: rule.latexDirect,
        });
        return rule.result;
      }
      // Chain rule
      steps.push({
        rule: `${rule.ruleName} · regla de la cadena`,
        explanation: `Derivamos la función externa y multiplicamos por la derivada de la interna (regla de la cadena).`,
        latex: rule.latexChain,
      });
      const dArg = deriveStep(arg, v, steps);
      return new OperatorNode('*', 'multiply', [rule.result, dArg]);
    }
  }

  // Parenthesis
  if (node.type === 'ParenthesisNode') {
    return deriveStep((node as ParenthesisNode).content, v, steps);
  }

  // Fallback to math.js
  const fallback = math.derivative(node, v);
  steps.push({
    rule: 'Derivada directa',
    explanation: 'Aplicamos la regla estándar de math.js para esta expresión.',
    latex: `\\frac{d}{d${v}}\\left[${toTex(node)}\\right] = ${toTex(fallback)}`,
  });
  return fallback;
}

interface ElementaryDerivativeRule {
  ruleName: string;
  explanation: string;
  result: MathNode;
  latexDirect: string;
  latexChain: string;
}

function elementaryDerivative(fnName: string, arg: MathNode, v: string): ElementaryDerivativeRule | null {
  const argTex = toTex(arg);
  switch (fnName) {
    case 'sin':
      return {
        ruleName: 'Derivada del seno',
        explanation: `(sin u)' = cos u · u'.`,
        result: new FunctionNode(new SymbolNode('cos'), [arg.cloneDeep()]),
        latexDirect: `\\frac{d}{d${v}}\\left[\\sin(${v})\\right] = \\cos(${v})`,
        latexChain: `\\frac{d}{d${v}}\\left[\\sin(${argTex})\\right] = \\cos(${argTex})\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    case 'cos':
      return {
        ruleName: 'Derivada del coseno',
        explanation: `(cos u)' = -sin u · u'.`,
        result: new OperatorNode('-', 'unaryMinus', [new FunctionNode(new SymbolNode('sin'), [arg.cloneDeep()])]),
        latexDirect: `\\frac{d}{d${v}}\\left[\\cos(${v})\\right] = -\\sin(${v})`,
        latexChain: `\\frac{d}{d${v}}\\left[\\cos(${argTex})\\right] = -\\sin(${argTex})\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    case 'tan':
      return {
        ruleName: 'Derivada de la tangente',
        explanation: `(tan u)' = sec²(u) · u'.`,
        result: new OperatorNode('^', 'pow', [new FunctionNode(new SymbolNode('sec'), [arg.cloneDeep()]), new ConstantNode(2)]),
        latexDirect: `\\frac{d}{d${v}}\\left[\\tan(${v})\\right] = \\sec^{2}(${v})`,
        latexChain: `\\frac{d}{d${v}}\\left[\\tan(${argTex})\\right] = \\sec^{2}(${argTex})\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    case 'exp':
      return {
        ruleName: 'Derivada de exp',
        explanation: `(e^u)' = e^u · u'.`,
        result: new FunctionNode(new SymbolNode('exp'), [arg.cloneDeep()]),
        latexDirect: `\\frac{d}{d${v}}\\left[e^{${v}}\\right] = e^{${v}}`,
        latexChain: `\\frac{d}{d${v}}\\left[e^{${argTex}}\\right] = e^{${argTex}}\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    case 'log':
    case 'ln':
      return {
        ruleName: 'Derivada de ln',
        explanation: `(ln u)' = u'/u.`,
        result: new OperatorNode('/', 'divide', [new ConstantNode(1), arg.cloneDeep()]),
        latexDirect: `\\frac{d}{d${v}}\\left[\\ln(${v})\\right] = \\frac{1}{${v}}`,
        latexChain: `\\frac{d}{d${v}}\\left[\\ln(${argTex})\\right] = \\frac{1}{${argTex}}\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    case 'sqrt':
      return {
        ruleName: 'Derivada de √',
        explanation: `(√u)' = u'/(2√u).`,
        result: new OperatorNode('/', 'divide', [
          new ConstantNode(1),
          new OperatorNode('*', 'multiply', [new ConstantNode(2), new FunctionNode(new SymbolNode('sqrt'), [arg.cloneDeep()])]),
        ]),
        latexDirect: `\\frac{d}{d${v}}\\left[\\sqrt{${v}}\\right] = \\frac{1}{2\\sqrt{${v}}}`,
        latexChain: `\\frac{d}{d${v}}\\left[\\sqrt{${argTex}}\\right] = \\frac{1}{2\\sqrt{${argTex}}}\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    case 'cbrt':
      // cbrt(u) = u^(1/3) → derivada = 1/(3·∛(u²))
      // IMPORTANTE: usamos cbrt(u²) en vez de u^(2/3) porque para u<0, u^(2/3)
      // evalua como complejo en math.js (parte real ≠ valor real correcto).
      // cbrt(u²) siempre da un real positivo.
      return {
        ruleName: 'Derivada de ∛',
        explanation: `(∛u)' = u'/(3·∛(u²)).  Nota: usamos ∛(u²) en lugar de u^(2/3) para obtener siempre el valor real (cuando u<0, u^(2/3) seria complejo).`,
        result: new OperatorNode('/', 'divide', [
          new ConstantNode(1),
          new OperatorNode('*', 'multiply', [
            new ConstantNode(3),
            new FunctionNode(new SymbolNode('cbrt'), [
              new OperatorNode('^', 'pow', [arg.cloneDeep(), new ConstantNode(2)]),
            ]),
          ]),
        ]),
        latexDirect: `\\frac{d}{d${v}}\\left[\\sqrt[3]{${v}}\\right] = \\frac{1}{3\\,\\sqrt[3]{${v}^{2}}}`,
        latexChain: `\\frac{d}{d${v}}\\left[\\sqrt[3]{${argTex}}\\right] = \\frac{1}{3\\,\\sqrt[3]{\\left(${argTex}\\right)^{2}}}\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    case 'asin':
      return {
        ruleName: 'Derivada de arcsin',
        explanation: `(arcsin u)' = u'/√(1 − u²).`,
        result: new OperatorNode('/', 'divide', [
          new ConstantNode(1),
          new FunctionNode(new SymbolNode('sqrt'), [
            new OperatorNode('-', 'subtract', [new ConstantNode(1), new OperatorNode('^', 'pow', [arg.cloneDeep(), new ConstantNode(2)])]),
          ]),
        ]),
        latexDirect: `\\frac{d}{d${v}}\\left[\\arcsin(${v})\\right] = \\frac{1}{\\sqrt{1 - ${v}^2}}`,
        latexChain: `\\frac{d}{d${v}}\\left[\\arcsin(${argTex})\\right] = \\frac{1}{\\sqrt{1 - (${argTex})^2}}\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    case 'acos':
      return {
        ruleName: 'Derivada de arccos',
        explanation: `(arccos u)' = -u'/√(1 − u²).`,
        result: new OperatorNode('/', 'divide', [
          new ConstantNode(-1),
          new FunctionNode(new SymbolNode('sqrt'), [
            new OperatorNode('-', 'subtract', [new ConstantNode(1), new OperatorNode('^', 'pow', [arg.cloneDeep(), new ConstantNode(2)])]),
          ]),
        ]),
        latexDirect: `\\frac{d}{d${v}}\\left[\\arccos(${v})\\right] = -\\frac{1}{\\sqrt{1 - ${v}^2}}`,
        latexChain: `\\frac{d}{d${v}}\\left[\\arccos(${argTex})\\right] = -\\frac{1}{\\sqrt{1 - (${argTex})^2}}\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    case 'atan':
      return {
        ruleName: 'Derivada de arctan',
        explanation: `(arctan u)' = u'/(1 + u²).`,
        result: new OperatorNode('/', 'divide', [
          new ConstantNode(1),
          new OperatorNode('+', 'add', [new ConstantNode(1), new OperatorNode('^', 'pow', [arg.cloneDeep(), new ConstantNode(2)])]),
        ]),
        latexDirect: `\\frac{d}{d${v}}\\left[\\arctan(${v})\\right] = \\frac{1}{1 + ${v}^2}`,
        latexChain: `\\frac{d}{d${v}}\\left[\\arctan(${argTex})\\right] = \\frac{1}{1 + (${argTex})^2}\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    case 'sinh':
      return {
        ruleName: 'Derivada de sinh',
        explanation: `(sinh u)' = cosh(u)·u'.`,
        result: new FunctionNode(new SymbolNode('cosh'), [arg.cloneDeep()]),
        latexDirect: `\\frac{d}{d${v}}\\left[\\sinh(${v})\\right] = \\cosh(${v})`,
        latexChain: `\\frac{d}{d${v}}\\left[\\sinh(${argTex})\\right] = \\cosh(${argTex})\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    case 'cosh':
      return {
        ruleName: 'Derivada de cosh',
        explanation: `(cosh u)' = sinh(u)·u'.`,
        result: new FunctionNode(new SymbolNode('sinh'), [arg.cloneDeep()]),
        latexDirect: `\\frac{d}{d${v}}\\left[\\cosh(${v})\\right] = \\sinh(${v})`,
        latexChain: `\\frac{d}{d${v}}\\left[\\cosh(${argTex})\\right] = \\sinh(${argTex})\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    case 'tanh':
      return {
        ruleName: 'Derivada de tanh',
        explanation: `(tanh u)' = sech²(u)·u' = (1 − tanh²u)·u'.`,
        result: new OperatorNode('-', 'subtract', [
          new ConstantNode(1),
          new OperatorNode('^', 'pow', [new FunctionNode(new SymbolNode('tanh'), [arg.cloneDeep()]), new ConstantNode(2)]),
        ]),
        latexDirect: `\\frac{d}{d${v}}\\left[\\tanh(${v})\\right] = 1 - \\tanh^{2}(${v})`,
        latexChain: `\\frac{d}{d${v}}\\left[\\tanh(${argTex})\\right] = \\left(1 - \\tanh^{2}(${argTex})\\right)\\cdot\\frac{d}{d${v}}\\left[${argTex}\\right]`,
      };
    default:
      return null;
  }
}

// ─── INTEGRAL ───

export function symbolicIntegral(expr: string, variable: string = 'x'): string {
  return symbolicIntegralSteps(expr, variable).result;
}

export function symbolicIntegralSteps(expr: string, variable: string = 'x'): SymbolicResult {
  try {
    const node = math.parse(expr);
    const steps: SymbolicStep[] = [];
    const integrated = integrateWithSteps(node, variable, steps);
    const simplified = math.simplify(integrated);

    if (simplified.toString() !== integrated.toString()) {
      steps.push({
        rule: 'Simplificar',
        explanation: 'Reducimos el resultado a su forma más compacta.',
        latex: `${toTex(integrated)} \\;=\\; ${toTex(simplified)}`,
      });
    }

    return {
      result: simplified.toString() + ' + C',
      resultTex: `${toTex(simplified)} + C`,
      steps,
    };
  } catch (e: any) {
    throw new Error(`No se pudo integrar: ${e.message}`);
  }
}

function integrateWithSteps(node: MathNode, v: string, steps: SymbolicStep[]): MathNode {
  // Constant
  if (!containsVariable(node, v)) {
    const result = new OperatorNode('*', 'multiply', [node, new SymbolNode(v)]);
    steps.push({
      rule: 'Integral de una constante',
      explanation: `∫c d${v} = c·${v}.`,
      latex: `\\int ${toTex(node)}\\, d${v} = ${toTex(node)}\\cdot ${v}`,
    });
    return result;
  }

  // Variable alone
  if (isSymbol(node, v)) {
    const result = new OperatorNode('/', 'divide', [
      new OperatorNode('^', 'pow', [new SymbolNode(v), new ConstantNode(2)]),
      new ConstantNode(2),
    ]);
    steps.push({
      rule: 'Regla de la potencia',
      explanation: `∫${v} d${v} = ${v}²/2.`,
      latex: `\\int ${v}\\, d${v} = \\frac{${v}^{2}}{2}`,
    });
    return result;
  }

  // Addition
  if (isOperator(node, '+')) {
    const op = node as OperatorNode;
    steps.push({
      rule: 'Regla de la suma',
      explanation: 'La integral de una suma es la suma de las integrales.',
      latex: `\\int \\left[${toTex(op.args[0])} + ${toTex(op.args[1])}\\right] d${v} = \\int ${toTex(op.args[0])}\\, d${v} + \\int ${toTex(op.args[1])}\\, d${v}`,
    });
    const a = integrateWithSteps(op.args[0], v, steps);
    const b = integrateWithSteps(op.args[1], v, steps);
    return new OperatorNode('+', 'add', [a, b]);
  }

  // Subtraction
  if (isOperator(node, '-')) {
    const op = node as OperatorNode;
    if (op.args.length === 1) {
      steps.push({
        rule: 'Signo negativo',
        explanation: '∫(−f) = −∫f.',
        latex: `\\int -${toTex(op.args[0])}\\, d${v} = -\\int ${toTex(op.args[0])}\\, d${v}`,
      });
      const a = integrateWithSteps(op.args[0], v, steps);
      return new OperatorNode('-', 'unaryMinus', [a]);
    }
    steps.push({
      rule: 'Regla de la resta',
      explanation: 'La integral de una resta es la resta de las integrales.',
      latex: `\\int \\left[${toTex(op.args[0])} - ${toTex(op.args[1])}\\right] d${v} = \\int ${toTex(op.args[0])}\\, d${v} - \\int ${toTex(op.args[1])}\\, d${v}`,
    });
    const a = integrateWithSteps(op.args[0], v, steps);
    const b = integrateWithSteps(op.args[1], v, steps);
    return new OperatorNode('-', 'subtract', [a, b]);
  }

  // Product
  if (isOperator(node, '*')) {
    const op = node as OperatorNode;

    if (!containsVariable(op.args[0], v)) {
      steps.push({
        rule: 'Múltiplo constante',
        explanation: 'La constante sale de la integral.',
        latex: `\\int ${toTex(op.args[0])}\\cdot ${toTex(op.args[1])}\\, d${v} = ${toTex(op.args[0])}\\int ${toTex(op.args[1])}\\, d${v}`,
      });
      const inner = integrateWithSteps(op.args[1], v, steps);
      return new OperatorNode('*', 'multiply', [op.args[0], inner]);
    }
    if (!containsVariable(op.args[1], v)) {
      steps.push({
        rule: 'Múltiplo constante',
        explanation: 'La constante sale de la integral.',
        latex: `\\int ${toTex(op.args[0])}\\cdot ${toTex(op.args[1])}\\, d${v} = ${toTex(op.args[1])}\\int ${toTex(op.args[0])}\\, d${v}`,
      });
      const inner = integrateWithSteps(op.args[0], v, steps);
      return new OperatorNode('*', 'multiply', [op.args[1], inner]);
    }

    // Both contain variable: try simplification → u-substitution → integration by parts
    return tryAdvancedIntegration(op, v, steps);
  }

  // Division
  if (isOperator(node, '/')) {
    const op = node as OperatorNode;

    // f(x) / c
    if (!containsVariable(op.args[1], v)) {
      steps.push({
        rule: 'División por constante',
        explanation: 'Una constante en el denominador sale multiplicando el recíproco.',
        latex: `\\int \\frac{${toTex(op.args[0])}}{${toTex(op.args[1])}}\\, d${v} = \\frac{1}{${toTex(op.args[1])}} \\int ${toTex(op.args[0])}\\, d${v}`,
      });
      const inner = integrateWithSteps(op.args[0], v, steps);
      return new OperatorNode('/', 'divide', [inner, op.args[1]]);
    }
    // c / x
    if (!containsVariable(op.args[0], v) && isSymbol(op.args[1], v)) {
      const result = new OperatorNode('*', 'multiply', [
        op.args[0],
        new FunctionNode(new SymbolNode('log'), [new FunctionNode(new SymbolNode('abs'), [new SymbolNode(v)])]),
      ]);
      steps.push({
        rule: 'Integral logarítmica',
        explanation: `∫c/${v} d${v} = c·ln|${v}|.`,
        latex: `\\int \\frac{${toTex(op.args[0])}}{${v}}\\, d${v} = ${toTex(op.args[0])}\\,\\ln|${v}|`,
      });
      return result;
    }
    // 1 / x
    if (isConstantValue(op.args[0], 1) && isSymbol(op.args[1], v)) {
      const result = new FunctionNode(new SymbolNode('log'), [new FunctionNode(new SymbolNode('abs'), [new SymbolNode(v)])]);
      steps.push({
        rule: 'Integral logarítmica',
        explanation: `∫1/${v} d${v} = ln|${v}|.`,
        latex: `\\int \\frac{1}{${v}}\\, d${v} = \\ln|${v}|`,
      });
      return result;
    }
    // 1 / x^n
    if (isConstantValue(op.args[0], 1) && isPower(op.args[1], v)) {
      const powNode = op.args[1] as OperatorNode;
      const negExp = new OperatorNode('-', 'unaryMinus', [powNode.args[1]]);
      const asPow = new OperatorNode('^', 'pow', [new SymbolNode(v), negExp]);
      steps.push({
        rule: 'Reescribir como potencia negativa',
        explanation: `Reescribimos 1/${v}^n como ${v}^{-n}.`,
        latex: `\\frac{1}{${toTex(op.args[1])}} = ${v}^{-${toTex(powNode.args[1])}}`,
      });
      return integrateWithSteps(asPow, v, steps);
    }
    // u-substitution: f'(x) / f(x) dx = ln|f(x)|
    const numDeriv = tryMatchDerivative(op.args[0], op.args[1], v);
    if (numDeriv) {
      steps.push({
        rule: 'Sustitución u = ' + op.args[1].toString(),
        explanation: `El numerador es la derivada del denominador: u = ${op.args[1].toString()}, du = ${numDeriv} d${v}, y ∫du/u = ln|u|.`,
        latex: `\\int \\frac{${toTex(op.args[0])}}{${toTex(op.args[1])}}\\, d${v} = \\ln\\left|${toTex(op.args[1])}\\right|`,
      });
      return new FunctionNode(new SymbolNode('log'), [new FunctionNode(new SymbolNode('abs'), [op.args[1].cloneDeep()])]);
    }
  }

  // Power
  if (isOperator(node, '^')) {
    const op = node as OperatorNode;
    if (isSymbol(op.args[0], v) && !containsVariable(op.args[1], v)) {
      const n = op.args[1];
      if (isConstantValue(n, -1)) {
        const result = new FunctionNode(new SymbolNode('log'), [new FunctionNode(new SymbolNode('abs'), [new SymbolNode(v)])]);
        steps.push({
          rule: 'Integral logarítmica',
          explanation: `∫${v}^{-1} d${v} = ln|${v}|.`,
          latex: `\\int ${v}^{-1}\\, d${v} = \\ln|${v}|`,
        });
        return result;
      }
      const nPlus1 = new OperatorNode('+', 'add', [n, new ConstantNode(1)]);
      const result = new OperatorNode('/', 'divide', [
        new OperatorNode('^', 'pow', [new SymbolNode(v), nPlus1]),
        nPlus1,
      ]);
      steps.push({
        rule: 'Regla de la potencia',
        explanation: `∫${v}^n d${v} = ${v}^{n+1}/(n+1), para n ≠ −1.`,
        latex: `\\int ${v}^{${toTex(n)}}\\, d${v} = \\frac{${v}^{${toTex(n)}+1}}{${toTex(n)}+1}`,
      });
      return result;
    }
    // e^x
    if (isSymbolNamed(op.args[0], 'e') && isSymbol(op.args[1], v)) {
      const result = new OperatorNode('^', 'pow', [new SymbolNode('e'), new SymbolNode(v)]);
      steps.push({
        rule: 'Integral exponencial',
        explanation: `∫e^${v} d${v} = e^${v}.`,
        latex: `\\int e^{${v}}\\, d${v} = e^{${v}}`,
      });
      return result;
    }
    // a^x
    if (!containsVariable(op.args[0], v) && isSymbol(op.args[1], v)) {
      const result = new OperatorNode('/', 'divide', [
        node,
        new FunctionNode(new SymbolNode('log'), [op.args[0]]),
      ]);
      steps.push({
        rule: 'Integral exponencial general',
        explanation: `∫a^${v} d${v} = a^${v}/ln(a).`,
        latex: `\\int ${toTex(op.args[0])}^{${v}}\\, d${v} = \\frac{${toTex(op.args[0])}^{${v}}}{\\ln(${toTex(op.args[0])})}`,
      });
      return result;
    }
    // e^(linear)
    if (isSymbolNamed(op.args[0], 'e') && isLinearIn(op.args[1], v)) {
      const { a: coeff } = getLinearCoeffs(op.args[1], v);
      const result = new OperatorNode('/', 'divide', [
        new OperatorNode('^', 'pow', [new SymbolNode('e'), op.args[1].cloneDeep()]),
        coeff,
      ]);
      steps.push({
        rule: 'Sustitución lineal (exponencial)',
        explanation: `u = ${op.args[1].toString()}, du = ${coeff.toString()}·d${v}. ∫e^u du = e^u, luego dividimos por ${coeff.toString()}.`,
        latex: `\\int e^{${toTex(op.args[1])}}\\, d${v} = \\frac{e^{${toTex(op.args[1])}}}{${toTex(coeff)}}`,
      });
      return result;
    }
  }

  // Functions
  if (node.type === 'FunctionNode') {
    const fn = node as FunctionNode;
    const fnName = fn.fn.toString();
    const arg = fn.args[0];

    // Direct: f(v)
    if (isSymbol(arg, v)) {
      const simple = integrateElementary(fnName, v);
      if (simple) {
        steps.push({
          rule: simple.ruleName,
          explanation: simple.explanation,
          latex: simple.latex,
        });
        return simple.result;
      }
    }

    // Linear substitution: f(av + b)
    if (isLinearIn(arg, v) && !isSymbol(arg, v)) {
      const { a: coeff } = getLinearCoeffs(arg, v);
      const simple = integrateElementary(fnName, v);
      if (simple) {
        const substituted = replaceVar(simple.result, v, arg);
        const divided = new OperatorNode('/', 'divide', [substituted, coeff]);
        steps.push({
          rule: 'Sustitución lineal u = ' + arg.toString(),
          explanation: `Hacemos u = ${arg.toString()}; du = ${coeff.toString()}·d${v}. Aplicamos ∫${fnName}(u) du y dividimos por ${coeff.toString()}.`,
          latex: `\\int ${fnName === 'log' || fnName === 'ln' ? '\\ln' : '\\' + fnName}\\!\\left(${toTex(arg)}\\right) d${v} = \\frac{1}{${toTex(coeff)}}\\,${toTex(substituted)}`,
        });
        return divided;
      }
    }
  }

  // Parenthesis
  if (node.type === 'ParenthesisNode') {
    return integrateWithSteps((node as ParenthesisNode).content, v, steps);
  }

  throw new Error(`No se puede integrar: ${node.toString()}`);
}

interface ElementaryIntegral {
  ruleName: string;
  explanation: string;
  result: MathNode;
  latex: string;
}

function integrateElementary(fnName: string, v: string): ElementaryIntegral | null {
  switch (fnName) {
    case 'sin':
      return {
        ruleName: 'Integral de sin',
        explanation: `∫sin(${v}) d${v} = −cos(${v}).`,
        result: new OperatorNode('-', 'unaryMinus', [new FunctionNode(new SymbolNode('cos'), [new SymbolNode(v)])]),
        latex: `\\int \\sin(${v})\\, d${v} = -\\cos(${v})`,
      };
    case 'cos':
      return {
        ruleName: 'Integral de cos',
        explanation: `∫cos(${v}) d${v} = sin(${v}).`,
        result: new FunctionNode(new SymbolNode('sin'), [new SymbolNode(v)]),
        latex: `\\int \\cos(${v})\\, d${v} = \\sin(${v})`,
      };
    case 'tan':
      return {
        ruleName: 'Integral de tan',
        explanation: `∫tan(${v}) d${v} = −ln|cos(${v})|.`,
        result: new OperatorNode('-', 'unaryMinus', [
          new FunctionNode(new SymbolNode('log'), [new FunctionNode(new SymbolNode('abs'), [new FunctionNode(new SymbolNode('cos'), [new SymbolNode(v)])])]),
        ]),
        latex: `\\int \\tan(${v})\\, d${v} = -\\ln|\\cos(${v})|`,
      };
    case 'exp':
      return {
        ruleName: 'Integral de exp',
        explanation: `∫e^${v} d${v} = e^${v}.`,
        result: new FunctionNode(new SymbolNode('exp'), [new SymbolNode(v)]),
        latex: `\\int e^{${v}}\\, d${v} = e^{${v}}`,
      };
    case 'log':
    case 'ln':
      return {
        ruleName: 'Integral de ln (por partes)',
        explanation: `Integración por partes con u = ln(${v}), dv = d${v} → ∫ln(${v}) d${v} = ${v}·ln(${v}) − ${v}.`,
        result: new OperatorNode('-', 'subtract', [
          new OperatorNode('*', 'multiply', [new SymbolNode(v), new FunctionNode(new SymbolNode('log'), [new SymbolNode(v)])]),
          new SymbolNode(v),
        ]),
        latex: `\\int \\ln(${v})\\, d${v} = ${v}\\ln(${v}) - ${v}`,
      };
    case 'sqrt':
      return {
        ruleName: 'Integral de √',
        explanation: `∫√${v} d${v} = (2/3)·${v}^(3/2).`,
        result: new OperatorNode('*', 'multiply', [
          new OperatorNode('/', 'divide', [new ConstantNode(2), new ConstantNode(3)]),
          new OperatorNode('^', 'pow', [new SymbolNode(v), new OperatorNode('/', 'divide', [new ConstantNode(3), new ConstantNode(2)])]),
        ]),
        latex: `\\int \\sqrt{${v}}\\, d${v} = \\tfrac{2}{3}\\,${v}^{3/2}`,
      };
    default:
      return null;
  }
}

function tryAdvancedIntegration(op: OperatorNode, v: string, steps: SymbolicStep[]): MathNode {
  // 1) Try simplification first (handles x*x^2 → x^3, etc.)
  const str = op.toString();
  const simplified = math.simplify(str);
  const simpStr = simplified.toString();
  if (simpStr !== str && !stillMixedProduct(simplified, v)) {
    steps.push({
      rule: 'Simplificar el producto',
      explanation: `Simplificamos antes de integrar: ${str} = ${simpStr}.`,
      latex: `${toTex(op)} \\;=\\; ${toTex(simplified)}`,
    });
    return integrateWithSteps(math.parse(simpStr), v, steps);
  }

  // 2) Try u-substitution: detect outer·inner' where f(u)·du pattern exists
  const uSub = tryUSubstitution(op, v, steps);
  if (uSub) return uSub;

  // 3) Integration by parts
  const byParts = tryIntegrationByParts(op, v, steps);
  if (byParts) return byParts;

  throw new Error(`No se puede integrar el producto: ${str}`);
}

function stillMixedProduct(node: MathNode, v: string): boolean {
  if (isOperator(node, '*')) {
    const op = node as OperatorNode;
    if (containsVariable(op.args[0], v) && containsVariable(op.args[1], v)) return true;
  }
  let any = false;
  node.forEach((c) => { if (stillMixedProduct(c, v)) any = true; });
  return any;
}

function tryUSubstitution(op: OperatorNode, v: string, steps: SymbolicStep[]): MathNode | null {
  // Look for pattern: outer(inner) * inner'(v), or inner'(v) * outer(inner)
  // where `outer` is an elementary function and `inner` is not just v.
  const candidates: Array<{ outer: FunctionNode; innerDeriv: MathNode }> = [];
  for (const [a, b] of [[op.args[0], op.args[1]], [op.args[1], op.args[0]]]) {
    if (a.type === 'FunctionNode') {
      const fn = a as FunctionNode;
      const arg = fn.args[0];
      if (!isSymbol(arg, v) && containsVariable(arg, v)) {
        // Check if b matches d/dv[arg]
        const d = safeDerivative(arg, v);
        if (d && equivalentExprs(d, b)) {
          candidates.push({ outer: fn, innerDeriv: b });
        }
      }
    }
    // Power (inner)^n · inner'
    if (isOperator(a, '^')) {
      const powOp = a as OperatorNode;
      const base = powOp.args[0];
      if (!isSymbol(base, v) && containsVariable(base, v) && !containsVariable(powOp.args[1], v)) {
        const d = safeDerivative(base, v);
        if (d && equivalentExprs(d, b)) {
          // Treat as ∫ u^n du with u = base
          const nPlus1 = new OperatorNode('+', 'add', [powOp.args[1], new ConstantNode(1)]);
          const result = new OperatorNode('/', 'divide', [
            new OperatorNode('^', 'pow', [base.cloneDeep(), nPlus1]),
            nPlus1,
          ]);
          steps.push({
            rule: 'Sustitución u = ' + base.toString(),
            explanation: `u = ${base.toString()}, du = ${b.toString()} d${v}. Aplicamos ∫u^n du = u^{n+1}/(n+1).`,
            latex: `\\int ${toTex(a)}\\cdot ${toTex(b)}\\, d${v} = \\frac{${toTex(base)}^{${toTex(powOp.args[1])}+1}}{${toTex(powOp.args[1])}+1}`,
          });
          return result;
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  const cand = candidates[0];
  const fnName = cand.outer.fn.toString();
  const innerNode = cand.outer.args[0];
  const simple = integrateElementary(fnName, v);
  if (!simple) return null;
  const substituted = replaceVar(simple.result, v, innerNode);
  steps.push({
    rule: 'Sustitución u = ' + innerNode.toString(),
    explanation: `u = ${innerNode.toString()}, du = ${cand.innerDeriv.toString()} d${v}. Aplicamos ∫${fnName}(u) du y volvemos a ${v}.`,
    latex: `\\int ${toTex(cand.outer)}\\cdot ${toTex(cand.innerDeriv)}\\, d${v} = ${toTex(substituted)}`,
  });
  return substituted;
}

function tryIntegrationByParts(op: OperatorNode, v: string, steps: SymbolicStep[]): MathNode | null {
  const f1 = op.args[0];
  const f2 = op.args[1];
  const p1 = liatePriority(f1, v);
  const p2 = liatePriority(f2, v);
  if (p1 === null || p2 === null) return null;

  // LIATE: lower priority number = pick as u
  const [u, dv] = p1 <= p2 ? [f1, f2] : [f2, f1];

  let du: MathNode;
  let vInt: MathNode;
  try {
    const throwaway: SymbolicStep[] = [];
    du = deriveStep(u, v, throwaway);
    du = math.simplify(du);
    const throwaway2: SymbolicStep[] = [];
    vInt = integrateWithSteps(dv, v, throwaway2);
  } catch {
    return null;
  }

  steps.push({
    rule: 'Integración por partes',
    explanation: `Elegimos u = ${u.toString()} y dv = ${dv.toString()} d${v} (criterio LIATE).`,
    latex: `\\int u\\, dv = u\\cdot v - \\int v\\, du, \\quad u = ${toTex(u)},\\; dv = ${toTex(dv)}\\, d${v}`,
  });

  steps.push({
    rule: 'Calcular du y v',
    explanation: `Derivamos u e integramos dv.`,
    latex: `du = ${toTex(du)}\\, d${v}, \\quad v = \\int ${toTex(dv)}\\, d${v} = ${toTex(vInt)}`,
  });

  const uv = new OperatorNode('*', 'multiply', [u.cloneDeep(), vInt.cloneDeep()]);
  const vDu = new OperatorNode('*', 'multiply', [vInt.cloneDeep(), du.cloneDeep()]);

  steps.push({
    rule: 'Sustituir en u·v − ∫v du',
    explanation: 'Reemplazamos u, v y du en la fórmula.',
    latex: `u\\cdot v - \\int v\\, du \\;=\\; ${toTex(uv)} - \\int ${toTex(vDu)}\\, d${v}`,
  });

  const remaining = integrateWithSteps(vDu, v, steps);

  return new OperatorNode('-', 'subtract', [uv, remaining]);
}

function liatePriority(node: MathNode, v: string): number | null {
  // LIATE: 1 Log, 2 Inv-trig, 3 Algebraic, 4 Trig, 5 Exp
  if (!containsVariable(node, v)) return null;

  if (node.type === 'FunctionNode') {
    const fnName = (node as FunctionNode).fn.toString();
    if (fnName === 'log' || fnName === 'ln') return 1;
    if (['asin', 'acos', 'atan'].includes(fnName)) return 2;
    if (['sin', 'cos', 'tan'].includes(fnName)) return 4;
    if (fnName === 'exp') return 5;
  }

  if (isSymbol(node, v)) return 3;

  if (isOperator(node, '^')) {
    const op = node as OperatorNode;
    if (isSymbol(op.args[0], v) && !containsVariable(op.args[1], v)) return 3;
    if (isSymbolNamed(op.args[0], 'e') && containsVariable(op.args[1], v)) return 5;
    if (!containsVariable(op.args[0], v) && containsVariable(op.args[1], v)) return 5;
  }

  return null;
}

function safeDerivative(node: MathNode, v: string): MathNode | null {
  try {
    return math.simplify(math.derivative(node, v));
  } catch {
    return null;
  }
}

function equivalentExprs(a: MathNode, b: MathNode): boolean {
  try {
    const diff = math.simplify(new OperatorNode('-', 'subtract', [a.cloneDeep(), b.cloneDeep()]));
    return diff.toString() === '0';
  } catch {
    return false;
  }
}

function tryMatchDerivative(num: MathNode, den: MathNode, v: string): string | null {
  const dDen = safeDerivative(den, v);
  if (dDen && equivalentExprs(dDen, num)) return dDen.toString();
  return null;
}

// ─── LaTeX helper ───

function toTex(node: MathNode): string {
  try {
    return node.toTex({ parenthesis: 'auto' });
  } catch {
    return node.toString();
  }
}

// ─── Shared helpers ───

function containsVariable(node: MathNode, v: string): boolean {
  if (node.type === 'SymbolNode') return (node as SymbolNode).name === v;
  if (node.type === 'ConstantNode') return false;
  let found = false;
  node.forEach((child) => { if (containsVariable(child, v)) found = true; });
  return found;
}

function isSymbol(node: MathNode, v: string): boolean {
  return node.type === 'SymbolNode' && (node as SymbolNode).name === v;
}

function isSymbolNamed(node: MathNode, name: string): boolean {
  return node.type === 'SymbolNode' && (node as SymbolNode).name === name;
}

function isOperator(node: MathNode, op: string): boolean {
  return node.type === 'OperatorNode' && (node as OperatorNode).op === op;
}

function isPower(node: MathNode, v: string): boolean {
  return isOperator(node, '^') && isSymbol((node as OperatorNode).args[0], v);
}

function isConstantValue(node: MathNode, val: number): boolean {
  if (node.type === 'ConstantNode') return (node as ConstantNode).value === val;
  return false;
}

function isLinearIn(node: MathNode, v: string): boolean {
  try {
    getLinearCoeffs(node, v);
    return true;
  } catch {
    return false;
  }
}

function getLinearCoeffs(node: MathNode, v: string): { a: MathNode; b: MathNode } {
  if (isSymbol(node, v)) return { a: new ConstantNode(1), b: new ConstantNode(0) };
  if (isOperator(node, '*')) {
    const op = node as OperatorNode;
    if (!containsVariable(op.args[0], v) && isSymbol(op.args[1], v)) return { a: op.args[0], b: new ConstantNode(0) };
    if (!containsVariable(op.args[1], v) && isSymbol(op.args[0], v)) return { a: op.args[1], b: new ConstantNode(0) };
  }
  if (isOperator(node, '+')) {
    const op = node as OperatorNode;
    if (containsVariable(op.args[0], v) && !containsVariable(op.args[1], v)) {
      const inner = getLinearCoeffs(op.args[0], v);
      return { a: inner.a, b: new OperatorNode('+', 'add', [inner.b, op.args[1]]) };
    }
    if (containsVariable(op.args[1], v) && !containsVariable(op.args[0], v)) {
      const inner = getLinearCoeffs(op.args[1], v);
      return { a: inner.a, b: new OperatorNode('+', 'add', [inner.b, op.args[0]]) };
    }
  }
  if (isOperator(node, '-')) {
    const op = node as OperatorNode;
    if (op.args.length === 2 && containsVariable(op.args[0], v) && !containsVariable(op.args[1], v)) {
      const inner = getLinearCoeffs(op.args[0], v);
      return { a: inner.a, b: new OperatorNode('-', 'subtract', [inner.b, op.args[1]]) };
    }
  }
  throw new Error('Not linear');
}

function replaceVar(node: MathNode, v: string, replacement: MathNode): MathNode {
  return node.transform((n) => {
    if (isSymbol(n, v)) return replacement.cloneDeep();
    return n;
  });
}
