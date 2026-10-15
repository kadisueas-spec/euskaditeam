import { AuthHero } from "@/components/auth/auth-hero";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

// Oct-2026: antes solo decía "escribile a tu coach" (sin SMTP propio, el
// límite de 2 emails/hora de Supabase no alcanzaba). Ahora manda el link de
// recuperación por email — ver actions.ts y app/auth/confirm.
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;

  return (
    <main className="flex h-[var(--app-height,100dvh)] flex-col bg-[#080808]">
      <AuthHero subtitle="Recuperar acceso" />
      <AuthCard>
        <ForgotPasswordForm expired={expired === "1"} />
      </AuthCard>
    </main>
  );
}
