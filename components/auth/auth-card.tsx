import type { ReactNode } from "react";

// Tarjeta que sube desde abajo y se superpone al hero (esquinas superiores
// muy redondeadas + margin-top negativo). animate-slide-up-in es CSS puro
// (@keyframes en globals.css) — nada de framer-motion, falla en Safari iOS
// viejo (ver components/motion/fade-in.tsx).
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="animate-slide-up-in relative z-10 -mt-8 flex flex-1 flex-col rounded-t-[32px] bg-[#111111] px-6 pt-8 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
