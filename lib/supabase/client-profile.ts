import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";

export type ClientRecord = {
  id: string;
  userId: string;
  coachId: string | null;
  weightKg: number | null;
  heightCm: number | null;
  goal: string | null;
  trainingExperience: string | null;
  isActive: boolean;
  subscriptionStatus: string;
  subscriptionEndDate: string | null;
  restTimerEnabled: boolean;
  restTimerSoundEnabled: boolean;
  restTimerVibrationEnabled: boolean;
  createdAt: string;
  progressPhotoReminderDismissedAt: string | null;
  // Consentimiento único de uso público de fotos de progreso (ago-2026,
  // reemplaza el toggle por foto) — null = todavía no se le preguntó.
  photosPublicUseAuthorized: boolean | null;
};

// cache(): varias funciones de este módulo llaman a getCurrentClientRecord()
// de forma independiente dentro del mismo request (layout, stats, my-month,
// etc.) — se memoiza para pagar la consulta a "clients" una sola vez.
// getAuthUser() ya no pega contra Supabase (lee el resultado que dejó el
// middleware), así que esto queda en 1 sola consulta real.
export const getCurrentClientRecord = cache(async function getCurrentClientRecord(): Promise<ClientRecord | null> {
  const authUser = await getAuthUser();
  if (!authUser) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select(
      "id, user_id, coach_id, weight_kg, height_cm, goal, training_experience, is_active, subscription_status, subscription_end_date, rest_timer_enabled, rest_timer_sound_enabled, rest_timer_vibration_enabled, created_at, progress_photo_reminder_dismissed_at, photos_public_use_authorized"
    )
    .eq("user_id", authUser.id)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    coachId: data.coach_id,
    weightKg: data.weight_kg,
    heightCm: data.height_cm,
    goal: data.goal,
    trainingExperience: data.training_experience,
    isActive: data.is_active,
    subscriptionStatus: data.subscription_status,
    subscriptionEndDate: data.subscription_end_date,
    restTimerEnabled: data.rest_timer_enabled,
    restTimerSoundEnabled: data.rest_timer_sound_enabled,
    restTimerVibrationEnabled: data.rest_timer_vibration_enabled,
    createdAt: data.created_at,
    progressPhotoReminderDismissedAt: data.progress_photo_reminder_dismissed_at,
    photosPublicUseAuthorized: data.photos_public_use_authorized,
  };
});
