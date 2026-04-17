import { mountKeyboard, setupKeyboardListeners } from '../mathKeyboard';

declare const GGBApplet: any;

let appletInjected = false;
let ggbApi: any = null;

export function renderGeogebra(): string {
  setTimeout(bindGeogebraEvents, 100);

  return `
    <div style="margin-bottom:20px;">
      <h2 style="font-size:1.5rem;margin-bottom:8px;">GeoGebra - Graficador Interactivo</h2>
      <p style="color:var(--subtext0);margin-bottom:16px;">Graficador completo con algebra, geometria y mas. Escribe funciones abajo o directamente en GeoGebra.</p>

      <div class="compare-config" style="margin-bottom:16px;">
        <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;">
          <div class="input-group" style="flex:1;min-width:250px;">
            <label>Enviar funcion a GeoGebra</label>
            <input id="ggb-func-input" type="text" placeholder="x^2 - 3*x + 1" value="" style="font-family:Consolas,monospace" autocomplete="off" spellcheck="false">
            <div class="hint">Ej: sin(x), x^2, sqrt(x), abs(x), log(x)</div>
          </div>
          <div style="display:flex;gap:8px;padding-bottom:4px;">
            <button class="btn btn-primary" id="ggb-send-btn" style="white-space:nowrap;">Graficar f(x)</button>
            <button class="btn btn-secondary" id="ggb-clear-btn" style="white-space:nowrap;">Limpiar</button>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary ggb-quick" data-cmd="f(x) = sin(x)" style="font-size:0.8rem;padding:6px 12px;">sin(x)</button>
          <button class="btn btn-secondary ggb-quick" data-cmd="f(x) = cos(x)" style="font-size:0.8rem;padding:6px 12px;">cos(x)</button>
          <button class="btn btn-secondary ggb-quick" data-cmd="f(x) = x^2" style="font-size:0.8rem;padding:6px 12px;">x²</button>
          <button class="btn btn-secondary ggb-quick" data-cmd="f(x) = x^3 - 3x" style="font-size:0.8rem;padding:6px 12px;">x³ - 3x</button>
          <button class="btn btn-secondary ggb-quick" data-cmd="f(x) = 1/x" style="font-size:0.8rem;padding:6px 12px;">1/x</button>
          <button class="btn btn-secondary ggb-quick" data-cmd="f(x) = exp(x)" style="font-size:0.8rem;padding:6px 12px;">eˣ</button>
          <button class="btn btn-secondary ggb-quick" data-cmd="f(x) = log(x)" style="font-size:0.8rem;padding:6px 12px;">ln(x)</button>
          <button class="btn btn-secondary ggb-quick" data-cmd="f(x) = sqrt(x)" style="font-size:0.8rem;padding:6px 12px;">√x</button>
        </div>
        <div id="kb-container"></div>
      </div>

      <div id="ggb-status" style="margin-bottom:8px;font-size:0.85rem;color:var(--green);"></div>
    </div>

    <div id="ggb-element" style="width:100%;min-height:600px;border-radius:var(--radius);overflow:hidden;border:1px solid var(--surface0);"></div>
  `;
}

function bindGeogebraEvents(): void {
  // Inject GeoGebra applet
  injectApplet();

  // Math keyboard
  mountKeyboard('kb-container');
  setupKeyboardListeners();
  const funcInput = document.getElementById('ggb-func-input') as HTMLInputElement;
  if (funcInput) {
    funcInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendFunction();
    });
  }

  // Send button
  document.getElementById('ggb-send-btn')?.addEventListener('click', sendFunction);

  // Clear button
  document.getElementById('ggb-clear-btn')?.addEventListener('click', () => {
    if (ggbApi) {
      // Delete all objects
      const names = ggbApi.getAllObjectNames();
      if (names) {
        for (const name of names) {
          ggbApi.deleteObject(name);
        }
      }
      setStatus('Graficador limpiado');
    }
  });

  // Quick buttons
  document.querySelectorAll('.ggb-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      if (cmd && ggbApi) {
        ggbApi.evalCommand(cmd);
        setStatus(`Enviado: ${cmd}`);
      }
    });
  });

}

function injectApplet(): void {
  if (typeof GGBApplet === 'undefined') {
    setStatus('Cargando GeoGebra...');
    // Wait for script to load
    const checkInterval = setInterval(() => {
      if (typeof GGBApplet !== 'undefined') {
        clearInterval(checkInterval);
        createApplet();
      }
    }, 500);
    // Timeout after 15s
    setTimeout(() => clearInterval(checkInterval), 15000);
    return;
  }
  createApplet();
}

function createApplet(): void {
  const container = document.getElementById('ggb-element');
  if (!container) return;

  const params: Record<string, any> = {
    appName: 'graphing',
    width: container.clientWidth || 1200,
    height: 600,
    showToolBar: true,
    showAlgebraInput: true,
    showMenuBar: false,
    showResetIcon: true,
    enableLabelDrags: false,
    enableShiftDragZoom: true,
    enableRightClick: true,
    capturingThreshold: null,
    showToolBarHelp: false,
    errorDialogsActive: false,
    useBrowserForJS: false,
    language: 'es',
    appletOnLoad: (api: any) => {
      ggbApi = api;
      appletInjected = true;
      setStatus('GeoGebra listo');
    },
  };

  const applet = new GGBApplet(params, true);
  applet.inject('ggb-element');
}

function sendFunction(): void {
  const input = document.getElementById('ggb-func-input') as HTMLInputElement;
  if (!input || !ggbApi) {
    if (!ggbApi) setStatus('GeoGebra aun no esta listo, espera un momento...');
    return;
  }

  const expr = input.value.trim();
  if (!expr) return;

  // Check if it already has assignment, if not wrap as f(x) = ...
  let cmd: string;
  if (/^[a-zA-Z]\s*\(/.test(expr) && expr.includes('=')) {
    cmd = expr; // Already like f(x) = ...
  } else {
    // Auto-generate a function name
    const existingNames = ggbApi.getAllObjectNames() || [];
    const usedLetters = new Set(existingNames.map((n: string) => n.toLowerCase()));
    let funcName = 'f';
    for (const letter of 'fghpqrstuvw') {
      if (!usedLetters.has(letter)) {
        funcName = letter;
        break;
      }
    }
    cmd = `${funcName}(x) = ${expr}`;
  }

  const success = ggbApi.evalCommand(cmd);
  if (success !== false) {
    setStatus(`Graficado: ${cmd}`);
    input.value = '';
  } else {
    setStatus('Error al graficar. Verifica la expresion.');
  }
}

function setStatus(msg: string): void {
  const el = document.getElementById('ggb-status');
  if (el) el.textContent = msg;
}
