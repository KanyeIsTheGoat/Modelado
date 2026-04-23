import { getMethod, categories } from './categories';
import { renderHome } from './views/home';
import { renderMethodView } from './views/methodView';
import { renderCompareView } from './views/compareView';
import { renderGeogebra } from './views/geogebra';
import { renderGeogebraCAS } from './views/geogebraCAS';
import { renderCalculator } from './views/calculator';
import { destroyAllCharts } from './plotter';

type View = 'home' | 'compare' | 'geogebra' | 'geogebraCAS' | 'calculator' | string;

let currentView: View = 'home';

function navigate(view: View): void {
  destroyAllCharts();
  currentView = view;
  const app = document.getElementById('app');
  if (!app) return;

  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
    const cat = btn.getAttribute('data-category');
    if (cat === view) {
      btn.classList.add('active');
    } else {
      // Check if viewing a method in this category
      const category = categories.find(c => c.id === cat);
      if (category && category.methods.some(m => m.id === view)) {
        btn.classList.add('active');
      }
    }
  });

  if (view === 'home') {
    app.innerHTML = renderHome(methodId => navigate(methodId));
  } else if (view === 'compare') {
    app.innerHTML = renderCompareView();
  } else if (view === 'geogebra') {
    app.innerHTML = renderGeogebra();
  } else if (view === 'geogebraCAS') {
    app.innerHTML = renderGeogebraCAS();
  } else if (view === 'calculator') {
    app.innerHTML = renderCalculator();
  } else {
    const method = getMethod(view);
    if (method) {
      app.innerHTML = renderMethodView(method);
    } else {
      app.innerHTML = renderHome(methodId => navigate(methodId));
    }
  }
}

function init(): void {
  // Nav button clicks
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-category');
      if (!cat) return;
      if (['home', 'compare', 'geogebra', 'geogebraCAS', 'calculator'].includes(cat)) {
        navigate(cat);
      } else {
        // Navigate to category = go home and scroll to it
        navigate('home');
        setTimeout(() => {
          const section = document.querySelector(`.category-title.${cat}`)?.parentElement;
          if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    });
  });

  // Brand click = home
  document.getElementById('nav-home')?.addEventListener('click', () => navigate('home'));

  // Keyboard: Escape = home
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentView !== 'home') {
      navigate('home');
    }
  });

  // Initial render
  navigate('home');
}

// Boot
document.addEventListener('DOMContentLoaded', init);
