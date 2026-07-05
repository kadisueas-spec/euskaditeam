"use client";

import { useEffect } from "react";

// iOS Safari solo aplica el pseudo-selector :active en taps si hay algún
// listener de touch registrado en un ancestro (si no, el tap se resuelve
// directo a click sin pasar por el estado :active). Un listener vacío alcanza
// para "activar" el comportamiento en toda la app. Sin esto, todos los
// active:scale-* de la app no responden al toque en iPhone real.
export function TouchActiveFix() {
  useEffect(() => {
    document.addEventListener("touchstart", () => {}, { passive: true });
  }, []);

  return null;
}
