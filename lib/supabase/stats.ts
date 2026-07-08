import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { mondayKeyFor, previousMondayKey } from "@/lib/utils/week";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function weekLabel(startMs: number) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(
    new Date(startMs)
  );
}

export type WeightPoint = { week: string; maxWeight: number | null };
export type ExerciseWeightSeries = {
  exerciseId: string;
  exerciseName: string;
  points: WeightPoint[];
};
export type VolumePoint = { week: string; volume: number };

export type ClientStats = {
  weightProgress: ExerciseWeightSeries[];
  weeklyVolume: VolumePoint[];
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

type LogSetRow = {
  workout_log_id: string;
  exercise_id: string | null;
  weight_kg: number | null;
  reps_completed: number | null;
};

type LogWithSetsRow = {
  id: string;
  workout_date: string;
  workout_set_logs: {
    routine_exercise_id: string | null;
    weight_kg: number | null;
    reps_completed: number | null;
    routine_exercises: { exercise_id: string; exercises: { name: string } | null } | null;
  }[];
};

type RoutineWithDayCountRow = {
  id: string;
  routine_days: { count: number }[];
};

// Antes: 7 round trips secuenciales (client, logs, activeRoutine,
// routine_days count, setLogs, routineExercises, exercises).
// Ahora: client (memoizado) + 3 consultas en paralelo (Promise.all) — la de
// logs+sets trae routine_exercises y exercises anidados en la misma
// consulta, y la de la rutina activa trae el conteo de días embebido.
export async function getClientStats(): Promise<ClientStats> {
  const client = await getCurrentClientRecord();
  if (!client) {
    return { weightProgress: [], weeklyVolume: [], streak: 0, adherencePercent: 0 };
  }

  const supabase = await createClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const eightWeeksAgo = new Date(todayStart.getTime() - 8 * WEEK_MS);
  const monthPrefix = now.toISOString().slice(0, 7);

  const [{ data: allLogs }, { data: recentLogsWithSets }, { data: activeRoutine }] =
    await Promise.all([
      supabase
        .from("workout_logs")
        .select("id, workout_date")
        .eq("client_id", client.id)
        .order("workout_date", { ascending: false }),
      supabase
        .from("workout_logs")
        .select(
          `id, workout_date,
           workout_set_logs (
             routine_exercise_id, weight_kg, reps_completed,
             routine_exercises ( exercise_id, exercises ( name ) )
           )`
        )
        .eq("client_id", client.id)
        .gte("workout_date", eightWeeksAgo.toISOString().slice(0, 10))
        .returns<LogWithSetsRow[]>(),
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

  const recentLogRows = recentLogsWithSets ?? [];
  const workoutDateByLogId = new Map(recentLogRows.map((l) => [l.id, l.workout_date]));
  const exerciseNameById = new Map<string, string>();
  const setRows: LogSetRow[] = [];
  for (const log of recentLogRows) {
    for (const s of log.workout_set_logs) {
      const exerciseId = s.routine_exercises?.exercise_id ?? null;
      setRows.push({
        workout_log_id: log.id,
        exercise_id: exerciseId,
        weight_kg: s.weight_kg,
        reps_completed: s.reps_completed,
      });
      if (exerciseId && s.routine_exercises?.exercises?.name) {
        exerciseNameById.set(exerciseId, s.routine_exercises.exercises.name);
      }
    }
  }

  // Buckets: 8 semanas, de la más vieja a la más nueva, terminando hoy.
  const weekStarts = Array.from({ length: 8 }, (_, i) => {
    const start = todayStart.getTime() - (7 - i) * WEEK_MS;
    return { start, label: weekLabel(start) };
  });

  function bucketIndexForDate(dateStr: string) {
    const ms = new Date(`${dateStr}T00:00:00Z`).getTime();
    for (let i = weekStarts.length - 1; i >= 0; i--) {
      if (ms >= weekStarts[i].start) return i;
    }
    return 0;
  }

  const maxWeightByExerciseAndWeek = new Map<string, Map<number, number>>();
  const volumeByWeek = new Map<number, number>(weekStarts.map((_, i) => [i, 0]));

  for (const set of setRows) {
    const workoutDate = workoutDateByLogId.get(set.workout_log_id);
    if (!workoutDate) continue;
    const bucket = bucketIndexForDate(workoutDate);

    if (set.weight_kg != null && set.reps_completed != null) {
      volumeByWeek.set(bucket, (volumeByWeek.get(bucket) ?? 0) + set.weight_kg * set.reps_completed);
    }

    const exerciseId = set.exercise_id;
    if (!exerciseId || set.weight_kg == null) continue;

    const perWeek = maxWeightByExerciseAndWeek.get(exerciseId) ?? new Map<number, number>();
    perWeek.set(bucket, Math.max(perWeek.get(bucket) ?? 0, set.weight_kg));
    maxWeightByExerciseAndWeek.set(exerciseId, perWeek);
  }

  const weightProgress: ExerciseWeightSeries[] = Array.from(
    maxWeightByExerciseAndWeek.entries()
  ).map(([exerciseId, perWeek]) => ({
    exerciseId,
    exerciseName: exerciseNameById.get(exerciseId) ?? "Ejercicio",
    points: weekStarts.map(({ label }, i) => ({
      week: label,
      maxWeight: perWeek.get(i) ?? null,
    })),
  }));

  const weeklyVolume: VolumePoint[] = weekStarts.map(({ label }, i) => ({
    week: label,
    volume: Math.round(volumeByWeek.get(i) ?? 0),
  }));

  return { weightProgress, weeklyVolume, streak, adherencePercent };
}
