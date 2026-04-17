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

  const comingSoon = `
    <div class="category-section">
      <h2 class="category-title" style="border-color: var(--overlay0)">Proximamente...</h2>
      <div class="methods-grid">
        <div class="method-card" style="opacity:0.5; cursor:default; border: 1px dashed var(--surface2);">
          <h3>Interpolacion</h3>
          <div class="description">Lagrange, Newton, Splines...</div>
        </div>
        <div class="method-card" style="opacity:0.5; cursor:default; border: 1px dashed var(--surface2);">
          <h3>Sistemas de Ecuaciones</h3>
          <div class="description">Gauss, Jacobi, Gauss-Seidel...</div>
        </div>
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
    ${comingSoon}
  `;
}
