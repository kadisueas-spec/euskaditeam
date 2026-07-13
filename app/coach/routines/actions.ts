"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPushToClient } from "@/lib/push/send-push";
import { NEW_ROUTINE_PUSH_TITLES, pickPushCopy } from "@/lib/constants/push-copy";

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
  durationWeeks: number;
  startsAt: string;
  days: RoutineDayInput[];
};

// Push notifications: mesociclo = duración estandarizada en semanas a
// partir de una fecha de inicio (routines.starts_at/duration_weeks/ends_at
// ya existían en el schema pero no se usaban desde ningún lado). ends_at se
// recalcula siempre server-side, nunca lo manda el cliente.
function computeEndsAt(startsAt: string, durationWeeks: number): string {
  const start = new Date(`${startsAt}T00:00:00Z`);
  const end = new Date(start.getTime() + durationWeeks * 7 * 24 * 60 * 60 * 1000);
  return end.toISOString().slice(0, 10);
}

export type CreateRoutineResult = { success: true; id: string } | { error: string };

export async function createRoutine(
  input: CreateRoutineInput
): Promise<CreateRoutineResult> {
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };
  if (!input.clientId) return { error: "Selecciona un cliente." };
  if (input.days.length === 0) return { error: "Agrega al menos un día." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const durationWeeks = input.durationWeeks > 0 ? input.durationWeeks : 4;
  const startsAt = input.startsAt || new Date().toISOString().slice(0, 10);

  const { data: routine, error: routineError } = await supabase
    .from("routines")
    .insert({
      coach_id: user.id,
      client_id: input.clientId,
      name: input.name.trim(),
      description: input.description.trim() || null,
      objective: input.objective.trim() || null,
      duration_weeks: durationWeeks,
      starts_at: startsAt,
      ends_at: computeEndsAt(startsAt, durationWeeks),
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

  sendPushToClient(input.clientId, {
    title: pickPushCopy(NEW_ROUTINE_PUSH_TITLES),
    body: input.name.trim(),
    url: "/client/my-routine",
  }).catch((error) => {
    console.error("createRoutine push error:", error);
  });

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
  if (input.days.length === 0) return { error: "Agrega al menos un día." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const durationWeeks = input.durationWeeks > 0 ? input.durationWeeks : 4;
  const startsAt = input.startsAt || new Date().toISOString().slice(0, 10);

  const { data: updatedRoutine, error: routineError } = await supabase
    .from("routines")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      objective: input.objective.trim() || null,
      duration_weeks: durationWeeks,
      starts_at: startsAt,
      ends_at: computeEndsAt(startsAt, durationWeeks),
    })
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .select("client_id")
    .single();

  if (routineError || !updatedRoutine) {
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

  if (updatedRoutine.client_id) {
    sendPushToClient(updatedRoutine.client_id, {
      title: pickPushCopy(NEW_ROUTINE_PUSH_TITLES),
      body: input.name.trim(),
      url: "/client/my-routine",
    }).catch((error) => {
      console.error("updateRoutine push error:", error);
    });
  }

  if (blockedCount > 0) {
    return {
      success: true,
      warning:
        "Se guardaron los cambios, pero algún día o ejercicio no se pudo eliminar porque ya tiene entrenamientos registrados.",
    };
  }

  return { success: true };
}

export type DeleteRoutineResult = { success: true } | { error: string };

// Borra la rutina y en cascada sus routine_days/routine_exercises (FK ON
// DELETE CASCADE en el schema). El historial del cliente se preserva: antes
// de borrar, se desvincula workout_set_logs.routine_exercise_id (esa FK no
// tiene ON DELETE, así que si quedara apuntando a un routine_exercise ya
// borrado, el DELETE de la rutina fallaría) — el peso/reps/RIR ya
// registrados viven en columnas propias de workout_set_logs, no dependen de
// routine_exercises, así que desvincular la referencia no pierde datos.
export async function deleteRoutine(routineId: string): Promise<DeleteRoutineResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: dayRows, error: daysError } = await supabase
    .from("routine_days")
    .select("id")
    .eq("routine_id", routineId);

  if (daysError) {
    console.error("deleteRoutine days lookup error:", daysError);
    return { error: "No se pudo eliminar la rutina." };
  }

  const dayIds = (dayRows ?? []).map((d) => d.id as string);

  if (dayIds.length > 0) {
    const { data: exerciseRows, error: exercisesError } = await supabase
      .from("routine_exercises")
      .select("id")
      .in("day_id", dayIds);

    if (exercisesError) {
      console.error("deleteRoutine exercises lookup error:", exercisesError);
      return { error: "No se pudo eliminar la rutina." };
    }

    const exerciseIds = (exerciseRows ?? []).map((e) => e.id as string);

    if (exerciseIds.length > 0) {
      const { error: unlinkError } = await supabase
        .from("workout_set_logs")
        .update({ routine_exercise_id: null })
        .in("routine_exercise_id", exerciseIds);

      if (unlinkError) {
        console.error("deleteRoutine unlink workout_set_logs error:", unlinkError);
        return { error: "No se pudo eliminar la rutina." };
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("routines")
    .delete()
    .eq("id", routineId)
    .eq("coach_id", user.id);

  if (deleteError) {
    console.error("deleteRoutine delete error:", deleteError);
    return { error: "No se pudo eliminar la rutina." };
  }

  revalidatePath("/coach/routines");
  revalidatePath("/client/my-routine");

  return { success: true };
}
