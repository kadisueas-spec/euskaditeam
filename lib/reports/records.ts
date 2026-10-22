import { isBetterSet } from "@/lib/utils/session-records";
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
};

export type PersonalBest = {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  type: "weight" | "reps" | "rir";
  delta: number;
  current: DayBestSet;
  previous: DayBestSet;
};

const EPS = 0.001;
const TYPE_ORDER = { weight: 0, reps: 1, rir: 2 } as const;

function asSet(r: DayBestSet) {
  return { weight: r.weight, reps: r.reps, rir: r.rir };
}

function bestByExercise(rows: DayBestSet[]): Map<string, DayBestSet> {
  const best = new Map<string, DayBestSet>();
  for (const r of rows) {
    const current = best.get(r.exerciseId);
    if (!current || isBetterSet(asSet(r), asSet(current))) best.set(r.exerciseId, r);
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
    if (!prev || !isBetterSet(asSet(cur), asSet(prev))) continue;
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
  if (pb.type === "weight") return `+${fmtKg(pb.delta)} kg`;
  if (pb.type === "reps") return `+${pb.delta} ${pb.delta === 1 ? "rep" : "reps"}`;
  return `RIR ${pb.current.rir} (antes ${pb.previous.rir})`;
}

export function recordRow(pb: PersonalBest): RecordRow {
  return { exercise: pb.exerciseName, value: setValue(pb.current), diff: recordDiff(pb) };
}
