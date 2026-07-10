import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { mondayKeyFor, previousMondayKey } from "@/lib/utils/week";

export type ClientStats = {
  streak: number;
  adherencePercent: number;
};

// C2: la racha ya no cuenta días consecutivos (entrenar lunes y no poder
// entrenar el fin de semana rompía la racha aunque el cliente haya cumplido
// su plan de 3 o 4 días/semana). Ahora cuenta semanas consecutivas
// (lunes-domingo) en las que se llegó a la cantidad de días planificados
// por la rutina activa.
function computeWeeklyStreak(datesDesc: string[], plannedPerWeek: number): number {
  if (plannedPerWeek <= 0 || datesDesc.length === 0) return 0;

  const countByWeekStart = new Map<string, number>();
  for (const d of datesDesc) {
    const key = mondayKeyFor(d);
    countByWeekStart.set(key, (countByWeekStart.get(key) ?? 0) + 1);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  let cursor = mondayKeyFor(todayStr);
  let streak = 0;

  // La semana en curso suma a la racha si ya se cumplió el plan, pero no la
  // corta si todavía no se cumplió (la semana no terminó).
  if ((countByWeekStart.get(cursor) ?? 0) >= plannedPerWeek) {
    streak++;
  }
  cursor = previousMondayKey(cursor);

  while ((countByWeekStart.get(cursor) ?? 0) >= plannedPerWeek) {
    streak++;
    cursor = previousMondayKey(cursor);
  }

  return streak;
}

type RoutineWithDayCountRow = {
  id: string;
  routine_days: { count: number }[];
};

// Mejora Fase 9 (jul-2026): el progreso de peso y el volumen semanal se
// mudaron a lib/supabase/metrics.ts (getExerciseSessionSeries) con
// granularidad por sesión real en vez de bucket semanal — acá solo queda
// racha y adherencia, que es lo único que este módulo sigue calculando.
export async function getClientStats(): Promise<ClientStats> {
  const client = await getCurrentClientRecord();
  if (!client) {
    return { streak: 0, adherencePercent: 0 };
  }

  const supabase = await createClient();
  const now = new Date();
  const monthPrefix = now.toISOString().slice(0, 7);

  const [{ data: allLogs }, { data: activeRoutine }] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("id, workout_date")
      .eq("client_id", client.id)
      .order("workout_date", { ascending: false }),
    supabase
      .from("routines")
      .select("id, routine_days(count)")
      .eq("client_id", client.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<RoutineWithDayCountRow | null>(),
  ]);

  const allLogRows = allLogs ?? [];
  const distinctDatesDesc = Array.from(new Set(allLogRows.map((l) => l.workout_date)));
  const plannedDaysPerWeek = activeRoutine?.routine_days[0]?.count ?? 0;
  const streak = computeWeeklyStreak(distinctDatesDesc, plannedDaysPerWeek);

  const trainedThisMonth = distinctDatesDesc.filter((d) => d.startsWith(monthPrefix)).length;
  const weeksElapsedThisMonth = Math.ceil(now.getUTCDate() / 7);
  const plannedTotal = plannedDaysPerWeek * weeksElapsedThisMonth;
  const adherencePercent = plannedTotal > 0
    ? Math.min(100, Math.round((trainedThisMonth / plannedTotal) * 100))
    : 0;

  return { streak, adherencePercent };
}
