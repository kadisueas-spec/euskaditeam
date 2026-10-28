import { isBetterSet } from "@/lib/utils/session-records";
import { isBetterTrackingSet, type TrackingSet } from "@/lib/utils/tracking-progression";
import { detectTrackingRecord, trackingRecordDiff, type TrackingRecord } from "@/lib/utils/tracking-records";
import { formatSet } from "@/lib/utils/set-format";
import type { TrackingFields } from "@/lib/constants/tracking";
import { fmtKg } from "@/lib/reports/format";
import type { RecordRow } from "@/lib/reports/types";

// Mejor serie de un ejercicio en un día (ya agregada por el loader: solo
// sesiones finalizadas con al menos 1 serie).
export type DayBestSet = {
  date: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  // Tipos de registro (oct-2026): opcionales — sin `tracking` es peso + reps.
  seconds?: number | null;
  distanceKm?: number | null;
  intensity?: number | null;
  assistance?: number | null;
  tracking?: TrackingFields;
};

export type PersonalBest = {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  type: "weight" | "reps" | "rir";
  delta: number;
  current: DayBestSet;
  previous: DayBestSet;
  // Récord de un tipo que no es peso + reps: `type` es el equivalente más
  // cercano (para el orden) y el texto sale de acá.
  typed?: { fields: TrackingFields; record: TrackingRecord };
};

export function isTypedTracking(r: DayBestSet): boolean {
  return !!r.tracking && r.tracking.trackingType !== "weight_reps";
}

export function dayBestToTrackingSet(r: DayBestSet): TrackingSet {
  return {
    weight: r.weight,
    reps: r.reps,
    rir: r.rir,
    seconds: r.seconds ?? null,
    distanceKm: r.distanceKm ?? null,
    intensity: r.intensity ?? null,
    assistance: r.assistance ?? null,
  };
}

// ¿a es mejor que b? Con el criterio del tipo del ejercicio.
export function isBetterDayBest(a: DayBestSet, b: DayBestSet): boolean {
  if (isTypedTracking(a)) return isBetterTrackingSet(a.tracking!, dayBestToTrackingSet(a), dayBestToTrackingSet(b));
  return isBetterSet(asSet(a), asSet(b));
}

const EPS = 0.001;
const TYPE_ORDER = { weight: 0, reps: 1, rir: 2 } as const;

function asSet(r: DayBestSet) {
  return { weight: r.weight, reps: r.reps, rir: r.rir };
}

function bestByExercise(rows: DayBestSet[]): Map<string, DayBestSet> {
  const best = new Map<string, DayBestSet>();
  for (const r of rows) {
    const current = best.get(r.exerciseId);
    if (!current || isBetterDayBest(r, current)) best.set(r.exerciseId, r);
  }
  return best;
}

// Mejores marcas del período contra la MEJOR MARCA HISTÓRICA anterior al
// período (aprobado oct-2026), no contra la semana anterior: con la semana
// anterior, volver a un peso que ya se había hecho contaba como récord
// (Luz: "+10 kg en Hack squat" tras una semana liviana, cuando ya había
// hecho 90 kg). Un ejercicio sin historial previo no es récord. Orden por
// impacto: kilos, después reps, después RIR; dentro de cada tipo, la mejora
// más grande primero (mismo criterio que compareRecordsByImpact).
export function personalBests(rows: DayBestSet[], periodStart: string, periodEnd: string): PersonalBest[] {
  const before = bestByExercise(rows.filter((r) => r.date < periodStart));
  const during = bestByExercise(rows.filter((r) => r.date >= periodStart && r.date <= periodEnd));

  const out: PersonalBest[] = [];
  for (const [exerciseId, cur] of during) {
    const prev = before.get(exerciseId);
    if (!prev) continue;
    if (isTypedTracking(cur)) {
      const record = detectTrackingRecord(cur.tracking!, dayBestToTrackingSet(prev), dayBestToTrackingSet(cur));
      if (!record) continue;
      out.push({
        exerciseId,
        exerciseName: cur.exerciseName,
        muscleGroup: cur.muscleGroup,
        type:
          record.type === "rir"
            ? "rir"
            : record.type === "load" || record.type === "assistance" || record.type === "intensity"
              ? "weight"
              : "reps",
        delta: record.delta,
        current: cur,
        previous: prev,
        typed: { fields: cur.tracking!, record },
      });
      continue;
    }
    if (!isBetterSet(asSet(cur), asSet(prev))) continue;
    const cw = cur.weight ?? 0;
    const pw = prev.weight ?? 0;
    let type: PersonalBest["type"];
    let delta: number;
    if (cw - pw > EPS) {
      type = "weight";
      delta = Math.round((cw - pw) * 100) / 100;
    } else if ((cur.reps ?? 0) > (prev.reps ?? 0)) {
      type = "reps";
      delta = (cur.reps ?? 0) - (prev.reps ?? 0);
    } else {
      type = "rir";
      delta = (cur.rir ?? 0) - (prev.rir ?? 0);
    }
    out.push({
      exerciseId,
      exerciseName: cur.exerciseName,
      muscleGroup: cur.muscleGroup,
      type,
      delta,
      current: cur,
      previous: prev,
    });
  }
  return out.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || b.delta - a.delta);
}

// "90 × 10", o "12 reps" sin carga (peso corporal).
export function setValue(s: { weight: number | null; reps: number | null }): string {
  if (s.weight == null || s.weight === 0) return `${s.reps ?? 0} reps`;
  return `${fmtKg(s.weight)} × ${s.reps ?? 0}`;
}

export function recordDiff(pb: PersonalBest): string {
  if (pb.typed) return trackingRecordDiff(pb.typed.fields, pb.typed.record);
  if (pb.type === "weight") return `+${fmtKg(pb.delta)} kg`;
  if (pb.type === "reps") return `+${pb.delta} ${pb.delta === 1 ? "rep" : "reps"}`;
  return `RIR ${pb.current.rir} (antes ${pb.previous.rir})`;
}

export function recordRow(pb: PersonalBest): RecordRow {
  return { exercise: pb.exerciseName, value: pbValue(pb, pb.current), diff: recordDiff(pb) };
}

// Cómo se lee la serie de una mejor marca: "90 × 10", o según su tipo
// ("45 s", "12 reps · ayuda 20 kg", "20 min · nivel 8").
export function pbValue(pb: PersonalBest, s: DayBestSet): string {
  if (pb.typed) {
    const t = dayBestToTrackingSet(s);
    return formatSet(pb.typed.fields, {
      weight: t.weight,
      reps: t.reps,
      rir: t.rir,
      seconds: t.seconds,
      distanceKm: t.distanceKm,
      intensity: t.intensity,
      assistance: t.assistance,
    });
  }
  return setValue(s);
}

// Número grande y unidad de la tarjeta "Tu mejor avance" para un tipo
// que no es peso + reps.
export function typedHeadline(pb: PersonalBest): { value: string; unit: string } {
  const r = pb.typed!.record;
  const f = pb.typed!.fields;
  const d = Number.isInteger(r.delta) ? String(r.delta) : String(r.delta).replace(".", ",");
  switch (r.type) {
    case "load":
      return { value: `+${d}`, unit: "kg lastre" };
    case "assistance":
      return f.assistanceUnit === "band" ? { value: `−${d}`, unit: "banda" } : { value: `−${d}`, unit: "kg ayuda" };
    case "reps":
      return { value: `+${d}`, unit: "reps" };
    case "seconds":
      return { value: `+${d}`, unit: "s" };
    case "minutes":
      return { value: `+${d}`, unit: "min" };
    case "intensity":
      return { value: `+${d}`, unit: f.cardioScale === "effort" ? "esfuerzo" : "nivel" };
    case "distance":
      return { value: `+${d}`, unit: "km" };
    case "rir":
      return { value: `+${d}`, unit: "RIR" };
  }
}
