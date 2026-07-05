"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { COACH_NAV_ITEMS } from "./coach-nav-items";

export function CoachSidebar() {
  const pathname = usePathname();
  const [tappedHref, setTappedHref] = useState<string | null>(null);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setTappedHref(null);
  }

  return (
    <nav className="hidden md:sticky md:top-[65px] md:flex md:h-[calc(100svh-65px)] md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-[#1e1e1e] md:bg-[#111111] md:p-4">
      {COACH_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = tappedHref === href || (tappedHref === null && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setTappedHref(href)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-[#e8001c] text-white shadow-[0_0_16px_rgba(232,0,28,0.35)]"
                : "text-[#888888] hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
