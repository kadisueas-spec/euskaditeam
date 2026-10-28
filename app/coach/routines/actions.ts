"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPushToClient } from "@/lib/push/send-push";
import { NEW_ROUTINE_PUSH_TITLES, pickPushCopy } from "@/lib/constants/push-copy";
import { todayInParaguay } from "@/lib/utils/today";
import { insertRoutineDays, trackingTargetColumns } from "@/lib/supabase/routine-tree";

export type WarmupType =
  | "none"
  | "percentage_with_kg"
  | "percentage_of_max"
  | "fixed_weight";

export type RoutineExerciseInput = {
  id?: string;
  exerciseId: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  rir: number | null;
  restSeconds: number | null;
  notes: string | null;
  weightIncrement: number;
  warmupType: WarmupType;
  warmupFixedWeightKg: number | null;
  // Tipos de registro (oct-2026): isométricos y cardio. Opcionales para
  // que Mi Entrenamiento y otros llamadores sigan igual.
  secondsMin?: number | null;
  secondsMax?: number | null;
  minutesTarget?: number | null;
  intensityTarget?: number | null;
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
  mesocicloNombre: string;
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
  if (!input.mesocicloNombre.trim()) return { error: "El nombre del mesociclo es obligatorio." };
  if (!input.clientId) return { error: "Selecciona un cliente." };
  if (input.days.length === 0) return { error: "Agrega al menos un día." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const durationWeeks = input.durationWeeks > 0 ? input.durationWeeks : 4;
  const startsAt = input.startsAt || todayInParaguay();

  // Sistema de mesociclos (jul-2026): archivar la rutina activa actual del
  // cliente ANTES de insertar la nueva — obligatorio, no solo prolijo,
  // desde que existe el constraint routines_one_active_per_client (índice
  // único parcial en client_id where is_active). Sin esto, el insert de
  // abajo violaría ese constraint para cualquier cliente que ya tenga una
  // rutina activa. ends_at = hoy marca la fecha real de archivado (antes
  // era solo la fecha planeada de fin del mesociclo).
  const { error: archiveError } = await supabase
    .from("routines")
    .update({ is_active: false, ends_at: todayInParaguay() })
    .eq("client_id", input.clientId)
    .eq("is_active", true);

  if (archiveError) {
    console.error("createRoutine archive previous routine error:", archiveError);
    return { error: "No se pudo archivar la rutina anterior." };
  }

  const { data: routine, error: routineError } = await supabase
    .from("routines")
    .insert({
      coach_id: user.id,
      client_id: input.clientId,
      name: input.name.trim(),
      description: input.description.trim() || null,
      objective: input.objective.trim() || null,
      mesociclo_nombre: input.mesocicloNombre.trim(),
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

  const daysError = await insertRoutineDays(supabase, routine.id, input.days);
  if (daysError) return { error: daysError };

  revalidatePath(`/coach/clients/${input.clientId}`);

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

  // Plantillas (oct-2026): el mismo editor edita plantillas. Una plantilla
  // no lleva mesociclo ni fecha de inicio (el CHECK routines_template_shape
  // rechaza starts_at no nulo), así que esos campos ni se validan ni se
  // escriben.
  const { data: current } = await supabase
    .from("routines")
    .select("is_template")
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .maybeSingle();
  const isTemplate = current?.is_template === true;

  if (!isTemplate && !input.mesocicloNombre.trim())
    return { error: "El nombre del mesociclo es obligatorio." };

  const durationWeeks = input.durationWeeks > 0 ? input.durationWeeks : 4;
  const startsAt = input.startsAt || todayInParaguay();

  // Sistema de mesociclos (jul-2026): a diferencia de createRoutine, ACÁ no
  // se recalcula ends_at a partir de duration_weeks/starts_at en cada
  // guardado — desde que existe "Extender mesociclo" (ver extendMesociclo
  // más abajo), ends_at pasa a ser un campo que el coach controla aparte;
  // recalcularlo acá pisaría cualquier extensión hecha después de crear la
  // rutina cada vez que el coach edite cualquier otra cosa del editor
  // normal.
  const { data: updatedRoutine, error: routineError } = await supabase
    .from("routines")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      objective: input.objective.trim() || null,
      duration_weeks: durationWeeks,
      ...(isTemplate
        ? {}
        : { mesociclo_nombre: input.mesocicloNombre.trim(), starts_at: startsAt }),
    })
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .select("client_id")
    .single();

  if (routineError || !updatedRoutine) {
    console.error("updateRoutine routine update error:", routineError);
    return { error: "No se pudo actualizar la rutina." };
  }

  // Editor con drag & drop (oct-2026): un ejercicio puede pasar de un día a
  // otro. Antes los ejercicios existentes se buscaban DÍA POR DÍA, así que
  // uno movido a otro día se tomaba como nuevo (insert con otro id) y el
  // original se intentaba borrar — si ya tenía series registradas, el
  // borrado fallaba y quedaba duplicado, y en cualquier caso el historial
  // quedaba colgando del id viejo. Ahora se miran todos los ejercicios de
  // la rutina juntos y un movido se actualiza (day_id incluido),
  // conservando su id y su historial.
  //
  // Orden: primero se guardan/mueven días y ejercicios, recién después se
  // borra lo que el coach sacó — si se borrara antes un día, el ON DELETE
  // CASCADE se llevaría los ejercicios que se movieron fuera de él.
  const { data: existingDaysData } = await supabase
    .from("routine_days")
    .select("id")
    .eq("routine_id", routineId);
  const existingDayIds = new Set((existingDaysData ?? []).map((d) => d.id as string));
  const keptDayIds = new Set(
    input.days.filter((d) => d.id && existingDayIds.has(d.id)).map((d) => d.id as string)
  );

  const { data: existingExercisesData } =
    existingDayIds.size > 0
      ? await supabase
          .from("routine_exercises")
          .select("id")
          .in("day_id", [...existingDayIds])
      : { data: [] as { id: string }[] };
  const existingExerciseIds = new Set(
    (existingExercisesData ?? []).map((e) => e.id as string)
  );
  const keptExerciseIds = new Set(
    input.days
      .flatMap((d) => d.exercises)
      .filter((e) => e.id && existingExerciseIds.has(e.id))
      .map((e) => e.id as string)
  );

  let blockedCount = 0;

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

    for (let j = 0; j < day.exercises.length; j++) {
      const ex = day.exercises[j];
      const payload = {
        day_id: dayId,
        exercise_id: ex.exerciseId,
        order_index: j + 1,
        sets: ex.sets,
        reps_min: ex.repsMin,
        reps_max: ex.repsMax,
        rir_target: ex.rir,
        rest_seconds: ex.restSeconds,
        coach_notes: ex.notes,
        weight_increment: ex.weightIncrement,
        warmup_type: ex.warmupType,
        warmup_fixed_weight_kg: ex.warmupFixedWeightKg,
        ...trackingTargetColumns(ex),
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
        const { error } = await supabase.from("routine_exercises").insert(payload);
        if (error) {
          console.error("updateRoutine exercise insert error:", error);
          return { error: `No se pudo guardar un ejercicio del día ${i + 1}.` };
        }
      }
    }
  }

  for (const removedId of existingExerciseIds) {
    if (keptExerciseIds.has(removedId)) continue;
    const { error } = await supabase.from("routine_exercises").delete().eq("id", removedId);
    if (error) {
      if (error.code !== "23503") {
        console.error("updateRoutine exercise delete error:", error);
        return { error: "No se pudo eliminar un ejercicio de la rutina." };
      }
      blockedCount++;
    }
  }

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

  revalidatePath(`/coach/routines/${routineId}`);
  revalidatePath("/coach/routines");
  revalidatePath("/client/my-routine");
  revalidatePath("/client/home");
  if (updatedRoutine.client_id) revalidatePath(`/coach/clients/${updatedRoutine.client_id}`);

  // Edición silenciosa (oct-2026): editar una rutina ya asignada aplica los
  // cambios al instante y SIN push al cliente — antes se mandaba "Tu nueva
  // rutina está lista" en cada guardado, aunque fuera para corregir una
  // nota. La push de rutina nueva queda solo en createRoutine (asignar un
  // bloque/mesociclo nuevo).

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

export type ExtendMesocicloResult = { success: true } | { error: string };

// Sistema de mesociclos (jul-2026): "Extender mesociclo" es intencionalmente
// la única acción de la app que toca ends_at después de que la rutina ya
// existe — sin archivar nada, sin crear una rutina nueva, sin tocar
// is_active/mesociclo_nombre/starts_at. newEndsAt en null = "sin fecha de
// fin" (indefinido).
export async function extendMesociclo(
  routineId: string,
  newEndsAt: string | null
): Promise<ExtendMesocicloResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: updated, error } = await supabase
    .from("routines")
    .update({ ends_at: newEndsAt })
    .eq("id", routineId)
    .eq("coach_id", user.id)
    .select("client_id")
    .single();

  if (error || !updated) {
    console.error("extendMesociclo error:", error);
    return { error: "No se pudo actualizar la fecha de fin del mesociclo." };
  }

  if (updated.client_id) {
    revalidatePath(`/coach/clients/${updated.client_id}`);
  }

  return { success: true };
}
