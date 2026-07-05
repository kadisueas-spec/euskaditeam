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

export async function getMyMonthProgress(): Promise<MyMonthProgress | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();
  const now = new Date();
  const totalDays = daysInMonth(now);
  const isUnlocked = isMonthEndToday(now);

  const goal = await getCurrentMonthGoal();

  const monthPrefix = now.toISOString().slice(0, 7);
  const { data: logs } = await supabase
    .from("workout_logs")
    .select("workout_date")
    .eq("client_id", client.id)
    .gte("workout_date", `${monthPrefix}-01`);

  const trainedDates = Array.from(
    new Set((logs ?? []).map((l) => l.workout_date))
  );
  const trainedDays = trainedDates.length;

  const { data: activeRoutine } = await supabase
    .from("routines")
    .select("id")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let plannedDaysPerWeek = 0;
  if (activeRoutine) {
    const { count } = await supabase
      .from("routine_days")
      .select("id", { count: "exact", head: true })
      .eq("routine_id", activeRoutine.id);
    plannedDaysPerWeek = count ?? 0;
  }

  const weeksInMonth = Math.ceil(totalDays / 7);
  const plannedDays = plannedDaysPerWeek * weeksInMonth;

  const stats = await getClientStats();

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

export async function getMyMonthUnlockedData(): Promise<MyMonthUnlocked | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const goal = await getCurrentMonthGoal();
  if (!goal) return null;

  const supabase = await createClient();
  const now = new Date();
  const monthPrefix = now.toISOString().slice(0, 7);
  const prevMonthPrefix = getPreviousMonthKey(now).slice(0, 7);

  const stats = await getClientStats();

  const { data: currentLogs } = await supabase
    .from("workout_logs")
    .select("id")
    .eq("client_id", client.id)
    .gte("workout_date", `${monthPrefix}-01`);

  const currentLogIds = (currentLogs ?? []).map((l) => l.id);

  const { data: currentSets } = currentLogIds.length
    ? await supabase
        .from("workout_set_logs")
        .select("routine_exercise_id, weight_kg, reps_completed, created_at")
        .in("workout_log_id", currentLogIds)
        .order("created_at", { ascending: true })
    : {
        data: [] as {
          routine_exercise_id: string | null;
          weight_kg: number | null;
          reps_completed: number | null;
          created_at: string;
        }[],
      };

  let totalVolume = 0;
  const setsByExercise = new Map<string, (number | null)[]>();
  for (const s of currentSets ?? []) {
    if (s.weight_kg != null && s.reps_completed != null) {
      totalVolume += s.weight_kg * s.reps_completed;
    }
    if (s.routine_exercise_id) {
      const list = setsByExercise.get(s.routine_exercise_id) ?? [];
      list.push(s.weight_kg);
      setsByExercise.set(s.routine_exercise_id, list);
    }
  }

  const routineExerciseIds = Array.from(setsByExercise.keys());
  const { data: routineExercises } = routineExerciseIds.length
    ? await supabase
        .from("routine_exercises")
        .select("id, exercise_id")
        .in("id", routineExerciseIds)
    : { data: [] as { id: string; exercise_id: string }[] };

  const exerciseIdByRoutineExerciseId = new Map(
    (routineExercises ?? []).map((re) => [re.id, re.exercise_id])
  );
  const exerciseIds = Array.from(
    new Set(Array.from(exerciseIdByRoutineExerciseId.values()))
  );

  const { data: exercises } = exerciseIds.length
    ? await supabase.from("exercises").select("id, name").in("id", exerciseIds)
    : { data: [] as { id: string; name: string }[] };

  const exerciseNameById = new Map((exercises ?? []).map((e) => [e.id, e.name]));

  const topExercises: ExerciseProgressSummary[] = Array.from(
    setsByExercise.entries()
  )
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([routineExerciseId, weights]) => {
      const nonNullWeights = weights.filter((w): w is number => w != null);
      const exerciseId = exerciseIdByRoutineExerciseId.get(routineExerciseId);
      return {
        exerciseName: exerciseId
          ? (exerciseNameById.get(exerciseId) ?? "Ejercicio")
          : "Ejercicio",
        firstWeight: nonNullWeights[0] ?? null,
        lastWeight: nonNullWeights[nonNullWeights.length - 1] ?? null,
      };
    });

  const { data: prevLogs } = await supabase
    .from("workout_logs")
    .select("id, workout_date")
    .eq("client_id", client.id)
    .gte("workout_date", `${prevMonthPrefix}-01`)
    .lt("workout_date", `${monthPrefix}-01`);

  let previousMonth: PreviousMonthComparison = null;
  if (prevLogs && prevLogs.length > 0) {
    const prevLogIds = prevLogs.map((l) => l.id);
    const { data: prevSets } = await supabase
      .from("workout_set_logs")
      .select("weight_kg, reps_completed")
      .in("workout_log_id", prevLogIds);

    let prevVolume = 0;
    for (const s of prevSets ?? []) {
      if (s.weight_kg != null && s.reps_completed != null) {
        prevVolume += s.weight_kg * s.reps_completed;
      }
    }

    previousMonth = {
      volume: Math.round(prevVolume),
      trainedDays: new Set(prevLogs.map((l) => l.workout_date)).size,
    };
  }

  const { data: review } = await supabase
    .from("monthly_reviews")
    .select("summary, next_month_goals, plan_adjustments, completed_at")
    .eq("client_id", client.id)
    .eq("month", getMonthKey())
    .maybeSingle();

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
