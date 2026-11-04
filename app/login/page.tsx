import { redirect } from "next/navigation";
import { AuthHero } from "@/components/auth/auth-hero";
import { AuthCard } from "@/components/auth/auth-card";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { LoginForm } from "./login-form";

// Avisos que llegan por query desde otros flujos (oct-2026): contraseña
// restablecida (/reset-password) y email confirmado (/auth/confirm).
const LOGIN_NOTICES: Record<string, string> = {
  reset: "Tu contraseña se actualizó. Iniciá sesión con la nueva.",
  confirmed: "Email confirmado. Ya podés iniciar sesión.",
  link: "El link venció o ya se usó. Si necesitás uno nuevo, pedilo de nuevo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  // F6: la cookie de sesión de Supabase dura 400 días y sobrevive cerrar la
  // PWA sin problema — el bug real era que "/" (start_url) siempre
  // redirige acá sin chequear si ya había sesión, así que esta pantalla
  // pedía login de nuevo en cada apertura aunque el token siguiera vigente.
  const authUser = await getAuthUser();
  if (authUser) {
    redirect(authUser.role === "coach" ? "/coach/dashboard" : "/client/home");
  }

  // Rediseño nov-2026 (estilo Solstice): hero alto + panel que sube
  // encima. Scrollea la página entera (no solo la tarjeta) para que con el
  // teclado abierto los campos y el botón puedan subir por encima de él.
  return (
    <main className="momentum-scroll flex h-[var(--app-height,100dvh)] flex-col overflow-y-auto overscroll-contain bg-[#080808]">
      <AuthHero size="tall" subtitle="Acá empieza tu progreso" />
      <AuthCard variant="sheet">
        <LoginForm notice={notice ? (LOGIN_NOTICES[notice] ?? null) : null} />
      </AuthCard>
    </main>
  );
}
