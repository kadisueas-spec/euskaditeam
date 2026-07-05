import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export type WorkoutHistoryItem = {
  id: string;
  workoutDate: string;
  dayName: string | null;
  isCompleted: boolean;
  energyLevel: number | null;
};

export async function getWorkoutHistory(): Promise<WorkoutHistoryItem[]> {
  const client = await getCurrentClientRecord();
  if (!client) return [];

  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("workout_logs")
    .select("id, workout_date, routine_day_id, is_completed, energy_level")
    .eq("client_id", client.id)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = logs ?? [];
  const dayIds = rows
    .map((r) => r.routine_day_id)
    .filter((id): id is string => Boolean(id));

  const { data: days } = dayIds.length
    ? await supabase.from("routine_days").select("id, name").in("id", dayIds)
    : { data: [] as { id: string; name: string }[] };

  const dayNameById = new Map((days ?? []).map((d) => [d.id, d.name]));

  return rows.map((r) => ({
    id: r.id,
    workoutDate: r.workout_date,
    dayName: r.routine_day_id
      ? (dayNameById.get(r.routine_day_id) ?? null)
      : null,
    isCompleted: r.is_completed,
    energyLevel: r.energy_level,
  }));
}

export type WorkoutLogSetDetail = {
  id: string;
  exerciseName: string;
  setNumber: number;
  weightKg: number | null;
  repsCompleted: number | null;
  rirActual: number | null;
};

export type WorkoutLogDetail = {
  id: string;
  workoutDate: string;
  dayName: string | null;
  energyLevel: number | null;
  clientNotes: string | null;
  sets: WorkoutLogSetDetail[];
};

export async function getWorkoutLogDetail(
  id: string
): Promise<WorkoutLogDetail | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();

  const { data: log } = await supabase
    .from("workout_logs")
    .select("id, workout_date, routine_day_id, energy_level, client_notes")
    .eq("id", id)
    .eq("client_id", client.id)
    .single();

  if (!log) return null;

  let dayName: string | null = null;
  if (log.routine_day_id) {
    const { data: day } = await supabase
      .from("routine_days")
      .select("name")
      .eq("id", log.routine_day_id)
      .single();
    dayName = day?.name ?? null;
  }

  const { data: setLogs } = await supabase
    .from("workout_set_logs")
    .select(
      "id, routine_exercise_id, set_number, weight_kg, reps_completed, rir_actual"
    )
    .eq("workout_log_id", id)
    .order("set_number", { ascending: true });

  const rows = setLogs ?? [];
  const routineExerciseIds = rows
    .map((r) => r.routine_exercise_id)
    .filter((id): id is string => Boolean(id));

  const { data: routineExercises } = routineExerciseIds.length
    ? await supabase
        .from("routine_exercises")
        .select("id, exercise_id")
        .in("id", routineExerciseIds)
    : { data: [] as { id: string; exercise_id: string }[] };

  const exerciseIdByRoutineExerciseId = new Map(
    (routineExercises ?? []).map((re) => [re.id, re.exercise_id])
  );
  const exerciseIds = Array.from(
    new Set(Array.from(exerciseIdByRoutineExerciseId.values()))
  );

  const { data: exercises } = exerciseIds.length
    ? await supabase.from("exercises").select("id, name").in("id", exerciseIds)
    : { data: [] as { id: string; name: string }[] };

  const exerciseNameById = new Map((exercises ?? []).map((e) => [e.id, e.name]));

  const sets: WorkoutLogSetDetail[] = rows.map((r) => {
    const exerciseId = r.routine_exercise_id
      ? exerciseIdByRoutineExerciseId.get(r.routine_exercise_id)
      : undefined;
    return {
      id: r.id,
      exerciseName: exerciseId
        ? (exerciseNameById.get(exerciseId) ?? "Ejercicio")
        : "Ejercicio",
      setNumber: r.set_number,
      weightKg: r.weight_kg,
      repsCompleted: r.reps_completed,
      rirActual: r.rir_actual,
    };
  });

  return {
    id: log.id,
    workoutDate: log.workout_date,
    dayName,
    energyLevel: log.energy_level,
    clientNotes: log.client_notes,
    sets,
  };
}
