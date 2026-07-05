"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type InviteState =
  | { error: string }
  | { success: true; code: string }
  | undefined;

function generateCode() {
  const random = crypto.randomUUID().split("-")[0].toUpperCase();
  return `CLIENTE-${random}`;
}

export async function generateInviteCode(
  _prevState: InviteState,
  _formData: FormData
): Promise<InviteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const code = generateCode();
  const { error } = await supabase
    .from("invite_codes")
    .insert({ code, role: "client", created_by: user.id });

  if (error) {
    console.error("generateInviteCode error:", error);
    return { error: "No se pudo generar el código. Intentá de nuevo." };
  }

  revalidatePath("/coach/clients/invite");
  return { success: true, code };
}
