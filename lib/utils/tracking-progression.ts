import type { TrackingFields } from "@/lib/constants/tracking";

// Sugerencias de Entrenar para los tipos de registro que no son peso + reps
// (oct-2026). Peso + reps sigue con su lógica de siempre (serie 1:
// getWorkoutSuggestions; serie 2+: suggestNextSet). Funciones puras: corren
// en el servidor (serie 1) y en el teléfono (serie 2+, offline).
//
// - Peso corporal: más reps; en el tope del rango, sumar lastre (si ya usa)
//   o pasar a una variante más difícil.
// - Asistido: en el tope, bajar la ayuda; por debajo del mínimo, subirla.
// - Isométrico: +5 s por sesión hasta el máximo; en la sesión, repetir.
// - Cardio: más minutos hasta el objetivo; después +1 de nivel.

export type TrackingSet = {
  weight: number | null; // kilos extra (peso corporal, isométrico)
  reps: number | null;
  rir: number | null;
  seconds: number | null; // isométrico: segundos; cardio: segundos totales
  distanceKm: number | null;
  intensity: number | null;
  assistance: number | null;
};

export type TrackingTargets = {
  repsMin: number | null;
  repsMax: number | null;
  rirTarget: number | null;
  secondsMin: number | null;
  secondsMax: number | null;
  minutesTarget: number | null;
  intensityTarget: number | null;
  weightIncrement: number;
};

export type TrackingCase =
  | "bw_more_reps"
  | "bw_add_load"
  | "bw_top"
  | "bw_one_less"
  | "bw_less_load"
  | "bw_hold"
  | "assist_less"
  | "assist_more"
  | "time_more"
  | "time_top"
  | "time_hold"
  | "time_aim_min"
  | "cardio_more_minutes"
  | "cardio_more_intensity"
  | "cardio_hold"
  | "repeat";

export type TrackingSuggestion = { set: TrackingSet; trackingCase: TrackingCase };

// Textos cortos para el recuadro de la sugerencia (gris, debajo del dato).
export const TRACKING_CASE_TEXT: Record<TrackingCase, string> = {
  bw_more_reps: "Una rep más que la última vez.",
  bw_add_load: "Te sobró: sumamos un poco de lastre.",
  bw_top: "Llegaste al tope del rango: sumá lastre o pasá a una variante más difícil.",
  bw_one_less: "Con la fatiga cae el rendimiento: una rep menos.",
  bw_less_load: "Bajamos el lastre para volver al rango.",
  bw_hold: "Mantené la técnica, hacé las que puedas.",
  assist_less: "Te sobró: bajamos la ayuda.",
  assist_more: "Subimos un poco la ayuda para volver al rango.",
  time_more: "5 segundos más que la última vez.",
  time_top: "Llegaste al máximo: sumá 2,5 kg o pasá a una variante más difícil.",
  time_hold: "Mismo tiempo que la serie anterior.",
  time_aim_min: "Apuntá al mínimo del rango.",
  cardio_more_minutes: "Un poco más de tiempo que la última vez.",
  cardio_more_intensity: "Ya llegás al tiempo: subimos un nivel.",
  cardio_hold: "Mismo trabajo que la última vez.",
  repeat: "",
};

const TIME_STEP_SECONDS = 5;
const CARDIO_STEP_MINUTES = 2;
// Sin RIR objetivo, "le sobró resto" = RIR 3 o más (mismo criterio que
// suggestNextSet en peso + reps).
const SPARE_RIR_WITHOUT_TARGET = 3;

const EMPTY: TrackingSet = {
  weight: null,
  reps: null,
  rir: null,
  seconds: null,
  distanceKm: null,
  intensity: null,
  assistance: null,
};

function bounds(min: number | null, max: number | null): { min: number; max: number } | null {
  if (min == null && max == null) return null;
  const lo = min ?? max!;
  const hi = max ?? min!;
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Paso de la asistencia: kilos del ejercicio, o un nivel de banda.
function assistanceStep(tracking: TrackingFields, targets: TrackingTargets): number {
  return tracking.assistanceUnit === "band" ? 1 : targets.weightIncrement > 0 ? targets.weightIncrement : 2.5;
}

function spareRest(rirActual: number | null, rirTarget: number | null): boolean {
  if (rirActual == null) return false;
  return rirTarget != null ? rirActual > rirTarget : rirActual >= SPARE_RIR_WITHOUT_TARGET;
}

function withRir(set: TrackingSet, targets: TrackingTargets): TrackingSet {
  return { ...set, rir: targets.rirTarget };
}

// --- Mejor serie (para elegir la referencia de la semana pasada) ---

// ¿a es mejor que b? Peso + reps no pasa por acá (isBetterSet de siempre).
export function isBetterTrackingSet(tracking: TrackingFields, a: TrackingSet, b: TrackingSet): boolean {
  const cmp = (x: number | null, y: number | null, lowerIsBetter = false): number => {
    const xv = x ?? (lowerIsBetter ? Infinity : 0);
    const yv = y ?? (lowerIsBetter ? Infinity : 0);
    if (xv === yv) return 0;
    return (lowerIsBetter ? xv < yv : xv > yv) ? 1 : -1;
  };
  const order: number[] = [];
  switch (tracking.trackingType) {
    case "bodyweight_reps":
      if (tracking.assistanceUnit) order.push(cmp(a.assistance, b.assistance, true));
      else order.push(cmp(a.weight, b.weight));
      order.push(cmp(a.reps, b.reps), cmp(a.rir, b.rir));
      break;
    case "time":
      order.push(cmp(a.weight, b.weight), cmp(a.seconds, b.seconds));
      break;
    case "cardio":
      order.push(cmp(a.intensity, b.intensity), cmp(a.seconds, b.seconds), cmp(a.distanceKm, b.distanceKm));
      break;
    default:
      order.push(cmp(a.weight, b.weight), cmp(a.reps, b.reps), cmp(a.rir, b.rir));
  }
  return (order.find((c) => c !== 0) ?? 0) > 0;
}

// --- Serie 1: contra la mejor serie de la última sesión con datos ---

export function suggestFirstTrackingSet(
  tracking: TrackingFields,
  previous: TrackingSet,
  targets: TrackingTargets
): TrackingSuggestion | null {
  switch (tracking.trackingType) {
    case "bodyweight_reps": {
      if (previous.reps == null) return null;
      const range = bounds(targets.repsMin, targets.repsMax);
      if (tracking.assistanceUnit) {
        const step = assistanceStep(tracking, targets);
        if (range && previous.reps >= range.max && previous.assistance != null) {
          return {
            set: withRir({ ...EMPTY, reps: range.min, assistance: Math.max(0, round2(previous.assistance - step)) }, targets),
            trackingCase: "assist_less",
          };
        }
        const reps = range ? Math.min(previous.reps + 1, range.max) : previous.reps;
        return {
          set: withRir({ ...EMPTY, reps, assistance: previous.assistance }, targets),
          trackingCase: range ? "bw_more_reps" : "repeat",
        };
      }
      if (!range) return { set: withRir({ ...EMPTY, reps: previous.reps, weight: previous.weight }, targets), trackingCase: "repeat" };
      if (previous.reps >= range.max) {
        if (previous.weight != null && previous.weight > 0) {
          return {
            set: withRir({ ...EMPTY, reps: range.min, weight: round2(previous.weight + targets.weightIncrement) }, targets),
            trackingCase: "bw_add_load",
          };
        }
        return { set: withRir({ ...EMPTY, reps: range.max }, targets), trackingCase: "bw_top" };
      }
      return {
        set: withRir({ ...EMPTY, reps: Math.max(previous.reps + 1, range.min), weight: previous.weight }, targets),
        trackingCase: "bw_more_reps",
      };
    }
    case "time": {
      if (previous.seconds == null) return null;
      const range = bounds(targets.secondsMin, targets.secondsMax);
      if (range && previous.seconds >= range.max) {
        return { set: { ...EMPTY, seconds: range.max, weight: previous.weight }, trackingCase: "time_top" };
      }
      const seconds = previous.seconds + TIME_STEP_SECONDS;
      return {
        set: { ...EMPTY, seconds: range ? Math.min(seconds, range.max) : seconds, weight: previous.weight },
        trackingCase: "time_more",
      };
    }
    case "cardio": {
      if (previous.seconds == null) return null;
      const minutes = Math.round(previous.seconds / 60);
      const target = targets.minutesTarget;
      if (target != null && minutes < target) {
        return {
          set: { ...EMPTY, seconds: Math.min(minutes + CARDIO_STEP_MINUTES, target) * 60, intensity: previous.intensity },
          trackingCase: "cardio_more_minutes",
        };
      }
      if (tracking.cardioScale === "level" && previous.intensity != null) {
        return {
          set: { ...EMPTY, seconds: minutes * 60, intensity: previous.intensity + 1 },
          trackingCase: "cardio_more_intensity",
        };
      }
      return { set: { ...EMPTY, seconds: minutes * 60, intensity: previous.intensity }, trackingCase: "cardio_hold" };
    }
    default:
      return null;
  }
}

// --- Serie 2 en adelante: contra la última serie de ESTA sesión ---

export function suggestNextTrackingSet(
  tracking: TrackingFields,
  last: TrackingSet,
  targets: TrackingTargets
): TrackingSuggestion | null {
  switch (tracking.trackingType) {
    case "bodyweight_reps": {
      if (last.reps == null || last.reps <= 0) return null;
      const range = bounds(targets.repsMin, targets.repsMax);
      const r = last.reps;
      if (!range) {
        return { set: { ...EMPTY, reps: r, weight: last.weight, assistance: last.assistance, rir: targets.rirTarget }, trackingCase: "repeat" };
      }
      const overTop = r > range.max || (r === range.max && spareRest(last.rir, targets.rirTarget));
      const belowRange = r - 1 < range.min;

      if (tracking.assistanceUnit) {
        const step = assistanceStep(tracking, targets);
        const a = last.assistance;
        if (overTop && a != null) {
          return { set: withRir({ ...EMPTY, reps: range.min, assistance: Math.max(0, round2(a - step)) }, targets), trackingCase: "assist_less" };
        }
        if (belowRange && a != null) {
          return { set: withRir({ ...EMPTY, reps: range.max, assistance: round2(a + step) }, targets), trackingCase: "assist_more" };
        }
        if (belowRange) return { set: withRir({ ...EMPTY, reps: r }, targets), trackingCase: "bw_hold" };
        return { set: withRir({ ...EMPTY, reps: r - 1, assistance: a }, targets), trackingCase: "bw_one_less" };
      }

      const load = last.weight != null && last.weight > 0 ? last.weight : null;
      if (overTop) {
        if (load != null) {
          return { set: withRir({ ...EMPTY, reps: range.min, weight: round2(load + targets.weightIncrement) }, targets), trackingCase: "bw_add_load" };
        }
        return { set: withRir({ ...EMPTY, reps: range.max }, targets), trackingCase: "bw_top" };
      }
      if (belowRange) {
        if (load != null) {
          const step = targets.weightIncrement > 0 ? targets.weightIncrement : 2.5;
          const lower = round2(roundTo(load - step, step));
          return {
            set: withRir({ ...EMPTY, reps: range.max, weight: lower > 0 ? lower : null }, targets),
            trackingCase: "bw_less_load",
          };
        }
        return { set: withRir({ ...EMPTY, reps: r }, targets), trackingCase: "bw_hold" };
      }
      return { set: withRir({ ...EMPTY, reps: r - 1, weight: load }, targets), trackingCase: "bw_one_less" };
    }
    case "time": {
      if (last.seconds == null || last.seconds <= 0) return null;
      const range = bounds(targets.secondsMin, targets.secondsMax);
      if (range && last.seconds < range.min) {
        return { set: { ...EMPTY, seconds: range.min, weight: last.weight }, trackingCase: "time_aim_min" };
      }
      return { set: { ...EMPTY, seconds: last.seconds, weight: last.weight }, trackingCase: "time_hold" };
    }
    default:
      // Cardio es una sola serie; "check" no tiene nada que sugerir.
      return null;
  }
}
