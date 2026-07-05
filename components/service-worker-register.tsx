"use client";

import { useEffect } from "react";

// next-pwa (v5) solo auto-inyecta este registro en el Pages Router
// (_document.js). Con App Router hay que registrarlo a mano para que el
// service worker generado en public/sw.js quede activo.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  return null;
}
