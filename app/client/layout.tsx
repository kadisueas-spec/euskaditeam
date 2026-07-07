import Image from "next/image";
import Link from "next/link";
import { Lock, MessageSquare } from "lucide-react";
import { redirect } from "next/navigation";
import { ClientBottomNav } from "@/components/client/client-bottom-nav";
import { MonthlyGoalModal } from "@/components/client/monthly-goal-modal";
import { OfflineBanner } from "@/components/client/offline-banner";
import { SyncBanner } from "@/components/client/sync-banner";
import { PushPermissionPrompt } from "@/components/client/push-permission-prompt";
import { PageTransition } from "@/components/motion/page-transition";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { getUnreadFeedbackCount } from "@/lib/supabase/feedback";
import { getCurrentMonthGoal } from "@/lib/supabase/monthly-goals";
import { isAccessActive } from "@/lib/constants/access";
import { logout } from "@/app/client/actions";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // profile y clientRecord son independientes entre sí (ambos dependen solo
  // del usuario ya validado por el middleware, no uno del otro) — antes se
  // pedían en secuencia, ahora en paralelo.
  const [profile, clientRecord] = await Promise.all([
    getCurrentProfile(),
    getCurrentClientRecord(),
  ]);

  // Belt-and-suspenders: proxy.ts already enforces this optimistically via
  // user_metadata.role. This is the secure check against profiles.role.
  if (!profile) redirect("/login");
  if (profile.role !== "client") redirect("/coach/dashboard");

  // El vencimiento se calcula en cada request (no depende de un cron que
  // actualice subscription_status), así el bloqueo aplica al instante.
  if (
    clientRecord &&
    !isAccessActive(
      clientRecord.subscriptionStatus,
      clientRecord.subscriptionEndDate
    )
  ) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[#080808] px-6 text-center text-white">
        <Lock className="size-10 text-[#e8001c]" />
        <h1 className="text-xl font-semibold">Tu acceso está inactivo</h1>
        <p className="text-sm text-[#888888]">
          Contactá a tu coach para renovar tu acceso y seguir usando la app.
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="mt-2 flex h-11 min-w-[160px] items-center justify-center rounded-lg border border-[#1e1e1e] px-4 text-sm font-medium text-[#888888] active:bg-white/5"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    );
  }

  // Ídem: goal y unreadFeedbackCount no dependen entre sí (ambos reusan el
  // clientRecord ya cacheado arriba, no requieren una nueva validación).
  const [monthlyGoal, unreadFeedbackCount] = await Promise.all([
    getCurrentMonthGoal(),
    getUnreadFeedbackCount(),
  ]);
  if (!monthlyGoal) {
    // Full-screen takeover: no other client route is reachable until the
    // client completes their goal for the current month.
    return <MonthlyGoalModal />;
  }

  return (
    <div className="flex min-h-svh flex-col bg-[#080808] text-white">
      <header className="gradient-section sticky top-0 z-10 flex items-center justify-center gap-2 border-b border-[#1e1e1e] px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <Image src="/brand/euskadi-logo.png" alt="" width={22} height={22} />
        <span className="font-display text-lg tracking-wide text-[#f5f5f5] uppercase">
          Euskadi Team
        </span>
      </header>
      <div className="sticky top-[calc(65px+env(safe-area-inset-top))] z-10 flex flex-col">
        <OfflineBanner />
        <SyncBanner />
        {unreadFeedbackCount > 0 && (
          <Link
            href="/client/feedback"
            className="flex min-h-[44px] items-center justify-center gap-2 bg-[#e8001c] px-4 py-2 text-center text-sm font-medium text-white active:bg-[#b8001a]"
          >
            <MessageSquare className="size-4 shrink-0" />
            Tenés {unreadFeedbackCount} comentario
            {unreadFeedbackCount === 1 ? "" : "s"} nuevo
            {unreadFeedbackCount === 1 ? "" : "s"} de tu coach
          </Link>
        )}
      </div>
      <main className="flex-1 px-4 py-5 pb-[calc(72px+env(safe-area-inset-bottom))]">
        <PageTransition>{children}</PageTransition>
      </main>
      <PushPermissionPrompt />
      <ClientBottomNav unreadFeedbackCount={unreadFeedbackCount} />
    </div>
  );
}
