import { categories } from '../categories';
import { texInline, FORMULAS } from '../latex';

export function renderHome(onMethodClick: (methodId: string) => void): string {
  const sectionsHtml = categories.map(cat => {
    const cards = cat.methods.map(m => {
      const latexFormula = FORMULAS[m.id];
      const formulaHtml = latexFormula
        ? texInline(latexFormula)
        : `<span class="formula-fallback">${m.formula}</span>`;

      return `
        <div class="method-card ${cat.cssClass}" data-method="${m.id}">
          <h3>${m.name}</h3>
          <div class="formula">${formulaHtml}</div>
          <div class="description">${m.description}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="category-section">
        <h2 class="category-title ${cat.cssClass}">${cat.name}</h2>
        <div class="methods-grid">${cards}</div>
      </div>
    `;
  }).join('');

  const capabilityGroups = [
    {
      title: 'G1 — Raices',
      items: [
        'Biseccion, Punto fijo, Newton-Raphson, Secante, Falsa posicion',
        'Aitken Δ² y Steffensen (aceleracion cuadratica)',
        'Verificacion de Bolzano y Lipschitz automatica',
        'Error relativo % y comparacion contra valor exacto',
      ],
    },
    {
      title: 'G2 — Interpolacion',
      items: [
        'Lagrange con base L_i(x) y tabla de contribuciones',
        'Newton diferencias divididas (tabla triangular)',
        'Error local |f(x) - P_n(x)| y cota global M/(n+1)!·|∏(x-x_i)|',
        'Input tabla (xᵢ, yᵢ) con filas dinamicas',
      ],
    },
    {
      title: 'G3 — Integracion numerica',
      items: [
        'Trapecio / Simpson 1/3 / Simpson 3/8 (simples y compuestos)',
        'Punto medio y cota de error con max |f⁽ᵏ⁾(ξ)|',
        'Auto-retry con n refinado si el error supera el 1 %',
        'Comparador de velocidad de convergencia',
      ],
    },
    {
      title: 'G4 — Monte Carlo',
      items: [
        'MC 1D con semilla, desv. estandar, IC 95 %',
        'MC 2D sobre rectangulo con K repeticiones promediadas',
        'Area entre curvas por hit-or-miss',
        'Demo de convergencia O(1/√N) y π',
      ],
    },
    {
      title: 'G5 — EDOs',
      items: [
        'Euler, Heun (RK2) y Runge-Kutta 4 (RK4)',
        'x objetivo con resaltado en la tabla y verificacion de iteraciones',
        'Comparador Euler ↔ Heun ↔ RK4 con overlay de trayectoria',
        'Solucion exacta opcional para medir |error|',
      ],
    },
    {
      title: 'Cross-cutting',
      items: [
        'Selector global de precision (decimales / cifras significativas)',
        'Teclado matematico, calculadora simbolica, GeoGebra embebido',
        'Exportar reporte Markdown con parametros, tabla y 4 graficos',
        'Ejercicios precargados del parcial en cada metodo',
      ],
    },
  ];

  const capabilityHtml = `
    <div class="category-section">
      <h2 class="category-title" style="border-color: var(--yellow)">Capacidades cubiertas (mapeo a parciales)</h2>
      <div class="capability-grid">
        ${capabilityGroups.map(g => `
          <div class="capability-card">
            <h3>${g.title}</h3>
            <ul>${g.items.map(it => `<li>${it}</li>`).join('')}</ul>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  setTimeout(() => {
    document.querySelectorAll('.method-card[data-method]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-method');
        if (id) onMethodClick(id);
      });
    });
  }, 0);

  return `
    <div class="home-header">
      <h1>Modelado Numerico</h1>
      <p>Metodos numericos interactivos con visualizacion en tiempo real</p>
    </div>
    ${sectionsHtml}
    ${capabilityHtml}
  `;
}
