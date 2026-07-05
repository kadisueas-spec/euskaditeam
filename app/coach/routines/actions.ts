"use server";

import { createClient } from "@/lib/supabase/server";

export type RoutineExerciseInput = {
  exerciseId: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  rir: number | null;
  restSeconds: number | null;
  notes: string | null;
};

export type RoutineDayInput = {
  name: string;
  exercises: RoutineExerciseInput[];
};

export type CreateRoutineInput = {
  name: string;
  description: string;
  objective: string;
  clientId: string;
  days: RoutineDayInput[];
};

export type CreateRoutineResult = { success: true; id: string } | { error: string };

export async function createRoutine(
  input: CreateRoutineInput
): Promise<CreateRoutineResult> {
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };
  if (!input.clientId) return { error: "Seleccioná un cliente." };
  if (input.days.length === 0) return { error: "Agregá al menos un día." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: routine, error: routineError } = await supabase
    .from("routines")
    .insert({
      coach_id: user.id,
      client_id: input.clientId,
      name: input.name.trim(),
      description: input.description.trim() || null,
      objective: input.objective.trim() || null,
    })
    .select("id")
    .single();

  if (routineError || !routine) {
    console.error("createRoutine routine insert error:", routineError);
    return { error: "No se pudo crear la rutina." };
  }

  for (let i = 0; i < input.days.length; i++) {
    const day = input.days[i];
    const { data: dayRow, error: dayError } = await supabase
      .from("routine_days")
      .insert({
        routine_id: routine.id,
        day_number: i + 1,
        name: day.name.trim() || `Día ${i + 1}`,
      })
      .select("id")
      .single();

    if (dayError || !dayRow) {
      console.error("createRoutine day insert error:", dayError);
      return { error: `No se pudo guardar el día ${i + 1}.` };
    }

    if (day.exercises.length === 0) continue;

    const { error: exercisesError } = await supabase.from("routine_exercises").insert(
      day.exercises.map((ex, index) => ({
        day_id: dayRow.id,
        exercise_id: ex.exerciseId,
        order_index: index + 1,
        sets: ex.sets,
        reps_min: ex.repsMin,
        reps_max: ex.repsMax,
        rir_target: ex.rir,
        rest_seconds: ex.restSeconds,
        coach_notes: ex.notes,
      }))
    );

    if (exercisesError) {
      console.error("createRoutine exercises insert error:", exercisesError);
      return { error: `No se pudieron guardar los ejercicios del día ${i + 1}.` };
    }
  }

  return { success: true, id: routine.id };
}
