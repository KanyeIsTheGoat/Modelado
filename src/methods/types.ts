export interface IterationRow {
  [key: string]: number | string;
}

export interface MethodResult {
  root?: number;
  integral?: number;
  derivative?: number;
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
  type?: 'text' | 'number';
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
  category: 'rootFinding' | 'integration' | 'differentiation';
  formula: string;
  description: string;
  inputs: MethodInput[];
  solve: (params: Record<string, string>) => MethodResult;
  getCharts: (params: Record<string, string>, result: MethodResult) => ChartData[];
  tableColumns: { key: string; label: string }[];
}
