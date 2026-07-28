import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import {
  getCurrentMonthGoal,
  isMonthEndToday,
  type MonthlyGoal,
} from "@/lib/supabase/monthly-goals";
import { getClientStats } from "@/lib/supabase/stats";

export type MyMonthProgress = {
  goal: MonthlyGoal | null;
  trainedDays: number;
  plannedDays: number;
  dailyStreak: number;
  weeklyStreak: number;
  isUnlocked: boolean;
  totalDaysInMonth: number;
  trainedDates: string[];
  daysUntilUnlock: number;
};

export function daysInMonth(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
}

type RoutineWithDayCountRow = {
  id: string;
  routine_days: { count: number }[];
};

// Antes: hasta 5 round trips secuenciales (client, goal, logs, activeRoutine,
// routine_days count) + los 7 internos de getClientStats = ~12.
// Ahora: client y goal memoizados (gratis si ya se pidieron antes en el
// request) + 3 consultas independientes en paralelo (logs, rutina con
// conteo de días embebido, stats ya optimizado a su vez).
export async function getMyMonthProgress(): Promise<MyMonthProgress | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();
  const now = new Date();
  const totalDays = daysInMonth(now);
  const isUnlocked = isMonthEndToday(now);
  const monthPrefix = now.toISOString().slice(0, 7);

  const [goal, { data: logs }, { data: activeRoutine }, stats] = await Promise.all([
    getCurrentMonthGoal(),
    supabase
      .from("workout_logs")
      .select("workout_date")
      .eq("client_id", client.id)
      .gte("workout_date", `${monthPrefix}-01`),
    supabase
      .from("routines")
      .select("id, routine_days(count)")
      .eq("client_id", client.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<RoutineWithDayCountRow | null>(),
    getClientStats(),
  ]);

  const trainedDates = Array.from(
    new Set((logs ?? []).map((l) => l.workout_date))
  );
  const trainedDays = trainedDates.length;

  const plannedDaysPerWeek = activeRoutine?.routine_days[0]?.count ?? 0;
  const weeksInMonth = Math.ceil(totalDays / 7);
  const plannedDays = plannedDaysPerWeek * weeksInMonth;

  return {
    goal,
    trainedDays,
    plannedDays,
    dailyStreak: stats.dailyStreak,
    weeklyStreak: stats.weeklyStreak,
    isUnlocked,
    totalDaysInMonth: totalDays,
    trainedDates,
    daysUntilUnlock: totalDays - now.getUTCDate(),
  };
}

// El resumen del mes desbloqueado vive en lib/supabase/month-summary.ts
// (getMyMonthSummary) desde jul-2026 — mucho más completo (rachas,
// récords, progresión con mini-gráfico, composición corporal) que lo que
// había acá antes.
