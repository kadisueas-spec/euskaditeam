import type { DayBestSet } from "@/lib/reports/records";
import type { ReportKind } from "@/lib/reports/types";

// Todo lo que un reporte necesita, ya leído de la base por el loader
// (lib/reports/load-input.ts). Los generadores (build-weekly/monthly) son
// funciones puras sobre esto: se testean sin Supabase.

// Solo sesiones que cuentan como día entrenado: finalizadas y con al menos
// 1 serie (lib/utils/training-sessions.ts). Historial hasta el fin del
// período.
export type SessionSummary = {
  date: string;
  dayId: string | null;
  dayName: string | null;
  setCount: number; // series de trabajo (un "check" no cuenta)
  volumeKg: number;
  // Tipos de registro (oct-2026): tiempo de cardio por ejercicio (segundos)
  // e isométricos en total. Opcionales: los fixtures de antes no los tienen.
  cardio?: { exerciseId: string; exerciseName: string; seconds: number }[];
  isometricSeconds?: number;
};

export type ReportInput = {
  kind: ReportKind;
  periodStart: string; // semanal: lunes; mensual: día 1
  periodEnd: string; // semanal: viernes; mensual: último día
  client: {
    id: string;
    firstName: string;
    fullName: string;
    goal: string | null; // clients.goal (objetivo general)
    accessActivatedAt: string | null;
    hideWeight: boolean; // clients.hide_weight_in_reports
  };
  coach: { name: string; avatarUrl: string | null };
  routine: {
    daysPerWeek: number;
    assignedAt: string | null; // starts_at ?? created_at
    endsAt: string | null;
    days: { id: string; name: string }[];
  } | null;
  sessions: SessionSummary[];
  bestSets: DayBestSet[];
  weights: { date: string; kg: number }[];
  evaluations: { date: string; weightKg: number | null; bodyFat: number | null; muscleKg: number | null }[];
  lastPhotoDate: string | null;
  nutritionPlanName: string | null;
  // Objetivo mensual del mes del período (semanal: el mes en que cae el lunes).
  monthGoal: { mainGoal: string; weightKg: number | null } | null;
  // Mensaje del cierre de mes del coach (solo si lo completó). Solo mensual.
  monthReviewSummary: string | null;
  // phrase_key → envío más reciente (ms) en los últimos 28 días.
  phraseHistory: Map<string, number>;
};
