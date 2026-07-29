"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

// Banner de bienvenida (ago-2026): se marca en la base (no localStorage)
// para que no vuelva a aparecer en otro dispositivo. Solo puede marcar la
// rutina activa del propio cliente — el filtro por client_id además de
// routineId ya alcanza para eso, sin necesitar RLS nueva (la policy
// existente de "cliente ve/edita su propia rutina" cubre update también).
export async function dismissWelcomeBanner(
  routineId: string
): Promise<{ success: true } | { error: string }> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No autenticado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("routines")
    .update({ welcome_banner_shown_at: new Date().toISOString() })
    .eq("id", routineId)
    .eq("client_id", client.id);

  if (error) {
    console.error("dismissWelcomeBanner error:", error);
    return { error: "No se pudo guardar." };
  }

  revalidatePath("/client/my-routine");
  return { success: true };
}
