import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { mondayKeyFor, addWeeks } from "@/lib/utils/week";

// Fase 9 — Métricas Avanzadas de Entrenamiento. Todo se calcula agregando
// workout_set_logs (peso/reps/RIR por serie) + exercises.muscle_group, no
// hace falta ninguna tabla nueva. Toda serie cargada cuenta como "efectiva"
// (el schema no distingue calentamiento de series de trabajo), y las
// sesiones no finalizadas también entran (las series ya quedaron guardadas
// en el servidor apenas se completan, ver Fase 3).

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const UNCATEGORIZED = "Sin categoría";

export type MetricsRange = "week" | "month" | "block";

function dateLabel(ms: number) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(
    new Date(ms)
  );
}

type Bucket = { key: string; label: string; startMs: number; endMs: number };

// "Bloque" = mesociclo estandarizado de 4 semanas (no es una tabla de la
// base, es una agrupación de 4 semanas calendario a partir de hoy).
function buildBuckets(range: MetricsRange, now: Date): Bucket[] {
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const currentMonday = mondayKeyFor(todayStart.toISOString().slice(0, 10));

  if (range === "week") {
    return Array.from({ length: 8 }, (_, i) => {
      const startKey = addWeeks(currentMonday, i - 7);
      const startMs = new Date(`${startKey}T00:00:00Z`).getTime();
      return { key: startKey, label: dateLabel(startMs), startMs, endMs: startMs + WEEK_MS };
    });
  }

  if (range === "month") {
    return Array.from({ length: 6 }, (_, i) => {
      const monthsAgo = 5 - i;
      const start = new Date(
        Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth() - monthsAgo, 1)
      );
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      const label = new Intl.DateTimeFormat("es-AR", {
        month: "short",
        year: "2-digit",
      }).format(start);
      return {
        key: start.toISOString().slice(0, 7),
        label,
        startMs: start.getTime(),
        endMs: end.getTime(),
      };
    });
  }

  return Array.from({ length: 6 }, (_, i) => {
    const blocksAgo = 5 - i;
    const startKey = addWeeks(currentMonday, -(blocksAgo * 4 + 3));
    const startMs = new Date(`${startKey}T00:00:00Z`).getTime();
    return { key: startKey, label: dateLabel(startMs), startMs, endMs: startMs + 4 * WEEK_MS };
  });
}

function bucketFor(buckets: Bucket[], dateStr: string): Bucket | undefined {
  const ms = new Date(`${dateStr}T00:00:00Z`).getTime();
  return buckets.find((b) => ms >= b.startMs && ms < b.endMs);
}

type RawSetRow = {
  workout_log_id: string;
  weight_kg: number | null;
  reps_completed: number | null;
  rir_actual: number | null;
  routine_exercises: {
    exercise_id: string;
    exercises: { name: string; muscle_group: string | null } | null;
  } | null;
  workout_logs: { workout_date: string } | null;
};

async function fetchRawSets(clientId: string, windowStartMs: number): Promise<RawSetRow[]> {
  const supabase = await createClient();
  const startDate = new Date(windowStartMs).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("workout_set_logs")
    .select(
      `workout_log_id, weight_kg, reps_completed, rir_actual,
       routine_exercises ( exercise_id, exercises ( name, muscle_group ) ),
       workout_logs!inner ( workout_date, client_id )`
    )
    .eq("workout_logs.client_id", clientId)
    .gte("workout_logs.workout_date", startDate)
    .returns<RawSetRow[]>();

  return data ?? [];
}

export type MuscleGroupTotal = { muscleGroup: string; tonnage: number; sets: number };
export type ExerciseTotal = {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  tonnage: number;
  sets: number;
};
// "Volumen por sesión" = cantidad de SERIES TOTALES por sesión (no
// tonelaje — eso ya está cubierto por el tonelaje por grupo muscular y por
// ejercicio más abajo).
export type SessionVolumePoint = { date: string; label: string; totalSets: number };
export type MuscleGroupTonnageSeries = {
  muscleGroups: string[];
  // cada punto: { label: string, [grupoMuscular]: number } — recharts consume
  // objetos planos, por eso no se tipa cada grupo muscular individualmente.
  points: Record<string, number | string>[];
};
export type ExerciseTonnageSeries = {
  exerciseId: string;
  exerciseName: string;
  points: { label: string; tonnage: number }[];
};
export type ExerciseLoadSeries = {
  exerciseId: string;
  exerciseName: string;
  points: { label: string; maxWeight: number | null }[];
};
// % calculado por cantidad de series (no por tonelaje), sobre las series que
// tienen RIR cargado en ese bucket.
export type RirDistributionPoint = {
  bucket: string;
  rir3: number;
  rir2: number;
  rir1: number;
  rir0: number;
  totalSetsWithRir: number;
};

// Peso máximo/promedio por EJERCICIO, un punto por sesión real entrenada
// (no por bucket semana/mes/bloque) — el eje X son las fechas reales en las
// que se cargó ese ejercicio, con huecos donde no se entrenó. Mejora sobre
// Fase 9 (jul-2026): es el gráfico más motivador para el cliente ("mirá
// cómo subió tu peso"), así que se calcula aparte de los buckets de rango.
export type ExerciseSessionPoint = {
  date: string;
  label: string;
  maxWeight: number;
  avgWeight: number;
};
export type ExerciseSessionSeries = {
  exerciseId: string;
  exerciseName: string;
  points: ExerciseSessionPoint[];
};

export type ClientMetrics = {
  range: MetricsRange;
  totalTonnage: number;
  totalSets: number;
  muscleGroupTotals: MuscleGroupTotal[];
  exerciseTotals: ExerciseTotal[];
  sessionVolume: SessionVolumePoint[];
  muscleGroupTonnageOverTime: MuscleGroupTonnageSeries;
  exerciseTonnageOverTime: ExerciseTonnageSeries[];
  exerciseLoadOverTime: ExerciseLoadSeries[];
  rirDistribution: RirDistributionPoint[];
};

function computeMetrics(rows: RawSetRow[], range: MetricsRange, now: Date): ClientMetrics {
  const buckets = buildBuckets(range, now);

  let totalTonnage = 0;
  let totalSets = 0;

  const muscleGroupTotals = new Map<string, { tonnage: number; sets: number }>();
  const exerciseTotals = new Map<
    string,
    { name: string; muscleGroup: string; tonnage: number; sets: number }
  >();
  const sessionSets = new Map<string, number>();
  const sessionDate = new Map<string, string>();

  const muscleGroupByBucket = new Map<string, Map<string, number>>();
  const exerciseTonnageByBucket = new Map<string, Map<string, number>>();
  const exerciseMaxWeightByBucket = new Map<string, Map<string, number>>();
  const rirCountsByBucket = new Map<
    string,
    { rir3: number; rir2: number; rir1: number; rir0: number; total: number }
  >();

  for (const row of rows) {
    const workoutDate = row.workout_logs?.workout_date;
    if (!workoutDate) continue;
    const bucket = bucketFor(buckets, workoutDate);

    const exerciseId = row.routine_exercises?.exercise_id;
    const exerciseName = row.routine_exercises?.exercises?.name ?? "Ejercicio";
    const muscleGroup = row.routine_exercises?.exercises?.muscle_group ?? UNCATEGORIZED;

    totalSets++;
    sessionDate.set(row.workout_log_id, workoutDate);

    const tonnage =
      row.weight_kg != null && row.reps_completed != null
        ? row.weight_kg * row.reps_completed
        : 0;

    totalTonnage += tonnage;
    sessionSets.set(row.workout_log_id, (sessionSets.get(row.workout_log_id) ?? 0) + 1);

    const mgTotal = muscleGroupTotals.get(muscleGroup) ?? { tonnage: 0, sets: 0 };
    mgTotal.tonnage += tonnage;
    mgTotal.sets += 1;
    muscleGroupTotals.set(muscleGroup, mgTotal);

    if (bucket) {
      const mgBucket = muscleGroupByBucket.get(bucket.key) ?? new Map<string, number>();
      mgBucket.set(muscleGroup, (mgBucket.get(muscleGroup) ?? 0) + tonnage);
      muscleGroupByBucket.set(bucket.key, mgBucket);
    }

    if (exerciseId) {
      const exTotal =
        exerciseTotals.get(exerciseId) ?? { name: exerciseName, muscleGroup, tonnage: 0, sets: 0 };
      exTotal.tonnage += tonnage;
      exTotal.sets += 1;
      exerciseTotals.set(exerciseId, exTotal);

      if (bucket) {
        const tonnageBuckets =
          exerciseTonnageByBucket.get(exerciseId) ?? new Map<string, number>();
        tonnageBuckets.set(bucket.key, (tonnageBuckets.get(bucket.key) ?? 0) + tonnage);
        exerciseTonnageByBucket.set(exerciseId, tonnageBuckets);

        if (row.weight_kg != null) {
          const weightBuckets =
            exerciseMaxWeightByBucket.get(exerciseId) ?? new Map<string, number>();
          weightBuckets.set(
            bucket.key,
            Math.max(weightBuckets.get(bucket.key) ?? 0, row.weight_kg)
          );
          exerciseMaxWeightByBucket.set(exerciseId, weightBuckets);
        }
      }
    }

    if (bucket && row.rir_actual != null) {
      const rirBucket =
        rirCountsByBucket.get(bucket.key) ?? { rir3: 0, rir2: 0, rir1: 0, rir0: 0, total: 0 };
      if (row.rir_actual >= 3) rirBucket.rir3++;
      else if (row.rir_actual === 2) rirBucket.rir2++;
      else if (row.rir_actual === 1) rirBucket.rir1++;
      else rirBucket.rir0++;
      rirBucket.total++;
      rirCountsByBucket.set(bucket.key, rirBucket);
    }
  }

  const muscleGroupTotalsArr: MuscleGroupTotal[] = Array.from(muscleGroupTotals.entries())
    .map(([muscleGroup, v]) => ({
      muscleGroup,
      tonnage: Math.round(v.tonnage),
      sets: v.sets,
    }))
    .sort((a, b) => b.tonnage - a.tonnage);

  const exerciseTotalsArr: ExerciseTotal[] = Array.from(exerciseTotals.entries())
    .map(([exerciseId, v]) => ({
      exerciseId,
      exerciseName: v.name,
      muscleGroup: v.muscleGroup,
      tonnage: Math.round(v.tonnage),
      sets: v.sets,
    }))
    .sort((a, b) => b.tonnage - a.tonnage);

  const sessionVolume: SessionVolumePoint[] = Array.from(sessionSets.entries())
    .map(([logId, totalSets]) => {
      const date = sessionDate.get(logId)!;
      return {
        date,
        label: dateLabel(new Date(`${date}T00:00:00Z`).getTime()),
        totalSets,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const muscleGroupsPresent = Array.from(muscleGroupTotals.keys());
  const muscleGroupTonnageOverTime: MuscleGroupTonnageSeries = {
    muscleGroups: muscleGroupsPresent,
    points: buckets.map((b) => {
      const point: Record<string, number | string> = { label: b.label };
      const bucketData = muscleGroupByBucket.get(b.key);
      for (const mg of muscleGroupsPresent) {
        point[mg] = Math.round(bucketData?.get(mg) ?? 0);
      }
      return point;
    }),
  };

  const exerciseTonnageOverTime: ExerciseTonnageSeries[] = Array.from(
    exerciseTonnageByBucket.entries()
  ).map(([exerciseId, bucketMap]) => ({
    exerciseId,
    exerciseName: exerciseTotals.get(exerciseId)?.name ?? "Ejercicio",
    points: buckets.map((b) => ({ label: b.label, tonnage: Math.round(bucketMap.get(b.key) ?? 0) })),
  }));

  const exerciseLoadOverTime: ExerciseLoadSeries[] = Array.from(
    exerciseMaxWeightByBucket.entries()
  ).map(([exerciseId, bucketMap]) => ({
    exerciseId,
    exerciseName: exerciseTotals.get(exerciseId)?.name ?? "Ejercicio",
    points: buckets.map((b) => ({
      label: b.label,
      maxWeight: bucketMap.has(b.key) ? bucketMap.get(b.key)! : null,
    })),
  }));

  const rirDistribution: RirDistributionPoint[] = buckets.map((b) => {
    const counts = rirCountsByBucket.get(b.key);
    const total = counts?.total ?? 0;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      bucket: b.label,
      rir3: counts ? pct(counts.rir3) : 0,
      rir2: counts ? pct(counts.rir2) : 0,
      rir1: counts ? pct(counts.rir1) : 0,
      rir0: counts ? pct(counts.rir0) : 0,
      totalSetsWithRir: total,
    };
  });

  return {
    range,
    totalTonnage: Math.round(totalTonnage),
    totalSets,
    muscleGroupTotals: muscleGroupTotalsArr,
    exerciseTotals: exerciseTotalsArr,
    sessionVolume,
    muscleGroupTonnageOverTime,
    exerciseTonnageOverTime,
    exerciseLoadOverTime,
    rirDistribution,
  };
}

export async function getClientMetrics(
  clientId: string,
  range: MetricsRange = "week"
): Promise<ClientMetrics> {
  const now = new Date();
  const buckets = buildBuckets(range, now);
  const rows = await fetchRawSets(clientId, buckets[0].startMs);
  return computeMetrics(rows, range, now);
}

export async function getMyMetrics(range: MetricsRange = "week"): Promise<ClientMetrics | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;
  return getClientMetrics(client.id, range);
}

function buildExerciseSessionSeries(rows: RawSetRow[]): ExerciseSessionSeries[] {
  type SessionAgg = { date: string; max: number; sum: number; count: number };
  const byExercise = new Map<string, Map<string, SessionAgg>>();
  const exerciseNameById = new Map<string, string>();

  for (const row of rows) {
    const workoutDate = row.workout_logs?.workout_date;
    const exerciseId = row.routine_exercises?.exercise_id;
    if (!workoutDate || !exerciseId || row.weight_kg == null) continue;

    exerciseNameById.set(exerciseId, row.routine_exercises?.exercises?.name ?? "Ejercicio");

    const sessions = byExercise.get(exerciseId) ?? new Map<string, SessionAgg>();
    const agg = sessions.get(row.workout_log_id) ?? {
      date: workoutDate,
      max: -Infinity,
      sum: 0,
      count: 0,
    };
    agg.max = Math.max(agg.max, row.weight_kg);
    agg.sum += row.weight_kg;
    agg.count += 1;
    sessions.set(row.workout_log_id, agg);
    byExercise.set(exerciseId, sessions);
  }

  return Array.from(byExercise.entries()).map(([exerciseId, sessions]) => ({
    exerciseId,
    exerciseName: exerciseNameById.get(exerciseId) ?? "Ejercicio",
    points: Array.from(sessions.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({
        date: s.date,
        label: dateLabel(new Date(`${s.date}T00:00:00Z`).getTime()),
        maxWeight: s.max,
        avgWeight: Math.round((s.sum / s.count) * 10) / 10,
      })),
  }));
}

// Historial completo (sin límite de rango) — a diferencia de getClientMetrics,
// que recorta a la ventana del bucket seleccionado. windowStartMs=0 reutiliza
// fetchRawSets sin fecha piso.
export async function getExerciseSessionSeries(clientId: string): Promise<ExerciseSessionSeries[]> {
  const rows = await fetchRawSets(clientId, 0);
  return buildExerciseSessionSeries(rows);
}

export async function getMyExerciseSessionSeries(): Promise<ExerciseSessionSeries[]> {
  const client = await getCurrentClientRecord();
  if (!client) return [];
  return getExerciseSessionSeries(client.id);
}
