"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ForgotPasswordState = { error: string } | { success: true } | undefined;

// Recuperación de contraseña por email (oct-2026, posible desde que Auth
// manda los emails por SMTP propio — Resend, dominio euskaditeam.app). El
// link del email pasa por /auth/confirm (verifica el token y deja la
// sesión) y termina en /reset-password.
//
// Siempre responde "te mandamos el email" aunque la cuenta no exista: así
// la pantalla no sirve para averiguar qué emails están registrados.
export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Ingresá tu email." };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    if (error.status === 429 || error.code === "over_email_send_rate_limit") {
      return { error: "Pediste demasiados emails seguidos. Esperá unos minutos y probá de nuevo." };
    }
    // Cualquier otro error (incluido "usuario no existe", según la config
    // de Supabase) se registra pero no se le muestra distinto al usuario.
    console.error("resetPasswordForEmail error:", error);
  }

  return { success: true };
}
