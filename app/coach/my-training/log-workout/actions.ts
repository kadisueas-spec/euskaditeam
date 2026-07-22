"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import { validateSetInput } from "@/lib/utils/validate-set-input";
import type {
  AddSetInput,
  AddSetResult,
  FinishWorkoutInput,
  FinishWorkoutResult,
  InProgressWorkout,
  UpdateSetInput,
  WorkoutSummary,
} from "@/app/client/log-workout/actions";

// Espejo de app/client/log-workout/actions.ts para el entrenamiento propio
// del coach — coach_id en vez de client_id. getWorkoutSuggestions NO se
// duplica: esa función no filtra por client_id explícito, se apoya
// 100% en RLS (ver comentario ahí), así que ya sirve tal cual para el
// coach una vez que las policies de la migración están puestas.
//
// Sin sync offline (a diferencia del cliente, que sí lo necesita para
// entrenar en el gimnasio sin señal): el coach usa esto sobre todo desde
// el celular/compu con conexión, y el volumen de uso es bajo — si falla
// una request, alcanza con reintentar.

export async function getOrCreateInProgressTrainingWorkout(
  dayId: string
): Promise<InProgressWorkout | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "No se pudo identificar tu perfil." };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("workout_logs")
    .select("id")
    .eq("coach_id", profile.id)
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
        coach_id: profile.id,
        routine_day_id: dayId,
        workout_date: today,
        started_at: new Date().toISOString(),
        is_completed: false,
      })
      .select("id")
      .single();

    if (error || !created) {
      console.error("getOrCreateInProgressTrainingWorkout insert error:", error);
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

type PriorMaxWeightRow = { weight_kg: number | null };

async function checkPersonalRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coachId: string,
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
      "weight_kg, routine_exercises!inner(exercise_id), workout_logs!inner(coach_id)"
    )
    .eq("routine_exercises.exercise_id", routineExercise.exercise_id)
    .eq("workout_logs.coach_id", coachId)
    .order("weight_kg", { ascending: false })
    .limit(1)
    .returns<PriorMaxWeightRow[]>();

  const priorMax = priorSets?.[0]?.weight_kg ?? null;
  return priorMax == null || weightKg > priorMax;
}

export async function addTrainingSet(input: AddSetInput): Promise<AddSetResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "No se pudo identificar tu perfil." };

  const validationError = validateSetInput(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();

  const isPersonalRecord = await checkPersonalRecord(
    supabase,
    profile.id,
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
    console.error("addTrainingSet error:", error);
    return { error: "No se pudo guardar la serie." };
  }

  return { success: true, id: data.id, isPersonalRecord };
}

export async function updateTrainingSet(
  setId: string,
  patch: UpdateSetInput
): Promise<{ success: true } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "No se pudo identificar tu perfil." };

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
    console.error("updateTrainingSet error:", error);
    return { error: "No se pudo actualizar la serie." };
  }

  return { success: true };
}

// Sin la lógica de "avisar por 80% de adherencia" (finishWorkout del
// cliente): no aplica, el coach no se manda push a sí mismo.
export async function finishTrainingWorkout(
  input: FinishWorkoutInput
): Promise<FinishWorkoutResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "No se pudo identificar tu perfil." };

  const supabase = await createClient();
  const now = new Date();

  const [{ data: workoutLog }, { data: sets }] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("workout_date, started_at")
      .eq("id", input.workoutLogId)
      .single(),
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
    console.error("finishTrainingWorkout error:", error);
    return { error: "No se pudo finalizar el entrenamiento." };
  }

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
