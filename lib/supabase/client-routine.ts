import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export type MyRoutineExercise = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  videoId: string | null;
  order: number;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  rirTarget: number | null;
  restSeconds: number | null;
  coachNotes: string | null;
};

export type MyRoutineDay = {
  id: string;
  name: string;
  dayNumber: number;
  exercises: MyRoutineExercise[];
};

export type MyRoutine = {
  id: string;
  name: string;
  objective: string | null;
  days: MyRoutineDay[];
};

type RoutineExerciseRow = {
  id: string;
  day_id: string;
  exercise_id: string;
  order_index: number;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rir_target: number | null;
  rest_seconds: number | null;
  coach_notes: string | null;
};

export async function getMyActiveRoutine(): Promise<MyRoutine | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();

  const { data: routine } = await supabase
    .from("routines")
    .select("id, name, objective")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!routine) return null;

  const { data: days } = await supabase
    .from("routine_days")
    .select("id, name, day_number")
    .eq("routine_id", routine.id)
    .order("day_number", { ascending: true });

  const dayRows = days ?? [];
  const dayIds = dayRows.map((d) => d.id);

  const { data: routineExercises } = dayIds.length
    ? await supabase
        .from("routine_exercises")
        .select(
          "id, day_id, exercise_id, order_index, sets, reps_min, reps_max, rir_target, rest_seconds, coach_notes"
        )
        .in("day_id", dayIds)
        .order("order_index", { ascending: true })
    : { data: [] as RoutineExerciseRow[] };

  const exerciseIds = (routineExercises ?? [])
    .map((re) => re.exercise_id)
    .filter((id): id is string => Boolean(id));

  const { data: exercises } = exerciseIds.length
    ? await supabase
        .from("exercises")
        .select("id, name, video_url")
        .in("id", exerciseIds)
    : { data: [] as { id: string; name: string; video_url: string | null }[] };

  const exerciseById = new Map((exercises ?? []).map((e) => [e.id, e]));

  const exercisesByDay = new Map<string, MyRoutineExercise[]>();
  for (const re of routineExercises ?? []) {
    const exercise = exerciseById.get(re.exercise_id);
    const list = exercisesByDay.get(re.day_id) ?? [];
    list.push({
      id: re.id,
      exerciseId: re.exercise_id,
      exerciseName: exercise?.name ?? "Ejercicio",
      videoId: exercise?.video_url ?? null,
      order: re.order_index,
      sets: re.sets,
      repsMin: re.reps_min,
      repsMax: re.reps_max,
      rirTarget: re.rir_target,
      restSeconds: re.rest_seconds,
      coachNotes: re.coach_notes,
    });
    exercisesByDay.set(re.day_id, list);
  }

  return {
    id: routine.id,
    name: routine.name,
    objective: routine.objective,
    days: dayRows.map((d) => ({
      id: d.id,
      name: d.name,
      dayNumber: d.day_number,
      exercises: exercisesByDay.get(d.id) ?? [],
    })),
  };
}

export async function getRoutineDayForLogging(dayId: string) {
  const routine = await getMyActiveRoutine();
  return routine?.days.find((d) => d.id === dayId) ?? null;
}
