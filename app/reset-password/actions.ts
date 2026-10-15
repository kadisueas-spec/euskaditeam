"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ResetPasswordState = { error: string } | undefined;

// Última parte de la recuperación de contraseña (oct-2026): /auth/confirm
// ya verificó el link del email y dejó una sesión — acá solo se fija la
// contraseña nueva (a diferencia de changePassword del perfil, no se pide
// la actual: justamente es la que se olvidó). Después se cierra la sesión
// y se manda al login: el link suele abrirse en Safari/Chrome y no en la
// PWA instalada, así que el cliente tiene que entrar igual desde la app.
export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!newPassword || !confirmPassword) return { error: "Completá los dos campos." };
  if (newPassword.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (newPassword !== confirmPassword) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "El link venció. Pedí uno nuevo desde \"¿Olvidaste tu contraseña?\"." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (error.code === "same_password") {
      return { error: "La contraseña nueva tiene que ser distinta de la anterior." };
    }
    console.error("resetPassword updateUser error:", error);
    return { error: "No se pudo actualizar la contraseña. Probá de nuevo." };
  }

  await supabase.auth.signOut();
  redirect("/login?notice=reset");
}
