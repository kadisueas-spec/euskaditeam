import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export type WorkoutHistoryItem = {
  id: string;
  workoutDate: string;
  dayName: string | null;
  isCompleted: boolean;
  energyLevel: number | null;
};

type HistoryRow = {
  id: string;
  workout_date: string;
  is_completed: boolean;
  energy_level: number | null;
  routine_days: { name: string } | null;
};

// Antes: 2 round trips (logs -> routine_days). Ahora: 1.
export async function getWorkoutHistory(): Promise<WorkoutHistoryItem[]> {
  const client = await getCurrentClientRecord();
  if (!client) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("workout_logs")
    .select(
      `id, workout_date, is_completed, energy_level,
       routine_days ( name )`
    )
    .eq("client_id", client.id)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<HistoryRow[]>();

  return (data ?? []).map((r) => ({
    id: r.id,
    workoutDate: r.workout_date,
    dayName: r.routine_days?.name ?? null,
    isCompleted: r.is_completed,
    energyLevel: r.energy_level,
  }));
}

// Bug jul-2026 (reportado por Luis): antes esto era una lista plana de
// series ya cargadas — un ejercicio salteado (0 series) no generaba
// ninguna fila y desaparecía del historial, como si nunca hubiera estado
// planificado ese día. Ahora cada WorkoutLogExerciseGroup representa un
// ejercicio PLANIFICADO (routine_exercises de ese routine_day), con un
// slot por cada serie planificada — completado (id real, valores reales)
// o pendiente (id null, completed:false, valores null). "Sin completar"
// se ve, no se esconde.
export type WorkoutLogSetSlot = {
  id: string | null; // null = serie planificada pero nunca cargada
  setNumber: number;
  weightKg: number | null;
  repsCompleted: number | null;
  rirActual: number | null;
  completed: boolean;
};

export type WorkoutLogExerciseGroup = {
  routineExerciseId: string;
  exerciseName: string;
  plannedSets: number;
  sets: WorkoutLogSetSlot[];
  fullyCompleted: boolean;
};

export type WorkoutLogDetail = {
  id: string;
  workoutDate: string;
  dayName: string | null;
  isCompleted: boolean;
  energyLevel: number | null;
  clientNotes: string | null;
  exercises: WorkoutLogExerciseGroup[];
};

type SetLogRow = {
  id: string;
  routine_exercise_id: string | null;
  set_number: number;
  weight_kg: number | null;
  reps_completed: number | null;
  rir_actual: number | null;
  routine_exercises: { exercises: { name: string } | null } | null;
};

type LogDetailRow = {
  id: string;
  workout_date: string;
  is_completed: boolean;
  energy_level: number | null;
  client_notes: string | null;
  routine_day_id: string | null;
  routine_days: { name: string } | null;
  workout_set_logs: SetLogRow[];
};

type PlannedExerciseRow = {
  id: string;
  order_index: number;
  sets: number;
  exercises: { name: string } | null;
};

// Combina lo planificado (routine_exercises de ese día) con lo realmente
// cargado (workout_set_logs) en un solo árbol por ejercicio. Compartida
// entre la vista del cliente y la del coach — ambas necesitan exactamente
// el mismo cruce.
function buildExerciseGroups(
  planned: PlannedExerciseRow[],
  setLogs: SetLogRow[]
): WorkoutLogExerciseGroup[] {
  const setsByExercise = new Map<string, SetLogRow[]>();
  for (const s of setLogs) {
    if (!s.routine_exercise_id) continue;
    const list = setsByExercise.get(s.routine_exercise_id) ?? [];
    list.push(s);
    setsByExercise.set(s.routine_exercise_id, list);
  }

  const groups: WorkoutLogExerciseGroup[] = [...planned]
    .sort((a, b) => a.order_index - b.order_index)
    .map((re) => {
      const logged = (setsByExercise.get(re.id) ?? []).sort(
        (a, b) => a.set_number - b.set_number
      );
      setsByExercise.delete(re.id); // consumido: lo que quede son huérfanos

      const slotCount = Math.max(re.sets, logged.length);
      const sets: WorkoutLogSetSlot[] = [];
      for (let i = 0; i < slotCount; i++) {
        const real = logged[i];
        sets.push(
          real
            ? {
                id: real.id,
                setNumber: real.set_number,
                weightKg: real.weight_kg,
                repsCompleted: real.reps_completed,
                rirActual: real.rir_actual,
                completed: true,
              }
            : {
                id: null,
                setNumber: i + 1,
                weightKg: null,
                repsCompleted: null,
                rirActual: null,
                completed: false,
              }
        );
      }

      return {
        routineExerciseId: re.id,
        exerciseName: re.exercises?.name ?? "Ejercicio",
        plannedSets: re.sets,
        sets,
        fullyCompleted: logged.length >= re.sets,
      };
    });

  // Series que quedaron cargadas contra un routine_exercise que ya no
  // aparece en el día planificado (p.ej. el coach sacó ese ejercicio de la
  // rutina después de la sesión) — nunca se descartan en silencio, se
  // agregan como grupo aparte al final.
  for (const [routineExerciseId, logged] of setsByExercise) {
    const sorted = [...logged].sort((a, b) => a.set_number - b.set_number);
    groups.push({
      routineExerciseId,
      exerciseName: sorted[0]?.routine_exercises?.exercises?.name ?? "Ejercicio",
      plannedSets: sorted.length,
      sets: sorted.map((real) => ({
        id: real.id,
        setNumber: real.set_number,
        weightKg: real.weight_kg,
        repsCompleted: real.reps_completed,
        rirActual: real.rir_actual,
        completed: true,
      })),
      fullyCompleted: true,
    });
  }

  return groups;
}

const LOG_DETAIL_SELECT = `id, workout_date, is_completed, energy_level, client_notes, routine_day_id,
       routine_days ( name ),
       workout_set_logs (
         id, routine_exercise_id, set_number, weight_kg, reps_completed, rir_actual,
         routine_exercises ( exercises ( name ) )
       )`;

async function loadPlannedExercises(
  supabase: Awaited<ReturnType<typeof createClient>>,
  routineDayId: string | null
): Promise<PlannedExerciseRow[]> {
  if (!routineDayId) return [];
  const { data } = await supabase
    .from("routine_exercises")
    .select("id, order_index, sets, exercises ( name )")
    .eq("day_id", routineDayId)
    .returns<PlannedExerciseRow[]>();
  return data ?? [];
}

export async function getWorkoutLogDetail(
  id: string
): Promise<WorkoutLogDetail | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();

  const { data: log } = await supabase
    .from("workout_logs")
    .select(LOG_DETAIL_SELECT)
    .eq("id", id)
    .eq("client_id", client.id)
    .single()
    .returns<LogDetailRow>();

  if (!log) return null;

  const planned = await loadPlannedExercises(supabase, log.routine_day_id);

  return {
    id: log.id,
    workoutDate: log.workout_date,
    dayName: log.routine_days?.name ?? null,
    isCompleted: log.is_completed,
    energyLevel: log.energy_level,
    clientNotes: log.client_notes,
    exercises: buildExerciseGroups(planned, log.workout_set_logs),
  };
}

// Misma vista que getWorkoutLogDetail, para que el coach revise una
// sesión de SU cliente — necesita ver los ejercicios salteados tanto como
// el cliente, para detectar patrones (máquinas ocupadas, dolor, etc.).
// Solo lectura del lado del coach: la edición sigue siendo del cliente.
export async function getWorkoutLogDetailForCoach(
  coachId: string,
  clientId: string,
  logId: string
): Promise<WorkoutLogDetail | null> {
  const supabase = await createClient();

  const { data: log } = await supabase
    .from("workout_logs")
    .select(`${LOG_DETAIL_SELECT}, clients!inner(coach_id)`)
    .eq("id", logId)
    .eq("client_id", clientId)
    .eq("clients.coach_id", coachId)
    .single()
    .returns<LogDetailRow>();

  if (!log) return null;

  const planned = await loadPlannedExercises(supabase, log.routine_day_id);

  return {
    id: log.id,
    workoutDate: log.workout_date,
    dayName: log.routine_days?.name ?? null,
    isCompleted: log.is_completed,
    energyLevel: log.energy_level,
    clientNotes: log.client_notes,
    exercises: buildExerciseGroups(planned, log.workout_set_logs),
  };
}
