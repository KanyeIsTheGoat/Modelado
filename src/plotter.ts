import { Chart, registerables } from 'chart.js';
import type { ChartData } from './methods/types';

Chart.register(...registerables);

const THEME = {
  bg: '#1e1e2e',
  surface: '#313244',
  grid: '#45475a',
  text: '#cdd6f4',
  subtext: '#a6adc8',
};

const COLORS = [
  '#89b4fa', '#a6e3a1', '#fab387', '#cba6f7',
  '#f38ba8', '#94e2d5', '#f9e2af', '#f5c2e7',
  '#74c7ec', '#eba0ac',
];

const chartInstances = new Map<string, Chart>();

export function destroyAllCharts(): void {
  chartInstances.forEach(c => c.destroy());
  chartInstances.clear();
}

export function renderChart(canvasId: string, data: ChartData): Chart {
  // Destroy existing chart on this canvas
  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId)!.destroy();
    chartInstances.delete(canvasId);
  }

  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) throw new Error(`Canvas #${canvasId} not found`);

  const datasets = data.datasets.map((ds, i) => {
    const color = ds.color || COLORS[i % COLORS.length];
    return {
      label: ds.label,
      data: ds.x.map((xv, j) => ({ x: xv, y: ds.y[j] })),
      borderColor: color,
      backgroundColor: ds.fill ? color + '33' : 'transparent',
      fill: ds.fill ?? false,
      borderDash: ds.dashed ? [6, 4] : [],
      pointRadius: ds.pointRadius ?? 0,
      pointBackgroundColor: color,
      borderWidth: 2,
      tension: 0,
      showLine: ds.showLine !== false,
    };
  });

  const chart = new Chart(canvas, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        title: {
          display: true,
          text: data.title,
          color: THEME.text,
          font: { size: 13, weight: 'bold' as const },
        },
        legend: {
          display: datasets.length > 1,
          labels: { color: THEME.subtext, font: { size: 11 } },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: !!data.xLabel,
            text: data.xLabel || '',
            color: THEME.subtext,
          },
          grid: { color: THEME.grid + '55' },
          ticks: { color: THEME.subtext, font: { size: 10 } },
        },
        y: {
          type: data.yLog ? 'logarithmic' : 'linear',
          title: {
            display: !!data.yLabel,
            text: data.yLabel || '',
            color: THEME.subtext,
          },
          grid: { color: THEME.grid + '55' },
          ticks: { color: THEME.subtext, font: { size: 10 } },
        },
      },
    },
  });

  chartInstances.set(canvasId, chart);
  return chart;
}
