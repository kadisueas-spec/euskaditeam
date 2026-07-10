"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CLIENT_NAV_ITEMS } from "./client-nav-items";

export function ClientBottomNav({
  unreadFeedbackCount = 0,
}: {
  unreadFeedbackCount?: number;
}) {
  const pathname = usePathname();
  // Estado "optimista": se marca activa apenas se toca, sin esperar a que
  // termine la navegación real. Se resincroniza cuando pathname cambia,
  // ajustando el estado durante el render en vez de en un efecto.
  const [tappedHref, setTappedHref] = useState<string | null>(null);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setTappedHref(null);
  }

  // Dos capas, mismo color sólido #080808 en ambas (nada de blur ni
  // transparencia): con rgba(8,8,8,.85)+backdrop-blur, la fila de ítems
  // desenfocaba lo que había DETRÁS (cards, bordes, glows del contenido
  // scrolleado) y el resultado no era el mismo negro exacto que la franja
  // sólida de la safe area de abajo — se veía una costura/banda separada.
  // Con las dos capas 100% opacas y del mismo hex, son un solo bloque
  // visual continuo hasta el borde físico, sin dependencia de qué haya
  // detrás para desenfocar.
  //
  // La franja de safe area usaba el valor COMPLETO de env(safe-area-inset-
  // bottom) (34px en la mayoría de los iPhone) como bloque vacío — eso es
  // lo que Luis reportó como "mucho espacio muerto" comparando con otras
  // apps de referencia. Se cambia a min(env(...), 10px): un colchón chico
  // fijo en vez del alto completo de la zona de gestos, para que los
  // íconos queden bien pegados abajo. El toque sigue funcionando cerca del
  // borde (el gesto de "volver al home" de iOS necesita un swipe desde el
  // borde, no se dispara con un tap simple), solo se pierde el respiro
  // visual completo que exige el HIG — decisión de Luis, no un default.
  //
  // Fila de ítems: la caja (min-h-44 + py-2) era mucho más alta que su
  // contenido real (ícono 20px + texto), así que el ícono quedaba chico y
  // centrado con mucho aire arriba/abajo, lejos del borde superior de la
  // barra y de la safe area de abajo. Se cambia a una altura fija más
  // chica (h-8, 32px) sin padding vertical, ícono más chico (size-4) y
  // label más chico (10px) — el contenido pasa a ocupar casi toda la caja
  // en vez de la mitad. Toque mínimo recomendado por Apple es 44px; esto
  // queda por debajo a propósito, decisión de Luis (igual que el ajuste
  // de safe area).
  return (
    <nav className="z-20 flex shrink-0 flex-col border-t border-[#1e1e1e]">
      <div className="flex bg-[#080808]">
        {CLIENT_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = tappedHref === href || (tappedHref === null && pathname.startsWith(href));
          const showBadge = href === "/client/feedback" && unreadFeedbackCount > 0;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setTappedHref(href)}
              className={`flex h-8 flex-1 flex-col items-center justify-center gap-0 text-[10px] transition-[color,transform] active:scale-90 active:bg-white/10 ${
                active ? "text-[#e8001c]" : "text-[#888888]"
              }`}
            >
              <span className="relative">
                <Icon className="size-4" />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2 flex min-w-[16px] items-center justify-center rounded-full bg-[#e8001c] px-1 text-[10px] leading-4 font-bold text-white">
                    {unreadFeedbackCount > 9 ? "9+" : unreadFeedbackCount}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
      <div className="h-[min(env(safe-area-inset-bottom),10px)] shrink-0 bg-[#080808]" />
    </nav>
  );
}
