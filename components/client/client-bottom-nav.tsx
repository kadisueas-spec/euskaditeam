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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[#1e1e1e] bg-[rgba(8,8,8,0.85)] backdrop-blur-[20px] pb-[env(safe-area-inset-bottom)]">
      {CLIENT_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = tappedHref === href || (tappedHref === null && pathname.startsWith(href));
        const showBadge = href === "/client/feedback" && unreadFeedbackCount > 0;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setTappedHref(href)}
            className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-[color,transform] active:scale-90 active:bg-white/10 ${
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
    </nav>
  );
}
