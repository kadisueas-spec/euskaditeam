// EXPERIMENTAL — versión del diagnóstico de safe area servida como HTML
// plano (Route Handler, cero React). La primera versión (page.tsx con
// useState/useEffect) y la segunda (script inline sobre una página React)
// se quedaban colgadas en el iPhone real: React seguía hidratando esta
// página por detrás y, al encontrar el DOM ya modificado por el script,
// lo revertía a como lo renderizó el servidor — "Midiendo..." para
// siempre. Este endpoint no pasa por React en ningún momento: es HTML +
// CSS + JS servidos tal cual, sin hidratación que pueda pelear con nada.
// El markup de la nav está escrito a mano (no importa el componente real)
// para no depender del bundle de Tailwind en un Route Handler.

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Diagnóstico Safe Area</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; background: #080808; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "DM Sans", sans-serif; }
  #container { display: flex; flex-direction: column; height: 100dvh; background: #080808; }
  header { flex-shrink: 0; border-bottom: 1px solid #1e1e1e; padding: 16px; }
  h1 { font-size: 22px; letter-spacing: 0.03em; color: #e8001c; text-transform: uppercase; margin: 0 0 12px 0; }
  .btn-row { display: flex; gap: 8px; }
  button { min-height: 44px; flex: 1; border-radius: 10px; font-size: 14px; font-weight: 500; border: none; }
  #btn-measure { background: #e8001c; color: #fff; }
  #btn-copy { background: transparent; color: #fff; border: 1px solid #1e1e1e; }
  button:active { transform: scale(0.95); }
  #status { font-size: 11px; color: #fbbf24; margin-top: 8px; }
  main { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }
  #output { font-size: 12px; white-space: pre-wrap; font-family: ui-monospace, monospace; margin: 0; word-break: break-all; }
  #copy-fallback { display: none; width: 100%; height: 160px; margin-top: 12px; background: #111; border: 1px solid #1e1e1e; border-radius: 10px; color: #fff; font-family: ui-monospace, monospace; font-size: 10px; padding: 8px; }

  /* Markup de la nav a mano, calcado del componente real
     (components/client/client-bottom-nav.tsx) para medir algo visualmente
     idéntico sin depender del bundle de Tailwind acá. */
  nav { display: flex; flex-direction: column; flex-shrink: 0; border-top: 1px solid #1e1e1e; }
  #nav-items { display: flex; background: #080808; }
  .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 44px; padding: 8px 0; font-size: 11px; color: #888; }
  .nav-item svg { width: 20px; height: 20px; }
  #nav-safe-area { flex-shrink: 0; background: #080808; }
</style>
</head>
<body>
<div id="container">
  <header>
    <h1>Diagnóstico Safe Area (v3 — HTML plano)</h1>
    <div class="btn-row">
      <button id="btn-measure">Medir de nuevo</button>
      <button id="btn-copy">Copiar todo</button>
    </div>
    <p id="status">Si esto sigue en amarillo después de 2 segundos, avisame — significa que ni el JS plano arrancó.</p>
  </header>
  <main>
    <pre id="output">Midiendo...</pre>
    <textarea id="copy-fallback" readonly></textarea>
  </main>
  <nav>
    <div id="nav-items">
      <div class="nav-item" style="color:#e8001c">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        Mi Rutina
      </div>
      <div class="nav-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9v6M18 9v6M4 12h16"/></svg>
        Entrenar
      </div>
      <div class="nav-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg>
        Mi Mes
      </div>
      <div class="nav-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 1 1 9-8.5Z"/></svg>
        Feedback
      </div>
      <div class="nav-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18M18 9l-5 5-4-4-3 3"/></svg>
        Progreso
      </div>
      <div class="nav-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
        Perfil
      </div>
    </div>
    <div id="nav-safe-area"></div>
  </nav>
</div>

<script>
(function () {
  var pageErrors = [];
  window.onerror = function (msg, src, line, col, err) {
    pageErrors.push('window.onerror: ' + msg + ' @ ' + src + ':' + line + ':' + col + (err && err.stack ? '\\n' + err.stack : ''));
    render();
  };
  window.addEventListener('unhandledrejection', function (ev) {
    pageErrors.push('unhandledrejection: ' + (ev.reason && ev.reason.stack ? ev.reason.stack : String(ev.reason)));
    render();
  });

  function px(n) { return Math.round(n * 100) / 100 + 'px'; }

  function measure() {
    var lines = [];
    function line(l, v) { lines.push(l + (v !== undefined ? ': ' + v : '')); }

    try {
      var probeBottom = document.createElement('div');
      probeBottom.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;';
      document.body.appendChild(probeBottom);
      var probeTop = document.createElement('div');
      probeTop.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none;';
      document.body.appendChild(probeTop);

      var container = document.getElementById('container');
      var nav = document.querySelector('nav');
      var itemsRow = document.getElementById('nav-items');
      var safeSpacer = document.getElementById('nav-safe-area');
      var root = document.documentElement;
      var body = document.body;

      // altura de la franja de safe area con la MISMA técnica que el
      // componente real: height: env(safe-area-inset-bottom).
      safeSpacer.style.height = 'env(safe-area-inset-bottom)';

      function cs(el) { return el ? getComputedStyle(el) : null; }
      var navRect = nav.getBoundingClientRect();
      var itemsRect = itemsRow.getBoundingClientRect();
      var safeRect = safeSpacer.getBoundingClientRect();

      var isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

      line('── CONTEXTO ──');
      line('Modo', isStandalone ? 'PWA instalada (standalone)' : 'Pestaña de Safari');
      line('User Agent', navigator.userAgent);
      line('screen.width x height', screen.width + ' x ' + screen.height);
      line('devicePixelRatio', String(window.devicePixelRatio));
      line('window.innerHeight', px(window.innerHeight));
      line('documentElement.clientHeight', px(root.clientHeight));
      line('visualViewport.height', window.visualViewport ? px(window.visualViewport.height) : 'no soportado');
      line('');
      line('── SAFE AREA (medida real) ──');
      line('env(safe-area-inset-top)', px(probeTop.getBoundingClientRect().height));
      line('env(safe-area-inset-bottom)', px(probeBottom.getBoundingClientRect().height));
      line('');
      line('── NAV: DIMENSIONES ──');
      line('nav — altura total', px(navRect.height));
      line('nav — fila de ítems, altura', px(itemsRect.height));
      line('nav — franja safe-area, altura', px(safeRect.height));
      line('nav.bottom (debería = viewport)', px(navRect.bottom));
      line('GAP nav.bottom vs innerHeight', px(window.innerHeight - navRect.bottom));
      line('');
      line('── COLORES DE FONDO ──');
      line('html — background-color', cs(root).backgroundColor);
      line('body — background-color', cs(body).backgroundColor);
      line('contenedor raíz — background-color', cs(container).backgroundColor);
      line('nav fila ítems — background-color', cs(itemsRow).backgroundColor);
      line('nav franja safe-area — background-color', cs(safeSpacer).backgroundColor);
      line('nav fila ítems — backdrop-filter', cs(itemsRow).backdropFilter);
      line('');
      line('── PADDING / MARGIN ──');
      line('html', cs(root).padding + ' / ' + cs(root).margin);
      line('body', cs(body).padding + ' / ' + cs(body).margin);
      line('contenedor raíz', cs(container).padding + ' / ' + cs(container).margin);
      line('nav', cs(nav).padding + ' / ' + cs(nav).margin);
      line('nav fila ítems', cs(itemsRow).padding + ' / ' + cs(itemsRow).margin);
      line('nav franja safe-area', cs(safeSpacer).padding + ' / ' + cs(safeSpacer).margin);

      probeBottom.remove();
      probeTop.remove();
    } catch (e) {
      lines.push('ERROR durante la medición: ' + (e && e.stack ? e.stack : String(e)));
    }

    return lines.join('\\n');
  }

  var lastText = '';
  function render() {
    var text = measure();
    if (pageErrors.length) {
      text = 'ERRORES DE PÁGINA CAPTURADOS:\\n' + pageErrors.join('\\n---\\n') + '\\n\\n' + text;
    }
    lastText = text;
    document.getElementById('output').textContent = text;
    document.getElementById('status').style.display = 'none';
  }

  function copyAll() {
    var done = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lastText).then(function () {
          var btn = document.getElementById('btn-copy');
          var orig = btn.textContent;
          btn.textContent = 'Copiado \\u2713';
          setTimeout(function () { btn.textContent = orig; }, 2000);
        }).catch(showFallback);
        done = true;
      }
    } catch (e) {}
    if (!done) showFallback();
  }

  function showFallback() {
    var ta = document.getElementById('copy-fallback');
    ta.value = lastText;
    ta.style.display = 'block';
    ta.focus();
    ta.setSelectionRange(0, ta.value.length);
  }

  document.getElementById('btn-measure').addEventListener('click', render);
  document.getElementById('btn-copy').addEventListener('click', copyAll);
  render();
})();
</script>
</body>
</html>`;

export async function GET() {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
