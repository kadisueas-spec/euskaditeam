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

  // Ver el comentario largo en components/client/client-bottom-nav.tsx:
  // misma estructura en dos capas (fila de ítems con blur + franja de safe
  // area sólida aparte) para garantizar que el fondo llegue pintado hasta
  // el borde físico, sin depender de que el backdrop-blur cubra bien el
  // padding-box hasta el último píxel en iOS.
  return (
    <nav className="z-20 flex shrink-0 flex-col border-t border-[#1e1e1e] md:hidden">
      <div className="flex bg-[rgba(8,8,8,0.85)] backdrop-blur-[20px]">
        {COACH_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = tappedHref === href || (tappedHref === null && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setTappedHref(href)}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-[color,transform] active:scale-90 active:bg-white/10 ${
                active ? "text-[#e8001c]" : "text-[#888888]"
              }`}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)] shrink-0 bg-[#080808]" />
    </nav>
  );
}
