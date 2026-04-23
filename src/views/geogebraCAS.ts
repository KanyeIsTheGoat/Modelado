import { mountKeyboard, setupKeyboardListeners } from '../mathKeyboard';

declare const GGBApplet: any;

let ggbCasApi: any = null;

export function renderGeogebraCAS(): string {
  setTimeout(bindGeogebraCASEvents, 100);

  return `
    <div style="margin-bottom:20px;">
      <h2 style="font-size:1.5rem;margin-bottom:8px;">GeoGebra CAS - Calculo Simbolico</h2>
      <p style="color:var(--subtext0);margin-bottom:16px;">
        Computer Algebra System: integrales, derivadas, limites, factorizacion, simplificacion y resolucion simbolica paso a paso.
      </p>

      <div class="compare-config" style="margin-bottom:16px;">
        <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;">
          <div class="input-group" style="flex:1;min-width:250px;">
            <label>Enviar comando CAS</label>
            <input id="ggb-cas-input" type="text" placeholder="Integral(sin(x)/x, 0, 1)" value="" style="font-family:Consolas,monospace" autocomplete="off" spellcheck="false">
            <div class="hint">Ej: Integral(x^2, 0, 1), Derivada(sin(x)), Resolver(x^2 - 4 = 0), Factorizar(x^2 - 4)</div>
          </div>
          <div style="display:flex;gap:8px;padding-bottom:4px;">
            <button class="btn btn-primary" id="ggb-cas-send-btn" style="white-space:nowrap;">Evaluar</button>
            <button class="btn btn-secondary" id="ggb-cas-clear-btn" style="white-space:nowrap;">Limpiar</button>
          </div>
        </div>

        <div style="margin-top:12px;">
          <div style="font-size:0.8rem;color:var(--subtext0);margin-bottom:6px;"><b>Calculo</b></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Integral(x^2, 0, 1)" style="font-size:0.8rem;padding:6px 12px;">∫x² dx [0,1]</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Integral(sin(x)/x, 0, 1)" style="font-size:0.8rem;padding:6px 12px;">∫sin(x)/x dx</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Integral(exp(x^2), 0, 2)" style="font-size:0.8rem;padding:6px 12px;">∫e^(x²) dx [0,2]</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Derivada(sin(x)*cos(x))" style="font-size:0.8rem;padding:6px 12px;">d/dx sin·cos</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Derivada(x^3 - 3*x^2 + 2, 2)" style="font-size:0.8rem;padding:6px 12px;">d²/dx²</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Limite(sin(x)/x, 0)" style="font-size:0.8rem;padding:6px 12px;">lim sin(x)/x</button>
          </div>
        </div>

        <div style="margin-top:10px;">
          <div style="font-size:0.8rem;color:var(--subtext0);margin-bottom:6px;"><b>Algebra</b></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Resolver(x^2 - 5*x + 6 = 0)" style="font-size:0.8rem;padding:6px 12px;">Resolver x²−5x+6=0</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Resolver({x + y = 5, x - y = 1}, {x, y})" style="font-size:0.8rem;padding:6px 12px;">Sistema 2×2</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Factorizar(x^2 - 9)" style="font-size:0.8rem;padding:6px 12px;">Factorizar x²−9</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Expandir((x + 1)^4)" style="font-size:0.8rem;padding:6px 12px;">(x+1)⁴</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Simplificar((x^2 - 1)/(x - 1))" style="font-size:0.8rem;padding:6px 12px;">Simplificar</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Sustituir(x^2 + 2*x, x = 3)" style="font-size:0.8rem;padding:6px 12px;">Sustituir</button>
          </div>
        </div>

        <div style="margin-top:10px;">
          <div style="font-size:0.8rem;color:var(--subtext0);margin-bottom:6px;"><b>Parcial — Casos practicos</b></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Integral(sqrt(x) - x^2, 0, 1)" style="font-size:0.8rem;padding:6px 12px;">∫(√x−x²)dx (area)</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Integral(Integral(x^2 + y^2, y, 0, 1), x, 0, 1)" style="font-size:0.8rem;padding:6px 12px;">∫∫(x²+y²) dydx</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="NIntegral(exp(x^2), 0, 2)" style="font-size:0.8rem;padding:6px 12px;">N∫e^(x²) [0,2]</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="TaylorPolinomio(sin(x), 0, 5)" style="font-size:0.8rem;padding:6px 12px;">Taylor sin(x) n=5</button>
            <button class="btn btn-secondary ggb-cas-quick" data-cmd="Intersecar(sqrt(x), x^2)" style="font-size:0.8rem;padding:6px 12px;">Intersecar √x=x²</button>
          </div>
        </div>

        <div id="kb-container"></div>
      </div>

      <div id="ggb-cas-status" style="margin-bottom:8px;font-size:0.85rem;color:var(--green);"></div>
    </div>

    <div id="ggb-cas-element" style="width:100%;min-height:650px;border-radius:var(--radius);overflow:hidden;border:1px solid var(--surface0);"></div>

    <div style="margin-top:16px; padding:12px 16px; background:var(--surface0); border-radius:var(--radius); font-size:0.85rem; color:var(--subtext0); line-height:1.6;">
      <b style="color:var(--text)">Referencia rapida de comandos CAS:</b><br>
      <code>Integral(f, a, b)</code> integral definida · <code>Integral(f)</code> primitiva ·
      <code>NIntegral(f, a, b)</code> numerica ·
      <code>Derivada(f)</code> derivada · <code>Derivada(f, n)</code> n-esima derivada ·
      <code>Limite(f, x0)</code> limite ·
      <code>Resolver(ec)</code> ecuacion · <code>Resolver({ec1, ec2}, {x, y})</code> sistema ·
      <code>Factorizar(p)</code> · <code>Expandir(p)</code> · <code>Simplificar(expr)</code> ·
      <code>Sustituir(expr, x = val)</code> ·
      <code>TaylorPolinomio(f, x0, n)</code> serie de Taylor ·
      <code>Intersecar(f, g)</code> interseccion simbolica
    </div>
  `;
}

function bindGeogebraCASEvents(): void {
  injectCASApplet();

  mountKeyboard('kb-container');
  setupKeyboardListeners();

  const input = document.getElementById('ggb-cas-input') as HTMLInputElement;
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendCASCommand();
    });
  }

  document.getElementById('ggb-cas-send-btn')?.addEventListener('click', sendCASCommand);

  document.getElementById('ggb-cas-clear-btn')?.addEventListener('click', () => {
    if (ggbCasApi) {
      const names = ggbCasApi.getAllObjectNames();
      if (names) {
        for (const name of names) {
          ggbCasApi.deleteObject(name);
        }
      }
      setCASStatus('CAS limpiado');
    }
  });

  document.querySelectorAll('.ggb-cas-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      if (cmd && ggbCasApi) {
        ggbCasApi.evalCommand(cmd);
        setCASStatus(`Enviado: ${cmd}`);
      } else if (!ggbCasApi) {
        setCASStatus('CAS aun no esta listo, espera un momento...');
      }
    });
  });
}

function injectCASApplet(): void {
  if (typeof GGBApplet === 'undefined') {
    setCASStatus('Cargando GeoGebra CAS...');
    const checkInterval = setInterval(() => {
      if (typeof GGBApplet !== 'undefined') {
        clearInterval(checkInterval);
        createCASApplet();
      }
    }, 500);
    setTimeout(() => clearInterval(checkInterval), 15000);
    return;
  }
  createCASApplet();
}

function createCASApplet(): void {
  const container = document.getElementById('ggb-cas-element');
  if (!container) return;

  const params: Record<string, any> = {
    appName: 'cas',
    width: container.clientWidth || 1200,
    height: 650,
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
      ggbCasApi = api;
      setCASStatus('GeoGebra CAS listo — escribe un comando o usa un boton rapido.');
    },
  };

  const applet = new GGBApplet(params, true);
  applet.inject('ggb-cas-element');
}

function sendCASCommand(): void {
  const input = document.getElementById('ggb-cas-input') as HTMLInputElement;
  if (!input || !ggbCasApi) {
    if (!ggbCasApi) setCASStatus('CAS aun no esta listo, espera un momento...');
    return;
  }

  const cmd = input.value.trim();
  if (!cmd) return;

  const success = ggbCasApi.evalCommand(cmd);
  if (success !== false) {
    setCASStatus(`Enviado: ${cmd}`);
    input.value = '';
  } else {
    setCASStatus('Error en el comando. Verifica la sintaxis (ej: Integral(x^2, 0, 1)).');
  }
}

function setCASStatus(msg: string): void {
  const el = document.getElementById('ggb-cas-status');
  if (el) el.textContent = msg;
}
