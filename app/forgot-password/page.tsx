import Link from "next/link";
import { AuthHero } from "@/components/auth/auth-hero";
import { AuthCard } from "@/components/auth/auth-card";

// Todavía no hay flujo de recuperación por email — por ahora el coach
// resetea la contraseña a mano desde el panel de Supabase. Esta pantalla
// solo evita que el link del login sea un 404.
export default function ForgotPasswordPage() {
  return (
    <main className="flex h-dvh flex-col bg-[#080808]">
      <AuthHero subtitle="Recuperar acceso" />
      <AuthCard>
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-3xl tracking-wide text-white uppercase">
            ¿Olvidaste tu contraseña?
          </h2>
          <p className="text-sm text-[#888888]">
            Por ahora escribile a tu coach para que te la restablezca.
          </p>
          <Link
            href="/login"
            className="mt-2 font-medium text-[#e8001c]"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      </AuthCard>
    </main>
  );
}
