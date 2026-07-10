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
      <div className="flex h-[var(--app-height,100dvh)] flex-col items-center justify-center gap-4 bg-[#080808] px-6 text-center text-white">
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

  // h-dvh + único scroll interno en <main> a propósito (en vez de min-h-svh +
  // nav con position:fixed + padding-bottom "adivinado" para compensarlo):
  // en iOS, un elemento fixed en una página que NO necesita scroll puede
  // calcularse contra un viewport de layout más alto que el visual (deja
  // espacio "fantasma" para una barra de URL que en PWA/standalone no
  // existe), dejando un hueco vacío debajo de la barra — pasaba en login,
  // /coach/clients y /client/profile porque son las pantallas más cortas,
  // no en el resto porque su contenido ya fuerza scroll real. Con la nav
  // como último hijo normal de un flex column de altura fija, no hace
  // falta position:fixed ni el padding-bottom mágico: main ocupa
  // exactamente lo que sobra y la nav siempre queda pegada abajo.
  //
  // h-[var(--app-height,100dvh)] en vez de h-dvh a secas: en la PWA
  // instalada, 100dvh puede reportar un valor "sin asentar" en el primer
  // render y recién corregirse tras el primer toque/scroll — se ve como
  // la nav saltando a su lugar. --app-height la fija AppHeightFix
  // (app/layout.tsx) midiendo con JS en vez de confiar en dvh desde el
  // frame cero. 100dvh queda de fallback si el script no corrió todavía.
  return (
    <div className="flex h-[var(--app-height,100dvh)] flex-col bg-[#080808] text-white">
      <header className="gradient-section shrink-0 flex items-center justify-center gap-2 border-b border-[#1e1e1e] px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <Image src="/brand/euskadi-logo.png" alt="" width={22} height={22} />
        <span className="font-display text-lg tracking-wide text-[#f5f5f5] uppercase">
          Euskadi Team
        </span>
      </header>
      <div className="flex shrink-0 flex-col">
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
      <main className="momentum-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
        <PageTransition>{children}</PageTransition>
      </main>
      <PushPermissionPrompt />
      <ClientBottomNav unreadFeedbackCount={unreadFeedbackCount} />
    </div>
  );
}
