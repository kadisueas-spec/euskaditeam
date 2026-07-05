"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COACH_NAV_ITEMS } from "./coach-nav-items";

export function CoachBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[#1e1e1e] bg-[rgba(8,8,8,0.85)] backdrop-blur-[20px] pb-[env(safe-area-inset-bottom)] md:hidden">
      {COACH_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-[color,transform] active:scale-90 active:bg-white/10 ${
              active ? "text-[#e8001c]" : "text-[#888888]"
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
