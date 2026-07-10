"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { COACH_NAV_ITEMS } from "./coach-nav-items";

export function CoachBottomNav() {
  const pathname = usePathname();
  const [tappedHref, setTappedHref] = useState<string | null>(null);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setTappedHref(null);
  }

  // Ver el comentario largo en components/client/client-bottom-nav.tsx: dos
  // capas, mismo negro sólido #080808 en ambas, sin blur ni transparencia
  // (el blur+transparencia dejaba un negro sutilmente distinto entre la
  // fila de ítems y la franja de safe area — se veía como una costura).
  // Franja de safe area achicada a min(env(...), 10px) — el valor completo
  // dejaba mucho espacio vacío entre los íconos y la rayita de gestos.
  // Fila de ítems: primer ajuste achicó la caja (h-8, ícono size-4) pero
  // eso también empequeñeció el contenido. Ahora se agranda de nuevo
  // (h-11, 44px) con íconos y texto proporcionalmente más grandes
  // (size-5, texto sm) para que llenen la caja sin aire muerto.
  return (
    <nav className="z-20 flex shrink-0 flex-col border-t border-[#1e1e1e] md:hidden">
      <div className="flex bg-[#080808]">
        {COACH_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = tappedHref === href || (tappedHref === null && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setTappedHref(href)}
              className={`flex h-11 flex-1 flex-col items-center justify-center gap-1 text-xs transition-[color,transform] active:scale-90 active:bg-white/10 ${
                active ? "text-[#e8001c]" : "text-[#888888]"
              }`}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </div>
      <div className="h-[min(env(safe-area-inset-bottom),10px)] shrink-0 bg-[#080808]" />
    </nav>
  );
}
