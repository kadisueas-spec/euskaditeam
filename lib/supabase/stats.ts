import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function computeStreak(datesDesc: string[]): number {
  if (datesDesc.length === 0) return 0;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const mostRecentMs = new Date(`${datesDesc[0]}T00:00:00Z`).getTime();
  const gapFromToday = Math.round((todayMs - mostRecentMs) / DAY_MS);
  if (gapFromToday > 1) return 0;

  let streak = 1;
  let prevMs = mostRecentMs;
  for (let i = 1; i < datesDesc.length; i++) {
    const curMs = new Date(`${datesDesc[i]}T00:00:00Z`).getTime();
    const diff = Math.round((prevMs - curMs) / DAY_MS);
    if (diff === 1) {
      streak++;
      prevMs = curMs;
    } else if (diff > 1) {
      break;
    }
  }
  return streak;
}

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

  const { data: logs } = await supabase
    .from("workout_logs")
    .select("id, workout_date")
    .eq("client_id", client.id)
    .order("workout_date", { ascending: false });

  const allLogRows = logs ?? [];
  const distinctDatesDesc = Array.from(new Set(allLogRows.map((l) => l.workout_date)));
  const streak = computeStreak(distinctDatesDesc);

  // Adherencia del mes: días entrenados vs. (días de rutina por semana x semanas transcurridas)
  const monthPrefix = now.toISOString().slice(0, 7);
  const trainedThisMonth = distinctDatesDesc.filter((d) => d.startsWith(monthPrefix)).length;

  const { data: activeRoutine } = await supabase
    .from("routines")
    .select("id")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let plannedDaysPerWeek = 0;
  if (activeRoutine) {
    const { count } = await supabase
      .from("routine_days")
      .select("id", { count: "exact", head: true })
      .eq("routine_id", activeRoutine.id);
    plannedDaysPerWeek = count ?? 0;
  }

  const weeksElapsedThisMonth = Math.ceil(now.getUTCDate() / 7);
  const plannedTotal = plannedDaysPerWeek * weeksElapsedThisMonth;
  const adherencePercent = plannedTotal > 0
    ? Math.min(100, Math.round((trainedThisMonth / plannedTotal) * 100))
    : 0;

  const logsInRange = allLogRows.filter(
    (l) => new Date(`${l.workout_date}T00:00:00Z`).getTime() >= eightWeeksAgo.getTime()
  );
  const logIds = logsInRange.map((l) => l.id);
  const workoutDateByLogId = new Map(logsInRange.map((l) => [l.id, l.workout_date]));

  const { data: setLogs } = logIds.length
    ? await supabase
        .from("workout_set_logs")
        .select("workout_log_id, routine_exercise_id, weight_kg, reps_completed")
        .in("workout_log_id", logIds)
    : { data: [] as { workout_log_id: string; routine_exercise_id: string | null; weight_kg: number | null; reps_completed: number | null }[] };

  const setRows = setLogs ?? [];
  const routineExerciseIds = Array.from(
    new Set(setRows.map((s) => s.routine_exercise_id).filter((id): id is string => Boolean(id)))
  );

  const { data: routineExercises } = routineExerciseIds.length
    ? await supabase.from("routine_exercises").select("id, exercise_id").in("id", routineExerciseIds)
    : { data: [] as { id: string; exercise_id: string }[] };

  const exerciseIdByRoutineExerciseId = new Map(
    (routineExercises ?? []).map((re) => [re.id, re.exercise_id])
  );
  const exerciseIds = Array.from(new Set(Array.from(exerciseIdByRoutineExerciseId.values())));

  const { data: exercises } = exerciseIds.length
    ? await supabase.from("exercises").select("id, name").in("id", exerciseIds)
    : { data: [] as { id: string; name: string }[] };

  const exerciseNameById = new Map((exercises ?? []).map((e) => [e.id, e.name]));

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

    const exerciseId = set.routine_exercise_id
      ? exerciseIdByRoutineExerciseId.get(set.routine_exercise_id)
      : undefined;
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
