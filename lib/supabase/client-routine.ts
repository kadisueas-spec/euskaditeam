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

type MyActiveRoutineRow = {
  id: string;
  name: string;
  objective: string | null;
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
      exercises: { name: string; video_url: string | null } | null;
    }[];
  }[];
};

// Antes: 4 round trips secuenciales (routine -> days -> routine_exercises ->
// exercises). Ahora: 1 sola consulta con todo anidado; orden se resuelve
// en JS.
export async function getMyActiveRoutine(): Promise<MyRoutine | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();

  const { data: routine } = await supabase
    .from("routines")
    .select(
      `id, name, objective,
       routine_days (
         id, name, day_number,
         routine_exercises (
           id, exercise_id, order_index, sets, reps_min, reps_max,
           rir_target, rest_seconds, coach_notes,
           exercises ( name, video_url )
         )
       )`
    )
    .eq("client_id", client.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .returns<MyActiveRoutineRow>();

  if (!routine) return null;

  const days = [...routine.routine_days].sort(
    (a, b) => a.day_number - b.day_number
  );

  return {
    id: routine.id,
    name: routine.name,
    objective: routine.objective,
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
          videoId: re.exercises?.video_url ?? null,
          order: re.order_index,
          sets: re.sets,
          repsMin: re.reps_min,
          repsMax: re.reps_max,
          rirTarget: re.rir_target,
          restSeconds: re.rest_seconds,
          coachNotes: re.coach_notes,
        })),
    })),
  };
}

export async function getRoutineDayForLogging(dayId: string) {
  const routine = await getMyActiveRoutine();
  return routine?.days.find((d) => d.id === dayId) ?? null;
}

// Bug jul-2026: "Entrenar" desde el bottom nav apunta a /client/log-workout
// SIN ?day= (a diferencia del link desde "Mi Rutina", que sí lo manda) — si
// el cliente estaba a mitad de un entrenamiento, navegaba a otra sección y
// volvía tocando "Entrenar" en la nav, caía en la pantalla vacía de "elegí
// un día" con cero indicio de que su sesión seguía abierta en el servidor.
// Antes de mostrar esa pantalla, nos fijamos si hay un workout_log de HOY
// sin terminar y, si existe, resolvemos directo a su día.
export async function getInProgressWorkoutDayId(): Promise<string | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("workout_logs")
    .select("routine_day_id")
    .eq("client_id", client.id)
    .eq("workout_date", today)
    .eq("is_completed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.routine_day_id ?? null;
}
