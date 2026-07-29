"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export type RestTimerPrefsPatch = {
  restTimerEnabled?: boolean;
  restTimerSoundEnabled?: boolean;
  restTimerVibrationEnabled?: boolean;
};

// Preferencias del temporizador de descanso (jul-2026) — se guardan en
// clients, no localStorage, para que persistan entre dispositivos (ver
// components/client/rest-timer-settings.tsx).
export async function updateRestTimerPrefs(
  patch: RestTimerPrefsPatch
): Promise<{ success: true } | { error: string }> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No autenticado." };

  const dbPatch: Record<string, boolean> = {};
  if (patch.restTimerEnabled !== undefined) dbPatch.rest_timer_enabled = patch.restTimerEnabled;
  if (patch.restTimerSoundEnabled !== undefined)
    dbPatch.rest_timer_sound_enabled = patch.restTimerSoundEnabled;
  if (patch.restTimerVibrationEnabled !== undefined)
    dbPatch.rest_timer_vibration_enabled = patch.restTimerVibrationEnabled;

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(dbPatch).eq("id", client.id);

  if (error) {
    console.error("updateRestTimerPrefs error:", error);
    return { error: "No se pudo guardar la preferencia." };
  }

  revalidatePath("/client/profile");
  return { success: true };
}
