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

type FeedbackRow = {
  id: string;
  type: FeedbackType;
  message: string;
  is_read: boolean;
  created_at: string;
  workout_log_id: string | null;
  routine_exercise_id: string | null;
};

async function enrichFeedbackRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: FeedbackRow[]
): Promise<FeedbackItem[]> {
  const workoutLogIds = rows
    .map((r) => r.workout_log_id)
    .filter((id): id is string => Boolean(id));
  const routineExerciseIds = rows
    .map((r) => r.routine_exercise_id)
    .filter((id): id is string => Boolean(id));

  const { data: logs } = workoutLogIds.length
    ? await supabase
        .from("workout_logs")
        .select("id, workout_date")
        .in("id", workoutLogIds)
    : { data: [] as { id: string; workout_date: string }[] };

  const { data: routineExercises } = routineExerciseIds.length
    ? await supabase
        .from("routine_exercises")
        .select("id, exercise_id")
        .in("id", routineExerciseIds)
    : { data: [] as { id: string; exercise_id: string }[] };

  const exerciseIds = Array.from(
    new Set((routineExercises ?? []).map((re) => re.exercise_id))
  );

  const { data: exercises } = exerciseIds.length
    ? await supabase.from("exercises").select("id, name").in("id", exerciseIds)
    : { data: [] as { id: string; name: string }[] };

  const dateByLogId = new Map((logs ?? []).map((l) => [l.id, l.workout_date]));
  const exerciseIdByRoutineExerciseId = new Map(
    (routineExercises ?? []).map((re) => [re.id, re.exercise_id])
  );
  const exerciseNameById = new Map((exercises ?? []).map((e) => [e.id, e.name]));

  return rows.map((r) => {
    const exerciseId = r.routine_exercise_id
      ? exerciseIdByRoutineExerciseId.get(r.routine_exercise_id)
      : undefined;
    return {
      id: r.id,
      type: r.type,
      message: r.message,
      isRead: r.is_read,
      createdAt: r.created_at,
      workoutLogId: r.workout_log_id,
      workoutDate: r.workout_log_id
        ? (dateByLogId.get(r.workout_log_id) ?? null)
        : null,
      routineExerciseId: r.routine_exercise_id,
      exerciseName: exerciseId
        ? (exerciseNameById.get(exerciseId) ?? null)
        : null,
    };
  });
}

export async function getFeedbackForClient(
  clientId: string
): Promise<FeedbackItem[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("feedback")
    .select(
      "id, type, message, is_read, created_at, workout_log_id, routine_exercise_id"
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return enrichFeedbackRows(supabase, data ?? []);
}

export async function getMyFeedback(): Promise<FeedbackItem[]> {
  const client = await getCurrentClientRecord();
  if (!client) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("feedback")
    .select(
      "id, type, message, is_read, created_at, workout_log_id, routine_exercise_id"
    )
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  return enrichFeedbackRows(supabase, data ?? []);
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

export async function getFeedbackDetailAndMarkRead(
  id: string
): Promise<FeedbackDetail | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from("feedback")
    .select(
      "id, type, message, is_read, created_at, workout_log_id, routine_exercise_id"
    )
    .eq("id", id)
    .eq("client_id", client.id)
    .single();

  if (!data) return null;

  if (!data.is_read) {
    await supabase
      .from("feedback")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);
  }

  const [enriched] = await enrichFeedbackRows(supabase, [data]);
  return { ...enriched, isRead: true };
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

export async function getClientRoutineExercisesForSelect(
  clientId: string
): Promise<ExerciseOption[]> {
  const supabase = await createClient();

  const { data: routine } = await supabase
    .from("routines")
    .select("id")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!routine) return [];

  const { data: days } = await supabase
    .from("routine_days")
    .select("id")
    .eq("routine_id", routine.id);

  const dayIds = (days ?? []).map((d) => d.id);
  if (dayIds.length === 0) return [];

  const { data: routineExercises } = await supabase
    .from("routine_exercises")
    .select("id, exercise_id")
    .in("day_id", dayIds);

  const rows = routineExercises ?? [];
  const exerciseIds = Array.from(new Set(rows.map((r) => r.exercise_id)));

  const { data: exercises } = exerciseIds.length
    ? await supabase.from("exercises").select("id, name").in("id", exerciseIds)
    : { data: [] as { id: string; name: string }[] };

  const exerciseNameById = new Map((exercises ?? []).map((e) => [e.id, e.name]));

  return rows.map((r) => ({
    id: r.id,
    name: exerciseNameById.get(r.exercise_id) ?? "Ejercicio",
  }));
}
