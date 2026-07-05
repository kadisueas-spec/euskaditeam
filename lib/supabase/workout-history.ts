import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export type WorkoutHistoryItem = {
  id: string;
  workoutDate: string;
  dayName: string | null;
  isCompleted: boolean;
  energyLevel: number | null;
};

type HistoryRow = {
  id: string;
  workout_date: string;
  is_completed: boolean;
  energy_level: number | null;
  routine_days: { name: string } | null;
};

// Antes: 2 round trips (logs -> routine_days). Ahora: 1.
export async function getWorkoutHistory(): Promise<WorkoutHistoryItem[]> {
  const client = await getCurrentClientRecord();
  if (!client) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("workout_logs")
    .select(
      `id, workout_date, is_completed, energy_level,
       routine_days ( name )`
    )
    .eq("client_id", client.id)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<HistoryRow[]>();

  return (data ?? []).map((r) => ({
    id: r.id,
    workoutDate: r.workout_date,
    dayName: r.routine_days?.name ?? null,
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

type LogDetailRow = {
  id: string;
  workout_date: string;
  energy_level: number | null;
  client_notes: string | null;
  routine_days: { name: string } | null;
  workout_set_logs: {
    id: string;
    set_number: number;
    weight_kg: number | null;
    reps_completed: number | null;
    rir_actual: number | null;
    routine_exercises: { exercises: { name: string } | null } | null;
  }[];
};

// Antes: hasta 5 round trips secuenciales (log -> day -> setLogs ->
// routineExercises -> exercises). Ahora: 1.
export async function getWorkoutLogDetail(
  id: string
): Promise<WorkoutLogDetail | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();

  const { data: log } = await supabase
    .from("workout_logs")
    .select(
      `id, workout_date, energy_level, client_notes,
       routine_days ( name ),
       workout_set_logs (
         id, set_number, weight_kg, reps_completed, rir_actual,
         routine_exercises ( exercises ( name ) )
       )`
    )
    .eq("id", id)
    .eq("client_id", client.id)
    .single()
    .returns<LogDetailRow>();

  if (!log) return null;

  const sets: WorkoutLogSetDetail[] = [...log.workout_set_logs]
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => ({
      id: s.id,
      exerciseName: s.routine_exercises?.exercises?.name ?? "Ejercicio",
      setNumber: s.set_number,
      weightKg: s.weight_kg,
      repsCompleted: s.reps_completed,
      rirActual: s.rir_actual,
    }));

  return {
    id: log.id,
    workoutDate: log.workout_date,
    dayName: log.routine_days?.name ?? null,
    energyLevel: log.energy_level,
    clientNotes: log.client_notes,
    sets,
  };
}
