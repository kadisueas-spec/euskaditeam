import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import type { MyRoutine, MyRoutineDay } from "@/lib/supabase/client-routine";

// Espejo de client-routine.ts para el entrenamiento propio del coach —
// mismas formas de datos (MyRoutine/MyRoutineDay), pero filtrando por
// routines.coach_id + client_id IS NULL en vez de clients.id. routines ya
// soporta esto sin ningún cambio de RLS: "Coach manages routines" solo
// exige coach_id = auth.uid(), nunca pidió client_id (ver migración
// 20260716_coach_own_training.sql).

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

export async function getMyTrainingRoutine(): Promise<MyRoutine | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

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
    .eq("coach_id", profile.id)
    .is("client_id", null)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .returns<MyActiveRoutineRow>();

  if (!routine) return null;

  const days = [...routine.routine_days].sort((a, b) => a.day_number - b.day_number);

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

export async function getTrainingDayForLogging(
  dayId: string
): Promise<MyRoutineDay | null> {
  const routine = await getMyTrainingRoutine();
  return routine?.days.find((d) => d.id === dayId) ?? null;
}

// Mismo fix que getInProgressWorkoutDayId (client-routine.ts): si no viene
// ?day= en la URL, buscar primero si hay un entrenamiento propio de hoy
// sin terminar antes de mostrar la pantalla vacía de "elegí un día".
export async function getInProgressTrainingDayId(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("workout_logs")
    .select("routine_day_id")
    .eq("coach_id", profile.id)
    .eq("workout_date", today)
    .eq("is_completed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.routine_day_id ?? null;
}
