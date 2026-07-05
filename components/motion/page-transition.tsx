"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Transición sutil entre pantallas. CSS puro (@keyframes en globals.css),
// sin framer-motion: ya tuvimos un caso real donde esa librería no disparaba
// la animación en Safari/WebKit viejo (iOS 16.3) y dejaba el contenido
// invisible. Usar `key={pathname}` remonta el div en cada navegación,
// reiniciando la animación de entrada.
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
