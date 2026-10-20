"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

// Banner de bienvenida (ago-2026): se marca en la base (no localStorage)
// para que no vuelva a aparecer en otro dispositivo. Una vez POR RUTINA: una
// rutina nueva es una fila nueva con la marca en null, así que el banner
// vuelve a salir cuando el coach asigna otra.
//
// Bug oct-2026: el banner aparecía en cada apertura porque la marca nunca
// se guardaba. El cliente NO tiene policy de UPDATE sobre routines (solo
// "Client views own routine", de SELECT) — el UPDATE con su sesión no daba
// error, simplemente tocaba 0 filas. No se agrega una policy de UPDATE para
// el cliente (podría modificar cualquier columna de su rutina): la
// propiedad se verifica acá con su sesión y la escritura de esta única
// columna va con el service role.
export async function dismissWelcomeBanner(
  routineId: string
): Promise<{ success: true } | { error: string }> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No autenticado." };

  // Verificación de propiedad con la sesión del cliente (RLS de SELECT):
  // solo encuentra la rutina si es suya.
  const supabase = await createClient();
  const { data: routine } = await supabase
    .from("routines")
    .select("id")
    .eq("id", routineId)
    .eq("client_id", client.id)
    .maybeSingle();
  if (!routine) return { error: "Rutina no encontrada." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("routines")
    .update({ welcome_banner_shown_at: new Date().toISOString() })
    .eq("id", routineId)
    .eq("client_id", client.id)
    .select("id");

  if (error || !data || data.length === 0) {
    console.error("dismissWelcomeBanner error:", error ?? "0 filas actualizadas");
    return { error: "No se pudo guardar." };
  }

  revalidatePath("/client/home");
  revalidatePath("/client/my-routine");
  return { success: true };
}
