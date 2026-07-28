"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Recorrido animado de "Mi Mes" (jul-2026): cada bloque entra al cruzar el
// viewport. Progressive enhancement real, no solo de palabra: sin JS, este
// componente nunca agrega la clase que oculta el contenido — el div se
// renderiza sin más que su className base, así que queda 100% visible y
// legible. Recién cuando el script corre (useEffect) se agrega
// "scroll-reveal" (que sí pone opacity:0 vía CSS) y el IntersectionObserver
// se encarga de sacarlo con la animación al entrar en pantalla.
export function ScrollReveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [jsReady, setJsReady] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    setJsReady(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const revealClass = jsReady ? (visible ? "scroll-reveal scroll-reveal-visible" : "scroll-reveal") : "";

  return (
    <div ref={ref} className={`${revealClass} ${className}`.trim()}>
      {children}
    </div>
  );
}
