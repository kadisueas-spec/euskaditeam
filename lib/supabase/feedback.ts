import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import type { FeedbackType } from "@/lib/constants/feedback";

export { FEEDBACK_TYPES } from "@/lib/constants/feedback";
export type { FeedbackType } from "@/lib/constants/feedback";

export type FeedbackItem = {
  id: string;
  type: FeedbackType;
  message: string;
  isRead: boolean;
  createdAt: string;
  workoutLogId: string | null;
  workoutDate: string | null;
  routineExerciseId: string | null;
  exerciseName: string | null;
};

const FEEDBACK_SELECT = `id, type, message, is_read, created_at, workout_log_id, routine_exercise_id,
  workout_logs ( workout_date ),
  routine_exercises ( exercises ( name ) )`;

type FeedbackRow = {
  id: string;
  type: FeedbackType;
  message: string;
  is_read: boolean;
  created_at: string;
  workout_log_id: string | null;
  routine_exercise_id: string | null;
  workout_logs: { workout_date: string } | null;
  routine_exercises: { exercises: { name: string } | null } | null;
};

// Transformación pura, sin consultas — antes `enrichFeedbackRows` hacía
// hasta 3 round trips secuenciales adicionales (workout_logs,
// routine_exercises, exercises) por cada lista de feedback. Ahora esos
// datos vienen embebidos en la misma consulta (ver FEEDBACK_SELECT).
function mapFeedbackRow(r: FeedbackRow): FeedbackItem {
  return {
    id: r.id,
    type: r.type,
    message: r.message,
    isRead: r.is_read,
    createdAt: r.created_at,
    workoutLogId: r.workout_log_id,
    workoutDate: r.workout_logs?.workout_date ?? null,
    routineExerciseId: r.routine_exercise_id,
    exerciseName: r.routine_exercises?.exercises?.name ?? null,
  };
}

// Antes: 1 (feedback) + 3 (enrich) = 4 round trips. Ahora: 1.
export async function getFeedbackForClient(
  clientId: string
): Promise<FeedbackItem[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("feedback")
    .select(FEEDBACK_SELECT)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .returns<FeedbackRow[]>();

  return (data ?? []).map(mapFeedbackRow);
}

// Antes: 1 (client, ahora memoizado) + 1 (feedback) + 3 (enrich) = 5 round
// trips. Ahora: client (memoizado) + 1.
export async function getMyFeedback(): Promise<FeedbackItem[]> {
  const client = await getCurrentClientRecord();
  if (!client) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("feedback")
    .select(FEEDBACK_SELECT)
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .returns<FeedbackRow[]>();

  return (data ?? []).map(mapFeedbackRow);
}

export async function getUnreadFeedbackCount(): Promise<number> {
  const client = await getCurrentClientRecord();
  if (!client) return 0;

  const supabase = await createClient();

  const { count } = await supabase
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id)
    .eq("is_read", false);

  return count ?? 0;
}

export type FeedbackDetail = FeedbackItem;

// D2: separado de la marca de "leído" (ver markFeedbackRead en
// app/client/feedback/actions.ts). Antes esta función mutaba durante el
// render de una página (GET), lo que deja is_read=true en la base pero no
// invalida el router cache de Next — el badge de "mensajes nuevos" del
// layout seguía mostrando el conteo viejo hasta un refresh completo. Ahora
// es una lectura pura; la mutación vive en un Server Action que sí puede
// llamar a revalidatePath.
export async function getFeedbackDetail(id: string): Promise<FeedbackDetail | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from("feedback")
    .select(FEEDBACK_SELECT)
    .eq("id", id)
    .eq("client_id", client.id)
    .single()
    .returns<FeedbackRow>();

  if (!data) return null;

  return mapFeedbackRow(data);
}

export type SessionOption = { id: string; label: string };

export async function getRecentSessionsForSelect(
  clientId: string
): Promise<SessionOption[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("workout_logs")
    .select("id, workout_date")
    .eq("client_id", clientId)
    .order("workout_date", { ascending: false })
    .limit(20);

  return (data ?? []).map((l) => ({ id: l.id, label: l.workout_date }));
}

export type ExerciseOption = { id: string; name: string };

type ActiveRoutineExercisesRow = {
  routine_days: {
    routine_exercises: {
      exercise_id: string;
      exercises: { id: string; name: string } | null;
    }[];
  }[];
};

// Antes: 4 round trips secuenciales (routine -> days -> routine_exercises ->
// exercises). Ahora: 1.
export async function getClientRoutineExercisesForSelect(
  clientId: string
): Promise<ExerciseOption[]> {
  const supabase = await createClient();

  const { data: routine } = await supabase
    .from("routines")
    .select(
      `routine_days (
         routine_exercises ( exercise_id, exercises ( id, name ) )
       )`
    )
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .returns<ActiveRoutineExercisesRow | null>();

  if (!routine) return [];

  const seen = new Set<string>();
  const options: ExerciseOption[] = [];
  for (const day of routine.routine_days) {
    for (const re of day.routine_exercises) {
      if (seen.has(re.exercise_id)) continue;
      seen.add(re.exercise_id);
      options.push({ id: re.exercise_id, name: re.exercises?.name ?? "Ejercicio" });
    }
  }
  return options;
}
