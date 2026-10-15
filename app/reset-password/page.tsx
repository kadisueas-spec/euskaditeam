import Link from "next/link";
import { AuthHero } from "@/components/auth/auth-hero";
import { AuthCard } from "@/components/auth/auth-card";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { ResetPasswordForm } from "./reset-password-form";

// Se llega desde el link del email de recuperación, pasando por
// /auth/confirm (que deja la sesión). Sin sesión, el link no sirvió o se
// entró directo a la URL: se ofrece pedir uno nuevo.
export default async function ResetPasswordPage() {
  const authUser = await getAuthUser();

  return (
    <main className="flex h-[var(--app-height,100dvh)] flex-col bg-[#080808]">
      <AuthHero subtitle="Recuperar acceso" />
      <AuthCard>
        {authUser ? (
          <ResetPasswordForm />
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-3xl tracking-wide text-white uppercase">
              Link vencido
            </h2>
            <p className="text-sm text-[#888888]">
              Este link ya no es válido. Pedí uno nuevo para crear tu contraseña.
            </p>
            <Link href="/forgot-password" className="mt-2 font-medium text-[#e8001c]">
              Pedir un link nuevo
            </Link>
          </div>
        )}
      </AuthCard>
    </main>
  );
}
