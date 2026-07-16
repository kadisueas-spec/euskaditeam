import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import { addWeeks, mondayKeyFor, previousMondayKey } from "@/lib/utils/week";
import {
  buildExerciseSessionSeries,
  type ExerciseSessionSeries,
  type RawSetRow,
} from "@/lib/supabase/metrics";

// Espejo de stats.ts + metrics.ts (getExerciseSessionSeries) para el
// entrenamiento propio del coach — mismo cálculo, coach_id en vez de
// client_id. La lógica de rachas/adherencia se reimplementa acá (no vale
// la pena parametrizar getClientStats solo para esto); el cálculo de
// series por ejercicio SÍ se reusa (buildExerciseSessionSeries, ya
// exportada de metrics.ts) porque no depende de client_id/coach_id, solo
// procesa filas ya filtradas.

const DAY_MS = 24 * 60 * 60 * 1000;

export type CoachTrainingStats = {
  dailyStreak: number;
  weeklyStreak: number;
  adherencePercent: number;
};

function dayBefore(dateStr: string): string {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function computeStreaks(
  datesDesc: string[],
  plannedPerWeek: number,
  today: Date
): { dailyStreak: number; weeklyStreak: number } {
  if (plannedPerWeek <= 0 || datesDesc.length === 0) {
    return { dailyStreak: 0, weeklyStreak: 0 };
  }

  const countByWeekStart = new Map<string, number>();
  for (const d of datesDesc) {
    const key = mondayKeyFor(d);
    countByWeekStart.set(key, (countByWeekStart.get(key) ?? 0) + 1);
  }

  const todayStr = today.toISOString().slice(0, 10);
  let cursor = mondayKeyFor(todayStr);
  let weeklyStreak = 0;

  if ((countByWeekStart.get(cursor) ?? 0) >= plannedPerWeek) {
    weeklyStreak++;
  }
  cursor = previousMondayKey(cursor);

  while ((countByWeekStart.get(cursor) ?? 0) >= plannedPerWeek) {
    weeklyStreak++;
    cursor = previousMondayKey(cursor);
  }

  const earliestMonday = mondayKeyFor(datesDesc[datesDesc.length - 1]);
  const realFailure = cursor >= earliestMonday;
  const anchor = realFailure ? addWeeks(cursor, 1) : dayBefore(earliestMonday);

  const anchorMs = new Date(`${anchor}T00:00:00Z`).getTime();
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  const dailyStreak = Math.max(0, Math.round((todayMs - anchorMs) / DAY_MS));

  return { dailyStreak, weeklyStreak };
}

type RoutineWithDayCountRow = {
  id: string;
  routine_days: { count: number }[];
};

export async function getCoachTrainingStats(): Promise<CoachTrainingStats> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { dailyStreak: 0, weeklyStreak: 0, adherencePercent: 0 };
  }

  const supabase = await createClient();
  const now = new Date();
  const monthPrefix = now.toISOString().slice(0, 7);

  const [{ data: allLogs }, { data: activeRoutine }] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("id, workout_date")
      .eq("coach_id", profile.id)
      .order("workout_date", { ascending: false }),
    supabase
      .from("routines")
      .select("id, routine_days(count)")
      .eq("coach_id", profile.id)
      .is("client_id", null)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<RoutineWithDayCountRow | null>(),
  ]);

  const allLogRows = allLogs ?? [];
  const distinctDatesDesc = Array.from(new Set(allLogRows.map((l) => l.workout_date)));
  const plannedDaysPerWeek = activeRoutine?.routine_days[0]?.count ?? 0;
  const { dailyStreak, weeklyStreak } = computeStreaks(distinctDatesDesc, plannedDaysPerWeek, now);

  const trainedThisMonth = distinctDatesDesc.filter((d) => d.startsWith(monthPrefix)).length;
  const weeksElapsedThisMonth = Math.ceil(now.getUTCDate() / 7);
  const plannedTotal = plannedDaysPerWeek * weeksElapsedThisMonth;
  const adherencePercent =
    plannedTotal > 0 ? Math.min(100, Math.round((trainedThisMonth / plannedTotal) * 100)) : 0;

  return { dailyStreak, weeklyStreak, adherencePercent };
}

export async function getCoachExerciseSessionSeries(): Promise<ExerciseSessionSeries[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_set_logs")
    .select(
      `workout_log_id, weight_kg, reps_completed, rir_actual,
       routine_exercises ( exercise_id, exercises ( name, muscle_group ) ),
       workout_logs!inner ( workout_date, coach_id )`
    )
    .eq("workout_logs.coach_id", profile.id)
    .returns<RawSetRow[]>();

  return buildExerciseSessionSeries(data ?? []);
}
