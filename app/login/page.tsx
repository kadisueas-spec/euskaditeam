import { redirect } from "next/navigation";
import { AuthHero } from "@/components/auth/auth-hero";
import { AuthCard } from "@/components/auth/auth-card";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // F6: la cookie de sesión de Supabase dura 400 días y sobrevive cerrar la
  // PWA sin problema — el bug real era que "/" (start_url) siempre
  // redirige acá sin chequear si ya había sesión, así que esta pantalla
  // pedía login de nuevo en cada apertura aunque el token siguiera vigente.
  const authUser = await getAuthUser();
  if (authUser) {
    redirect(authUser.role === "coach" ? "/coach/dashboard" : "/client/my-routine");
  }

  return (
    <main className="flex h-[var(--app-height,100dvh)] flex-col bg-[#080808]">
      <AuthHero subtitle="Acá empieza tu progreso" />
      <AuthCard>
        <LoginForm />
      </AuthCard>
    </main>
  );
}
