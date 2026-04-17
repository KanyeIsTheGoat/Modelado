// Math keyboard component — scientific/calculus-style input helper
// Mounts into a dedicated #kb-container element (not inside input-group)

type ButtonDef = {
  display: string;
  insert: string;
  type: 'func' | 'op' | 'const' | 'action' | 'trig';
  html?: boolean;
};

const ROWS: ButtonDef[][] = [
  [
    { display: '□&sup2;', insert: '^2', type: 'op', html: true },
    { display: 'x<sup>□</sup>', insert: '^', type: 'op', html: true },
    { display: '&radic;□', insert: 'sqrt', type: 'func', html: true },
    { display: '<sup>3</sup>&radic;□', insert: 'cbrt', type: 'func', html: true },
    { display: '<sup>□</sup>&frasl;<sub>□</sub>', insert: '/', type: 'op', html: true },
    { display: 'log<sub>□</sub>', insert: 'log', type: 'func', html: true },
    { display: '&pi;', insert: 'pi', type: 'const', html: true },
    { display: '&infin;', insert: 'Infinity', type: 'const', html: true },
    { display: '&int;', insert: 'INTEGRAL', type: 'action', html: true },
    { display: '<sup>d</sup>&frasl;<sub>dx</sub>', insert: 'DERIVATIVE', type: 'action', html: true },
    { display: '&lArr;', insert: 'BACKSPACE', type: 'action', html: true },
  ],
  [
    { display: '&ge;', insert: '>=', type: 'op', html: true },
    { display: '&le;', insert: '<=', type: 'op', html: true },
    { display: '&middot;', insert: '*', type: 'op', html: true },
    { display: '&divide;', insert: '/', type: 'op', html: true },
    { display: 'x&deg;', insert: '^', type: 'op', html: true },
    { display: '( □ )', insert: '()', type: 'op' },
    { display: '| □ |', insert: 'abs', type: 'func' },
    { display: 'f(x)', insert: 'f(x)', type: 'op' },
    { display: 'ln', insert: 'log', type: 'func' },
    { display: 'e<sup>□</sup>', insert: 'exp', type: 'func', html: true },
    { display: 'CE', insert: 'CLEAR', type: 'action' },
  ],
  [
    { display: "f '", insert: 'DERIVATIVE', type: 'action' },
    { display: '<sup>&part;</sup>&frasl;<sub>&part;x</sub>', insert: 'PARTIAL', type: 'action', html: true },
    { display: 'lim', insert: 'lim', type: 'op' },
    { display: '&Sigma;', insert: 'sum', type: 'op', html: true },
    { display: 'sin', insert: 'sin', type: 'trig' },
    { display: 'cos', insert: 'cos', type: 'trig' },
    { display: 'tan', insert: 'tan', type: 'trig' },
    { display: 'cot', insert: 'cot', type: 'trig' },
    { display: 'csc', insert: 'csc', type: 'trig' },
    { display: 'sec', insert: 'sec', type: 'trig' },
    { display: 'x', insert: 'x', type: 'const' },
  ],
  [
    { display: '7', insert: '7', type: 'const' },
    { display: '8', insert: '8', type: 'const' },
    { display: '9', insert: '9', type: 'const' },
    { display: '+', insert: '+', type: 'op' },
    { display: '&minus;', insert: '-', type: 'op', html: true },
    { display: '4', insert: '4', type: 'const' },
    { display: '5', insert: '5', type: 'const' },
    { display: '6', insert: '6', type: 'const' },
    { display: '1', insert: '1', type: 'const' },
    { display: '2', insert: '2', type: 'const' },
    { display: '3', insert: '3', type: 'const' },
  ],
  [
    { display: '0', insert: '0', type: 'const' },
    { display: '.', insert: '.', type: 'const' },
    { display: 'e', insert: 'e', type: 'const' },
    { display: '(', insert: '(', type: 'op' },
    { display: ')', insert: ')', type: 'op' },
    { display: 'asin', insert: 'asin', type: 'trig' },
    { display: 'acos', insert: 'acos', type: 'trig' },
    { display: 'atan', insert: 'atan', type: 'trig' },
    { display: 'log10', insert: 'log10', type: 'func' },
    { display: '^', insert: '^', type: 'op' },
    { display: 'exp', insert: 'exp', type: 'func' },
  ],
];

let keyboardEl: HTMLElement | null = null;
let previewEl: HTMLElement | null = null;
let activeInput: HTMLInputElement | null = null;
let isVisible = false;

function getColorClass(type: ButtonDef['type']): string {
  switch (type) {
    case 'const': return 'kb-digit';
    case 'op': return 'kb-op';
    case 'func': return 'kb-func';
    case 'trig': return 'kb-trig';
    case 'action': return 'kb-action';
  }
}

function buildKeyboard(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'math-keyboard';
  wrapper.id = 'math-keyboard';

  const preview = document.createElement('div');
  preview.className = 'kb-preview';
  preview.id = 'kb-preview';
  wrapper.appendChild(preview);
  previewEl = preview;

  const grid = document.createElement('div');
  grid.className = 'kb-grid';

  for (const row of ROWS) {
    for (const btn of row) {
      const b = document.createElement('button');
      b.className = `kb-btn ${getColorClass(btn.type)}`;
      if (btn.html) {
        b.innerHTML = btn.display;
      } else {
        b.textContent = btn.display;
      }
      b.type = 'button';
      b.tabIndex = -1;
      b.addEventListener('mousedown', (e) => {
        e.preventDefault();
        insertText(btn.insert, btn.type);
      });
      grid.appendChild(b);
    }
  }

  wrapper.appendChild(grid);
  return wrapper;
}

function insertText(text: string, type: ButtonDef['type']): void {
  if (!activeInput) return;

  const start = activeInput.selectionStart ?? activeInput.value.length;
  const end = activeInput.selectionEnd ?? start;
  const val = activeInput.value;

  if (text === 'BACKSPACE') {
    if (start > 0) {
      activeInput.value = val.slice(0, start - 1) + val.slice(end);
      activeInput.setSelectionRange(start - 1, start - 1);
    }
    updatePreview();
    return;
  }

  if (text === 'CLEAR') {
    activeInput.value = '';
    activeInput.setSelectionRange(0, 0);
    updatePreview();
    return;
  }

  if (text === 'INTEGRAL' || text === 'DERIVATIVE' || text === 'PARTIAL') {
    if (previewEl) previewEl.textContent = text === 'INTEGRAL'
      ? 'Usa la seccion Calculadora para integrales'
      : 'Usa la seccion Calculadora para derivadas';
    return;
  }

  const before = val.slice(0, start);

  if (type === 'func' || type === 'trig') {
    let prefix = '';
    if (before && /[0-9x)eπ]$/.test(before)) {
      prefix = '*';
    }
    const ins = `${prefix}${text}()`;
    activeInput.value = before + ins + val.slice(end);
    const cursorPos = start + prefix.length + text.length + 1;
    activeInput.setSelectionRange(cursorPos, cursorPos);
  } else if (text === '^' || text === '^2') {
    activeInput.value = before + text + val.slice(end);
    activeInput.setSelectionRange(start + text.length, start + text.length);
  } else if (text === '()') {
    activeInput.value = before + '()' + val.slice(end);
    activeInput.setSelectionRange(start + 1, start + 1);
  } else if (text === 'f(x)') {
    activeInput.value = before + 'f(x)' + val.slice(end);
    activeInput.setSelectionRange(start + 4, start + 4);
  } else {
    activeInput.value = before + text + val.slice(end);
    activeInput.setSelectionRange(start + text.length, start + text.length);
  }

  updatePreview();
  activeInput.focus();
}

function updatePreview(): void {
  if (!previewEl || !activeInput) {
    if (previewEl) previewEl.textContent = '';
    return;
  }
  const expr = activeInput.value.trim();
  if (!expr) {
    previewEl.textContent = '';
    return;
  }
  let display = expr
    .replace(/\*\*/g, '\u207f')
    .replace(/\*/g, '\u00b7')
    .replace(/sqrt/g, '\u221a')
    .replace(/cbrt/g, '\u221b')
    .replace(/pi/g, '\u03c0')
    .replace(/>=/, '\u2265')
    .replace(/<=/, '\u2264')
    .replace(/Infinity/g, '\u221e');
  previewEl.textContent = display;
}

/**
 * Ensure the keyboard element exists (built once, reused everywhere).
 */
export function initMathKeyboard(): void {
  if (keyboardEl) return;
  keyboardEl = buildKeyboard();
}

/**
 * Mount the keyboard into a specific container element by ID.
 * Call this after rendering HTML that includes <div id="kb-container"></div>.
 */
export function mountKeyboard(containerId: string = 'kb-container'): void {
  initMathKeyboard();
  const container = document.getElementById(containerId);
  if (container && keyboardEl) {
    if (keyboardEl.parentElement !== container) {
      keyboardEl.remove();
      container.appendChild(keyboardEl);
    }
  }
}

/**
 * Show the keyboard and set the active input.
 */
export function showKeyboard(input: HTMLInputElement): void {
  initMathKeyboard();
  activeInput = input;
  isVisible = true;
  if (keyboardEl) {
    keyboardEl.style.display = 'block';
  }
  updatePreview();
}

/**
 * Hide the keyboard.
 */
export function hideKeyboard(): void {
  if (keyboardEl) {
    keyboardEl.style.display = 'none';
  }
  isVisible = false;
  activeInput = null;
}


/**
 * Wire up: text inputs show keyboard on focus, clicking outside hides it.
 * Call after DOM is ready.
 */
export function setupKeyboardListeners(scope: HTMLElement | Document = document): void {
  const textInputs = scope.querySelectorAll<HTMLInputElement>('input[type="text"]');
  textInputs.forEach(input => {
    input.addEventListener('focus', () => showKeyboard(input));
  });

  // Click outside hides
  document.addEventListener('mousedown', (e) => {
    if (!isVisible) return;
    const target = e.target as HTMLElement;
    if (!target.closest('.math-keyboard') && !target.closest('input[type="text"]')) {
      hideKeyboard();
    }
  });
}
