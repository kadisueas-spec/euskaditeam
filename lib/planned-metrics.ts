// Métricas PLANIFICADAS del creador/editor de rutinas: lo que el coach está
// diseñando, no lo que el cliente entrenó (eso vive en lib/supabase/metrics.ts).
// Cálculo 100% en memoria a partir del estado del formulario — sin ida y
// vuelta a la base — para que el panel se actualice al instante con cada
// tecla mientras el coach arma la rutina.

export type PlannedExerciseInput = {
  exerciseId: string;
  sets: string;
  repsMin: string;
  repsMax: string;
  rir: string;
};

export type PlannedDayInput = {
  exercises: PlannedExerciseInput[];
};

export type VolumeStatus = "ok" | "warning" | "danger";

export type MuscleGroupVolume = {
  group: string;
  sets: number;
  status: VolumeStatus;
};

export type MuscleGroupTonnage = {
  group: string;
  units: number;
};

export type PlannedRirDistribution = {
  rir3: number;
  rir2: number;
  rir1: number;
  rir0: number;
  ratedSets: number;
};

export type PlannedMetrics = {
  totalSets: number;
  volumeByGroup: MuscleGroupVolume[];
  rir: PlannedRirDistribution;
  tonnageByGroup: MuscleGroupTonnage[];
};

export const VOLUME_WARNING_THRESHOLD = 25;
export const VOLUME_DANGER_THRESHOLD = 30;

function statusForSets(sets: number): VolumeStatus {
  if (sets > VOLUME_DANGER_THRESHOLD) return "danger";
  if (sets > VOLUME_WARNING_THRESHOLD) return "warning";
  return "ok";
}

export function computePlannedMetrics(
  days: PlannedDayInput[],
  muscleGroupByExerciseId: Map<string, string | null>
): PlannedMetrics {
  const setsByGroup = new Map<string, number>();
  const tonnageByGroup = new Map<string, number>();
  let totalSets = 0;
  let ratedSets = 0;
  let rir3 = 0;
  let rir2 = 0;
  let rir1 = 0;
  let rir0 = 0;

  for (const day of days) {
    for (const ex of day.exercises) {
      if (!ex.exerciseId) continue;
      const sets = Number(ex.sets);
      if (!Number.isFinite(sets) || sets <= 0) continue;

      const group = muscleGroupByExerciseId.get(ex.exerciseId) ?? "Sin grupo";
      setsByGroup.set(group, (setsByGroup.get(group) ?? 0) + sets);
      totalSets += sets;

      const repsMin = ex.repsMin !== "" ? Number(ex.repsMin) : null;
      const repsMax = ex.repsMax !== "" ? Number(ex.repsMax) : null;
      const reps =
        repsMin != null && repsMax != null
          ? (repsMin + repsMax) / 2
          : (repsMax ?? repsMin ?? 0);
      if (reps > 0) {
        tonnageByGroup.set(group, (tonnageByGroup.get(group) ?? 0) + sets * reps);
      }

      const rir = ex.rir !== "" ? Number(ex.rir) : null;
      if (rir != null && Number.isFinite(rir)) {
        ratedSets += sets;
        if (rir >= 3) rir3 += sets;
        else if (rir === 2) rir2 += sets;
        else if (rir === 1) rir1 += sets;
        else rir0 += sets;
      }
    }
  }

  const volumeByGroup = [...setsByGroup.entries()]
    .map(([group, sets]) => ({ group, sets, status: statusForSets(sets) }))
    .sort((a, b) => b.sets - a.sets);

  const tonnageEntries = [...tonnageByGroup.entries()]
    .map(([group, units]) => ({ group, units: Math.round(units) }))
    .sort((a, b) => b.units - a.units);

  const pct = (n: number) => (ratedSets > 0 ? Math.round((n / ratedSets) * 100) : 0);

  return {
    totalSets,
    volumeByGroup,
    rir: {
      rir3: pct(rir3),
      rir2: pct(rir2),
      rir1: pct(rir1),
      rir0: pct(rir0),
      ratedSets,
    },
    tonnageByGroup: tonnageEntries,
  };
}
