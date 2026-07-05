import { createClient } from "@/lib/supabase/server";

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

export async function getCurrentClientRecord(): Promise<ClientRecord | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("clients")
    .select(
      "id, user_id, coach_id, weight_kg, height_cm, goal, training_experience, is_active, subscription_status, subscription_end_date"
    )
    .eq("user_id", user.id)
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
}
