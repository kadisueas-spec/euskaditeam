import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import { getClientStats } from "@/lib/supabase/stats";
import { getMonthKey, getPreviousMonthKey, isMonthEndToday } from "@/lib/supabase/monthly-goals";
import { daysInMonth } from "@/lib/supabase/my-month";
import { mondayKeyFor, addWeeks } from "@/lib/utils/week";
import {
  bestSetByExercise,
  detectWeeklyRecord,
  summarizeSessionRecords,
  type SessionRecord,
} from "@/lib/utils/session-records";
import {
  buildExerciseSessionSeries,
  type ExerciseSessionPoint,
  type RawSetRow,
} from "@/lib/supabase/metrics";
import {
  computeMonthHighlight,
  PERIMETER_TYPES,
  type MonthHighlight,
  type MonthHighlightInput,
} from "@/lib/utils/month-highlight";
import type { PerimeterType } from "@/lib/anthropometrics/constants";

const DAY_MS = 24 * 60 * 60 * 1000;

// Resumen mensual completo de "Mi Mes" (jul-2026) — reemplaza el contenido
// de MyMonthUnlocked. Todo se calcula acá en una sola pasada (varias
// consultas en paralelo) para que la página no tenga que pedir nada más.
// El gate de bloqueo (isMonthEndToday) NO se toca — sigue viviendo en
// getMyMonthProgress/my-month.ts tal cual estaba.

function firstDayOfNextMonth(monthPrefix: string): string {
  const [y, m] = monthPrefix.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

function percentDiff(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// Racha simple de días CALENDARIO consecutivos con al menos un
// entrenamiento — a propósito más simple que dailyStreak de stats.ts (esa
// está pensada para evaluarse "hoy", no para una ventana cerrada del
// pasado como "el mes que acaba de terminar").
function longestConsecutiveRun(datesAsc: string[]): number {
  if (datesAsc.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < datesAsc.length; i++) {
    const prevMs = new Date(`${datesAsc[i - 1]}T00:00:00Z`).getTime();
    const currMs = new Date(`${datesAsc[i]}T00:00:00Z`).getTime();
    current = currMs - prevMs === DAY_MS ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

// Datos de respaldo de la IMAGEN de compartir (jul-2026) — ver comentario
// en MyMonthSummary.shareBackups. Prioridad fija pedida: 1º racha máxima
// de días del mes (solo si >=5, un número menor no es un logro), 2º
// entrenamientos completados, 3º semanas completas. Si el logro principal
// YA es "constancia" (entrenamientos), ese dato no se repite como
// respaldo — se usa racha, semanas completas y récords en su lugar, con
// tonelaje como último relleno para nunca quedar con menos de 2 líneas
// (antes: la tarjeta de respaldo podía salir directamente vacía cuando el
// mes era flojo y "constancia" ganaba por fallback, ver computeMonthHighlight).
function buildShareBackups(params: {
  isConsistencyMain: boolean;
  longestDailyStreakInMonth: number;
  trainedDays: number;
  completeWeeksCount: number;
  recordsCount: number;
  totalVolume: number;
}): string[] {
  const {
    isConsistencyMain,
    longestDailyStreakInMonth,
    trainedDays,
    completeWeeksCount,
    recordsCount,
    totalVolume,
  } = params;

  const streakLine =
    longestDailyStreakInMonth >= 5 ? `${longestDailyStreakInMonth} días seguidos entrenando` : null;
  const weeksLine =
    completeWeeksCount > 0
      ? `${completeWeeksCount} ${pluralize(completeWeeksCount, "semana completa", "semanas completas")}`
      : null;

  if (isConsistencyMain) {
    const recordsLine =
      recordsCount > 0
        ? `${recordsCount} ${pluralize(recordsCount, "récord personal", "récords personales")}`
        : null;
    const volumeLine =
      totalVolume > 0 ? `${totalVolume.toLocaleString("es-AR")} kg movidos este mes` : null;
    return [streakLine, weeksLine, recordsLine, volumeLine]
      .filter((l): l is string => l != null)
      .slice(0, 2);
  }

  const trainedLine = trainedDays > 0 ? `${trainedDays} entrenamientos` : null;
  return [streakLine, trainedLine, weeksLine].filter((l): l is string => l != null).slice(0, 2);
}

export type MonthNumberComparison = { diffPercent: number; direction: "up" | "down" } | null;

export type MonthSummaryNumbers = {
  trainedDays: number;
  plannedDays: number;
  adherencePercent: number;
  totalSets: number;
  totalVolume: number;
  vsTrainedDays: MonthNumberComparison;
  vsAdherencePercent: MonthNumberComparison;
  vsTotalSets: MonthNumberComparison;
  vsTotalVolume: MonthNumberComparison;
  previousMonthLabel: string | null;
};

export type MonthSummaryStreaks = {
  longestDailyStreakInMonth: number;
  completeWeeksCount: number;
  currentWeeklyStreak: number;
  isNewStreakRecord: boolean;
};

export type MonthSummaryRecords = {
  totalCount: number;
  records: SessionRecord[];
};

export type MonthTopExercise = {
  exerciseId: string;
  exerciseName: string;
  firstWeight: number;
  lastWeight: number;
  diff: number;
  points: ExerciseSessionPoint[];
};

export type MonthBodyComposition = {
  evaluationsCount: number;
  firstDate: string;
  lastDate: string;
  weightKg: { first: number; last: number; diff: number };
  bodyFatPercentage: { first: number; last: number; diff: number } | null;
  muscleMassKg: { first: number; last: number; diff: number } | null;
};

export type MyMonthSummary = {
  monthLabel: string;
  clientFirstName: string;
  numbers: MonthSummaryNumbers;
  streaks: MonthSummaryStreaks;
  records: MonthSummaryRecords;
  topExercises: MonthTopExercise[];
  bodyComposition: MonthBodyComposition | null;
  highlight: MonthHighlight | null;
  // Datos de respaldo para la IMAGEN de compartir (jul-2026) — a
  // diferencia de highlight.backups (que compite por score genérico entre
  // candidatos y casi siempre queda vacío cuando el logro principal es
  // "constancia", ver buildShareBackups), esto sigue una prioridad fija
  // pedida explícitamente: 1º racha máxima de días del mes (si es 5 o
  // más), 2º entrenamientos completados, 3º semanas completas — y en el
  // caso puntual de que el logro principal YA sea "constancia"
  // (entrenamientos), no se repite ese dato: se usa racha máxima, semanas
  // completas y récords en su lugar, para no mostrar el mismo número dos
  // veces y garantizar al menos 2 líneas.
  shareBackups: string[];
};

type MonthSetRow = Omit<RawSetRow, "workout_logs"> & {
  routine_exercise_id: string | null;
  workout_logs: { workout_date: string; is_completed: boolean } | null;
};

type EvaluationRow = {
  evaluation_date: string;
  weight_kg: number;
  body_fat_percentage: number | null;
  muscle_mass_kg: number | null;
  body_measurements: { measurement_type: string; value: number }[];
};

type RoutineWithDayCountRow = { id: string; routine_days: { count: number }[] };

export async function getMyMonthSummary(): Promise<MyMonthSummary | null> {
  if (!isMonthEndToday()) return null;

  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();
  const now = new Date();
  const monthKey = getMonthKey(now);
  const monthPrefix = monthKey.slice(0, 7);
  const monthStart = `${monthPrefix}-01`;
  const monthEndExclusive = firstDayOfNextMonth(monthPrefix);
  const prevMonthPrefix = getPreviousMonthKey(now).slice(0, 7);
  const prevMonthStart = `${prevMonthPrefix}-01`;

  let weekStart = mondayKeyFor(monthStart);
  if (weekStart < monthStart) weekStart = addWeeks(weekStart, 1);
  const weeksOfMonth: string[] = [];
  while (weekStart < monthEndExclusive) {
    weeksOfMonth.push(weekStart);
    weekStart = addWeeks(weekStart, 1);
  }
  const paddedStart = weeksOfMonth.length > 0 ? addWeeks(weeksOfMonth[0], -1) : monthStart;

  const [
    profile,
    stats,
    { data: activeRoutine },
    { data: monthLogs },
    { data: prevMonthLogs },
    { data: paddedSetRows },
    { data: prevMonthSetRows },
    { data: completeWeeks },
    { data: evaluations },
  ] = await Promise.all([
    getCurrentProfile(),
    getClientStats(),
    supabase
      .from("routines")
      .select("id, routine_days(count)")
      .eq("client_id", client.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<RoutineWithDayCountRow | null>(),
    supabase
      .from("workout_logs")
      .select("workout_date")
      .eq("client_id", client.id)
      .eq("is_completed", true)
      .lt("workout_date", monthEndExclusive),
    supabase
      .from("workout_logs")
      .select("workout_date")
      .eq("client_id", client.id)
      .eq("is_completed", true)
      .gte("workout_date", prevMonthStart)
      .lt("workout_date", monthStart),
    supabase
      .from("workout_set_logs")
      .select(
        `workout_log_id, routine_exercise_id, weight_kg, reps_completed, rir_actual,
         routine_exercises ( exercise_id, exercises ( name, muscle_group ) ),
         workout_logs!inner ( workout_date, client_id, is_completed )`
      )
      .eq("workout_logs.client_id", client.id)
      .gte("workout_logs.workout_date", paddedStart)
      .lt("workout_logs.workout_date", monthEndExclusive)
      .returns<MonthSetRow[]>(),
    supabase
      .from("workout_set_logs")
      .select(
        `workout_log_id, routine_exercise_id, weight_kg, reps_completed, rir_actual,
         routine_exercises ( exercise_id, exercises ( name, muscle_group ) ),
         workout_logs!inner ( workout_date, client_id, is_completed )`
      )
      .eq("workout_logs.client_id", client.id)
      .gte("workout_logs.workout_date", prevMonthStart)
      .lt("workout_logs.workout_date", monthStart)
      .returns<MonthSetRow[]>(),
    supabase
      .from("weekly_celebrations")
      .select("id")
      .eq("client_id", client.id)
      .gte("week_start", monthStart)
      .lt("week_start", monthEndExclusive),
    supabase
      .from("anthropometric_evaluations")
      .select(
        `evaluation_date, weight_kg, body_fat_percentage, muscle_mass_kg,
         body_measurements ( measurement_type, value )`
      )
      .eq("client_id", client.id)
      .gte("evaluation_date", monthStart)
      .lt("evaluation_date", monthEndExclusive)
      .order("evaluation_date", { ascending: true })
      .returns<EvaluationRow[]>(),
  ]);

  const plannedDaysPerWeek = activeRoutine?.routine_days[0]?.count ?? 0;
  const weeksInMonth = Math.ceil(daysInMonth(now) / 7);
  const weeksInPrevMonth = Math.ceil(
    daysInMonth(new Date(`${prevMonthStart}T00:00:00Z`)) / 7
  );

  // --- Números del mes ---
  const trainedDatesAllTime = Array.from(
    new Set((monthLogs ?? []).map((l) => l.workout_date))
  ).sort();
  const trainedDaysThisMonth = trainedDatesAllTime.filter(
    (d) => d >= monthStart
  ).length;
  const prevTrainedDays = new Set((prevMonthLogs ?? []).map((l) => l.workout_date)).size;

  const allRowsThisMonth = (paddedSetRows ?? []).filter(
    (r) => r.workout_logs && r.workout_logs.workout_date >= monthStart
  );
  const totalSets = allRowsThisMonth.length;
  const totalVolume = Math.round(
    allRowsThisMonth.reduce(
      (sum, r) => sum + (r.weight_kg != null && r.reps_completed != null ? r.weight_kg * r.reps_completed : 0),
      0
    )
  );
  const prevTotalSets = (prevMonthSetRows ?? []).length;
  const prevTotalVolume = Math.round(
    (prevMonthSetRows ?? []).reduce(
      (sum, r) => sum + (r.weight_kg != null && r.reps_completed != null ? r.weight_kg * r.reps_completed : 0),
      0
    )
  );

  const plannedDays = plannedDaysPerWeek * weeksInMonth;
  const adherencePercent = stats.adherencePercent;
  const prevPlannedDays = plannedDaysPerWeek * weeksInPrevMonth;
  const prevAdherencePercent =
    prevPlannedDays > 0 ? Math.min(100, Math.round((prevTrainedDays / prevPlannedDays) * 100)) : 0;

  const hasPreviousMonthData = (prevMonthLogs ?? []).length > 0 || (prevMonthSetRows ?? []).length > 0;
  const previousMonthLabel = hasPreviousMonthData
    ? new Intl.DateTimeFormat("es-AR", { month: "long" }).format(
        new Date(`${prevMonthStart}T00:00:00Z`)
      )
    : null;

  function comparison(current: number, previous: number): MonthNumberComparison {
    if (!hasPreviousMonthData) return null;
    const diff = percentDiff(current, previous);
    if (diff == null) return null;
    return { diffPercent: Math.abs(diff), direction: diff >= 0 ? "up" : "down" };
  }

  const numbers: MonthSummaryNumbers = {
    trainedDays: trainedDaysThisMonth,
    plannedDays,
    adherencePercent,
    totalSets,
    totalVolume,
    vsTrainedDays: comparison(trainedDaysThisMonth, prevTrainedDays),
    vsAdherencePercent: comparison(adherencePercent, prevAdherencePercent),
    vsTotalSets: comparison(totalSets, prevTotalSets),
    vsTotalVolume: comparison(totalVolume, prevTotalVolume),
    previousMonthLabel,
  };

  // --- Rachas ---
  const datesBeforeMonth = trainedDatesAllTime.filter((d) => d < monthStart);
  const datesInMonth = trainedDatesAllTime.filter((d) => d >= monthStart);
  const longestDailyStreakInMonth = longestConsecutiveRun(datesInMonth);
  const longestDailyStreakBeforeMonth = longestConsecutiveRun(datesBeforeMonth);

  const streaks: MonthSummaryStreaks = {
    longestDailyStreakInMonth,
    completeWeeksCount: (completeWeeks ?? []).length,
    currentWeeklyStreak: stats.weeklyStreak,
    isNewStreakRecord:
      datesBeforeMonth.length > 0 && longestDailyStreakInMonth > longestDailyStreakBeforeMonth,
  };

  // --- Récords del mes: misma comparación semana-vs-semana-anterior que la
  // celebración semanal, corrida para cada semana del mes en vez de solo
  // "esta semana" ---
  const completedRows = (paddedSetRows ?? []).filter((r) => r.workout_logs && r.workout_logs.is_completed);
  const recordHits: SessionRecord[] = [];
  for (const wStart of weeksOfMonth) {
    const wEnd = addWeeks(wStart, 1);
    const prevWStart = addWeeks(wStart, -1);
    const weekRows = completedRows.filter(
      (r) => r.workout_logs!.workout_date >= wStart && r.workout_logs!.workout_date < wEnd
    );
    const prevWeekRows = completedRows.filter(
      (r) => r.workout_logs!.workout_date >= prevWStart && r.workout_logs!.workout_date < wStart
    );
    const weekBest = bestSetByExercise(weekRows);
    const prevWeekBest = bestSetByExercise(prevWeekRows);

    for (const [routineExerciseId, row] of weekBest) {
      const prev = prevWeekBest.get(routineExerciseId);
      if (!prev || prev.weight_kg == null || prev.reps_completed == null) continue;
      const detected = detectWeeklyRecord(
        { weight: prev.weight_kg, reps: prev.reps_completed, rir: prev.rir_actual },
        { weight: row.weight_kg, reps: row.reps_completed, rir: row.rir_actual }
      );
      if (!detected) continue;
      recordHits.push({
        id: crypto.randomUUID(),
        exerciseId: routineExerciseId,
        exerciseName: row.routine_exercises?.exercises?.name ?? "Ejercicio",
        weight: row.weight_kg as number,
        reps: row.reps_completed,
        rir: row.rir_actual,
        ...detected,
      });
    }
  }

  const records: MonthSummaryRecords = {
    totalCount: recordHits.length,
    records: summarizeSessionRecords(recordHits),
  };

  // --- Dónde más progresaste: top 3 por mayor diferencia de peso máximo,
  // exigiendo al menos 2 sesiones reales del ejercicio en el mes (una sola
  // sesión no es progresión, es ruido) ---
  const monthSeries = buildExerciseSessionSeries(allRowsThisMonth);
  const topExercises: MonthTopExercise[] = monthSeries
    .filter((s) => s.points.length >= 2)
    .map((s) => {
      const first = s.points[0];
      const last = s.points[s.points.length - 1];
      return {
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseName,
        firstWeight: first.maxWeight,
        lastWeight: last.maxWeight,
        diff: Math.round((last.maxWeight - first.maxWeight) * 100) / 100,
        points: s.points,
      };
    })
    .filter((s) => s.diff > 0)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 3);

  // --- Composición corporal: solo si hubo evaluaciones este mes ---
  const evalRows = evaluations ?? [];
  let bodyComposition: MonthBodyComposition | null = null;
  if (evalRows.length > 0) {
    const first = evalRows[0];
    const last = evalRows[evalRows.length - 1];
    bodyComposition = {
      evaluationsCount: evalRows.length,
      firstDate: first.evaluation_date,
      lastDate: last.evaluation_date,
      weightKg: {
        first: first.weight_kg,
        last: last.weight_kg,
        diff: Math.round((last.weight_kg - first.weight_kg) * 10) / 10,
      },
      bodyFatPercentage:
        first.body_fat_percentage != null && last.body_fat_percentage != null
          ? {
              first: first.body_fat_percentage,
              last: last.body_fat_percentage,
              diff: Math.round((last.body_fat_percentage - first.body_fat_percentage) * 10) / 10,
            }
          : null,
      muscleMassKg:
        first.muscle_mass_kg != null && last.muscle_mass_kg != null
          ? {
              first: first.muscle_mass_kg,
              last: last.muscle_mass_kg,
              diff: Math.round((last.muscle_mass_kg - first.muscle_mass_kg) * 10) / 10,
            }
          : null,
    };
  }

  // Medidas: solo los tipos "perímetro" (cintura, brazo, etc.) tienen
  // sentido como logro presentable — los pliegues cutáneos son datos
  // técnicos del protocolo, no algo que alguien comparte.
  const measurementPairs: MonthHighlightInput["measurementPairs"] = [];
  if (evalRows.length >= 2) {
    const firstMeasurements = new Map(
      evalRows[0].body_measurements.map((m) => [m.measurement_type, m.value])
    );
    const lastMeasurements = new Map(
      evalRows[evalRows.length - 1].body_measurements.map((m) => [m.measurement_type, m.value])
    );
    for (const type of PERIMETER_TYPES) {
      const first = firstMeasurements.get(type);
      const last = lastMeasurements.get(type);
      if (first != null && last != null) {
        measurementPairs.push({ type: type as PerimeterType, first, last });
      }
    }
  }

  const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
    new Date(`${monthStart}T00:00:00Z`)
  );
  const monthNameOnly = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(
    new Date(`${monthStart}T00:00:00Z`)
  );

  const highlight = computeMonthHighlight({
    monthNameOnly,
    clientGoal: client.goal,
    trainedDays: numbers.trainedDays,
    currentWeeklyStreak: streaks.currentWeeklyStreak,
    exerciseSeries: monthSeries,
    bodyComposition,
    measurementPairs,
  });

  const shareBackups = highlight
    ? buildShareBackups({
        isConsistencyMain: highlight.main.type === "consistency",
        longestDailyStreakInMonth: streaks.longestDailyStreakInMonth,
        trainedDays: numbers.trainedDays,
        completeWeeksCount: streaks.completeWeeksCount,
        recordsCount: records.totalCount,
        totalVolume: numbers.totalVolume,
      })
    : [];

  return {
    monthLabel,
    clientFirstName: profile?.full_name?.split(" ")[0] ?? "",
    numbers,
    streaks,
    records,
    topExercises,
    bodyComposition,
    highlight,
    shareBackups,
  };
}
