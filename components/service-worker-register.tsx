"use client";

import { useEffect } from "react";

// next-pwa (v5) solo auto-inyecta este registro en el Pages Router
// (_document.js). Con App Router hay que registrarlo a mano para que el
// service worker generado en public/sw.js quede activo.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // En dev /sw.js no existe (next-pwa está deshabilitado ahí a propósito)
      // — el 404 es esperado, no hace falta que rompa como unhandled rejection.
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
