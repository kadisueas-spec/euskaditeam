import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export function getMonthKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function getPreviousMonthKey(date = new Date()): string {
  const prev = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return getMonthKey(prev);
}

export function isMonthEndToday(date = new Date()): boolean {
  const totalDays = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return date.getUTCDate() === totalDays;
}

export type MonthlyGoal = {
  id: string;
  month: string;
  mainGoal: string;
  weightKg: number | null;
  motivationLevel: number | null;
  improveNote: string | null;
  createdAt: string;
};

export async function getCurrentMonthGoal(): Promise<MonthlyGoal | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from("monthly_goals")
    .select(
      "id, month, main_goal, weight_kg, motivation_level, improve_note, created_at"
    )
    .eq("client_id", client.id)
    .eq("month", getMonthKey())
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    month: data.month,
    mainGoal: data.main_goal,
    weightKg: data.weight_kg,
    motivationLevel: data.motivation_level,
    improveNote: data.improve_note,
    createdAt: data.created_at,
  };
}

export async function getMonthlyGoalForClient(
  clientId: string,
  month: string
): Promise<MonthlyGoal | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("monthly_goals")
    .select(
      "id, month, main_goal, weight_kg, motivation_level, improve_note, created_at"
    )
    .eq("client_id", clientId)
    .eq("month", month)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    month: data.month,
    mainGoal: data.main_goal,
    weightKg: data.weight_kg,
    motivationLevel: data.motivation_level,
    improveNote: data.improve_note,
    createdAt: data.created_at,
  };
}
