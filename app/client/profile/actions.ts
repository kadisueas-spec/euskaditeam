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

// Consentimiento único de uso público de fotos de progreso (ago-2026,
// reemplaza el toggle por foto anterior) — una sola decisión a nivel de
// cliente, no notifica al coach por push. Se usa tanto desde el modal de
// primera vez (components/client/photos-consent-modal.tsx) como desde el
// toggle de /client/profile.
export async function setPhotosPublicUseAuthorization(
  authorized: boolean
): Promise<{ success: true } | { error: string }> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No autenticado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ photos_public_use_authorized: authorized })
    .eq("id", client.id);

  if (error) {
    console.error("setPhotosPublicUseAuthorization error:", error);
    return { error: "No se pudo guardar tu respuesta." };
  }

  revalidatePath("/client/profile");
  revalidatePath("/client/progress");
  return { success: true };
}
