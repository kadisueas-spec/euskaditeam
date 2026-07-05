import type { CSSProperties, ReactNode } from "react";

// Transición de entrada sutil reutilizable para pantallas/secciones. Animación
// CSS pura (sin framer-motion): en WebKit viejo (iOS 16.3 probado) la
// animación vía Web Animations API de framer-motion nunca disparaba, dejando
// el contenido en su estado inicial `opacity: 0` de forma permanente —
// pantalla en blanco/negro según el fondo. CSS @keyframes no depende de que
// ningún JS de terceros se ejecute correctamente.
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const style: CSSProperties | undefined = delay
    ? { animationDelay: `${delay}s` }
    : undefined;

  return (
    <div className={`animate-fade-in-up ${className ?? ""}`} style={style}>
      {children}
    </div>
  );
}
