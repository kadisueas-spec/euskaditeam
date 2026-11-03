import type { ReactNode } from "react";

// Tarjeta que sube desde abajo y se superpone al hero (esquinas superiores
// muy redondeadas + margin-top negativo). animate-slide-up-in es CSS puro
// (@keyframes en globals.css) — nada de framer-motion, falla en Safari iOS
// viejo (ver components/motion/fade-in.tsx).
//
// variant="sheet" (nov-2026, login estilo Solstice): panel un escalón más
// claro que el fondo con línea de luz de 1px arriba (surface-sheet), una
// barrita centrada en el borde superior y esquinas más redondeadas. NO
// scrollea por su cuenta: scrollea la página entera (ver app/login/page.tsx)
// para que con el teclado abierto todo pueda subir por encima de él. El
// resto de las pantallas siguen con la variante de siempre.
export function AuthCard({ children, variant = "default" }: { children: ReactNode; variant?: "default" | "sheet" }) {
  if (variant === "sheet") {
    return (
      <div className="surface-sheet animate-slide-up-in relative z-10 -mt-10 flex flex-1 flex-col rounded-t-[36px] px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <span aria-hidden className="mx-auto mb-6 block h-1.5 w-12 shrink-0 rounded-full bg-white/20" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">{children}</div>
      </div>
    );
  }
  return (
    <div className="animate-slide-up-in momentum-scroll relative z-10 -mt-8 flex flex-1 flex-col overflow-y-auto overscroll-contain rounded-t-[32px] bg-[#111111] px-6 pt-8 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
