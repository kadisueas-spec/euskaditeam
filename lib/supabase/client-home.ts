import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import {
  getMyActiveRoutine,
  getWeekProgress,
  isClientsFirstRoutine,
  type MyRoutineDay,
} from "@/lib/supabase/client-routine";
import { getClientStats } from "@/lib/supabase/stats";
import { getMyBodyEvaluations } from "@/lib/supabase/anthropometrics";
import { getMyNutritionPlans } from "@/lib/supabase/nutrition";
import { getMyProgressPhotos } from "@/lib/supabase/progress-photos";
import { getMyVideos } from "@/lib/supabase/videos";

const DAY_MS = 24 * 60 * 60 * 1000;

export type TodaySummary = {
  dayName: string | null;
  totalSets: number;
  totalVolume: number;
};

export type ClientHomeData = {
  firstName: string;
  sex: "male" | "female" | null;
  hasRoutine: boolean;
  // Acción del día: exactamente uno de estos tres estados manda (ver
  // app/client/home/page.tsx) — trainedToday tiene prioridad incluso si
  // todavía quedan días planificados sin completar esta semana (un
  // cliente puede adelantar el día de mañana hoy y de todos modos ya
  // entrenó HOY).
  trainedToday: boolean;
  todaySummary: TodaySummary | null;
  suggestedDay: MyRoutineDay | null;
  completedThisWeek: number;
  plannedThisWeek: number;
  // Estado actual (una fila, tres datos)
  dailyStreak: number;
  adherencePercent: number;
  daysSinceLastEvaluation: number | null;
  // Tarjetas del plan — null = todavía no tiene ese dato (tarjeta "vacía"
  // pero siempre visible, ver PlanCard).
  routineCard: { mesocicloNombre: string | null; daysPerWeek: number } | null;
  nutritionCard: { monthLabel: string; downloadUrl: string | null } | null;
  bodyCard: { bodyFatPercentage: number | null; evaluationDate: string } | null;
  photosCard: { count: number; daysSinceLast: number } | null;
  videosCard: { unseenCount: number; totalCount: number };
  progressCard: { completedWorkoutsCount: number };
  // Banner de bienvenida de rutina (antes vivía en /client/my-routine) —
  // se movió acá porque esta pantalla es ahora el punto de entrada real de
  // la app; my-routine ya no es lo primero que ve el cliente.
  welcomeBanner: {
    routineId: string;
    routineName: string;
    mesocicloNombre: string | null;
    daysPerWeek: number;
    isFirstRoutine: boolean;
  } | null;
};

type TodayLogRow = { id: string; routine_days: { name: string } | null };

// Pantalla de inicio del cliente (ago-2026): reemplaza a Mi Rutina como
// primera pantalla al abrir la app. Todo en una sola función — las
// consultas van en paralelo (Promise.all) en vez de una por tarjeta, mismo
// criterio que getCoachDashboardData/getMyMonthSummary.
export async function getClientHomeData(): Promise<ClientHomeData | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    profile,
    routine,
    stats,
    evaluations,
    nutritionPlans,
    photos,
    videos,
    completedCountResult,
    todayLogsResult,
  ] = await Promise.all([
    getCurrentProfile(),
    getMyActiveRoutine(),
    getClientStats(),
    getMyBodyEvaluations(),
    getMyNutritionPlans(),
    getMyProgressPhotos(),
    getMyVideos(),
    supabase
      .from("workout_logs")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("is_completed", true),
    supabase
      .from("workout_logs")
      .select("id, routine_days ( name )")
      .eq("client_id", client.id)
      .eq("is_completed", true)
      .eq("workout_date", today)
      .returns<TodayLogRow[]>(),
  ]);

  const weekProgress = routine
    ? await getWeekProgress(routine.days)
    : { completedDayIds: [], suggestedDayId: null };
  const suggestedDay =
    routine?.days.find((d) => d.id === weekProgress.suggestedDayId) ?? null;

  const todayLogs = todayLogsResult.data ?? [];
  const trainedToday = todayLogs.length > 0;
  let todaySummary: TodaySummary | null = null;
  if (trainedToday) {
    const { data: sets } = await supabase
      .from("workout_set_logs")
      .select("weight_kg, reps_completed")
      .in(
        "workout_log_id",
        todayLogs.map((l) => l.id)
      );
    const totalVolume = Math.round(
      (sets ?? []).reduce(
        (sum, s) =>
          sum + (s.weight_kg != null && s.reps_completed != null ? s.weight_kg * s.reps_completed : 0),
        0
      )
    );
    todaySummary = {
      dayName: todayLogs[0].routine_days?.name ?? null,
      totalSets: (sets ?? []).length,
      totalVolume,
    };
  }

  const showWelcomeBanner = !!routine && !routine.welcomeBannerShownAt;
  const isFirstRoutine =
    showWelcomeBanner && routine ? await isClientsFirstRoutine(client.id, routine.id) : false;

  const lastEvaluation = evaluations.length > 0 ? evaluations[evaluations.length - 1] : null;
  const daysSinceLastEvaluation = lastEvaluation
    ? Math.floor((Date.now() - new Date(lastEvaluation.evaluationDate).getTime()) / DAY_MS)
    : null;

  const activeNutritionPlan = nutritionPlans.find((p) => p.status === "active") ?? null;
  const nutritionMonthLabel = activeNutritionPlan
    ? new Intl.DateTimeFormat("es-AR", { month: "long" }).format(
        new Date(`${(activeNutritionPlan.validFrom ?? activeNutritionPlan.createdAt).slice(0, 10)}T00:00:00Z`)
      )
    : null;

  const lastPhoto = photos.length > 0 ? photos[0] : null;
  const daysSinceLastPhoto = lastPhoto
    ? Math.floor((Date.now() - new Date(lastPhoto.takenAt).getTime()) / DAY_MS)
    : 0;

  return {
    firstName: profile?.full_name?.split(" ")[0] ?? "",
    sex: client.sex,
    hasRoutine: !!routine,
    trainedToday,
    todaySummary,
    suggestedDay,
    completedThisWeek: weekProgress.completedDayIds.length,
    plannedThisWeek: routine?.days.length ?? 0,
    dailyStreak: stats.dailyStreak,
    adherencePercent: stats.adherencePercent,
    daysSinceLastEvaluation,
    routineCard: routine
      ? { mesocicloNombre: routine.mesocicloNombre, daysPerWeek: routine.days.length }
      : null,
    nutritionCard: activeNutritionPlan
      ? { monthLabel: nutritionMonthLabel as string, downloadUrl: activeNutritionPlan.downloadUrl }
      : null,
    bodyCard: lastEvaluation
      ? { bodyFatPercentage: lastEvaluation.bodyFatPercentage, evaluationDate: lastEvaluation.evaluationDate }
      : null,
    photosCard: photos.length > 0 ? { count: photos.length, daysSinceLast: daysSinceLastPhoto } : null,
    videosCard: {
      unseenCount: videos.filter((v) => !v.isSeen).length,
      totalCount: videos.length,
    },
    progressCard: { completedWorkoutsCount: completedCountResult.count ?? 0 },
    welcomeBanner:
      showWelcomeBanner && routine
        ? {
            routineId: routine.id,
            routineName: routine.name,
            mesocicloNombre: routine.mesocicloNombre,
            daysPerWeek: routine.days.length,
            isFirstRoutine,
          }
        : null,
  };
}
