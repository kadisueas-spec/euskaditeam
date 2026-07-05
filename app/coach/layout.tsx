import { redirect } from "next/navigation";
import { CoachBottomNav } from "@/components/coach/coach-bottom-nav";
import { CoachHeader } from "@/components/coach/coach-header";
import { CoachSidebar } from "@/components/coach/coach-sidebar";
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

  return (
    <div className="min-h-svh bg-[#080808] text-white">
      <CoachHeader profile={profile} />
      <div className="flex">
        <CoachSidebar />
        <main className="min-w-0 flex-1 p-6 pb-24 md:pb-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <CoachBottomNav />
    </div>
  );
}
