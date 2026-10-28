import { trackingFromRow, type TrackingFields } from "@/lib/constants/tracking";
import { isBetterTrackingSet } from "@/lib/utils/tracking-progression";
import {
  TRACKING_RECORD_PRIORITY,
  trackingRecordBanner,
  trackingRecordDiff,
  type TrackingRecord,
} from "@/lib/utils/tracking-records";
import type { TrackingSet } from "@/lib/utils/tracking-progression";
import { formatSet, type SetValues } from "@/lib/utils/set-format";

// Sistema de celebración de récords (jul-2026). Compara cada serie recién
// cargada contra el récord CRUDO de la semana pasada (previousRecord de
// WorkoutSuggestion, ver actions.ts) — nunca contra la sugerencia ya
// proyectada por el algoritmo de progresión, que representa un objetivo
// hacia adelante, no lo que realmente pasó la semana pasada.
export type RecordType = "weight" | "reps" | "rir";

export type PreviousRecord = {
  weight: number;
  reps: number;
  rir: number | null;
};

export type SessionRecord = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  type: RecordType;
  weight: number;
  reps: number | null;
  rir: number | null;
  weightDelta?: number;
  repsDelta?: number;
  // Récord de RIR: cuántas reps MÁS en reserva que antes (mismo peso y reps).
  rirDelta?: number;
  previousRir?: number;
  // Tipos de registro (oct-2026): récord de un ejercicio que no es peso +
  // reps (ver lib/utils/tracking-records.ts). `value` = la serie como se
  // lee ("45 s · +5 kg"). Con esto, banner y resumen usan su propio texto.
  tracking?: { fields: TrackingFields; record: TrackingRecord; value: string };
};

const EPS = 0.001;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Cualquier mejora vs la semana anterior cuenta, en orden de prioridad:
// más peso -> mismo peso y más reps -> mismo peso y reps con MAYOR RIR.
// Cada criterio requiere que el anterior haya empatado, no solo "no haya
// empeorado".
//
// RIR = repeticiones en reserva. Mismo peso y mismas reps con más RIR que
// antes es un récord: el mismo trabajo le sale con más resto, o sea que se
// hizo más fuerte (antes 50kg × 10 a RIR 1, ahora 50kg × 10 a RIR 3).
// Bug oct-2026: estaba al revés (premiaba MENOS RIR, que es más esfuerzo).
export function detectWeeklyRecord(
  previousRecord: PreviousRecord | null,
  entered: { weight: number | null; reps: number | null; rir: number | null }
): {
  type: RecordType;
  weightDelta?: number;
  repsDelta?: number;
  rirDelta?: number;
  previousRir?: number;
} | null {
  if (!previousRecord || entered.weight == null) return null;

  const weightDiff = entered.weight - previousRecord.weight;
  if (weightDiff > EPS) {
    return { type: "weight", weightDelta: round2(weightDiff) };
  }
  if (weightDiff < -EPS) return null;

  if (entered.reps == null) return null;
  const repsDiff = entered.reps - previousRecord.reps;
  if (repsDiff > 0) return { type: "reps", repsDelta: repsDiff };
  if (repsDiff < 0) return null;

  if (entered.rir != null && previousRecord.rir != null && entered.rir > previousRecord.rir) {
    return {
      type: "rir",
      rirDelta: entered.rir - previousRecord.rir,
      previousRir: previousRecord.rir,
    };
  }
  return null;
}

export function formatKg(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round2(n));
}

// Momento 1 — dato concreto debajo de "¡Nuevo récord!" en el banner.
export function recordBannerDetail(record: SessionRecord): string {
  if (record.tracking) return trackingRecordBanner(record.tracking.fields, record.tracking.record);
  if (record.type === "weight") {
    return `+${formatKg(record.weightDelta ?? 0)}kg más que la semana pasada`;
  }
  if (record.type === "reps") {
    return `+${record.repsDelta ?? 0} reps con ${formatKg(record.weight)}kg`;
  }
  return record.previousRir != null
    ? `Mismo peso y reps, con ${record.rirDelta ?? 0} rep${record.rirDelta === 1 ? "" : "s"} más en reserva 💪`
    : "Mismo peso y reps, te sobraron más reps 💪";
}

// Momento 2 — una línea por ejercicio en "Tus récords de hoy".
export function recordSummaryLine(record: SessionRecord): string {
  if (record.tracking) {
    return `${record.exerciseName}: ${trackingRecordDiff(record.tracking.fields, record.tracking.record)} (${record.tracking.value})`;
  }
  const repsSuffix = record.reps != null ? ` × ${record.reps}` : "";
  if (record.type === "weight") {
    return `${record.exerciseName}: +${formatKg(record.weightDelta ?? 0)}kg (${formatKg(record.weight)}kg${repsSuffix})`;
  }
  if (record.type === "reps") {
    return `${record.exerciseName}: +${record.repsDelta ?? 0} reps (${formatKg(record.weight)}kg${repsSuffix})`;
  }
  const rirChange =
    record.previousRir != null ? `RIR ${record.previousRir} → ${record.rir}` : `RIR ${record.rir}`;
  return `${record.exerciseName}: mismo peso y reps, te sobraron más reps (${rirChange})`;
}

export function recordSummaryMessage(count: number): string {
  if (count >= 4) return "Sesión histórica. Guardá este momento.";
  if (count >= 2) return "Varios récords en una sesión. Eso no es suerte, es trabajo.";
  return "Un récord es un paso adelante.";
}

// Prioridad por impacto real (oct-2026): 1º subida de peso, 2º más reps con
// el mismo peso, 3º mismo peso y reps con más RIR. Dentro de cada tipo,
// la mejora más grande primero (+5kg antes que +2,5kg).
const TYPE_PRIORITY: Record<RecordType, number> = { weight: 2, reps: 1, rir: 0 };

function recordPriority(record: SessionRecord): number {
  return record.tracking ? TRACKING_RECORD_PRIORITY[record.tracking.record.type] : TYPE_PRIORITY[record.type];
}

function recordMagnitude(record: SessionRecord): number {
  if (record.tracking) return record.tracking.record.delta;
  if (record.type === "weight") return record.weightDelta ?? 0;
  if (record.type === "reps") return record.repsDelta ?? 0;
  return record.rirDelta ?? 0;
}

// Negativo si `a` es más impactante que `b` (para Array.sort).
export function compareRecordsByImpact(a: SessionRecord, b: SessionRecord): number {
  const byType = recordPriority(b) - recordPriority(a);
  if (byType !== 0) return byType;
  return recordMagnitude(b) - recordMagnitude(a);
}

// TODOS los ejercicios con récord, sin límite de cantidad, ordenados por
// impacto. Una línea por ejercicio: si el cliente batió el mismo
// ejercicio en más de una serie, queda la mejora más impactante de ese
// ejercicio (no una línea repetida por serie).
export function summarizeSessionRecords(records: SessionRecord[]): SessionRecord[] {
  const byExercise = new Map<string, SessionRecord>();
  for (const record of records) {
    const current = byExercise.get(record.exerciseId);
    if (!current || compareRecordsByImpact(record, current) < 0) {
      byExercise.set(record.exerciseId, record);
    }
  }
  return Array.from(byExercise.values()).sort(compareRecordsByImpact);
}

// Fila de workout_set_logs con lo necesario para agrupar "mejor serie por
// ejercicio" en una ventana de fechas — compartida entre la celebración
// semanal (checkWeeklyCompletion) y el resumen de Mi Mes (que corre esta
// misma comparación semana por semana a lo largo de todo el mes).
export type SetLogWithExerciseRow = {
  routine_exercise_id: string | null;
  weight_kg: number | null;
  reps_completed: number | null;
  rir_actual: number | null;
  // Tipos de registro (oct-2026): opcionales para las consultas que no los
  // piden (quedan como peso + reps).
  duration_seconds?: number | null;
  distance_km?: number | null;
  intensity?: number | null;
  assistance?: number | null;
  workout_logs: { workout_date: string } | null;
  routine_exercises: {
    exercises: {
      name: string;
      tracking_type?: string | null;
      per_side?: boolean | null;
      assistance_unit?: string | null;
      cardio_scale?: string | null;
    } | null;
  } | null;
};

// Fila → valores de una serie para los tipos de registro.
export function rowToTrackingSet(row: SetLogWithExerciseRow): TrackingSet {
  const num = (x: number | null | undefined) => (x != null ? Number(x) : null);
  return {
    weight: num(row.weight_kg),
    reps: row.reps_completed,
    rir: row.rir_actual,
    seconds: row.duration_seconds ?? null,
    distanceKm: num(row.distance_km),
    intensity: num(row.intensity),
    assistance: num(row.assistance),
  };
}

export function rowTracking(row: SetLogWithExerciseRow): TrackingFields {
  return trackingFromRow(row.routine_exercises?.exercises ?? {});
}

// ¿La serie `a` es mejor que `b`? Mayor peso; empate -> más reps; empate ->
// MÁS RIR (le sobró más con el mismo trabajo). Compartido por la mejor
// serie de la semana (récords) y la referencia de la sugerencia de la
// serie 1 (getWorkoutSuggestions), así las dos miran lo mismo.
export function isBetterSet(
  a: { weight: number | null; reps: number | null; rir: number | null },
  b: { weight: number | null; reps: number | null; rir: number | null }
): boolean {
  const aw = a.weight ?? -Infinity;
  const bw = b.weight ?? -Infinity;
  if (aw !== bw) return aw > bw;
  const ar = a.reps ?? -Infinity;
  const br = b.reps ?? -Infinity;
  if (ar !== br) return ar > br;
  return (a.rir ?? -Infinity) > (b.rir ?? -Infinity);
}

// Mejor serie por ejercicio dentro de un subconjunto de filas ya filtrado
// por rango de fechas (ver isBetterSet).
export function bestSetByExercise<T extends SetLogWithExerciseRow>(
  rows: T[]
): Map<string, T> {
  const best = new Map<string, T>();
  for (const row of rows) {
    if (!row.routine_exercise_id) continue;
    const current = best.get(row.routine_exercise_id);
    const tracking = rowTracking(row);
    const better =
      !current ||
      (tracking.trackingType === "weight_reps"
        ? isBetterSet(
            { weight: row.weight_kg, reps: row.reps_completed, rir: row.rir_actual },
            { weight: current.weight_kg, reps: current.reps_completed, rir: current.rir_actual }
          )
        : isBetterTrackingSet(tracking, rowToTrackingSet(row), rowToTrackingSet(current)));
    if (better) {
      best.set(row.routine_exercise_id, row);
    }
  }
  return best;
}

// Récord de un tipo de registro que no es peso + reps (oct-2026), con la
// forma de siempre para que la cola de banners, el resumen y la
// celebración semanal lo traten igual. `type` es el equivalente más
// cercano (carga/ayuda/nivel ≈ peso; reps/segundos/minutos ≈ reps).
export function trackingSessionRecord(params: {
  exerciseId: string;
  exerciseName: string;
  fields: TrackingFields;
  record: TrackingRecord;
  current: TrackingSet;
}): SessionRecord {
  const { record, current } = params;
  const type: RecordType =
    record.type === "rir"
      ? "rir"
      : record.type === "load" || record.type === "assistance" || record.type === "intensity"
        ? "weight"
        : "reps";
  return {
    id: crypto.randomUUID(),
    exerciseId: params.exerciseId,
    exerciseName: params.exerciseName,
    type,
    weight: current.weight ?? 0,
    reps: current.reps,
    rir: current.rir,
    tracking: { fields: params.fields, record, value: formatSet(params.fields, setValuesOf(current)) },
  };
}

function setValuesOf(s: TrackingSet): SetValues {
  return {
    weight: s.weight,
    reps: s.reps,
    rir: s.rir,
    seconds: s.seconds,
    distanceKm: s.distanceKm,
    intensity: s.intensity,
    assistance: s.assistance,
  };
}
