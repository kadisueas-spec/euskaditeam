import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import { computeStreaks } from "@/lib/utils/streaks";
import {
  buildExerciseSessionSeries,
  type ExerciseSessionSeries,
  type RawSetRow,
} from "@/lib/supabase/metrics";
import { paraguayNow } from "@/lib/utils/today";
import { plannedDaysInRange } from "@/lib/utils/planned-days";
import { TRAINING_SESSION_SELECT, adherencePercent, trainedDates } from "@/lib/utils/training-sessions";
import type { TrainingSessionRow } from "@/lib/utils/training-sessions";

// Espejo de stats.ts + metrics.ts (getExerciseSessionSeries) para el
// entrenamiento propio del coach — mismo cálculo, coach_id en vez de
// client_id. Rachas (lib/utils/streaks.ts), día entrenado
// (lib/utils/training-sessions.ts) y días planificados
// (lib/utils/planned-days.ts) son los mismos helpers que el cliente; el cálculo de
// series por ejercicio SÍ se reusa (buildExerciseSessionSeries, ya
// exportada de metrics.ts) porque no depende de client_id/coach_id, solo
// procesa filas ya filtradas.

export type CoachTrainingStats = {
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

export async function getCoachTrainingStats(): Promise<CoachTrainingStats> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { dailyStreak: 0, weeklyStreak: 0, adherencePercent: 0 };
  }

  const supabase = await createClient();
  const now = paraguayNow();
  const monthPrefix = now.toISOString().slice(0, 7);

  const [{ data: allLogs }, { data: activeRoutine }] = await Promise.all([
    supabase
      .from("workout_logs")
      .select(TRAINING_SESSION_SELECT)
      .eq("coach_id", profile.id)
      .order("workout_date", { ascending: false })
      .returns<TrainingSessionRow[]>(),
    supabase
      .from("routines")
      .select("id, starts_at, created_at, routine_days(count)")
      .eq("coach_id", profile.id)
      .is("client_id", null)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<RoutineWithDayCountRow | null>(),
  ]);

  // Mismo criterio de día entrenado y de días planificados que el cliente
  // (el coach no tiene access_activated_at: cuenta desde la rutina).
  const trained = trainedDates(allLogs ?? []);
  const plannedDaysPerWeek = activeRoutine?.routine_days[0]?.count ?? 0;
  const { dailyStreak, weeklyStreak } = computeStreaks([...trained].reverse(), plannedDaysPerWeek, now);

  const trainedThisMonth = trained.filter((d) => d.startsWith(monthPrefix)).length;
  const plannedTotal = plannedDaysInRange({
    rangeStart: `${monthPrefix}-01`,
    rangeEnd: now.toISOString().slice(0, 10),
    plannedPerWeek: plannedDaysPerWeek,
    accessActivatedAt: null,
    routineAssignedAt: activeRoutine?.starts_at ?? activeRoutine?.created_at ?? null,
  });

  return { dailyStreak, weeklyStreak, adherencePercent: adherencePercent(trainedThisMonth, plannedTotal) };
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
