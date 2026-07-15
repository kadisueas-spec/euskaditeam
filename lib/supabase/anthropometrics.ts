import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import type { Protocol, Sex } from "@/lib/anthropometrics/formulas";
import type { MeasurementType } from "@/lib/anthropometrics/constants";

// Datos del cliente necesarios para calcular (sexo/edad) y para precargar
// el paso 1 del wizard (altura de la última evaluación) — sexo y altura
// solo se piden la primera vez, después se arrastran.
export type ClientBodyInfo = {
  birthDate: string | null;
  sex: Sex | null;
  latestHeightCm: number | null;
};

export async function getClientBodyInfo(clientId: string): Promise<ClientBodyInfo> {
  const supabase = await createClient();

  const [{ data: client }, { data: latestEvaluation }] = await Promise.all([
    supabase.from("clients").select("birth_date, sex").eq("id", clientId).maybeSingle(),
    supabase
      .from("anthropometric_evaluations")
      .select("height_cm")
      .eq("client_id", clientId)
      .order("evaluation_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    birthDate: client?.birth_date ?? null,
    sex: (client?.sex as Sex | null) ?? null,
    latestHeightCm: latestEvaluation?.height_cm ?? null,
  };
}

export type EvaluationListItem = {
  id: string;
  evaluationDate: string;
  weightKg: number;
  protocol: Protocol;
  bodyFatPercentage: number | null;
};

type EvaluationListRow = {
  id: string;
  evaluation_date: string;
  weight_kg: number;
  protocol: string;
  body_fat_percentage: number | null;
};

export async function getEvaluationsForClient(
  clientId: string
): Promise<EvaluationListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("anthropometric_evaluations")
    .select("id, evaluation_date, weight_kg, protocol, body_fat_percentage")
    .eq("client_id", clientId)
    .order("evaluation_date", { ascending: false })
    .returns<EvaluationListRow[]>();

  return (data ?? []).map((row) => ({
    id: row.id,
    evaluationDate: row.evaluation_date,
    weightKg: row.weight_kg,
    protocol: row.protocol as Protocol,
    bodyFatPercentage: row.body_fat_percentage,
  }));
}

export type EvaluationDetail = {
  id: string;
  clientId: string;
  evaluationDate: string;
  weightKg: number;
  heightCm: number;
  protocol: Protocol;
  bodyFatPercentage: number | null;
  fatMassKg: number | null;
  muscleMassKg: number | null;
  bmi: number;
  waistHipRatio: number | null;
  skinfoldSum: number | null;
  coachNotes: string | null;
  measurements: Partial<Record<MeasurementType, number>>;
  createdAt: string;
};

type EvaluationDetailRow = {
  id: string;
  client_id: string;
  evaluation_date: string;
  weight_kg: number;
  height_cm: number;
  protocol: string;
  body_fat_percentage: number | null;
  fat_mass_kg: number | null;
  muscle_mass_kg: number | null;
  bmi: number;
  waist_hip_ratio: number | null;
  coach_notes: string | null;
  created_at: string;
  body_measurements: { measurement_type: string; value: number }[];
};

// ISAK8 no calcula % grasa (ver formulas.ts) — la sumatoria de 8 pliegues
// se deriva acá mismo de las measurements guardadas, no se persiste aparte.
function computeSkinfoldSum(
  protocol: string,
  measurements: { measurement_type: string; value: number }[]
): number | null {
  if (protocol !== "ISAK8") return null;
  const types = [
    "biceps",
    "triceps",
    "subscapular",
    "suprailiac",
    "iliac_crest",
    "abdominal",
    "thigh_skinfold",
    "calf",
  ];
  const values = measurements.filter((m) => types.includes(m.measurement_type));
  if (values.length !== types.length) return null;
  return values.reduce((sum, m) => sum + m.value, 0);
}

function mapEvaluationDetail(row: EvaluationDetailRow): EvaluationDetail {
  const measurements: Partial<Record<MeasurementType, number>> = {};
  for (const m of row.body_measurements) {
    measurements[m.measurement_type as MeasurementType] = m.value;
  }

  return {
    id: row.id,
    clientId: row.client_id,
    evaluationDate: row.evaluation_date,
    weightKg: row.weight_kg,
    heightCm: row.height_cm,
    protocol: row.protocol as Protocol,
    bodyFatPercentage: row.body_fat_percentage,
    fatMassKg: row.fat_mass_kg,
    muscleMassKg: row.muscle_mass_kg,
    bmi: row.bmi,
    waistHipRatio: row.waist_hip_ratio,
    skinfoldSum: computeSkinfoldSum(row.protocol, row.body_measurements),
    coachNotes: row.coach_notes,
    measurements,
    createdAt: row.created_at,
  };
}

const EVALUATION_DETAIL_SELECT = `id, client_id, evaluation_date, weight_kg, height_cm,
   protocol, body_fat_percentage, fat_mass_kg, muscle_mass_kg, bmi,
   waist_hip_ratio, coach_notes, created_at,
   body_measurements ( measurement_type, value )`;

export async function getEvaluationDetail(
  evaluationId: string
): Promise<EvaluationDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("anthropometric_evaluations")
    .select(EVALUATION_DETAIL_SELECT)
    .eq("id", evaluationId)
    .maybeSingle()
    .returns<EvaluationDetailRow>();

  if (!data) return null;
  return mapEvaluationDetail(data);
}

// La evaluación inmediatamente anterior a una fecha dada, para la
// comparación "vs. anterior" en el detalle.
export async function getPreviousEvaluation(
  clientId: string,
  beforeDate: string,
  excludeId: string
): Promise<EvaluationDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("anthropometric_evaluations")
    .select(EVALUATION_DETAIL_SELECT)
    .eq("client_id", clientId)
    .lt("evaluation_date", beforeDate)
    .neq("id", excludeId)
    .order("evaluation_date", { ascending: false })
    .limit(1)
    .maybeSingle()
    .returns<EvaluationDetailRow>();

  if (!data) return null;
  return mapEvaluationDetail(data);
}

// Todas las evaluaciones del cliente logueado, ascendente por fecha — sirve
// para el dashboard (última = último item), tendencias (penúltima vs
// última), los gráficos de evolución y la comparación inicio vs. ahora
// (primer item vs. último), todo con una sola consulta.
export async function getMyBodyEvaluations(): Promise<EvaluationDetail[]> {
  const client = await getCurrentClientRecord();
  if (!client) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("anthropometric_evaluations")
    .select(EVALUATION_DETAIL_SELECT)
    .eq("client_id", client.id)
    .order("evaluation_date", { ascending: true })
    .returns<EvaluationDetailRow[]>();

  return (data ?? []).map(mapEvaluationDetail);
}
