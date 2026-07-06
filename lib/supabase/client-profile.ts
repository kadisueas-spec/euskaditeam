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
      "id, user_id, coach_id, weight_kg, height_cm, goal, training_experience, is_active, subscription_status, subscription_end_date"
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
  };
});
