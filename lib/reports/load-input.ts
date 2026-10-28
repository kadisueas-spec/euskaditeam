import { createAdminClient } from "@/lib/supabase/admin";
import { TRACKING_COLUMNS, trackingFromRow } from "@/lib/constants/tracking";
import { countsAsTraining } from "@/lib/utils/training-sessions";
import { paraguayDateOf } from "@/lib/utils/today";
import { addDays, daysBetween } from "@/lib/reports/format";
import { isBetterDayBest, type DayBestSet } from "@/lib/reports/records";
import type { ReportInput, SessionSummary } from "@/lib/reports/input";
import type { ReportKind } from "@/lib/reports/types";

// Lee de la base todo lo que necesita un reporte (ReportInput). Corre con
// service role: lo usan el cron (sin sesión) y las acciones del coach, que
// verifican ANTES con su propia sesión que el cliente es suyo.

type Admin = ReturnType<typeof createAdminClient>;

const PAGE = 1000; // tope de filas por respuesta de PostgREST
const WEIGHT_LOOKBACK_DAYS = 140;
const PHRASE_HISTORY_DAYS = 28;

type SessionRow = {
  id: string;
  workout_date: string;
  is_completed: boolean;
  routine_day_id: string | null;
  routine_days: { name: string } | null;
  workout_set_logs: {
    weight_kg: number | null;
    reps_completed: number | null;
    rir_actual: number | null;
    duration_seconds?: number | null;
    distance_km?: number | null;
    intensity?: number | null;
    assistance?: number | null;
    routine_exercises: {
      exercise_id: string;
      exercises: {
        name: string;
        muscle_group: string | null;
        tracking_type?: string | null;
        per_side?: boolean | null;
        assistance_unit?: string | null;
        cardio_scale?: string | null;
      } | null;
    } | null;
  }[];
};

async function allSessions(admin: Admin, clientId: string, periodEnd: string): Promise<SessionRow[]> {
  const rows: SessionRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("workout_logs")
      .select(
        `id, workout_date, is_completed, routine_day_id, routine_days ( name ),
         workout_set_logs ( weight_kg, reps_completed, rir_actual,
           duration_seconds, distance_km, intensity, assistance,
           routine_exercises ( exercise_id, exercises ( name, muscle_group, ${TRACKING_COLUMNS} ) ) )`
      )
      .eq("client_id", clientId)
      .eq("is_completed", true)
      .lte("workout_date", periodEnd)
      .order("workout_date", { ascending: true })
      .range(from, from + PAGE - 1)
      .returns<SessionRow[]>();
    if (error) throw new Error(`reportes: no se pudieron leer las sesiones (${error.message})`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

// Sesiones válidas (día entrenado) + mejor serie por ejercicio y día.
export function summarizeSessions(rows: SessionRow[]): { sessions: SessionSummary[]; bestSets: DayBestSet[] } {
  const sessions: SessionSummary[] = [];
  const best = new Map<string, DayBestSet>();
  for (const r of rows) {
    if (!countsAsTraining({ isCompleted: r.is_completed, setCount: r.workout_set_logs.length })) continue;
    let volume = 0;
    for (const s of r.workout_set_logs) {
      if (s.weight_kg != null && s.reps_completed != null) volume += s.weight_kg * s.reps_completed;
      const ex = s.routine_exercises;
      if (!ex?.exercise_id) continue;
      const key = `${r.workout_date}|${ex.exercise_id}`;
      const candidate: DayBestSet = {
        date: r.workout_date,
        exerciseId: ex.exercise_id,
        exerciseName: ex.exercises?.name ?? "Ejercicio",
        muscleGroup: ex.exercises?.muscle_group ?? null,
        weight: s.weight_kg != null ? Number(s.weight_kg) : null,
        reps: s.reps_completed,
        rir: s.rir_actual,
        seconds: s.duration_seconds ?? null,
        distanceKm: s.distance_km != null ? Number(s.distance_km) : null,
        intensity: s.intensity != null ? Number(s.intensity) : null,
        assistance: s.assistance != null ? Number(s.assistance) : null,
        tracking: trackingFromRow(ex.exercises ?? {}),
      };
      const current = best.get(key);
      if (!current || isBetterDayBest(candidate, current)) best.set(key, candidate);
    }
    sessions.push({
      date: r.workout_date,
      dayId: r.routine_day_id,
      dayName: r.routine_days?.name ?? null,
      setCount: r.workout_set_logs.length,
      volumeKg: volume,
    });
  }
  return { sessions, bestSets: [...best.values()] };
}

export async function loadReportInput(params: {
  clientId: string;
  kind: ReportKind;
  periodStart: string;
  periodEnd: string;
}): Promise<ReportInput | null> {
  const { clientId, kind, periodStart, periodEnd } = params;
  const admin = createAdminClient();
  // Objetivo mensual: el del mes del período (en un rango libre, el del mes
  // en que termina, el más reciente).
  const monthKey = `${(kind === "custom" ? periodEnd : periodStart).slice(0, 7)}-01`;
  // Peso: lo suficiente para el período, el anterior de igual duración y la
  // serie de tendencia.
  const weightSince = addDays(periodStart, -Math.max(WEIGHT_LOOKBACK_DAYS, daysBetween(periodStart, periodEnd) + 1 + 120));
  const historySince = new Date(Date.now() - PHRASE_HISTORY_DAYS * 86400000).toISOString();

  const { data: client } = await admin
    .from("clients")
    .select(
      "id, coach_id, goal, access_activated_at, hide_weight_in_reports, profiles!clients_user_id_fkey ( full_name )"
    )
    .eq("id", clientId)
    .maybeSingle<{
      id: string;
      coach_id: string | null;
      goal: string | null;
      access_activated_at: string | null;
      hide_weight_in_reports: boolean;
      profiles: { full_name: string | null } | null;
    }>();
  if (!client || !client.coach_id) return null;

  const [
    coach,
    routine,
    sessionRows,
    weights,
    evaluations,
    photo,
    nutrition,
    goal,
    review,
    history,
  ] = await Promise.all([
    admin.from("profiles").select("full_name, avatar_url").eq("id", client.coach_id).maybeSingle<{
      full_name: string | null;
      avatar_url: string | null;
    }>(),
    admin
      .from("routines")
      .select("id, starts_at, ends_at, created_at, routine_days ( id, name, day_number )")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .eq("is_template", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        starts_at: string | null;
        ends_at: string | null;
        created_at: string;
        routine_days: { id: string; name: string; day_number: number }[];
      }>(),
    allSessions(admin, clientId, periodEnd),
    admin
      .from("weight_logs")
      .select("date, weight_kg")
      .eq("client_id", clientId)
      .gte("date", weightSince)
      .lte("date", periodEnd)
      .order("date", { ascending: true })
      .returns<{ date: string; weight_kg: number }[]>(),
    admin
      .from("anthropometric_evaluations")
      .select("evaluation_date, weight_kg, body_fat_percentage, muscle_mass_kg")
      .eq("client_id", clientId)
      .lte("evaluation_date", periodEnd)
      .order("evaluation_date", { ascending: true })
      .returns<
        {
          evaluation_date: string;
          weight_kg: number | null;
          body_fat_percentage: number | null;
          muscle_mass_kg: number | null;
        }[]
      >(),
    admin
      .from("progress_photos")
      .select("taken_at")
      .eq("client_id", clientId)
      .lte("taken_at", `${periodEnd}T23:59:59.999-03:00`)
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ taken_at: string }>(),
    kind !== "weekly"
      ? admin
          .from("nutrition_plans")
          .select("name")
          .eq("client_id", clientId)
          .eq("status", "active")
          .limit(1)
          .maybeSingle<{ name: string | null }>()
      : Promise.resolve({ data: null }),
    admin
      .from("monthly_goals")
      .select("main_goal, weight_kg")
      .eq("client_id", clientId)
      .eq("month", monthKey)
      .maybeSingle<{ main_goal: string; weight_kg: number | null }>(),
    kind === "monthly"
      ? admin
          .from("monthly_reviews")
          .select("summary, completed_at")
          .eq("client_id", clientId)
          .eq("month", monthKey)
          .maybeSingle<{ summary: string | null; completed_at: string | null }>()
      : Promise.resolve({ data: null }),
    admin
      .from("progress_reports")
      .select("phrase_keys, sent_at")
      .eq("client_id", clientId)
      .eq("status", "sent")
      .gte("sent_at", historySince)
      .returns<{ phrase_keys: string[]; sent_at: string }[]>(),
  ]);

  const { sessions, bestSets } = summarizeSessions(sessionRows);
  const phraseHistory = new Map<string, number>();
  for (const r of history.data ?? []) {
    const at = Date.parse(r.sent_at);
    for (const k of r.phrase_keys) phraseHistory.set(k, Math.max(phraseHistory.get(k) ?? 0, at));
  }

  const fullName = client.profiles?.full_name?.trim() || "Cliente";
  const r = routine.data;
  return {
    kind,
    periodStart,
    periodEnd,
    client: {
      id: client.id,
      firstName: fullName.split(" ")[0],
      fullName,
      goal: client.goal,
      accessActivatedAt: client.access_activated_at,
      hideWeight: client.hide_weight_in_reports,
    },
    coach: {
      name: coach.data?.full_name?.trim() || "Tu coach",
      avatarUrl: coach.data?.avatar_url ?? null,
    },
    routine: r
      ? {
          daysPerWeek: r.routine_days.length,
          assignedAt: r.starts_at ?? r.created_at,
          endsAt: r.ends_at,
          days: [...r.routine_days].sort((a, b) => a.day_number - b.day_number).map((d) => ({ id: d.id, name: d.name })),
        }
      : null,
    sessions,
    bestSets,
    weights: (weights.data ?? []).map((w) => ({ date: w.date, kg: Number(w.weight_kg) })),
    evaluations: (evaluations.data ?? []).map((e) => ({
      date: e.evaluation_date,
      weightKg: e.weight_kg,
      bodyFat: e.body_fat_percentage,
      muscleKg: e.muscle_mass_kg,
    })),
    lastPhotoDate: photo.data ? paraguayDateOf(photo.data.taken_at) : null,
    nutritionPlanName: nutrition.data?.name ?? null,
    monthGoal: goal.data ? { mainGoal: goal.data.main_goal, weightKg: goal.data.weight_kg } : null,
    monthReviewSummary:
      review.data?.completed_at && review.data.summary?.trim() ? review.data.summary.trim() : null,
    phraseHistory,
  };
}
