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
};

const EPS = 0.001;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Cualquier mejora vs la semana anterior cuenta, en orden de prioridad:
// más peso -> mismo peso y más reps -> mismo peso y reps con menor RIR
// (menos esfuerzo). Cada criterio requiere que el anterior haya empatado,
// no solo "no haya empeorado".
export function detectWeeklyRecord(
  previousRecord: PreviousRecord | null,
  entered: { weight: number | null; reps: number | null; rir: number | null }
): { type: RecordType; weightDelta?: number; repsDelta?: number } | null {
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

  if (entered.rir != null && previousRecord.rir != null && entered.rir < previousRecord.rir) {
    return { type: "rir" };
  }
  return null;
}

export function formatKg(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round2(n));
}

// Momento 1 — dato concreto debajo de "¡Nuevo récord!" en el banner.
export function recordBannerDetail(record: SessionRecord): string {
  if (record.type === "weight") {
    return `+${formatKg(record.weightDelta ?? 0)}kg más que la semana pasada`;
  }
  if (record.type === "reps") {
    return `+${record.repsDelta ?? 0} reps con ${formatKg(record.weight)}kg`;
  }
  return "Mismo peso, menos esfuerzo 💪";
}

// Momento 2 — una línea por ejercicio en "Tus récords de hoy".
export function recordSummaryLine(record: SessionRecord): string {
  const repsSuffix = record.reps != null ? ` × ${record.reps}` : "";
  if (record.type === "weight") {
    return `${record.exerciseName}: +${formatKg(record.weightDelta ?? 0)}kg (${formatKg(record.weight)}kg${repsSuffix})`;
  }
  if (record.type === "reps") {
    return `${record.exerciseName}: +${record.repsDelta ?? 0} reps (${formatKg(record.weight)}kg${repsSuffix})`;
  }
  return `${record.exerciseName}: mismo peso y reps, menos esfuerzo (RIR ${record.rir})`;
}

export function recordSummaryMessage(count: number): string {
  if (count >= 4) return "Sesión histórica. Guardá este momento.";
  if (count >= 2) return "Varios récords en una sesión. Eso no es suerte, es trabajo.";
  return "Un récord es un paso adelante.";
}

// Un récord por ejercicio para el resumen final — si el cliente batió el
// mismo ejercicio en más de una serie, se queda con la mejora más
// significativa (peso > reps > RIR), no una línea repetida por serie.
const TYPE_PRIORITY: Record<RecordType, number> = { weight: 2, reps: 1, rir: 0 };

export function summarizeSessionRecords(records: SessionRecord[]): SessionRecord[] {
  const byExercise = new Map<string, SessionRecord>();
  for (const record of records) {
    const current = byExercise.get(record.exerciseId);
    if (!current) {
      byExercise.set(record.exerciseId, record);
      continue;
    }
    const currentRank = TYPE_PRIORITY[current.type];
    const nextRank = TYPE_PRIORITY[record.type];
    const better =
      nextRank > currentRank ||
      (nextRank === currentRank &&
        (record.weightDelta ?? 0) + (record.repsDelta ?? 0) >
          (current.weightDelta ?? 0) + (current.repsDelta ?? 0));
    if (better) byExercise.set(record.exerciseId, record);
  }
  return Array.from(byExercise.values());
}
