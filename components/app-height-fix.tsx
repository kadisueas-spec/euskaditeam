import Script from "next/script";

// iOS (sobre todo en la PWA instalada, standalone) a veces reporta un
// 100dvh "sin asentar" en el primer render — la nav inferior (y cualquier
// contenedor h-dvh) puede aparecer en la posición equivocada hasta el
// primer toque/scroll, momento en el que el navegador recalcula y todo
// salta a su lugar. Es un problema conocido de WebKit, no de nuestro CSS.
//
// Fix estándar: medir la altura real con JS y exponerla como --app-height,
// en vez de confiar en que dvh esté bien calculado desde el primer frame.
// strategy="beforeInteractive" para que corra lo antes posible, antes del
// primer paint visible. Los contenedores raíz (h-dvh) pasan a usar
// h-[var(--app-height,100dvh)] — 100dvh queda de fallback por si este
// script no llegó a correr todavía.
//
// window.innerHeight, NO visualViewport.height (bug jul-2026): al abrir el
// teclado numérico en iOS, visualViewport.height se achica (el teclado le
// come espacio a la vista visual) pero window.innerHeight no cambia — el
// viewport de layout sigue siendo el mismo. Medir con visualViewport hacía
// que TODO el shell de la app (header, nav, panel de registro de series)
// se encogiera cada vez que aparecía el teclado, como si la página entera
// se corriera hacia arriba con él, en vez de que el teclado se superponga
// por encima sin mover nada. window.innerHeight no reacciona al teclado en
// iOS, así que --app-height queda estable mientras se escribe.
export function AppHeightFix() {
  return (
    <Script id="app-height-fix" strategy="beforeInteractive">
      {`
(function () {
  function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
  }
  setAppHeight();
  window.addEventListener('resize', setAppHeight);
  window.addEventListener('orientationchange', function () {
    setAppHeight();
    setTimeout(setAppHeight, 100);
    setTimeout(setAppHeight, 300);
  });
  // WebKit a veces recién asienta el viewport real después del primer
  // toque/scroll — remedir un par de veces más apenas carga, sin esperar
  // a que el usuario interactúe.
  setTimeout(setAppHeight, 100);
  setTimeout(setAppHeight, 500);
})();
      `}
    </Script>
  );
}
