import { redirect } from "next/navigation";
import { CoachBottomNav } from "@/components/coach/coach-bottom-nav";
import { CoachHeader } from "@/components/coach/coach-header";
import { CoachSidebar } from "@/components/coach/coach-sidebar";
import { CoachPushPermissionPrompt } from "@/components/coach/push-permission-prompt";
import { PageTransition } from "@/components/motion/page-transition";
import { getCurrentProfile } from "@/lib/supabase/profiles";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  // Belt-and-suspenders: proxy.ts already enforces this optimistically via
  // user_metadata.role. This is the secure check against profiles.role.
  if (!profile) redirect("/login");
  if (profile.role !== "coach") redirect("/client/my-routine");

  // h-dvh + único scroll interno en <main>, ver el comentario largo en
  // app/client/layout.tsx: evita que la nav (antes position:fixed) deje un
  // hueco vacío abajo en pantallas cortas como /coach/clients en iOS.
  return (
    <div className="flex h-dvh flex-col bg-[#080808] text-white">
      <CoachHeader profile={profile} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CoachSidebar />
        <main className="momentum-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <CoachBottomNav />
      <CoachPushPermissionPrompt />
    </div>
  );
}
