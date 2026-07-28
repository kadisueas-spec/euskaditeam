"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord, type ClientRecord } from "@/lib/supabase/client-profile";
import { getClientStats } from "@/lib/supabase/stats";
import { sendPushToCoach } from "@/lib/push/send-push";
import { adherence80PushTitle } from "@/lib/constants/push-copy";
import { validateSetInput } from "@/lib/utils/validate-set-input";
import { mondayKeyFor, previousMondayKey, addWeeks } from "@/lib/utils/week";
import { EDIT_WINDOW_DAYS, daysAgo } from "@/lib/utils/edit-window";
import {
  bestSetByExercise,
  detectWeeklyRecord,
  summarizeSessionRecords,
  type SessionRecord,
  type SetLogWithExerciseRow,
} from "@/lib/utils/session-records";

export type LoggedSet = {
  id: string;
  routineExerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
};

export type InProgressWorkout = {
  workoutLogId: string;
  loggedSets: LoggedSet[];
};

export type PlannedSetCount = { routineExerciseId: string; sets: number };

// A1: cada serie se guarda en el servidor apenas se completa (no se espera
// a "Finalizar"), en un workout_log con is_completed=false. Si el cliente
// cierra la app y vuelve, esta función encuentra ese mismo registro en
// curso (por client+día+fecha) en vez de crear uno nuevo, y devuelve todas
// las series ya guardadas para reconstruir dónde había quedado.
//
// Bug jul-2026 (reportado por Luis): la búsqueda de "en curso" filtraba
// is_completed=false. Si una clienta finalizaba por error (con un
// ejercicio salteado) y volvía a entrar a ESE MISMO día, esta función no
// encontraba el log ya completado y creaba uno nuevo desde cero — perdía
// todas las series ya cargadas, sin ningún aviso. Ahora la búsqueda ya no
// filtra por is_completed: si existe un log de hoy para este client+día
// (completado o no), se reusa ese mismo en vez de crear uno nuevo —
// consistente con la restricción única que se agrega en la migración de la
// BD (un solo workout_log por client+routine_day+fecha).
//
// `plannedSets` (opcional, lo manda WorkoutLogger con lo que ya tiene de
// `day.exercises`) es la clave de por qué esto es seguro: si el log
// encontrado ya estaba completado PERO le faltan series respecto de lo
// planificado, se reabre (is_completed vuelve a false) para que el
// cliente pueda seguir cargando. Si ya tiene TODAS las series
// planificadas, se deja tal cual — no lo "desfinaliza" solo porque el
// cliente volvió a entrar a esa pantalla a mirar o por error de tap.
export async function getOrCreateInProgressWorkout(
  dayId: string,
  plannedSets?: PlannedSetCount[]
): Promise<InProgressWorkout | { error: string }> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("workout_logs")
    .select("id, is_completed")
    .eq("client_id", client.id)
    .eq("routine_day_id", dayId)
    .eq("workout_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let workoutLogId = existing?.id as string | undefined;

  if (!workoutLogId) {
    const { data: created, error } = await supabase
      .from("workout_logs")
      .insert({
        client_id: client.id,
        routine_day_id: dayId,
        workout_date: today,
        started_at: new Date().toISOString(),
        is_completed: false,
      })
      .select("id")
      .single();

    if (error || !created) {
      console.error("getOrCreateInProgressWorkout insert error:", error);
      return { error: "No se pudo iniciar el entrenamiento." };
    }
    workoutLogId = created.id;
  }

  const { data: sets } = await supabase
    .from("workout_set_logs")
    .select("id, routine_exercise_id, set_number, weight_kg, reps_completed, rir_actual")
    .eq("workout_log_id", workoutLogId)
    .order("set_number", { ascending: true });

  const loggedSets: LoggedSet[] = (sets ?? []).map((s) => ({
    id: s.id,
    routineExerciseId: s.routine_exercise_id ?? "",
    setNumber: s.set_number,
    weightKg: s.weight_kg,
    reps: s.reps_completed,
    rir: s.rir_actual,
  }));

  if (existing?.is_completed && plannedSets) {
    const countByExercise = new Map<string, number>();
    for (const s of loggedSets) {
      countByExercise.set(
        s.routineExerciseId,
        (countByExercise.get(s.routineExerciseId) ?? 0) + 1
      );
    }
    const isIncomplete = plannedSets.some(
      (p) => (countByExercise.get(p.routineExerciseId) ?? 0) < p.sets
    );
    if (isIncomplete) {
      const { error: reopenError } = await supabase
        .from("workout_logs")
        .update({ is_completed: false, finished_at: null })
        .eq("id", workoutLogId);
      if (reopenError) {
        console.error("getOrCreateInProgressWorkout reopen error:", reopenError);
      }
    }
  }

  return { workoutLogId: workoutLogId as string, loggedSets };
}

export type AddSetInput = {
  workoutLogId: string;
  routineExerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
};

export type AddSetResult =
  | { success: true; id: string; isPersonalRecord: boolean }
  | { error: string };

type PriorMaxWeightRow = { weight_kg: number | null };

// Bloque 2 (jul-2026): ¿esta serie es un récord personal? Compara contra el
// máximo histórico de ESE EJERCICIO (no de esta rutina puntual, ni de esta
// routine_exercise puntual) para este cliente, en cualquier sesión pasada.
// Se calcula ANTES del insert para no comparar la serie contra sí misma.
async function checkPersonalRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  routineExerciseId: string,
  weightKg: number | null
): Promise<boolean> {
  if (weightKg == null) return false;

  const { data: routineExercise } = await supabase
    .from("routine_exercises")
    .select("exercise_id")
    .eq("id", routineExerciseId)
    .single();
  if (!routineExercise?.exercise_id) return false;

  const { data: priorSets } = await supabase
    .from("workout_set_logs")
    .select(
      "weight_kg, routine_exercises!inner(exercise_id), workout_logs!inner(client_id)"
    )
    .eq("routine_exercises.exercise_id", routineExercise.exercise_id)
    .eq("workout_logs.client_id", clientId)
    .order("weight_kg", { ascending: false })
    .limit(1)
    .returns<PriorMaxWeightRow[]>();

  const priorMax = priorSets?.[0]?.weight_kg ?? null;
  return priorMax == null || weightKg > priorMax;
}

export async function addSet(input: AddSetInput): Promise<AddSetResult> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const validationError = validateSetInput(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();

  const isPersonalRecord = await checkPersonalRecord(
    supabase,
    client.id,
    input.routineExerciseId,
    input.weightKg
  );

  const { data, error } = await supabase
    .from("workout_set_logs")
    .insert({
      workout_log_id: input.workoutLogId,
      routine_exercise_id: input.routineExerciseId,
      set_number: input.setNumber,
      weight_kg: input.weightKg,
      reps_completed: input.reps,
      rir_actual: input.rir,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("addSet error:", error);
    return { error: "No se pudo guardar la serie." };
  }

  return { success: true, id: data.id, isPersonalRecord };
}

export type UpdateSetInput = {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
};

type SetOwnershipRow = {
  routine_exercise_id: string | null;
  workout_logs: { client_id: string | null; workout_date: string } | null;
};

// A4 / B2 (jul-2026): permite corregir una serie ya guardada, dentro del
// entrenamiento en curso o de una sesión pasada (desde el historial en
// Progreso) — con el mismo límite de 7 días que agregar/eliminar series de
// una sesión pasada, así que hace falta el mismo chequeo de dueño+fecha
// antes de tocar nada (el entrenamiento en curso siempre está dentro de la
// ventana, así que esto no cambia nada para ese flujo). También recalcula
// isPersonalRecord: corregir un peso puede convertir (o dejar de ser) un
// récord histórico.
export async function updateSet(
  setId: string,
  patch: UpdateSetInput
): Promise<{ success: true; isPersonalRecord: boolean } | { error: string }> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const validationError = validateSetInput(patch);
  if (validationError) return { error: validationError };

  const supabase = await createClient();

  const { data: set } = await supabase
    .from("workout_set_logs")
    .select("routine_exercise_id, workout_logs!inner(client_id, workout_date)")
    .eq("id", setId)
    .eq("workout_logs.client_id", client.id)
    .maybeSingle()
    .returns<SetOwnershipRow>();

  if (!set?.workout_logs) return { error: "Serie no encontrada." };
  if (daysAgo(set.workout_logs.workout_date) > EDIT_WINDOW_DAYS) {
    return { error: `Solo se pueden editar sesiones de los últimos ${EDIT_WINDOW_DAYS} días.` };
  }

  const isPersonalRecord = set.routine_exercise_id
    ? await checkPersonalRecord(supabase, client.id, set.routine_exercise_id, patch.weightKg)
    : false;

  const { error } = await supabase
    .from("workout_set_logs")
    .update({
      weight_kg: patch.weightKg,
      reps_completed: patch.reps,
      rir_actual: patch.rir,
    })
    .eq("id", setId);

  if (error) {
    console.error("updateSet error:", error);
    return { error: "No se pudo actualizar la serie." };
  }

  return { success: true, isPersonalRecord };
}

export type EditPastSessionResult =
  | {
      success: true;
      id: string;
      isPersonalRecord: boolean;
      weeklyCelebration?: WeeklyCelebrationSummary;
    }
  | { error: string };

// B2 (jul-2026): agregar una serie a una sesión YA FINALIZADA — el caso
// concreto es completar un ejercicio salteado que quedó con guiones en el
// historial. Mismo chequeo de dueño+ventana que updateSet/deleteSet. Si
// esta serie deja completa la semana en curso, dispara la celebración
// semanal acá mismo — finishWorkout no vuelve a correr en este flujo, así
// que es el único lugar donde ese chequeo puede pasar para una edición
// retroactiva.
export async function addSetToPastLog(input: AddSetInput): Promise<EditPastSessionResult> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const validationError = validateSetInput(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();

  const { data: log } = await supabase
    .from("workout_logs")
    .select("id, workout_date")
    .eq("id", input.workoutLogId)
    .eq("client_id", client.id)
    .maybeSingle();

  if (!log) return { error: "Entrenamiento no encontrado." };
  if (daysAgo(log.workout_date) > EDIT_WINDOW_DAYS) {
    return { error: `Solo se pueden editar sesiones de los últimos ${EDIT_WINDOW_DAYS} días.` };
  }

  const isPersonalRecord = await checkPersonalRecord(
    supabase,
    client.id,
    input.routineExerciseId,
    input.weightKg
  );

  const { data, error } = await supabase
    .from("workout_set_logs")
    .insert({
      workout_log_id: input.workoutLogId,
      routine_exercise_id: input.routineExerciseId,
      set_number: input.setNumber,
      weight_kg: input.weightKg,
      reps_completed: input.reps,
      rir_actual: input.rir,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("addSetToPastLog error:", error);
    return { error: "No se pudo guardar la serie." };
  }

  let weeklyCelebration: WeeklyCelebrationSummary | undefined;
  try {
    const { data: activeRoutine } = await supabase
      .from("routines")
      .select("id, routine_days(count)")
      .eq("client_id", client.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<{ id: string; routine_days: { count: number }[] } | null>();

    weeklyCelebration =
      (await checkWeeklyCompletion({
        supabase,
        client,
        workoutDate: log.workout_date,
        plannedDays: activeRoutine?.routine_days[0]?.count ?? 0,
      })) ?? undefined;
  } catch (err) {
    console.error("addSetToPastLog weekly celebration error:", err);
  }

  return { success: true, id: data.id, isPersonalRecord, weeklyCelebration };
}

// B2 (jul-2026): borrar una serie cargada por error, desde el historial de
// una sesión pasada. Mismo chequeo de dueño+ventana.
export async function deleteSet(setId: string): Promise<{ success: true } | { error: string }> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const supabase = await createClient();

  const { data: set } = await supabase
    .from("workout_set_logs")
    .select("id, workout_logs!inner(client_id, workout_date)")
    .eq("id", setId)
    .eq("workout_logs.client_id", client.id)
    .maybeSingle()
    .returns<SetOwnershipRow>();

  if (!set?.workout_logs) return { error: "Serie no encontrada." };
  if (daysAgo(set.workout_logs.workout_date) > EDIT_WINDOW_DAYS) {
    return { error: `Solo se pueden editar sesiones de los últimos ${EDIT_WINDOW_DAYS} días.` };
  }

  const { error } = await supabase.from("workout_set_logs").delete().eq("id", setId);
  if (error) {
    console.error("deleteSet error:", error);
    return { error: "No se pudo eliminar la serie." };
  }

  return { success: true };
}

export type FinishWorkoutInput = {
  workoutLogId: string;
  energyLevel: number;
  notes: string;
};

export type WorkoutSummary = {
  totalSets: number;
  totalVolume: number;
  durationMinutes: number;
};

export type WeeklyCelebrationSummary = {
  completedDays: number;
  plannedDays: number;
  totalSets: number;
  totalVolume: number;
  weeklyStreak: number;
  isFirstCompleteWeek: boolean;
  records: SessionRecord[];
};

export type FinishWorkoutResult =
  | { success: true; summary: WorkoutSummary; weeklyCelebration?: WeeklyCelebrationSummary }
  | { error: string };

// Push al coach cuando el cliente CRUZA el 80% de adherencia del mes (no
// cuando ya está arriba de 80%, para no repetir el aviso en cada sesión
// posterior). Compara la adherencia antes/después de esta sesión usando
// fechas distintas entrenadas, igual que getClientStats() en stats.ts.
async function notifyCoachIfAdherenceCrossed80({
  client,
  workoutDate,
  monthLogDates,
  plannedDaysPerWeek,
  now,
}: {
  client: ClientRecord;
  workoutDate: string | undefined;
  monthLogDates: string[];
  plannedDaysPerWeek: number;
  now: Date;
}): Promise<void> {
  if (!client.coachId || !workoutDate || plannedDaysPerWeek <= 0) return;

  const weeksElapsedThisMonth = Math.ceil(now.getUTCDate() / 7);
  const plannedTotal = plannedDaysPerWeek * weeksElapsedThisMonth;
  if (plannedTotal <= 0) return;

  const beforeDates = new Set(monthLogDates);
  const beforePercent = (beforeDates.size / plannedTotal) * 100;
  if (beforePercent >= 80) return;

  const afterDates = new Set(beforeDates).add(workoutDate);
  const afterPercent = (afterDates.size / plannedTotal) * 100;
  if (afterPercent < 80) return;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", client.userId)
    .single();
  const clientName = profile?.full_name ?? profile?.email ?? "Tu cliente";

  await sendPushToCoach(client.coachId, {
    title: adherence80PushTitle(clientName),
    body: "Revisa su progreso en tu panel.",
    url: `/coach/clients/${client.id}`,
  });
}

// Sistema de celebración semanal (jul-2026): al finalizar una sesión, si
// esa sesión completó todos los días planificados de la semana calendario
// en curso (lunes a domingo) Y esa semana no fue celebrada todavía,
// devuelve el resumen para mostrar la celebración de pantalla completa.
// El insert en weekly_celebrations hace de lock: si ya existe una fila
// para (client_id, week_start) el insert falla con 23505 y no se repite.
async function checkWeeklyCompletion({
  supabase,
  client,
  workoutDate,
  plannedDays,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  client: ClientRecord;
  workoutDate: string | undefined;
  plannedDays: number;
}): Promise<WeeklyCelebrationSummary | null> {
  if (!workoutDate || plannedDays <= 0) return null;

  const weekStart = mondayKeyFor(workoutDate);
  const weekEnd = addWeeks(weekStart, 1);
  const prevWeekStart = previousMondayKey(weekStart);

  const { data: weekLogs } = await supabase
    .from("workout_logs")
    .select("workout_date")
    .eq("client_id", client.id)
    .eq("is_completed", true)
    .gte("workout_date", weekStart)
    .lt("workout_date", weekEnd);

  const completedDays = new Set((weekLogs ?? []).map((l) => l.workout_date)).size;
  if (completedDays < plannedDays) return null;

  const { error: insertError } = await supabase
    .from("weekly_celebrations")
    .insert({ client_id: client.id, week_start: weekStart });
  if (insertError) {
    if (insertError.code === "23505") return null; // ya celebrada
    throw insertError;
  }

  const [{ count: priorCount }, { data: setRows }, stats] = await Promise.all([
    supabase
      .from("weekly_celebrations")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id),
    supabase
      .from("workout_set_logs")
      .select(
        `routine_exercise_id, weight_kg, reps_completed, rir_actual,
         workout_logs!inner ( workout_date, is_completed, client_id ),
         routine_exercises!inner ( exercises ( name ) )`
      )
      .eq("workout_logs.client_id", client.id)
      .eq("workout_logs.is_completed", true)
      .gte("workout_logs.workout_date", prevWeekStart)
      .lt("workout_logs.workout_date", weekEnd)
      .returns<SetLogWithExerciseRow[]>(),
    getClientStats(),
  ]);

  const rows = setRows ?? [];
  const thisWeekRows = rows.filter(
    (r) => r.workout_logs && r.workout_logs.workout_date >= weekStart
  );
  const prevWeekRows = rows.filter(
    (r) => r.workout_logs && r.workout_logs.workout_date < weekStart
  );
  const thisWeekBest = bestSetByExercise(thisWeekRows);
  const prevWeekBest = bestSetByExercise(prevWeekRows);

  const records: SessionRecord[] = [];
  for (const [routineExerciseId, row] of thisWeekBest) {
    const prev = prevWeekBest.get(routineExerciseId);
    if (!prev || prev.weight_kg == null || prev.reps_completed == null) continue;
    const weeklyRecord = detectWeeklyRecord(
      { weight: prev.weight_kg, reps: prev.reps_completed, rir: prev.rir_actual },
      { weight: row.weight_kg, reps: row.reps_completed, rir: row.rir_actual }
    );
    if (!weeklyRecord) continue;
    records.push({
      id: crypto.randomUUID(),
      exerciseId: routineExerciseId,
      exerciseName: row.routine_exercises?.exercises?.name ?? "Ejercicio",
      weight: row.weight_kg as number,
      reps: row.reps_completed,
      rir: row.rir_actual,
      ...weeklyRecord,
    });
  }

  const totalVolume = thisWeekRows.reduce(
    (sum, r) => sum + (r.weight_kg != null && r.reps_completed != null ? r.weight_kg * r.reps_completed : 0),
    0
  );

  return {
    completedDays,
    plannedDays,
    totalSets: thisWeekRows.length,
    totalVolume: Math.round(totalVolume),
    weeklyStreak: stats.weeklyStreak,
    isFirstCompleteWeek: priorCount === 1,
    records: summarizeSessionRecords(records),
  };
}

// Las series ya están guardadas (una por una, ver addSet). Acá solo se
// marca el entrenamiento como completo con el feeling/notas finales.
export async function finishWorkout(
  input: FinishWorkoutInput
): Promise<FinishWorkoutResult> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const supabase = await createClient();
  const now = new Date();
  const monthPrefix = now.toISOString().slice(0, 7);

  const [{ data: workoutLog }, { data: monthLogs }, { data: activeRoutine }, { data: sets }] =
    await Promise.all([
      supabase
        .from("workout_logs")
        .select("workout_date, started_at")
        .eq("id", input.workoutLogId)
        .single(),
      supabase
        .from("workout_logs")
        .select("workout_date")
        .eq("client_id", client.id)
        .eq("is_completed", true)
        .gte("workout_date", `${monthPrefix}-01`),
      supabase
        .from("routines")
        .select("id, routine_days(count)")
        .eq("client_id", client.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .returns<{ id: string; routine_days: { count: number }[] } | null>(),
      supabase
        .from("workout_set_logs")
        .select("weight_kg, reps_completed")
        .eq("workout_log_id", input.workoutLogId),
    ]);

  const finishedAt = now.toISOString();

  const { error } = await supabase
    .from("workout_logs")
    .update({
      is_completed: true,
      finished_at: finishedAt,
      energy_level: input.energyLevel,
      client_notes: input.notes || null,
    })
    .eq("id", input.workoutLogId);

  if (error) {
    console.error("finishWorkout error:", error);
    return { error: "No se pudo finalizar el entrenamiento." };
  }

  notifyCoachIfAdherenceCrossed80({
    client,
    workoutDate: workoutLog?.workout_date,
    monthLogDates: (monthLogs ?? []).map((l) => l.workout_date),
    plannedDaysPerWeek: activeRoutine?.routine_days[0]?.count ?? 0,
    now,
  }).catch((err) => console.error("finishWorkout adherence push error:", err));

  const totalVolume = (sets ?? []).reduce(
    (sum, s) => sum + (s.weight_kg != null && s.reps_completed != null ? s.weight_kg * s.reps_completed : 0),
    0
  );
  const durationMinutes = workoutLog?.started_at
    ? Math.max(1, Math.round((new Date(finishedAt).getTime() - new Date(workoutLog.started_at).getTime()) / 60000))
    : 0;

  const summary: WorkoutSummary = {
    totalSets: (sets ?? []).length,
    totalVolume: Math.round(totalVolume),
    durationMinutes,
  };

  // Nunca debe tumbar el "sí, se guardó tu entrenamiento" — si esto falla,
  // simplemente no aparece la celebración semanal esta vez.
  let weeklyCelebration: WeeklyCelebrationSummary | undefined;
  try {
    weeklyCelebration =
      (await checkWeeklyCompletion({
        supabase,
        client,
        workoutDate: workoutLog?.workout_date,
        plannedDays: activeRoutine?.routine_days[0]?.count ?? 0,
      })) ?? undefined;
  } catch (err) {
    console.error("finishWorkout weekly celebration error:", err);
  }

  return { success: true, summary, weeklyCelebration };
}

export type WorkoutSuggestion = {
  weight: number | null;
  reps: number | null;
  rir: number | null;
  progressionCase: "weight_increase" | "reps_increase" | null;
  // Récord CRUDO de la sesión de referencia (mayor peso, empate -> más
  // reps), sin el ajuste del algoritmo de progresión — a diferencia de
  // weight/reps de arriba, que ya vienen proyectados hacia adelante.
  // Sistema de celebración de récords (jul-2026) lo usa como base de
  // comparación real para detectar si la serie recién cargada superó esa
  // referencia, sin repetir la consulta acá.
  previousRecord: { weight: number; reps: number; rir: number | null } | null;
  // Bug jul-2026: hace cuántas semanas fue la sesión de referencia (1 =
  // la semana pasada, 2 = hace dos semanas, ...). null si no hay ninguna
  // referencia dentro de las últimas 8 semanas. El cliente usa esto para
  // avisar cuándo el dato no es fresco ("Tu última vez con este
  // ejercicio, hace X semanas").
  weeksAgo: number | null;
};

type SetLogRow = {
  routine_exercise_id: string | null;
  weight_kg: number | null;
  reps_completed: number | null;
  rir_actual: number | null;
  workout_logs: { workout_date: string; is_completed: boolean } | null;
};

type RoutineExerciseRangeRow = {
  id: string;
  reps_min: number | null;
  reps_max: number | null;
  weight_increment: number;
};

// Bug jul-2026: si el cliente se salteó una semana entera de un ejercicio
// (semana 2 sin entrenarlo), la sugerencia quedaba vacía en la semana 3
// aunque hubiera datos de la semana 1. `lastWeekRange` (ventana fija de
// una sola semana) queda reemplazada por esta búsqueda hacia atrás.
//
// Cuántas semanas de calendario (lunes a domingo, UTC) hace que empezó la
// semana que contiene `dateStr`, respecto de "hoy" — 1 = la semana pasada,
// 2 = hace dos semanas, etc. Nunca cuenta la semana en curso (por diseño:
// la ventana de búsqueda siempre termina el domingo pasado, ver
// MAX_SUGGESTION_WEEKS_BACK más abajo).
function weeksAgoForDate(now: Date, dateStr: string): number {
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const thisMonday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday);
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const diffDays = Math.round((thisMonday - target) / 86400000);
  return Math.ceil(diffDays / 7);
}

// Lunes de "hace N semanas" (UTC) — límites de la ventana de búsqueda.
function mondayWeeksAgo(now: Date, weeksAgo: number): string {
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday - 7 * weeksAgo)
  );
  return monday.toISOString().slice(0, 10);
}

// Tope de la búsqueda hacia atrás: si hace más de esto que el cliente no
// hace este ejercicio, el dato ya no es representativo de su estado
// actual y no se sugiere nada (mejor que una sugerencia vieja y engañosa).
const MAX_SUGGESTION_WEEKS_BACK = 8;
// A partir de esta cantidad de semanas sin hacer el ejercicio, no
// corresponde subir la carga — se sugiere repetir el mismo peso/reps de
// la última vez, no proyectar progresión sobre una pausa larga.
const PROGRESSION_STALE_WEEKS = 4;

// Reescrito desde cero (jul-2026, 3er intento de la versión original, 4to
// contando este fix): el problema de los intentos anteriores era 100% de
// timing en el cliente (ver historial en workout-logger.tsx); ESTE fix es
// distinto — no es de timing, es de ventana: antes solo miraba la semana
// calendario anterior, así que un ejercicio salteado una sola semana
// dejaba la sugerencia vacía aunque hubiera datos recientes de 2+ semanas
// atrás. Ahora busca semana por semana hacia atrás (hasta
// MAX_SUGGESTION_WEEKS_BACK) la semana más reciente con datos de ESE
// ejercicio, y arma la sugerencia sobre esa referencia. Devuelve un
// objeto plano { [routineExerciseId]: sugerencia } en vez de un array —
// más simple de consumir del lado del cliente, sin re-armar un Map ahí.
//
// Sin filtro explícito de client_id a propósito: se apoya 100% en RLS,
// igual que la función que reemplaza — así el entrenamiento propio del
// coach (app/coach/my-training/log-workout) puede seguir reusando esta
// misma función tal cual, sin necesitar una variante coach-scoped (sus
// workout_logs usan coach_id, no client_id, así que filtrar por client_id
// acá rompería ese reuso).
//
// Algoritmo de progresión (jul-2026, sin cambios en la lógica en sí,
// ver Bug 4 más abajo para la excepción de pausa larga):
// - Si las reps del récord de referencia llegaron al techo del rango
//   (reps_max): subir weight_increment kg y volver al piso (reps_min).
// - Si quedaron dentro del rango (o por debajo de reps_min): mismo peso,
//   +1 rep.
// - Excepción (Bug 4): si la referencia tiene PROGRESSION_STALE_WEEKS
//   semanas o más, no se aplica ninguna de las dos — se sugiere repetir
//   exactamente el peso/reps de esa sesión, sin progresión hacia arriba.
// El RIR sugerido siempre es el de la referencia, sin cambios.
export async function getWorkoutSuggestions(
  routineExerciseIds: string[]
): Promise<Record<string, WorkoutSuggestion>> {
  if (routineExerciseIds.length === 0) return {};

  const supabase = await createClient();
  const now = new Date();
  const from = mondayWeeksAgo(now, MAX_SUGGESTION_WEEKS_BACK);
  const to = mondayWeeksAgo(now, 0); // lunes de esta semana, exclusivo más abajo (lte usaría el domingo pasado)
  const lastSunday = new Date(`${to}T00:00:00Z`);
  lastSunday.setUTCDate(lastSunday.getUTCDate() - 1);
  const toInclusive = lastSunday.toISOString().slice(0, 10);

  const [{ data }, { data: ranges }] = await Promise.all([
    supabase
      .from("workout_set_logs")
      .select(
        `routine_exercise_id, weight_kg, reps_completed, rir_actual,
         workout_logs!inner ( workout_date, is_completed )`
      )
      .in("routine_exercise_id", routineExerciseIds)
      .eq("workout_logs.is_completed", true)
      .gte("workout_logs.workout_date", from)
      .lte("workout_logs.workout_date", toInclusive)
      .returns<SetLogRow[]>(),
    supabase
      .from("routine_exercises")
      .select("id, reps_min, reps_max, weight_increment")
      .in("id", routineExerciseIds)
      .returns<RoutineExerciseRangeRow[]>(),
  ]);

  // Por ejercicio: la semana más reciente (menor weeksAgo) que tiene datos,
  // y dentro de esa semana la serie de mayor peso (empate -> más reps).
  const bestByExercise = new Map<string, SetLogRow & { weeksAgo: number }>();
  for (const row of data ?? []) {
    if (!row.routine_exercise_id || !row.workout_logs) continue;
    const rowWeeksAgo = weeksAgoForDate(now, row.workout_logs.workout_date);
    if (rowWeeksAgo < 1 || rowWeeksAgo > MAX_SUGGESTION_WEEKS_BACK) continue;

    const current = bestByExercise.get(row.routine_exercise_id);
    if (!current || rowWeeksAgo < current.weeksAgo) {
      // Semana más reciente que la que teníamos: arranca de cero la
      // comparación de "mejor serie" para esta semana nueva.
      bestByExercise.set(row.routine_exercise_id, { ...row, weeksAgo: rowWeeksAgo });
      continue;
    }
    if (rowWeeksAgo > current.weeksAgo) continue; // semana más vieja, ya tenemos una mejor

    const weight = row.weight_kg ?? -Infinity;
    const currentWeight = current.weight_kg ?? -Infinity;
    const reps = row.reps_completed ?? -Infinity;
    const currentReps = current.reps_completed ?? -Infinity;
    if (weight > currentWeight || (weight === currentWeight && reps > currentReps)) {
      bestByExercise.set(row.routine_exercise_id, { ...row, weeksAgo: rowWeeksAgo });
    }
  }

  const rangeByExercise = new Map<string, RoutineExerciseRangeRow>();
  for (const r of ranges ?? []) rangeByExercise.set(r.id, r);

  const result: Record<string, WorkoutSuggestion> = {};
  for (const [routineExerciseId, row] of bestByExercise) {
    const weightRecord = row.weight_kg;
    const repsRecord = row.reps_completed;

    if (weightRecord == null || repsRecord == null) {
      result[routineExerciseId] = {
        weight: weightRecord,
        reps: repsRecord,
        rir: row.rir_actual,
        progressionCase: null,
        previousRecord: null,
        weeksAgo: row.weeksAgo,
      };
      continue;
    }

    const previousRecord = { weight: weightRecord, reps: repsRecord, rir: row.rir_actual };

    // Pausa larga (Bug 4): no proyectar progresión, repetir tal cual.
    if (row.weeksAgo >= PROGRESSION_STALE_WEEKS) {
      result[routineExerciseId] = {
        weight: weightRecord,
        reps: repsRecord,
        rir: row.rir_actual,
        progressionCase: null,
        previousRecord,
        weeksAgo: row.weeksAgo,
      };
      continue;
    }

    const range = rangeByExercise.get(routineExerciseId);
    const weightIncrement = range?.weight_increment ?? 2.5;
    const repsMin = range?.reps_min ?? 1;
    const repsMax = range?.reps_max ?? null;

    if (repsMax != null && repsRecord >= repsMax) {
      result[routineExerciseId] = {
        weight: weightRecord + weightIncrement,
        reps: repsMin,
        rir: row.rir_actual,
        progressionCase: "weight_increase",
        previousRecord,
        weeksAgo: row.weeksAgo,
      };
    } else {
      result[routineExerciseId] = {
        weight: weightRecord,
        reps: repsRecord + 1,
        rir: row.rir_actual,
        progressionCase: "reps_increase",
        previousRecord,
        weeksAgo: row.weeksAgo,
      };
    }
  }
  return result;
}
