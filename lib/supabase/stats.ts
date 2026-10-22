import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { computeStreaks } from "@/lib/utils/streaks";
import { plannedDaysInRange } from "@/lib/utils/planned-days";
import { paraguayNow } from "@/lib/utils/today";
import { TRAINING_SESSION_SELECT, adherencePercent, trainedDates } from "@/lib/utils/training-sessions";
import type { TrainingSessionRow } from "@/lib/utils/training-sessions";

export type ClientStats = {
  dailyStreak: number;
  weeklyStreak: number;
  adherencePercent: number;
};

type RoutineWithDayCountRow = {
  id: string;
  starts_at: string | null;
  created_at: string;
  routine_days: { count: number }[];
};

// Mejora Fase 9 (jul-2026): el progreso de peso y el volumen semanal se
// mudaron a lib/supabase/metrics.ts (getExerciseSessionSeries) con
// granularidad por sesión real en vez de bucket semanal — acá solo queda
// racha y adherencia, que es lo único que este módulo sigue calculando.
export async function getClientStats(): Promise<ClientStats> {
  const client = await getCurrentClientRecord();
  if (!client) {
    return { dailyStreak: 0, weeklyStreak: 0, adherencePercent: 0 };
  }

  const supabase = await createClient();
  const now = paraguayNow();
  const monthPrefix = now.toISOString().slice(0, 7);

  const [{ data: allLogs }, { data: activeRoutine }] = await Promise.all([
    supabase
      .from("workout_logs")
      .select(TRAINING_SESSION_SELECT)
      .eq("client_id", client.id)
      .order("workout_date", { ascending: false })
      .returns<TrainingSessionRow[]>(),
    supabase
      .from("routines")
      .select("id, starts_at, created_at, routine_days(count)")
      .eq("client_id", client.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<RoutineWithDayCountRow | null>(),
  ]);

  // Rachas y adherencia con el mismo criterio de día entrenado
  // (lib/utils/training-sessions.ts).
  const trained = trainedDates(allLogs ?? []);
  const plannedDaysPerWeek = activeRoutine?.routine_days[0]?.count ?? 0;
  const { dailyStreak, weeklyStreak } = computeStreaks(
    [...trained].reverse(),
    plannedDaysPerWeek,
    now
  );

  const trainedThisMonth = trained.filter((d) => d.startsWith(monthPrefix)).length;
  const plannedTotal = plannedDaysInRange({
    rangeStart: `${monthPrefix}-01`,
    rangeEnd: now.toISOString().slice(0, 10),
    plannedPerWeek: plannedDaysPerWeek,
    accessActivatedAt: client.accessActivatedAt,
    routineAssignedAt: activeRoutine?.starts_at ?? activeRoutine?.created_at ?? null,
  });
  return { dailyStreak, weeklyStreak, adherencePercent: adherencePercent(trainedThisMonth, plannedTotal) };
}
