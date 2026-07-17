"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export type SaveWeightLogResult = { success: true; id: string } | { error: string };

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;

// Un solo action para crear O editar: la unique constraint (client_id,
// date) hace que un upsert por fecha sea exactamente "si ya me pesé ese
// día, corregí el valor; si no, creá el registro" — sirve tanto para
// "Registrar mi peso de hoy" como para editar cualquier día del historial,
// sin necesitar dos funciones separadas.
export async function saveWeightLog(
  date: string,
  weightKg: number
): Promise<SaveWeightLogResult> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  if (!date) return { error: "Fecha inválida." };
  if (!Number.isFinite(weightKg) || weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) {
    return { error: "Ingresá un peso válido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weight_logs")
    .upsert(
      { client_id: client.id, date, weight_kg: weightKg },
      { onConflict: "client_id,date" }
    )
    .select("id")
    .single();

  if (error || !data) {
    console.error("saveWeightLog error:", error);
    return { error: "No se pudo guardar el peso." };
  }

  revalidatePath("/client/progress");
  return { success: true, id: data.id };
}
