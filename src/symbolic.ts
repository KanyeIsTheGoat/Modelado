import { create, all, MathNode, OperatorNode, ConstantNode, SymbolNode, FunctionNode, ParenthesisNode } from 'mathjs';

const math = create(all);

/**
 * Symbolic derivative using math.js built-in.
 * Returns a simplified string expression.
 */
export function symbolicDerivative(expr: string, variable: string = 'x'): string {
  try {
    const node = math.parse(expr);
    const derived = math.derivative(node, variable);
    return math.simplify(derived).toString();
  } catch (e: any) {
    throw new Error(`No se pudo derivar: ${e.message}`);
  }
}

/**
 * Symbolic integration using recursive rules.
 * Returns a string expression + " + C".
 */
export function symbolicIntegral(expr: string, variable: string = 'x'): string {
  try {
    const node = math.parse(expr);
    const result = integrateNode(node, variable);
    const simplified = math.simplify(result).toString();
    return simplified + ' + C';
  } catch (e: any) {
    throw new Error(`No se pudo integrar: ${e.message}`);
  }
}

function integrateNode(node: MathNode, v: string): MathNode {
  // Constant (no variable)
  if (!containsVariable(node, v)) {
    // ∫c dx = c * x
    return new OperatorNode('*', 'multiply', [node, new SymbolNode(v)]);
  }

  // Just the variable: ∫x dx = x^2/2
  if (isSymbol(node, v)) {
    return new OperatorNode('/', 'divide', [
      new OperatorNode('^', 'pow', [new SymbolNode(v), new ConstantNode(2)]),
      new ConstantNode(2),
    ]);
  }

  // Addition: ∫(f + g) = ∫f + ∫g
  if (isOperator(node, '+')) {
    const op = node as OperatorNode;
    return new OperatorNode('+', 'add', [
      integrateNode(op.args[0], v),
      integrateNode(op.args[1], v),
    ]);
  }

  // Subtraction: ∫(f - g) = ∫f - ∫g
  if (isOperator(node, '-')) {
    const op = node as OperatorNode;
    if (op.args.length === 1) {
      // Unary minus: ∫(-f) = -∫f
      return new OperatorNode('-', 'unaryMinus', [integrateNode(op.args[0], v)]);
    }
    return new OperatorNode('-', 'subtract', [
      integrateNode(op.args[0], v),
      integrateNode(op.args[1], v),
    ]);
  }

  // Constant * f(x): ∫c*f = c * ∫f
  if (isOperator(node, '*')) {
    const op = node as OperatorNode;
    if (!containsVariable(op.args[0], v)) {
      return new OperatorNode('*', 'multiply', [op.args[0], integrateNode(op.args[1], v)]);
    }
    if (!containsVariable(op.args[1], v)) {
      return new OperatorNode('*', 'multiply', [op.args[1], integrateNode(op.args[0], v)]);
    }
    // Both contain variable — try power rule for x * x^n patterns
    return tryProductIntegration(op, v);
  }

  // Division: c / f or f / c
  if (isOperator(node, '/')) {
    const op = node as OperatorNode;
    // f(x) / c = (1/c) * ∫f
    if (!containsVariable(op.args[1], v)) {
      return new OperatorNode('/', 'divide', [integrateNode(op.args[0], v), op.args[1]]);
    }
    // c / x = c * ln|x|
    if (!containsVariable(op.args[0], v) && isSymbol(op.args[1], v)) {
      return new OperatorNode('*', 'multiply', [
        op.args[0],
        new FunctionNode(new SymbolNode('log'), [new FunctionNode(new SymbolNode('abs'), [new SymbolNode(v)])]),
      ]);
    }
    // 1/x = ln|x|
    if (isConstantValue(op.args[0], 1) && isSymbol(op.args[1], v)) {
      return new FunctionNode(new SymbolNode('log'), [new FunctionNode(new SymbolNode('abs'), [new SymbolNode(v)])]);
    }
    // 1/x^n = x^(-n) — delegate to power rule
    if (isConstantValue(op.args[0], 1) && isPower(op.args[1], v)) {
      const powNode = op.args[1] as OperatorNode;
      const negExp = new OperatorNode('-', 'unaryMinus', [powNode.args[1]]);
      const asPow = new OperatorNode('^', 'pow', [new SymbolNode(v), negExp]);
      return integrateNode(asPow, v);
    }
  }

  // Power: x^n
  if (isOperator(node, '^')) {
    const op = node as OperatorNode;
    if (isSymbol(op.args[0], v) && !containsVariable(op.args[1], v)) {
      const n = op.args[1];
      // Check for x^(-1) = ln|x|
      if (isConstantValue(n, -1)) {
        return new FunctionNode(new SymbolNode('log'), [new FunctionNode(new SymbolNode('abs'), [new SymbolNode(v)])]);
      }
      // ∫x^n = x^(n+1) / (n+1)
      const nPlus1 = new OperatorNode('+', 'add', [n, new ConstantNode(1)]);
      return new OperatorNode('/', 'divide', [
        new OperatorNode('^', 'pow', [new SymbolNode(v), nPlus1]),
        nPlus1,
      ]);
    }
    // e^x
    if (isSymbolNamed(op.args[0], 'e') && isSymbol(op.args[1], v)) {
      return new OperatorNode('^', 'pow', [new SymbolNode('e'), new SymbolNode(v)]);
    }
    // a^x = a^x / ln(a)
    if (!containsVariable(op.args[0], v) && isSymbol(op.args[1], v)) {
      return new OperatorNode('/', 'divide', [
        node,
        new FunctionNode(new SymbolNode('log'), [op.args[0]]),
      ]);
    }
  }

  // Functions: sin, cos, tan, exp, log, sqrt, etc.
  if (node.type === 'FunctionNode') {
    const fn = node as FunctionNode;
    const fnName = fn.fn.toString();
    const arg = fn.args[0];

    // Only handle f(x) where arg = x directly
    if (isSymbol(arg, v)) {
      switch (fnName) {
        case 'sin': // ∫sin(x) = -cos(x)
          return new OperatorNode('-', 'unaryMinus', [
            new FunctionNode(new SymbolNode('cos'), [new SymbolNode(v)]),
          ]);
        case 'cos': // ∫cos(x) = sin(x)
          return new FunctionNode(new SymbolNode('sin'), [new SymbolNode(v)]);
        case 'tan': // ∫tan(x) = -ln|cos(x)|
          return new OperatorNode('-', 'unaryMinus', [
            new FunctionNode(new SymbolNode('log'), [
              new FunctionNode(new SymbolNode('abs'), [
                new FunctionNode(new SymbolNode('cos'), [new SymbolNode(v)]),
              ]),
            ]),
          ]);
        case 'exp': // ∫e^x = e^x
          return new FunctionNode(new SymbolNode('exp'), [new SymbolNode(v)]);
        case 'log': // ∫ln(x) = x*ln(x) - x
          return new OperatorNode('-', 'subtract', [
            new OperatorNode('*', 'multiply', [
              new SymbolNode(v),
              new FunctionNode(new SymbolNode('log'), [new SymbolNode(v)]),
            ]),
            new SymbolNode(v),
          ]);
        case 'sqrt': // ∫sqrt(x) = ∫x^(1/2) = (2/3)*x^(3/2)
          return new OperatorNode('*', 'multiply', [
            new OperatorNode('/', 'divide', [new ConstantNode(2), new ConstantNode(3)]),
            new OperatorNode('^', 'pow', [
              new SymbolNode(v),
              new OperatorNode('/', 'divide', [new ConstantNode(3), new ConstantNode(2)]),
            ]),
          ]);
        case 'sec': // ∫sec(x) — not elementary simple, skip
        case 'csc':
        case 'cot':
          break;
      }
    }

    // ∫f(ax+b) patterns via simple substitution
    if (isLinearIn(arg, v)) {
      const { a: coeff } = getLinearCoeffs(arg, v);
      const innerResult = integrateSimpleFunc(fnName, v);
      if (innerResult) {
        // Replace x with (ax+b) in the result, divide by a
        const substituted = replaceVar(innerResult, v, arg);
        return new OperatorNode('/', 'divide', [substituted, coeff]);
      }
    }
  }

  // Parenthesis — unwrap
  if (node.type === 'ParenthesisNode') {
    return integrateNode((node as ParenthesisNode).content, v);
  }

  throw new Error(`No se puede integrar: ${node.toString()}`);
}

// ── Helpers ──

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
  // Check if node is of the form a*x + b or a*x or x + b or just x
  try {
    getLinearCoeffs(node, v);
    return true;
  } catch {
    return false;
  }
}

function getLinearCoeffs(node: MathNode, v: string): { a: MathNode; b: MathNode } {
  if (isSymbol(node, v)) {
    return { a: new ConstantNode(1), b: new ConstantNode(0) };
  }
  if (isOperator(node, '*')) {
    const op = node as OperatorNode;
    if (!containsVariable(op.args[0], v) && isSymbol(op.args[1], v)) {
      return { a: op.args[0], b: new ConstantNode(0) };
    }
    if (!containsVariable(op.args[1], v) && isSymbol(op.args[0], v)) {
      return { a: op.args[1], b: new ConstantNode(0) };
    }
  }
  if (isOperator(node, '+')) {
    const op = node as OperatorNode;
    if (containsVariable(op.args[0], v) && !containsVariable(op.args[1], v)) {
      const inner = getLinearCoeffs(op.args[0], v);
      return { a: inner.a, b: new OperatorNode('+', 'add', [inner.b, op.args[1]]) };
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

function integrateSimpleFunc(fnName: string, v: string): MathNode | null {
  switch (fnName) {
    case 'sin':
      return new OperatorNode('-', 'unaryMinus', [
        new FunctionNode(new SymbolNode('cos'), [new SymbolNode(v)]),
      ]);
    case 'cos':
      return new FunctionNode(new SymbolNode('sin'), [new SymbolNode(v)]);
    case 'exp':
      return new FunctionNode(new SymbolNode('exp'), [new SymbolNode(v)]);
    default:
      return null;
  }
}

function tryProductIntegration(op: OperatorNode, v: string): MathNode {
  // Try to expand x * x^n = x^(n+1) and similar
  const str = op.toString();
  const expanded = math.simplify(str, {}, { exactFractions: false });
  // If simplify turned it into a power, try again
  if (expanded.type === 'OperatorNode' && (expanded as OperatorNode).op === '^') {
    return integrateNode(expanded, v);
  }
  // Try expanding
  const expandedStr = math.simplify(str).toString();
  const reparsed = math.parse(expandedStr);
  if (reparsed.toString() !== str) {
    return integrateNode(reparsed, v);
  }
  throw new Error(`No se puede integrar el producto: ${str}`);
}
