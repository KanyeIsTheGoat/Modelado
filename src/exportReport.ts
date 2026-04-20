import type { MethodDefinition, MethodResult } from './methods/types';

const MAX_TABLE_ROWS = 50;

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') {
    if (!isFinite(v)) return String(v);
    const abs = Math.abs(v);
    if (abs !== 0 && (abs < 1e-4 || abs >= 1e10)) return v.toExponential(6);
    return v.toPrecision(8).replace(/\.?0+$/, '');
  }
  return String(v);
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function buildInputsSection(method: MethodDefinition, params: Record<string, string>): string {
  const rows = method.inputs.map(inp => {
    const label = escapePipes(inp.label);
    const value = escapePipes(params[inp.id] ?? '');
    return `| ${label} | \`${value}\` |`;
  }).join('\n');
  return `## Parametros de entrada\n\n| Campo | Valor |\n|---|---|\n${rows}`;
}

function buildResultSection(result: MethodResult): string {
  const lines: string[] = ['## Resultado'];
  const kv: [string, string][] = [];
  if (result.root !== undefined) kv.push(['Raiz', fmt(result.root)]);
  if (result.integral !== undefined) kv.push(['Integral', fmt(result.integral)]);
  if (result.derivative !== undefined) kv.push(['Derivada', fmt(result.derivative)]);
  if (result.exact !== undefined) kv.push(['Valor exacto', fmt(result.exact)]);
  if (result.relativeErrorPercent !== undefined) kv.push(['Error relativo (%)', fmt(result.relativeErrorPercent)]);
  if (result.truncationBound !== undefined) {
    kv.push([`Cota |E| (orden ${result.truncationOrder ?? '?'})`, fmt(result.truncationBound)]);
  }
  if (result.maxDerivative !== undefined) {
    kv.push([`max |f^(${result.truncationOrder ?? '?'})(ξ)|`, `${fmt(result.maxDerivative)} en ξ ≈ ${fmt(result.xiApprox)}`]);
  }
  if (result.derivativeExpr) kv.push(['Derivada simbolica', `\`${result.derivativeExpr}\``]);
  if (result.retried) kv.push(['Reintento', 'Error > 1 % → n refinado']);
  kv.push(['Iteraciones', String(result.iterations.length)]);
  kv.push(['Error final', fmt(result.error)]);
  kv.push(['Convergido', result.converged ? 'Si' : 'No']);
  if (result.message) kv.push(['Nota', result.message]);

  lines.push('', '| Campo | Valor |', '|---|---|');
  for (const [k, v] of kv) lines.push(`| ${escapePipes(k)} | ${escapePipes(v)} |`);
  return lines.join('\n');
}

function buildTableSection(result: MethodResult, columns: { key: string; label: string }[]): string {
  if (result.iterations.length === 0) return '';
  const header = `| ${columns.map(c => escapePipes(c.label)).join(' | ')} |`;
  const separator = `|${columns.map(() => '---').join('|')}|`;
  const rows: string[] = [];
  const total = result.iterations.length;
  const limit = Math.min(total, MAX_TABLE_ROWS);
  for (let i = 0; i < limit; i++) {
    const row = result.iterations[i];
    const cells = columns.map(c => escapePipes(fmt(row[c.key]))).join(' | ');
    rows.push(`| ${cells} |`);
  }
  const truncatedNote = total > limit ? `\n\n> Tabla truncada: mostrando las primeras ${limit} de ${total} filas.` : '';
  return `## Tabla de iteraciones\n\n${header}\n${separator}\n${rows.join('\n')}${truncatedNote}`;
}

function buildTheoremSection(result: MethodResult): string {
  if (!result.theoremPanels || result.theoremPanels.length === 0) return '';
  const stripped = result.theoremPanels.map(html =>
    html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  ).filter(s => s.length > 0);
  if (stripped.length === 0) return '';
  return `## Verificaciones teoricas\n\n${stripped.map(s => `- ${s}`).join('\n')}`;
}

function captureChartImages(count: number): string[] {
  const images: string[] = [];
  for (let i = 0; i < count; i++) {
    const canvas = document.getElementById(`chart-${i}`) as HTMLCanvasElement | null;
    if (!canvas) continue;
    try {
      const data = canvas.toDataURL('image/png');
      if (data && data.startsWith('data:image/png')) images.push(data);
    } catch {
      // ignore (tainted canvas etc.)
    }
  }
  return images;
}

function buildChartsSection(chartImages: string[]): string {
  if (chartImages.length === 0) return '';
  const blocks = chartImages.map((img, i) => `### Grafico ${i + 1}\n\n![chart-${i}](${img})`);
  return `## Graficos\n\n${blocks.join('\n\n')}`;
}

export function buildMarkdownReport(
  method: MethodDefinition,
  params: Record<string, string>,
  result: MethodResult,
): string {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const chartImages = captureChartImages(4);

  const sections = [
    `# ${method.name}`,
    `_${method.description}_`,
    `**Formula:** \`${method.formula}\``,
    `**Generado:** ${now}`,
    buildInputsSection(method, params),
    buildResultSection(result),
    buildTheoremSection(result),
    buildChartsSection(chartImages),
    buildTableSection(result, method.tableColumns),
  ].filter(s => s && s.trim() !== '');

  return sections.join('\n\n') + '\n';
}

export function downloadMarkdownReport(
  method: MethodDefinition,
  params: Record<string, string>,
  result: MethodResult,
): void {
  const md = buildMarkdownReport(method, params, result);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = method.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  a.href = url;
  a.download = `reporte_${safeName}_${stamp}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
