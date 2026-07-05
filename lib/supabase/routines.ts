import { createClient } from "@/lib/supabase/server";

export type RoutineListItem = {
  id: string;
  name: string;
  clientName: string | null;
  isActive: boolean;
  createdAt: string;
};

export async function getRoutinesList(): Promise<RoutineListItem[]> {
  const supabase = await createClient();

  const { data: routines } = await supabase
    .from("routines")
    .select("id, name, client_id, is_active, created_at")
    .order("created_at", { ascending: false });

  const rows = routines ?? [];
  const clientIds = rows
    .map((r) => r.client_id)
    .filter((id): id is string => Boolean(id));

  const { data: clients } = clientIds.length
    ? await supabase.from("clients").select("id, user_id").in("id", clientIds)
    : { data: [] as { id: string; user_id: string }[] };

  const userIds = (clients ?? [])
    .map((c) => c.user_id)
    .filter((id): id is string => Boolean(id));

  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const clientNameByClientId = new Map(
    (clients ?? []).map((c) => {
      const profile = profileById.get(c.user_id);
      return [c.id, profile?.full_name ?? profile?.email ?? "Cliente"];
    })
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    clientName: r.client_id
      ? (clientNameByClientId.get(r.client_id) ?? null)
      : null,
    isActive: r.is_active,
    createdAt: r.created_at,
  }));
}

export type ClientOption = { id: string; name: string };

export async function getClientsForSelect(): Promise<ClientOption[]> {
  const supabase = await createClient();

  const { data: clients } = await supabase.from("clients").select("id, user_id");
  const rows = clients ?? [];
  const userIds = rows
    .map((c) => c.user_id)
    .filter((id): id is string => Boolean(id));

  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((c) => {
    const profile = c.user_id ? profileById.get(c.user_id) : undefined;
    return { id: c.id, name: profile?.full_name ?? profile?.email ?? "Cliente" };
  });
}

export type ExerciseOption = {
  id: string;
  name: string;
  muscleGroup: string | null;
};

export async function getExercisesForSelect(): Promise<ExerciseOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercises")
    .select("id, name, muscle_group")
    .order("name", { ascending: true });

  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscle_group,
  }));
}

export type RoutineExerciseDetail = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  rirTarget: number | null;
  restSeconds: number | null;
  notes: string | null;
};

export type RoutineDayDetail = {
  id: string;
  name: string;
  dayNumber: number;
  exercises: RoutineExerciseDetail[];
};

export type RoutineDetail = {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  clientName: string | null;
  isActive: boolean;
  days: RoutineDayDetail[];
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

export async function getRoutineDetail(id: string): Promise<RoutineDetail | null> {
  const supabase = await createClient();

  const { data: routine } = await supabase
    .from("routines")
    .select("id, name, description, objective, client_id, is_active")
    .eq("id", id)
    .single();

  if (!routine) return null;

  let clientName: string | null = null;
  if (routine.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("user_id")
      .eq("id", routine.client_id)
      .single();
    if (client?.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", client.user_id)
        .single();
      clientName = profile?.full_name ?? profile?.email ?? null;
    }
  }

  const { data: days } = await supabase
    .from("routine_days")
    .select("id, name, day_number")
    .eq("routine_id", id)
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
    ? await supabase.from("exercises").select("id, name").in("id", exerciseIds)
    : { data: [] as { id: string; name: string }[] };

  const exerciseNameById = new Map((exercises ?? []).map((e) => [e.id, e.name]));

  const exercisesByDay = new Map<string, RoutineExerciseDetail[]>();
  for (const re of routineExercises ?? []) {
    const list = exercisesByDay.get(re.day_id) ?? [];
    list.push({
      id: re.id,
      exerciseId: re.exercise_id,
      exerciseName: exerciseNameById.get(re.exercise_id) ?? "Ejercicio",
      order: re.order_index,
      sets: re.sets,
      repsMin: re.reps_min,
      repsMax: re.reps_max,
      rirTarget: re.rir_target,
      restSeconds: re.rest_seconds,
      notes: re.coach_notes,
    });
    exercisesByDay.set(re.day_id, list);
  }

  return {
    id: routine.id,
    name: routine.name,
    description: routine.description,
    objective: routine.objective,
    clientName,
    isActive: routine.is_active,
    days: dayRows.map((d) => ({
      id: d.id,
      name: d.name,
      dayNumber: d.day_number,
      exercises: exercisesByDay.get(d.id) ?? [],
    })),
  };
}
