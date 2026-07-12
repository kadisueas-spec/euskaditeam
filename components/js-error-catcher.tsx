import Script from "next/script";

// DIAGNÓSTICO TEMPORAL (jul-2026) — sacar apenas tengamos la respuesta. Ver
// conversación: hidratación en 0% en el iPhone del coach incluso en
// navegación privada (descarta caché/Service Worker) y con JavaScript
// activado en Ajustes. Este script es JS puro, sin ninguna dependencia de
// React — corre con strategy="beforeInteractive" (antes de que React
// intente hidratar nada) y muestra CUALQUIER error directo en pantalla,
// como una consola rudimentaria, para poder ver el error real sin
// necesitar acceso a las devtools del dispositivo.
export function JsErrorCatcher() {
  return (
    <Script id="js-error-catcher" strategy="beforeInteractive">
      {`
(function () {
  var pending = [];
  function flush() {
    if (!document.body) return;
    var el = document.getElementById('js-error-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'js-error-banner';
      el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:999999;background:#000;color:#0f0;font-family:monospace;font-size:11px;padding:8px;max-height:45vh;overflow:auto;white-space:pre-wrap;border-top:3px solid red;';
      document.body.appendChild(el);
    }
    while (pending.length) {
      el.textContent += pending.shift() + '\\n\\n';
    }
  }
  function showError(msg) {
    pending.push(msg);
    flush();
  }
  window.addEventListener('error', function (e) {
    showError('ERROR: ' + e.message + ' @ ' + e.filename + ':' + e.lineno + ':' + e.colno);
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    showError('PROMISE: ' + (r && r.message ? r.message : String(r)));
  });
  document.addEventListener('DOMContentLoaded', flush);
  document.addEventListener('readystatechange', flush);
  setTimeout(function () {
    showError('(sin errores hasta ahora — ' + new Date().toISOString() + ')');
  }, 3000);
})();
      `}
    </Script>
  );
}
