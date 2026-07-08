import { createClient } from "@/lib/supabase/server";

export type RoutineListItem = {
  id: string;
  name: string;
  clientName: string | null;
  isActive: boolean;
  createdAt: string;
};

type RoutineListRow = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  clients: {
    profiles: { full_name: string | null; email: string } | null;
  } | null;
};

// Antes: 3 round trips secuenciales (routines -> clients -> profiles).
// Ahora: 1 sola consulta con joins embebidos (Supabase/PostgREST resuelve
// las relaciones vía foreign keys). `clients` tiene dos FKs a `profiles`
// (coach_id y user_id), por eso hace falta el hint `!clients_user_id_fkey`
// para desambiguar cuál usar.
export async function getRoutinesList(): Promise<RoutineListItem[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("routines")
    .select(
      `id, name, is_active, created_at,
       clients ( profiles!clients_user_id_fkey ( full_name, email ) )`
    )
    .order("created_at", { ascending: false })
    .returns<RoutineListRow[]>();

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    clientName:
      r.clients?.profiles?.full_name ?? r.clients?.profiles?.email ?? null,
    isActive: r.is_active,
    createdAt: r.created_at,
  }));
}

export type ClientOption = { id: string; name: string };

type ClientOptionRow = {
  id: string;
  profiles: { full_name: string | null; email: string } | null;
};

// Antes: 2 round trips (clients -> profiles). Ahora: 1.
export async function getClientsForSelect(): Promise<ClientOption[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("clients")
    .select(`id, profiles!clients_user_id_fkey ( full_name, email )`)
    .returns<ClientOptionRow[]>();

  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.profiles?.full_name ?? c.profiles?.email ?? "Cliente",
  }));
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
  clientId: string | null;
  clientName: string | null;
  isActive: boolean;
  durationWeeks: number | null;
  startsAt: string | null;
  endsAt: string | null;
  days: RoutineDayDetail[];
};

type RoutineDetailRow = {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  is_active: boolean;
  client_id: string | null;
  duration_weeks: number | null;
  starts_at: string | null;
  ends_at: string | null;
  clients: {
    profiles: { full_name: string | null; email: string } | null;
  } | null;
  routine_days: {
    id: string;
    name: string;
    day_number: number;
    routine_exercises: {
      id: string;
      exercise_id: string;
      order_index: number;
      sets: number;
      reps_min: number | null;
      reps_max: number | null;
      rir_target: number | null;
      rest_seconds: number | null;
      coach_notes: string | null;
      exercises: { name: string } | null;
    }[];
  }[];
};

// Antes: hasta 6 round trips secuenciales (routine -> client -> profile ->
// days -> routine_exercises -> exercises). Ahora: 1 sola consulta con todo
// anidado. El orden de días/ejercicios se resuelve en JS después (más
// simple y confiable que depender de ordering en relaciones anidadas dos
// niveles de profundidad vía PostgREST).
export async function getRoutineDetail(id: string): Promise<RoutineDetail | null> {
  const supabase = await createClient();

  const { data: routine } = await supabase
    .from("routines")
    .select(
      `id, name, description, objective, is_active, client_id,
       duration_weeks, starts_at, ends_at,
       clients ( profiles!clients_user_id_fkey ( full_name, email ) ),
       routine_days (
         id, name, day_number,
         routine_exercises (
           id, exercise_id, order_index, sets, reps_min, reps_max,
           rir_target, rest_seconds, coach_notes,
           exercises ( name )
         )
       )`
    )
    .eq("id", id)
    .single()
    .returns<RoutineDetailRow>();

  if (!routine) return null;

  const days = [...routine.routine_days].sort(
    (a, b) => a.day_number - b.day_number
  );

  return {
    id: routine.id,
    name: routine.name,
    description: routine.description,
    objective: routine.objective,
    clientId: routine.client_id,
    clientName:
      routine.clients?.profiles?.full_name ??
      routine.clients?.profiles?.email ??
      null,
    isActive: routine.is_active,
    durationWeeks: routine.duration_weeks,
    startsAt: routine.starts_at,
    endsAt: routine.ends_at,
    days: days.map((d) => ({
      id: d.id,
      name: d.name,
      dayNumber: d.day_number,
      exercises: [...d.routine_exercises]
        .sort((a, b) => a.order_index - b.order_index)
        .map((re) => ({
          id: re.id,
          exerciseId: re.exercise_id,
          exerciseName: re.exercises?.name ?? "Ejercicio",
          order: re.order_index,
          sets: re.sets,
          repsMin: re.reps_min,
          repsMax: re.reps_max,
          rirTarget: re.rir_target,
          restSeconds: re.rest_seconds,
          notes: re.coach_notes,
        })),
    })),
  };
}

export type NoActiveRoutineAlert = { clientId: string; clientName: string };

type ClientRoutineCheckRow = {
  id: string;
  profiles: { full_name: string | null; email: string } | null;
  routines: { is_active: boolean; ends_at: string | null }[];
};

// Push/dashboard: un cliente activo sin ninguna rutina vigente (activa y
// sin vencer) — típicamente porque su mesociclo terminó y el coach todavía
// no le asignó el siguiente.
export async function getNoActiveRoutineAlerts(): Promise<NoActiveRoutineAlert[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("clients")
    .select(
      `id, profiles!clients_user_id_fkey ( full_name, email ),
       routines ( is_active, ends_at )`
    )
    .eq("is_active", true)
    .returns<ClientRoutineCheckRow[]>();

  return (data ?? [])
    .filter((c) => {
      const hasValidRoutine = c.routines.some(
        (r) => r.is_active && (!r.ends_at || r.ends_at >= today)
      );
      return !hasValidRoutine;
    })
    .map((c) => ({
      clientId: c.id,
      clientName: c.profiles?.full_name ?? c.profiles?.email ?? "Cliente",
    }));
}
