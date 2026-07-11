"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";

export type ChangePasswordState =
  | { error: string }
  | { success: true }
  | undefined;

// Compartido entre /client/profile y /coach/profile — la lógica no depende
// del rol. supabase.auth.updateUser() no pide la contraseña actual, así
// que se verifica re-autenticando con signInWithPassword() antes de
// actualizar; si esa llamada falla, la contraseña actual era incorrecta.
export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Completá todos los campos." };
  }
  if (newPassword.length < 8) {
    return { error: "La nueva contraseña debe tener al menos 8 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const authUser = await getAuthUser();
  if (!authUser) return { error: "No autenticado." };

  const supabase = await createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: authUser.email,
    password: currentPassword,
  });
  if (signInError) {
    return { error: "La contraseña actual no es correcta." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    console.error("changePassword updateUser error:", updateError);
    return { error: "No se pudo actualizar la contraseña. Intentá de nuevo." };
  }

  return { success: true };
}
