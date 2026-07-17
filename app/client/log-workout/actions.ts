"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord, type ClientRecord } from "@/lib/supabase/client-profile";
import { sendPushToCoach } from "@/lib/push/send-push";
import { adherence80PushTitle } from "@/lib/constants/push-copy";
import { validateSetInput } from "@/lib/utils/validate-set-input";

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

// A1: cada serie se guarda en el servidor apenas se completa (no se espera
// a "Finalizar"), en un workout_log con is_completed=false. Si el cliente
// cierra la app y vuelve, esta función encuentra ese mismo registro en
// curso (por client+día+fecha) en vez de crear uno nuevo, y devuelve todas
// las series ya guardadas para reconstruir dónde había quedado.
export async function getOrCreateInProgressWorkout(
  dayId: string
): Promise<InProgressWorkout | { error: string }> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("workout_logs")
    .select("id")
    .eq("client_id", client.id)
    .eq("routine_day_id", dayId)
    .eq("workout_date", today)
    .eq("is_completed", false)
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

  return {
    workoutLogId: workoutLogId as string,
    loggedSets: (sets ?? []).map((s) => ({
      id: s.id,
      routineExerciseId: s.routine_exercise_id ?? "",
      setNumber: s.set_number,
      weightKg: s.weight_kg,
      reps: s.reps_completed,
      rir: s.rir_actual,
    })),
  };
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

// A4: permite corregir una serie ya guardada dentro del entrenamiento en
// curso (o de una sesión pasada, ver Bloque B2).
export async function updateSet(
  setId: string,
  patch: UpdateSetInput
): Promise<{ success: true } | { error: string }> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const validationError = validateSetInput(patch);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
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

export type FinishWorkoutResult =
  | { success: true; summary: WorkoutSummary }
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

  return { success: true, summary };
}

export type PreviousSetValue = {
  routineExerciseId: string;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
};

type PreviousSetRow = {
  routine_exercise_id: string | null;
  weight_kg: number | null;
  reps_completed: number | null;
  rir_actual: number | null;
  workout_logs: { workout_date: string; is_completed: boolean } | null;
};

// A5 (rediseñado jul-2026): solo se sugiere en la PRIMERA serie de cada
// ejercicio — antes autocompletaba la "serie equivalente" (serie 2 con la
// serie 2 de la vez pasada, etc.), pero lo que sirve como referencia real
// es el RÉCORD de la sesión anterior: la serie de mayor peso (empate ->
// más reps), sin importar en qué número de serie haya salido esa vez.
export async function getPreviousSetsForExercises(
  routineExerciseIds: string[]
): Promise<PreviousSetValue[]> {
  if (routineExerciseIds.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_set_logs")
    .select(
      `routine_exercise_id, weight_kg, reps_completed, rir_actual,
       workout_logs!inner ( workout_date, is_completed )`
    )
    .in("routine_exercise_id", routineExerciseIds)
    .eq("workout_logs.is_completed", true)
    .returns<PreviousSetRow[]>();

  // Paso 1: la fecha de la sesión más reciente en la que se cargó cada
  // ejercicio (RLS ya garantiza que son solo registros de este cliente).
  const latestDateByExercise = new Map<string, string>();
  for (const row of data ?? []) {
    if (!row.routine_exercise_id || !row.workout_logs) continue;
    const current = latestDateByExercise.get(row.routine_exercise_id);
    if (!current || row.workout_logs.workout_date > current) {
      latestDateByExercise.set(row.routine_exercise_id, row.workout_logs.workout_date);
    }
  }

  // Paso 2: dentro de esa sesión más reciente, la serie con más peso
  // (empate -> más reps) = el récord a sugerir.
  const recordByExercise = new Map<string, PreviousSetRow>();
  for (const row of data ?? []) {
    if (!row.routine_exercise_id || !row.workout_logs) continue;
    if (row.workout_logs.workout_date !== latestDateByExercise.get(row.routine_exercise_id)) {
      continue;
    }
    const current = recordByExercise.get(row.routine_exercise_id);
    const weight = row.weight_kg ?? -Infinity;
    const currentWeight = current?.weight_kg ?? -Infinity;
    const reps = row.reps_completed ?? -Infinity;
    const currentReps = current?.reps_completed ?? -Infinity;
    if (!current || weight > currentWeight || (weight === currentWeight && reps > currentReps)) {
      recordByExercise.set(row.routine_exercise_id, row);
    }
  }

  return Array.from(recordByExercise.entries()).map(([routineExerciseId, row]) => ({
    routineExerciseId,
    weightKg: row.weight_kg,
    reps: row.reps_completed,
    rir: row.rir_actual,
  }));
}
