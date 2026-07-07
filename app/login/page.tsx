import Image from "next/image";
import { redirect } from "next/navigation";
import { FadeIn } from "@/components/motion/fade-in";
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
    <main className="flex min-h-svh flex-col items-center justify-center bg-[#080808] p-6">
      <FadeIn className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute size-28 rounded-full bg-[#e8001c]/25 blur-2xl" />
            <Image
              src="/brand/euskadi-logo.png"
              alt="Euskadi Team"
              width={96}
              height={96}
              priority
              className="relative"
            />
          </div>
          <div className="text-center">
            <h1 className="font-display text-5xl tracking-wide text-[#f5f5f5] uppercase">
              Euskadi Team
            </h1>
            <p className="mt-2 text-sm text-[#888888]">
              Entrenamiento personalizado · Luis Mineur
            </p>
          </div>
        </div>
        <LoginForm />
      </FadeIn>
    </main>
  );
}
