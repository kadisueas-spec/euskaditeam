"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { minutesInputToSeconds } from "@/lib/utils/rest-time";

export type TrainingExerciseInput = {
  exerciseId: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  rir: number | null;
  restMinutes: string;
  notes: string | null;
};

export type TrainingDayInput = {
  name: string;
  exercises: TrainingExerciseInput[];
};

export type CreateTrainingRoutineInput = {
  name: string;
  days: TrainingDayInput[];
};

export type CreateTrainingRoutineResult = { success: true; id: string } | { error: string };

// Espejo simplificado de createRoutine (coach/routines/actions.ts): sin
// selector de cliente (client_id queda NULL a propósito, es la rutina
// PROPIA del coach — ver migración 20260716) y sin push (el coach no se
// notifica a sí mismo). Una sola página, no wizard de pasos — es para uso
// personal, no hace falta el ceremonial del creador para clientes.
export async function createTrainingRoutine(
  input: CreateTrainingRoutineInput
): Promise<CreateTrainingRoutineResult> {
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };
  if (input.days.length === 0) return { error: "Agregá al menos un día." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  // Cualquier rutina propia activa anterior se archiva — mismo criterio de
  // "una activa a la vez" que ya rige para las rutinas de clientes.
  await supabase
    .from("routines")
    .update({ is_active: false })
    .eq("coach_id", user.id)
    .is("client_id", null)
    .eq("is_active", true);

  const { data: routine, error: routineError } = await supabase
    .from("routines")
    .insert({
      coach_id: user.id,
      client_id: null,
      name: input.name.trim(),
      is_active: true,
    })
    .select("id")
    .single();

  if (routineError || !routine) {
    console.error("createTrainingRoutine routine insert error:", routineError);
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
      console.error("createTrainingRoutine day insert error:", dayError);
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
        rest_seconds: minutesInputToSeconds(ex.restMinutes),
        coach_notes: ex.notes,
      }))
    );

    if (exercisesError) {
      console.error("createTrainingRoutine exercises insert error:", exercisesError);
      return { error: `No se pudieron guardar los ejercicios del día ${i + 1}.` };
    }
  }

  revalidatePath("/coach/my-training");
  revalidatePath("/coach/profile");

  return { success: true, id: routine.id };
}
