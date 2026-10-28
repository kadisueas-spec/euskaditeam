import { trackingFromRow, type TrackingFields } from "@/lib/constants/tracking";

// Volumen de una serie según el tipo de registro (oct-2026, plan aprobado):
// - Peso + reps: peso × reps, × 2 si es "por lado" (las reps anotadas son
//   de un lado; el volumen cuenta los dos).
// - Peso corporal: kilos extra (lastre) × reps, × 2 si es por lado. Sin
//   lastre no suma kilos.
// - Asistido, isométrico, cardio y check: no suman kilos (los isométricos
//   con lastre no tienen reps). El cardio y los isométricos suman tiempo
//   aparte (setTime).
// Un solo lugar para todos los cálculos (reportes, estadísticas, métricas
// del coach, resumen de sesión y semana, Inicio).

export function setVolumeKg(tracking: TrackingFields, weightKg: number | null, reps: number | null): number {
  if (weightKg == null || reps == null || weightKg <= 0 || reps <= 0) return 0;
  const side = tracking.perSide ? 2 : 1;
  switch (tracking.trackingType) {
    case "weight_reps":
      return Number(weightKg) * reps * side;
    case "bodyweight_reps":
      return tracking.assistanceUnit ? 0 : Number(weightKg) * reps * side;
    default:
      return 0;
  }
}

// Tiempo de una serie: minutos de cardio y segundos de isométrico (× 2 si
// es por lado, igual que el volumen).
export function setTime(
  tracking: TrackingFields,
  durationSeconds: number | null
): { cardioSeconds: number; isometricSeconds: number } {
  if (durationSeconds == null || durationSeconds <= 0) return { cardioSeconds: 0, isometricSeconds: 0 };
  if (tracking.trackingType === "cardio") return { cardioSeconds: durationSeconds, isometricSeconds: 0 };
  if (tracking.trackingType === "time") {
    return { cardioSeconds: 0, isometricSeconds: durationSeconds * (tracking.perSide ? 2 : 1) };
  }
  return { cardioSeconds: 0, isometricSeconds: 0 };
}

// Una serie "check" (solo hecho) cuenta para completar el día, pero no
// como serie de trabajo (series efectivas, total de series).
export function countsAsWorkSet(tracking: TrackingFields): boolean {
  return tracking.trackingType !== "check";
}

// Para filas de Supabase con el ejercicio embebido.
export function trackingOfSetRow(row: {
  routine_exercises?: {
    exercises?: {
      tracking_type?: string | null;
      per_side?: boolean | null;
      assistance_unit?: string | null;
      cardio_scale?: string | null;
    } | null;
  } | null;
}): TrackingFields {
  return trackingFromRow(row.routine_exercises?.exercises ?? {});
}

// Fila mínima para calcular volumen (para tipar las consultas con .returns).
export type SetVolumeRow = {
  weight_kg: number | null;
  reps_completed: number | null;
  routine_exercises: {
    exercises: {
      tracking_type: string | null;
      per_side: boolean | null;
      assistance_unit: string | null;
      cardio_scale: string | null;
    } | null;
  } | null;
};
