"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export type FinishWorkoutInput = {
  dayId: string;
  exercises: {
    routineExerciseId: string;
    sets: { weightKg: number | null; reps: number | null; rir: number | null }[];
  }[];
  energyLevel: number;
  notes: string;
};

export type FinishWorkoutResult = { success: true } | { error: string };

export async function finishWorkout(
  input: FinishWorkoutInput
): Promise<FinishWorkoutResult> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: log, error: logError } = await supabase
    .from("workout_logs")
    .insert({
      client_id: client.id,
      routine_day_id: input.dayId,
      workout_date: now.slice(0, 10),
      started_at: now,
      finished_at: now,
      energy_level: input.energyLevel,
      client_notes: input.notes || null,
      is_completed: true,
    })
    .select("id")
    .single();

  if (logError || !log) {
    console.error("finishWorkout log insert error:", logError);
    return { error: "No se pudo guardar el entrenamiento." };
  }

  const setRows = input.exercises.flatMap((ex) =>
    ex.sets.map((set, index) => ({
      workout_log_id: log.id,
      routine_exercise_id: ex.routineExerciseId,
      set_number: index + 1,
      weight_kg: set.weightKg,
      reps_completed: set.reps,
      rir_actual: set.rir,
    }))
  );

  if (setRows.length > 0) {
    const { error: setsError } = await supabase
      .from("workout_set_logs")
      .insert(setRows);

    if (setsError) {
      console.error("finishWorkout sets insert error:", setsError);
      return {
        error: "El entrenamiento se guardó pero hubo un error con las series.",
      };
    }
  }

  return { success: true };
}
