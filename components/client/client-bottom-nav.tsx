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
  // Fila de ítems: la caja original (min-h-44 + py-2) era mucho más alta
  // que su contenido, dejando los íconos chicos con mucho aire. Un primer
  // ajuste achicó la CAJA (h-8, ícono size-4) pero eso también empequeñeció
  // el contenido. Ahora la caja es más alta (h-[50px]) con íconos y texto
  // grandes (size-5, texto sm).
  //
  // El ícono NO va centrado con justify-center: la franja de safe area de
  // abajo (10px) ya empuja visualmente el contenido hacia arriba respecto
  // de la rayita de gestos, así que centrar dentro de la caja del ícono
  // solamente deja el ícono pegado a la línea divisoria de arriba y con
  // más aire abajo (safe area + padding) que arriba. pt-[10px] en vez de
  // justify-center: mismo espacio (10px) arriba (hasta la línea
  // divisoria) que abajo (los 10px de la franja de safe area), sin dejar
  // padding extra propio — el contenido llena el resto de la caja.
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
              className={`flex h-[50px] flex-1 flex-col items-center gap-1 pt-[10px] text-xs transition-[color,transform] active:scale-90 active:bg-white/10 ${
                active ? "text-[#e8001c]" : "text-[#888888]"
              }`}
            >
              <span className="relative">
                <Icon className="size-5" />
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
