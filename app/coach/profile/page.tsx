import { LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import { logout } from "../actions";

export default async function CoachProfilePage() {
  const profile = await getCurrentProfile();

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          {profile?.full_name ?? "Mi perfil"}
        </h1>
        <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
        <p className="text-sm text-[#888888]">{profile?.email}</p>
      </div>

      <Card className="border-[#1e1e1e] bg-[#111111]">
        <CardHeader>
          <CardTitle className="text-base text-white">Seguridad</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <form action={logout}>
        <button
          type="submit"
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#1e1e1e] text-[#888888] active:bg-white/5"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
