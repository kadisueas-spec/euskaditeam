import Image from "next/image";
import { LogOut } from "lucide-react";
import { logout } from "@/app/coach/actions";
import type { Profile } from "@/lib/supabase/profiles";

function initials(name: string | null, email: string) {
  const base = name?.trim() || email;
  return base.slice(0, 2).toUpperCase();
}

export function CoachHeader({ profile }: { profile: Profile }) {
  return (
    <header className="gradient-section z-30 flex min-h-[65px] shrink-0 items-center justify-between border-b border-[#1e1e1e] px-4 pt-[env(safe-area-inset-top)] md:px-6">
      <span className="flex items-center gap-2 font-display text-xl tracking-wide text-[#f5f5f5] uppercase">
        <Image src="/brand/euskadi-logo.png" alt="" width={26} height={26} />
        Euskadi Team <span className="text-[#e8001c]">Coach</span>
      </span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-[#e8001c] text-xs font-semibold text-white">
            {initials(profile.full_name, profile.email)}
          </span>
          <span className="hidden text-sm text-[#888888] sm:inline">
            {profile.full_name ?? profile.email}
          </span>
        </div>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="flex size-[44px] items-center justify-center rounded-lg text-[#888888] hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-5" />
          </button>
        </form>
      </div>
    </header>
  );
}
