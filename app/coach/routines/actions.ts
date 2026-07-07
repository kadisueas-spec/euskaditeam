"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RoutineExerciseInput = {
  id?: string;
  exerciseId: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  rir: number | null;
  restSeconds: number | null;
  notes: string | null;
};

export type RoutineDayInput = {
  id?: string;
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

export type UpdateRoutineInput = Omit<CreateRoutineInput, "clientId">;

export type UpdateRoutineResult =
  | { success: true; warning?: string }
  | { error: string };

// B1: edita una rutina ya asignada in-place en vez de recrearla. Los días y
// ejercicios que ya existían (traen `id`) se actualizan; los nuevos (sin
// `id`) se insertan; los que el coach sacó del editor se borran — salvo que
// ya tengan entrenamientos registrados (workout_set_logs.routine_exercise_id
// no tiene ON DELETE CASCADE a propósito, es RESTRICT), en cuyo caso el
// borrado falla con FK violation (23503) y simplemente se deja esa fila como
// estaba, avisándole al coach en vez de perder el historial del cliente.
export async function updateRoutine(
  routineId: string,
  input: UpdateRoutineInput
): Promise<UpdateRoutineResult> {
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };
  if (input.days.length === 0) return { error: "Agregá al menos un día." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error: routineError } = await supabase
    .from("routines")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      objective: input.objective.trim() || null,
    })
    .eq("id", routineId)
    .eq("coach_id", user.id);

  if (routineError) {
    console.error("updateRoutine routine update error:", routineError);
    return { error: "No se pudo actualizar la rutina." };
  }

  const { data: existingDaysData } = await supabase
    .from("routine_days")
    .select("id")
    .eq("routine_id", routineId);
  const existingDayIds = new Set((existingDaysData ?? []).map((d) => d.id as string));
  const keptDayIds = new Set(
    input.days.filter((d) => d.id).map((d) => d.id as string)
  );

  let blockedCount = 0;

  for (const removedId of existingDayIds) {
    if (keptDayIds.has(removedId)) continue;
    const { error } = await supabase.from("routine_days").delete().eq("id", removedId);
    if (error) {
      if (error.code !== "23503") {
        console.error("updateRoutine day delete error:", error);
        return { error: "No se pudo eliminar un día de la rutina." };
      }
      blockedCount++;
    }
  }

  for (let i = 0; i < input.days.length; i++) {
    const day = input.days[i];
    let dayId = day.id;

    if (dayId && existingDayIds.has(dayId)) {
      const { error } = await supabase
        .from("routine_days")
        .update({ name: day.name.trim() || `Día ${i + 1}`, day_number: i + 1 })
        .eq("id", dayId);
      if (error) {
        console.error("updateRoutine day update error:", error);
        return { error: `No se pudo actualizar el día ${i + 1}.` };
      }
    } else {
      const { data: newDay, error } = await supabase
        .from("routine_days")
        .insert({
          routine_id: routineId,
          day_number: i + 1,
          name: day.name.trim() || `Día ${i + 1}`,
        })
        .select("id")
        .single();
      if (error || !newDay) {
        console.error("updateRoutine day insert error:", error);
        return { error: `No se pudo guardar el día ${i + 1}.` };
      }
      dayId = newDay.id;
    }

    const { data: existingExercisesData } = await supabase
      .from("routine_exercises")
      .select("id")
      .eq("day_id", dayId);
    const existingExerciseIds = new Set(
      (existingExercisesData ?? []).map((e) => e.id as string)
    );
    const keptExerciseIds = new Set(
      day.exercises.filter((e) => e.id).map((e) => e.id as string)
    );

    for (const removedId of existingExerciseIds) {
      if (keptExerciseIds.has(removedId)) continue;
      const { error } = await supabase
        .from("routine_exercises")
        .delete()
        .eq("id", removedId);
      if (error) {
        if (error.code !== "23503") {
          console.error("updateRoutine exercise delete error:", error);
          return { error: `No se pudo eliminar un ejercicio del día ${i + 1}.` };
        }
        blockedCount++;
      }
    }

    for (let j = 0; j < day.exercises.length; j++) {
      const ex = day.exercises[j];
      const payload = {
        exercise_id: ex.exerciseId,
        order_index: j + 1,
        sets: ex.sets,
        reps_min: ex.repsMin,
        reps_max: ex.repsMax,
        rir_target: ex.rir,
        rest_seconds: ex.restSeconds,
        coach_notes: ex.notes,
      };

      if (ex.id && existingExerciseIds.has(ex.id)) {
        const { error } = await supabase
          .from("routine_exercises")
          .update(payload)
          .eq("id", ex.id);
        if (error) {
          console.error("updateRoutine exercise update error:", error);
          return { error: `No se pudo actualizar un ejercicio del día ${i + 1}.` };
        }
      } else {
        const { error } = await supabase
          .from("routine_exercises")
          .insert({ ...payload, day_id: dayId });
        if (error) {
          console.error("updateRoutine exercise insert error:", error);
          return { error: `No se pudo guardar un ejercicio del día ${i + 1}.` };
        }
      }
    }
  }

  revalidatePath(`/coach/routines/${routineId}`);
  revalidatePath("/client/my-routine");

  if (blockedCount > 0) {
    return {
      success: true,
      warning:
        "Se guardaron los cambios, pero algún día o ejercicio no se pudo eliminar porque ya tiene entrenamientos registrados.",
    };
  }

  return { success: true };
}
