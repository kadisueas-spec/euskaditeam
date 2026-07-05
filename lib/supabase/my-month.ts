import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import {
  getCurrentMonthGoal,
  getMonthKey,
  getPreviousMonthKey,
  isMonthEndToday,
  type MonthlyGoal,
} from "@/lib/supabase/monthly-goals";
import { getClientStats } from "@/lib/supabase/stats";

export type MyMonthProgress = {
  goal: MonthlyGoal | null;
  trainedDays: number;
  plannedDays: number;
  streak: number;
  isUnlocked: boolean;
  totalDaysInMonth: number;
  trainedDates: string[];
  daysUntilUnlock: number;
};

function daysInMonth(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
}

type RoutineWithDayCountRow = {
  id: string;
  routine_days: { count: number }[];
};

// Antes: hasta 5 round trips secuenciales (client, goal, logs, activeRoutine,
// routine_days count) + los 7 internos de getClientStats = ~12.
// Ahora: client y goal memoizados (gratis si ya se pidieron antes en el
// request) + 3 consultas independientes en paralelo (logs, rutina con
// conteo de días embebido, stats ya optimizado a su vez).
export async function getMyMonthProgress(): Promise<MyMonthProgress | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();
  const now = new Date();
  const totalDays = daysInMonth(now);
  const isUnlocked = isMonthEndToday(now);
  const monthPrefix = now.toISOString().slice(0, 7);

  const [goal, { data: logs }, { data: activeRoutine }, stats] = await Promise.all([
    getCurrentMonthGoal(),
    supabase
      .from("workout_logs")
      .select("workout_date")
      .eq("client_id", client.id)
      .gte("workout_date", `${monthPrefix}-01`),
    supabase
      .from("routines")
      .select("id, routine_days(count)")
      .eq("client_id", client.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<RoutineWithDayCountRow | null>(),
    getClientStats(),
  ]);

  const trainedDates = Array.from(
    new Set((logs ?? []).map((l) => l.workout_date))
  );
  const trainedDays = trainedDates.length;

  const plannedDaysPerWeek = activeRoutine?.routine_days[0]?.count ?? 0;
  const weeksInMonth = Math.ceil(totalDays / 7);
  const plannedDays = plannedDaysPerWeek * weeksInMonth;

  return {
    goal,
    trainedDays,
    plannedDays,
    streak: stats.streak,
    isUnlocked,
    totalDaysInMonth: totalDays,
    trainedDates,
    daysUntilUnlock: totalDays - now.getUTCDate(),
  };
}

export type ExerciseProgressSummary = {
  exerciseName: string;
  firstWeight: number | null;
  lastWeight: number | null;
};

export type PreviousMonthComparison = {
  volume: number;
  trainedDays: number;
} | null;

export type CoachMonthReview = {
  summary: string | null;
  nextMonthGoals: string | null;
  planAdjustments: string | null;
  completedAt: string | null;
};

export type MyMonthUnlocked = {
  goal: MonthlyGoal;
  currentWeightKg: number | null;
  adherencePercent: number;
  totalVolume: number;
  topExercises: ExerciseProgressSummary[];
  previousMonth: PreviousMonthComparison;
  coachReview: CoachMonthReview | null;
};

type LogWithSetsRow = {
  id: string;
  workout_set_logs: {
    routine_exercise_id: string | null;
    weight_kg: number | null;
    reps_completed: number | null;
    created_at: string;
    routine_exercises: { exercise_id: string; exercises: { name: string } | null } | null;
  }[];
};

type PrevLogWithSetsRow = {
  id: string;
  workout_date: string;
  workout_set_logs: { weight_kg: number | null; reps_completed: number | null }[];
};

// Antes: ~15-20 round trips secuenciales (client, goal, stats [7 propios],
// currentLogs, currentSets, routineExercises, exercises, prevLogs, prevSets,
// review). Ahora: client y goal memoizados + 4 consultas independientes en
// un solo Promise.all (stats ya optimizado, logs actuales con sets
// embebidos, logs del mes anterior con sets embebidos, review) — el
// equivalente a 1 round trip.
export async function getMyMonthUnlockedData(): Promise<MyMonthUnlocked | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const goal = await getCurrentMonthGoal();
  if (!goal) return null;

  const supabase = await createClient();
  const now = new Date();
  const monthPrefix = now.toISOString().slice(0, 7);
  const prevMonthPrefix = getPreviousMonthKey(now).slice(0, 7);

  const [stats, { data: currentLogsWithSets }, { data: prevLogsWithSets }, { data: review }] =
    await Promise.all([
      getClientStats(),
      supabase
        .from("workout_logs")
        .select(
          `id,
           workout_set_logs (
             routine_exercise_id, weight_kg, reps_completed, created_at,
             routine_exercises ( exercise_id, exercises ( name ) )
           )`
        )
        .eq("client_id", client.id)
        .gte("workout_date", `${monthPrefix}-01`)
        .returns<LogWithSetsRow[]>(),
      supabase
        .from("workout_logs")
        .select(
          `id, workout_date,
           workout_set_logs ( weight_kg, reps_completed )`
        )
        .eq("client_id", client.id)
        .gte("workout_date", `${prevMonthPrefix}-01`)
        .lt("workout_date", `${monthPrefix}-01`)
        .returns<PrevLogWithSetsRow[]>(),
      supabase
        .from("monthly_reviews")
        .select("summary, next_month_goals, plan_adjustments, completed_at")
        .eq("client_id", client.id)
        .eq("month", getMonthKey())
        .maybeSingle(),
    ]);

  let totalVolume = 0;
  const setsByExerciseId = new Map<string, (number | null)[]>();
  const exerciseNameById = new Map<string, string>();
  // Orden de aparición preservado (igual que antes, que ordenaba por
  // created_at ascendente dentro de cada grupo de exerciseId).
  const allSets = (currentLogsWithSets ?? [])
    .flatMap((log) => log.workout_set_logs)
    .sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  for (const s of allSets) {
    if (s.weight_kg != null && s.reps_completed != null) {
      totalVolume += s.weight_kg * s.reps_completed;
    }
    const exerciseId = s.routine_exercises?.exercise_id;
    if (exerciseId) {
      const list = setsByExerciseId.get(exerciseId) ?? [];
      list.push(s.weight_kg);
      setsByExerciseId.set(exerciseId, list);
      if (s.routine_exercises?.exercises?.name) {
        exerciseNameById.set(exerciseId, s.routine_exercises.exercises.name);
      }
    }
  }

  const topExercises: ExerciseProgressSummary[] = Array.from(
    setsByExerciseId.entries()
  )
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([exerciseId, weights]) => {
      const nonNullWeights = weights.filter((w): w is number => w != null);
      return {
        exerciseName: exerciseNameById.get(exerciseId) ?? "Ejercicio",
        firstWeight: nonNullWeights[0] ?? null,
        lastWeight: nonNullWeights[nonNullWeights.length - 1] ?? null,
      };
    });

  let previousMonth: PreviousMonthComparison = null;
  const prevRows = prevLogsWithSets ?? [];
  if (prevRows.length > 0) {
    let prevVolume = 0;
    for (const log of prevRows) {
      for (const s of log.workout_set_logs) {
        if (s.weight_kg != null && s.reps_completed != null) {
          prevVolume += s.weight_kg * s.reps_completed;
        }
      }
    }

    previousMonth = {
      volume: Math.round(prevVolume),
      trainedDays: new Set(prevRows.map((l) => l.workout_date)).size,
    };
  }

  return {
    goal,
    currentWeightKg: client.weightKg,
    adherencePercent: stats.adherencePercent,
    totalVolume: Math.round(totalVolume),
    topExercises,
    previousMonth,
    coachReview: review
      ? {
          summary: review.summary,
          nextMonthGoals: review.next_month_goals,
          planAdjustments: review.plan_adjustments,
          completedAt: review.completed_at,
        }
      : null,
  };
}
