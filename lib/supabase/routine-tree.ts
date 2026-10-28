import type { createClient } from "@/lib/supabase/server";
import type { RoutineDayInput, RoutineExerciseInput } from "@/app/coach/routines/actions";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Columnas de la prescripción de isométricos y cardio (oct-2026). Compartido
// por insertRoutineDays y updateRoutine.
export function trackingTargetColumns(ex: RoutineExerciseInput) {
  return {
    seconds_min: ex.secondsMin ?? null,
    seconds_max: ex.secondsMax ?? null,
    minutes_target: ex.minutesTarget ?? null,
    intensity_target: ex.intensityTarget ?? null,
  };
}

// Inserta los días y ejercicios de una rutina recién creada. Compartido por
// createRoutine (rutina de cliente) y las plantillas (oct-2026) — una
// plantilla es una fila más de routines con is_template, mismo árbol de
// routine_days/routine_exercises. Devuelve el mensaje de error para el UI, o
// null si salió todo bien.
export async function insertRoutineDays(
  supabase: SupabaseServerClient,
  routineId: string,
  days: RoutineDayInput[]
): Promise<string | null> {
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const { data: dayRow, error: dayError } = await supabase
      .from("routine_days")
      .insert({
        routine_id: routineId,
        day_number: i + 1,
        name: day.name.trim() || `Día ${i + 1}`,
      })
      .select("id")
      .single();

    if (dayError || !dayRow) {
      console.error("insertRoutineDays day insert error:", dayError);
      return `No se pudo guardar el día ${i + 1}.`;
    }

    if (day.exercises.length === 0) continue;

    const { error: exercisesError } = await supabase.from("routine_exercises").insert(
      day.exercises.map((ex, index) => ({
        day_id: dayRow.id,
        exercise_id: ex.exerciseId,
        order_index: index + 1,
        sets: ex.sets,
        reps_min: ex.repsMin,
        reps_max: ex.repsMax,
        rir_target: ex.rir,
        rest_seconds: ex.restSeconds,
        coach_notes: ex.notes,
        weight_increment: ex.weightIncrement,
        warmup_type: ex.warmupType,
        warmup_fixed_weight_kg: ex.warmupFixedWeightKg,
        ...trackingTargetColumns(ex),
      }))
    );

    if (exercisesError) {
      console.error("insertRoutineDays exercises insert error:", exercisesError);
      return `No se pudieron guardar los ejercicios del día ${i + 1}.`;
    }
  }

  return null;
}
