"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export type TourPart = "home" | "workout";

const COLUMN: Record<TourPart, "tour_home_seen_at" | "tour_workout_seen_at"> = {
  home: "tour_home_seen_at",
  workout: "tour_workout_seen_at",
};

// Recorrido de bienvenida (oct-2026): marca una parte como vista para la
// rutina activa. Se llama apenas aparece el primer paso — así, si el
// cliente lo cierra a mitad (o cierra la app), no vuelve a salir.
// El cliente no tiene policy de UPDATE sobre routines (ver bug del banner
// en app/client/my-routine/actions.ts): la propiedad se verifica con su
// sesión y la escritura de esta única columna va con el service role.
export async function markTourSeen(
  routineId: string,
  part: TourPart
): Promise<{ success: true } | { error: string }> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No autenticado." };

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
    .update({ [COLUMN[part]]: new Date().toISOString() })
    .eq("id", routineId)
    .eq("client_id", client.id)
    .select("id");

  if (error || !data || data.length === 0) {
    console.error("markTourSeen error:", error ?? "0 filas actualizadas");
    return { error: "No se pudo guardar." };
  }
  // Sin revalidatePath a propósito: el recorrido ya se está mostrando y se
  // cierra solo; revalidar re-renderizaría la pantalla debajo del overlay.
  return { success: true };
}
