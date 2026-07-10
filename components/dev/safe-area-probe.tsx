"use client";

import Script from "next/script";

// EXPERIMENTAL — mide la ClientBottomNav REAL, dentro del layout REAL de
// cliente (con header, banners y contenido real arriba), en vez de la
// réplica aislada de /dev-safe-area/raw. Se activa solo con ?diag=1 en la
// URL — invisible en uso normal. strategy="afterInteractive" es la forma
// oficial de Next de correr un script DESPUÉS de que React termine de
// hidratar (evita el problema que encontramos en /dev-safe-area: un
// script corriendo ANTES de que termine la hidratación hace que React
// revierta el DOM al terminar). Además, en vez de sobreescribir contenido
// que React ya renderizó, este script agrega un panel flotante NUEVO
// (un nodo que React nunca tocó), así no hay nada que conciliar/revertir.
export function SafeAreaProbe() {
  return (
    <Script id="safe-area-probe" strategy="afterInteractive">
      {`
(function () {
  if (!location.search.includes('diag=1')) return;

  function px(n) { return Math.round(n * 100) / 100 + 'px'; }

  function measure() {
    var lines = [];
    function line(l, v) { lines.push(l + (v !== undefined ? ': ' + v : '')); }

    var probeBottom = document.createElement('div');
    probeBottom.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;';
    document.body.appendChild(probeBottom);

    var navEls = document.querySelectorAll('nav');
    var nav = navEls.length ? navEls[navEls.length - 1] : null;
    var root = document.documentElement;
    var body = document.body;
    function cs(el) { return el ? getComputedStyle(el) : null; }

    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

    line('modo', isStandalone ? 'standalone' : 'tab');
    line('innerHeight', px(window.innerHeight));
    line('env(safe-bottom)', px(probeBottom.getBoundingClientRect().height));
    line('cant. <nav> en el DOM', String(navEls.length));

    if (nav) {
      var navRect = nav.getBoundingClientRect();
      var itemsRow = nav.firstElementChild;
      var safeSpacer = nav.lastElementChild;
      var itemsRect = itemsRow ? itemsRow.getBoundingClientRect() : null;
      var safeRect = safeSpacer ? safeSpacer.getBoundingClientRect() : null;

      line('nav.top', px(navRect.top));
      line('nav.bottom', px(navRect.bottom));
      line('GAP nav.bottom vs innerHeight', px(window.innerHeight - navRect.bottom));
      line('nav altura total', px(navRect.height));
      line('nav fila items altura', itemsRect ? px(itemsRect.height) : '?');
      line('nav safe-strip altura', safeRect ? px(safeRect.height) : '?');
      line('nav bg', cs(nav).backgroundColor);
      line('nav fila items bg', itemsRow ? cs(itemsRow).backgroundColor : '?');
      line('nav safe-strip bg', safeSpacer ? cs(safeSpacer).backgroundColor : '?');
      line('nav position', cs(nav).position);
      line('nav transform', cs(nav).transform);

      // Qué hay INMEDIATAMENTE debajo del borde inferior de la nav, si algo.
      var belowPoint = document.elementFromPoint(navRect.left + 10, Math.min(navRect.bottom + 5, window.innerHeight - 1));
      line('elemento 5px debajo de nav.bottom', belowPoint ? (belowPoint.tagName + (belowPoint.id ? '#' + belowPoint.id : '') + (belowPoint.className ? '.' + String(belowPoint.className).split(' ').join('.') : '')) : 'ninguno');

      // Padres de la nav, para ver si alguno tiene padding/margin/transform
      // raro empujándola.
      var p = nav.parentElement;
      var depth = 0;
      while (p && depth < 5) {
        var pcs = cs(p);
        line('padre[' + depth + '] <' + p.tagName.toLowerCase() + '>', 'padding:' + pcs.padding + ' margin:' + pcs.margin + ' transform:' + pcs.transform + ' position:' + pcs.position);
        p = p.parentElement;
        depth++;
      }
    } else {
      line('ERROR', 'no se encontró ningún <nav> en el DOM');
    }

    probeBottom.remove();
    return lines.join('\\n');
  }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.id = 'safe-area-probe-panel';
    panel.style.cssText = 'position:fixed;top:0;left:0;right:0;max-height:60vh;overflow-y:auto;background:rgba(0,0,0,0.95);color:#0f0;font-family:ui-monospace,monospace;font-size:10px;padding:10px;z-index:999999;white-space:pre-wrap;word-break:break-all;border-bottom:2px solid #e8001c;';
    var btn = document.createElement('button');
    btn.textContent = 'Copiar';
    btn.style.cssText = 'position:fixed;top:8px;right:8px;z-index:1000000;background:#e8001c;color:#fff;border:none;border-radius:6px;padding:8px 12px;font-size:12px;';
    var pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;padding-top:30px;';
    panel.appendChild(pre);
    document.body.appendChild(panel);
    document.body.appendChild(btn);

    function update() {
      pre.textContent = measure();
    }
    btn.addEventListener('click', function () {
      try {
        navigator.clipboard.writeText(pre.textContent);
        btn.textContent = 'Copiado \\u2713';
        setTimeout(function () { btn.textContent = 'Copiar'; }, 1500);
      } catch (e) {
        alert(pre.textContent);
      }
    });
    update();
    // Re-medir si la ventana cambia (teclado, rotación) para agarrar el
    // estado real en el momento en que Luis lo esté mirando.
    window.addEventListener('resize', update);
  }

  if (document.body) {
    buildPanel();
  } else {
    document.addEventListener('DOMContentLoaded', buildPanel);
  }
})();
      `}
    </Script>
  );
}
