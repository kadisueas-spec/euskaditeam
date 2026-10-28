// Tipos de registro por ejercicio (oct-2026, migración
// 20261028_tracking_types.sql). Define QUÉ se anota en cada serie:
// - weight_reps: peso, reps y RIR (el de siempre).
// - bodyweight_reps: peso corporal — reps, kilos extra y RIR opcionales.
//   Con asistencia (kg de máquina o nivel de banda): menos es mejor.
// - time: isométrico — segundos, kilos extra opcionales.
// - cardio: minutos; distancia e intensidad opcionales (nivel de la máquina
//   o esfuerzo 1 a 10). Sin RIR.
// - check: solo se marca como hecho (calentamiento, movilidad).
//
// "Por lado" (per_side): las reps o segundos anotados son de UN lado; el
// volumen y los totales cuentan los dos.

export const TRACKING_TYPES = ["weight_reps", "bodyweight_reps", "time", "cardio", "check"] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export type AssistanceUnit = "kg" | "band";
export type CardioScale = "level" | "effort";

export const TRACKING_LABELS: Record<TrackingType, string> = {
  weight_reps: "Peso y reps",
  bodyweight_reps: "Peso corporal",
  time: "Isométrico (segundos)",
  cardio: "Cardio (minutos)",
  check: "Solo marcar hecho",
};

export const TRACKING_DESCRIPTIONS: Record<TrackingType, string> = {
  weight_reps: "Se anotan kilos, reps y RIR en cada serie.",
  bodyweight_reps: "Se anotan reps. Kilos extra y RIR, opcionales. Ej.: crunch, dominadas, fondos.",
  time: "Se anotan segundos, con kilos extra opcionales. Ej.: planchas, hollow body hold.",
  cardio: "Se anotan minutos, con distancia e intensidad opcionales. Sin RIR. Ej.: bici, escaladora.",
  check: "Solo se marca como hecho. Cuenta para completar el día, no para volumen ni récords.",
};

// Tipos que se pueden elegir en el formulario. "check" se suma cuando
// Entrenar lo sepa registrar (etapa 5 del plan).
export const SELECTABLE_TRACKING_TYPES: TrackingType[] = ["weight_reps", "bodyweight_reps", "time", "cardio"];

export const ASSISTANCE_LABELS: Record<AssistanceUnit, string> = {
  kg: "Asistido (kg de ayuda)",
  band: "Asistido (nivel de banda)",
};

export const CARDIO_SCALE_LABELS: Record<CardioScale, string> = {
  level: "Nivel de la máquina",
  effort: "Esfuerzo (1 a 10)",
};

export type TrackingFields = {
  trackingType: TrackingType;
  perSide: boolean;
  assistanceUnit: AssistanceUnit | null;
  cardioScale: CardioScale | null;
};

export const DEFAULT_TRACKING: TrackingFields = {
  trackingType: "weight_reps",
  perSide: false,
  assistanceUnit: null,
  cardioScale: null,
};

export function isTrackingType(value: unknown): value is TrackingType {
  return typeof value === "string" && (TRACKING_TYPES as readonly string[]).includes(value);
}

// Deja los campos coherentes con el tipo — las mismas reglas que los CHECK
// de la base: asistencia solo en peso corporal, escala solo en cardio (y
// cardio siempre con escala), "por lado" solo donde hay reps o segundos.
export function normalizeTracking(input: {
  trackingType: unknown;
  perSide?: unknown;
  assistanceUnit?: unknown;
  cardioScale?: unknown;
}): TrackingFields {
  const trackingType = isTrackingType(input.trackingType) ? input.trackingType : "weight_reps";
  const perSide =
    (input.perSide === true || input.perSide === "on" || input.perSide === "true") &&
    trackingType !== "cardio" &&
    trackingType !== "check";
  const assistanceUnit =
    trackingType === "bodyweight_reps" && (input.assistanceUnit === "kg" || input.assistanceUnit === "band")
      ? input.assistanceUnit
      : null;
  const cardioScale =
    trackingType === "cardio" ? (input.cardioScale === "effort" ? "effort" : "level") : null;
  return { trackingType, perSide, assistanceUnit, cardioScale };
}

// Lo que se lee de la fila de exercises (columnas snake_case). Filas sin
// las columnas (lecturas viejas) caen en el default.
export function trackingFromRow(row: {
  tracking_type?: string | null;
  per_side?: boolean | null;
  assistance_unit?: string | null;
  cardio_scale?: string | null;
}): TrackingFields {
  return normalizeTracking({
    trackingType: row.tracking_type,
    perSide: row.per_side === true,
    assistanceUnit: row.assistance_unit,
    cardioScale: row.cardio_scale,
  });
}

export const TRACKING_COLUMNS = "tracking_type, per_side, assistance_unit, cardio_scale";
