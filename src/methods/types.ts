export interface IterationRow {
  [key: string]: number | string | null;
}

export interface MethodResult {
  root?: number;
  integral?: number;
  derivative?: number;
  /** User-provided or computed exact reference value, used for error comparison */
  exact?: number;
  /** Relative error vs exact, in percent */
  relativeErrorPercent?: number;
  /** Theoretical truncation error bound |E| using max|f^(k)| */
  truncationBound?: number;
  /** Order k of the derivative used to compute the truncation bound */
  truncationOrder?: number;
  /** Max |f^(k)| observed on the interval */
  maxDerivative?: number;
  /** x where the max derivative was found (approx ξ) */
  xiApprox?: number;
  /** Symbolic expression for the derivative used (when available) */
  derivativeExpr?: string;
  /** True when the method auto-retried with a refined n due to error > 1% */
  retried?: boolean;
  /** Pre-rendered HTML for theorem verification panels (Bolzano, Lipschitz, etc.) */
  theoremPanels?: string[];
  iterations: IterationRow[];
  converged: boolean;
  error: number;
  message?: string;
}

export interface MethodInput {
  id: string;
  label: string;
  placeholder: string;
  hint?: string;
  defaultValue?: string;
  type?: 'text' | 'number' | 'table' | 'stopCriterion';
  /** For type='table': number of columns (e.g. 2 for (x, y) pairs) */
  tableColumns?: number;
  /** For type='table': column headers */
  tableHeaders?: string[];
}

export interface ChartData {
  title: string;
  type: 'line' | 'scatter' | 'bar';
  datasets: {
    label: string;
    x: number[];
    y: number[];
    color: string;
    fill?: boolean;
    dashed?: boolean;
    pointRadius?: number;
    showLine?: boolean;
  }[];
  xLabel?: string;
  yLabel?: string;
  yLog?: boolean;
}

export interface MethodDefinition {
  id: string;
  name: string;
  category: 'rootFinding' | 'integration' | 'differentiation' | 'ode' | 'interpolation';
  formula: string;
  /** Optional LaTeX version of the formula rendered via KaTeX. Preferred over `formula` when present. */
  latexFormula?: string;
  description: string;
  inputs: MethodInput[];
  solve: (params: Record<string, string>) => MethodResult;
  getCharts: (params: Record<string, string>, result: MethodResult) => ChartData[];
  tableColumns: { key: string; label: string }[];
  /** Guia paso a paso (HTML inline permitido: <b>, <code>, <em>). Se muestra en la vista del metodo. */
  steps?: string[];
}
