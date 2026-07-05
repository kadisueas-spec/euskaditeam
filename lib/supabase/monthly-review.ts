import { createClient } from "@/lib/supabase/server";
import { getMonthKey, isMonthEndToday } from "@/lib/supabase/monthly-goals";

export type MonthEndAlert = {
  clientId: string;
  clientName: string;
};

export async function getMonthEndAlerts(): Promise<MonthEndAlert[]> {
  if (!isMonthEndToday()) return [];

  const supabase = await createClient();
  const monthKey = getMonthKey();

  const { data: clients } = await supabase.from("clients").select("id, user_id");
  const rows = clients ?? [];
  if (rows.length === 0) return [];

  const clientIds = rows.map((c) => c.id);
  const clientById = new Map(rows.map((c) => [c.id, c]));
  const allUserIds = rows
    .map((c) => c.user_id)
    .filter((id): id is string => Boolean(id));

  // "reviews" y "profiles" son independientes entre sí (ambos dependen solo
  // de los IDs ya obtenidos de "clients") — antes se pedían en secuencia,
  // ahora en paralelo. Nota: esta función solo corre el último día del mes
  // (ver isMonthEndToday arriba), es de bajo impacto en el total.
  const [{ data: reviews }, { data: profiles }] = await Promise.all([
    supabase
      .from("monthly_reviews")
      .select("client_id, completed_at")
      .eq("month", monthKey)
      .in("client_id", clientIds),
    allUserIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", allUserIds)
      : Promise.resolve({
          data: [] as { id: string; full_name: string | null; email: string }[],
        }),
  ]);

  const completedClientIds = new Set(
    (reviews ?? []).filter((r) => r.completed_at).map((r) => r.client_id)
  );

  const pendingClientIds = clientIds.filter(
    (id) => !completedClientIds.has(id)
  );
  if (pendingClientIds.length === 0) return [];

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return pendingClientIds.map((clientId) => {
    const client = clientById.get(clientId);
    const profile = client?.user_id
      ? profileById.get(client.user_id)
      : undefined;
    return {
      clientId,
      clientName: profile?.full_name ?? profile?.email ?? "Cliente",
    };
  });
}

export type MonthlyReviewFormData = {
  clientGoal: {
    mainGoal: string;
    weightKg: number | null;
    motivationLevel: number | null;
    improveNote: string | null;
  } | null;
  review: {
    summary: string | null;
    nextMonthGoals: string | null;
    planAdjustments: string | null;
    completedAt: string | null;
  } | null;
};

export async function getMonthlyReviewFormData(
  clientId: string
): Promise<MonthlyReviewFormData> {
  const supabase = await createClient();
  const monthKey = getMonthKey();

  const [{ data: goal }, { data: review }] = await Promise.all([
    supabase
      .from("monthly_goals")
      .select("main_goal, weight_kg, motivation_level, improve_note")
      .eq("client_id", clientId)
      .eq("month", monthKey)
      .maybeSingle(),
    supabase
      .from("monthly_reviews")
      .select("summary, next_month_goals, plan_adjustments, completed_at")
      .eq("client_id", clientId)
      .eq("month", monthKey)
      .maybeSingle(),
  ]);

  return {
    clientGoal: goal
      ? {
          mainGoal: goal.main_goal,
          weightKg: goal.weight_kg,
          motivationLevel: goal.motivation_level,
          improveNote: goal.improve_note,
        }
      : null,
    review: review
      ? {
          summary: review.summary,
          nextMonthGoals: review.next_month_goals,
          planAdjustments: review.plan_adjustments,
          completedAt: review.completed_at,
        }
      : null,
  };
}
