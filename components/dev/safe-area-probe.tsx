"use client";

import Script from "next/script";

// EXPERIMENTAL — mide la ClientBottomNav REAL, dentro del layout REAL de
// cliente (con header, banners y contenido real arriba), en vez de la
// réplica aislada de /dev-safe-area/raw. Se activa solo con ?diag=1 en la
// URL — invisible en uso normal. strategy="afterInteractive" es la forma
// oficial de Next de correr un script DESPUÉS de que React termine de
// hidratar (evita el problema de /dev-safe-area v1/v2: un script corriendo
// ANTES de que termine la hidratación hace que React revierta el DOM al
// terminar). Agrega un panel flotante NUEVO en vez de sobreescribir
// contenido que React ya renderizó, así no hay nada que conciliar/revertir.
//
// v2: registra un HISTORIAL de mediciones (carga inicial + scroll + resize
// + cada 500ms durante los primeros 3s) en vez de una sola foto — Luis
// describe que la nav aparece mal al principio y se corrige sola al
// arrastrar/scrollear, patrón clásico de iOS donde el viewport reportado
// en el primer paint no es el definitivo. Con el historial se ve el salto.
export function SafeAreaProbe() {
  return (
    <Script id="safe-area-probe" strategy="afterInteractive">
      {`
(function () {
  if (!location.search.includes('diag=1')) return;

  function px(n) { return Math.round(n * 100) / 100 + 'px'; }

  function measureCompact() {
    var probeBottom = document.createElement('div');
    probeBottom.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;';
    document.body.appendChild(probeBottom);

    var navEls = document.querySelectorAll('nav');
    var nav = navEls.length ? navEls[navEls.length - 1] : null;
    var result = {
      t: new Date().toISOString().slice(11, 23),
      innerHeight: window.innerHeight,
      envBottom: probeBottom.getBoundingClientRect().height,
    };
    if (nav) {
      var r = nav.getBoundingClientRect();
      result.navBottom = r.bottom;
      result.navHeight = r.height;
      result.gap = window.innerHeight - r.bottom;
    } else {
      result.error = 'sin <nav>';
    }
    probeBottom.remove();
    return result;
  }

  function formatEntry(label, m) {
    if (m.error) return '[' + m.t + '] ' + label + ' -- ERROR: ' + m.error;
    return '[' + m.t + '] ' + label + ' -- innerHeight:' + px(m.innerHeight) + ' navBottom:' + px(m.navBottom) + ' GAP:' + px(m.gap) + ' navHeight:' + px(m.navHeight) + ' envBottom:' + px(m.envBottom);
  }

  function measureDetailed() {
    var lines = [];
    function line(l, v) { lines.push(l + (v !== undefined ? ': ' + v : '')); }

    var navEls = document.querySelectorAll('nav');
    var nav = navEls.length ? navEls[navEls.length - 1] : null;
    var root = document.documentElement;
    var body = document.body;
    function cs(el) { return el ? getComputedStyle(el) : null; }
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

    line('modo', isStandalone ? 'standalone' : 'tab');
    line('cant. <nav> en el DOM', String(navEls.length));

    if (nav) {
      var navRect = nav.getBoundingClientRect();
      var itemsRow = nav.firstElementChild;
      var safeSpacer = nav.lastElementChild;
      line('nav bg', cs(nav).backgroundColor);
      line('nav fila items bg', itemsRow ? cs(itemsRow).backgroundColor : '?');
      line('nav safe-strip bg', safeSpacer ? cs(safeSpacer).backgroundColor : '?');
      line('nav position', cs(nav).position);
      line('nav transform', cs(nav).transform);

      var belowPoint = document.elementFromPoint(navRect.left + 10, Math.min(navRect.bottom + 5, window.innerHeight - 1));
      line('elemento 5px debajo de nav.bottom', belowPoint ? (belowPoint.tagName + (belowPoint.id ? '#' + belowPoint.id : '') + (belowPoint.className ? '.' + String(belowPoint.className).split(' ').join('.') : '')) : 'ninguno');

      var p = nav.parentElement;
      var depth = 0;
      while (p && depth < 5) {
        var pcs = cs(p);
        line('padre[' + depth + '] <' + p.tagName.toLowerCase() + '>', 'padding:' + pcs.padding + ' margin:' + pcs.margin + ' transform:' + pcs.transform + ' position:' + pcs.position);
        p = p.parentElement;
        depth++;
      }
    }
    return lines.join('\\n');
  }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.id = 'safe-area-probe-panel';
    panel.style.cssText = 'position:fixed;top:0;left:0;right:0;max-height:70vh;overflow-y:auto;background:rgba(0,0,0,0.97);color:#0f0;font-family:ui-monospace,monospace;font-size:9px;padding:10px;z-index:999999;white-space:pre-wrap;word-break:break-all;border-bottom:2px solid #e8001c;';
    var btn = document.createElement('button');
    btn.textContent = 'Copiar historial';
    btn.style.cssText = 'position:fixed;top:8px;right:8px;z-index:1000000;background:#e8001c;color:#fff;border:none;border-radius:6px;padding:8px 12px;font-size:12px;';
    var historyPre = document.createElement('pre');
    historyPre.style.cssText = 'margin:0 0 10px 0;padding-top:32px;color:#0f0;';
    var label1 = document.createElement('div');
    label1.textContent = '── HISTORIAL (mirá si GAP cambia con el tiempo/scroll) ──';
    label1.style.cssText = 'color:#e8001c;font-weight:bold;padding-top:32px;';
    var label2 = document.createElement('div');
    label2.textContent = '── DETALLE (última medición) ──';
    label2.style.cssText = 'color:#e8001c;font-weight:bold;margin-top:10px;';
    var detailPre = document.createElement('pre');
    detailPre.style.cssText = 'margin:0;color:#fff;';

    panel.appendChild(label1);
    panel.appendChild(historyPre);
    panel.appendChild(label2);
    panel.appendChild(detailPre);
    document.body.appendChild(panel);
    document.body.appendChild(btn);

    var history = [];
    var fullText = '';

    function addEntry(label) {
      var m = measureCompact();
      history.push(formatEntry(label, m));
      historyPre.textContent = history.join('\\n');
      detailPre.textContent = measureDetailed();
      fullText = '── HISTORIAL ──\\n' + history.join('\\n') + '\\n\\n── DETALLE (última) ──\\n' + detailPre.textContent;
      panel.scrollTop = panel.scrollHeight;
    }

    btn.addEventListener('click', function () {
      try {
        navigator.clipboard.writeText(fullText);
        btn.textContent = 'Copiado \\u2713';
        setTimeout(function () { btn.textContent = 'Copiar historial'; }, 1500);
      } catch (e) {
        alert(fullText);
      }
    });

    // Carga inicial + reintentos cortos (agarra el "salto" si pasa en el
    // primer segundo, sin que Luis tenga que hacer nada) + en cada
    // scroll/resize (agarra el salto si pasa recién al interactuar).
    addEntry('carga inicial');
    setTimeout(function () { addEntry('+150ms'); }, 150);
    setTimeout(function () { addEntry('+500ms'); }, 500);
    setTimeout(function () { addEntry('+1500ms'); }, 1500);
    setTimeout(function () { addEntry('+3000ms'); }, 3000);

    var scrollTimer = null;
    window.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () { addEntry('scroll'); }, 100);
    }, { passive: true, capture: true });

    window.addEventListener('resize', function () { addEntry('resize'); });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () { addEntry('visualViewport.resize'); });
    }
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
