import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { mondayKeyFor, addWeeks } from "@/lib/utils/week";

export type WarmupType =
  | "none"
  | "percentage_with_kg"
  | "percentage_of_max"
  | "fixed_weight";

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
  warmupType: WarmupType;
  warmupFixedWeightKg: number | null;
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
  mesocicloNombre: string | null;
  // Banner de bienvenida (ago-2026): null = todavía no se mostró para esta
  // rutina puntual — ver dismissWelcomeBanner en app/client/my-routine/actions.ts.
  welcomeBannerShownAt: string | null;
  days: MyRoutineDay[];
};

type MyActiveRoutineRow = {
  id: string;
  name: string;
  objective: string | null;
  mesociclo_nombre: string | null;
  welcome_banner_shown_at: string | null;
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
      warmup_type: string;
      warmup_fixed_weight_kg: number | null;
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
      `id, name, objective, mesociclo_nombre, welcome_banner_shown_at,
       routine_days (
         id, name, day_number,
         routine_exercises (
           id, exercise_id, order_index, sets, reps_min, reps_max,
           rir_target, rest_seconds, coach_notes, warmup_type, warmup_fixed_weight_kg,
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
    mesocicloNombre: routine.mesociclo_nombre,
    welcomeBannerShownAt: routine.welcome_banner_shown_at,
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
          warmupType: re.warmup_type as WarmupType,
          warmupFixedWeightKg: re.warmup_fixed_weight_kg,
        })),
    })),
  };
}

// Banner de bienvenida (ago-2026): distingue "primera rutina de tu vida"
// (mensaje "acá arranca tu proceso") de "rutina nueva" (mensaje "nueva
// etapa") — mirando si existe CUALQUIER otra rutina para este cliente,
// activa o archivada, aparte de la actual.
export async function isClientsFirstRoutine(
  clientId: string,
  currentRoutineId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("routines")
    .select("id")
    .eq("client_id", clientId)
    .neq("id", currentRoutineId)
    .limit(1)
    .maybeSingle();
  return !data;
}

export type MyRoutineWeekProgress = {
  completedDayIds: string[];
  suggestedDayId: string | null;
};

// "Próximo entrenamiento" (jul-2026): el día sugerido es el de menor
// day_number que TODAVÍA no se completó en la semana en curso (lunes a
// domingo) — no el "siguiente cronológico" tras el último completado, así
// que si el cliente se salteó un día (completó 1 y 3), sugiere el 2, no el
// 4. Si ya completó todos, no hay sugerido (semana completa). Una rutina
// recién asignada a mitad de semana no tiene workout_logs con esos
// routine_day_id todavía, así que cae sola en "sugerir el Día 1" sin
// necesitar un caso especial.
export async function getWeekProgress(
  days: MyRoutineDay[]
): Promise<MyRoutineWeekProgress> {
  const client = await getCurrentClientRecord();
  if (!client || days.length === 0) {
    return { completedDayIds: [], suggestedDayId: null };
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = mondayKeyFor(today);
  const weekEnd = addWeeks(weekStart, 1);

  const { data } = await supabase
    .from("workout_logs")
    .select("routine_day_id")
    .eq("client_id", client.id)
    .eq("is_completed", true)
    .gte("workout_date", weekStart)
    .lt("workout_date", weekEnd);

  const dayIds = new Set(days.map((d) => d.id));
  const completedDayIds = Array.from(
    new Set(
      (data ?? [])
        .map((l) => l.routine_day_id)
        .filter((id): id is string => !!id && dayIds.has(id))
    )
  );

  const completedSet = new Set(completedDayIds);
  const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const suggestedDayId = sortedDays.find((d) => !completedSet.has(d.id))?.id ?? null;

  return { completedDayIds, suggestedDayId };
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
// y, si existe, resolvemos directo a su día.
//
// Sin filtro de is_completed a propósito (jul-2026): si el cliente finalizó
// por error hoy mismo y toca "Entrenar" de nuevo, también tiene que caer
// directo en ese día — getOrCreateInProgressWorkout ya sabe reabrir un log
// completado del mismo día en vez de crear uno nuevo (ver actions.ts).
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
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.routine_day_id ?? null;
}
