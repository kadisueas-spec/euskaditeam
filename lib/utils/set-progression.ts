// Progresión serie a serie (oct-2026): sugerencia para la SIGUIENTE serie
// de la misma sesión, calculada contra la serie que el cliente acaba de
// completar (no contra la sesión anterior — eso es solo la serie 1, ver
// getWorkoutSuggestions). Función pura, sin Supabase: corre en el teléfono,
// así que funciona offline y con la serie anterior todavía pendiente de
// sincronizar. Si la sesión anterior tuvo menos series que hoy, las extra
// salen igual de la última serie de hoy — no hace falta caso aparte.

export type SetProgressionCase =
  // Caso 1: R en rango y R−1 ≥ mínimo → mismo peso, una rep menos.
  | "same_weight_one_less"
  // Casos 2 y 3: R−1 < mínimo, o R < mínimo → bajar el peso, apuntar al máximo.
  | "lower_weight"
  // Caso 4: R > máximo → mismo peso, apuntar al máximo.
  | "aim_max"
  // Casos 2/3 sin peso para bajar (peso corporal, o P − incremento ≤ 0):
  // mismo peso, mismas reps.
  | "bodyweight_hold"
  // Ejercicio sin rango de reps cargado: repetir la serie anterior.
  | "repeat";

export type SetProgressionSuggestion = {
  weight: number | null;
  reps: number;
  rir: number | null;
  progressionCase: SetProgressionCase;
};

export const SET_PROGRESSION_TEXT: Record<SetProgressionCase, string | null> = {
  same_weight_one_less: "Con la fatiga cae el rendimiento: mismo peso, una rep menos.",
  lower_weight: "Bajá el peso para mantenerte en el rango.",
  aim_max: "Buen trabajo, apuntá al máximo del rango.",
  bodyweight_hold: "Mantené la técnica, hacé las que puedas.",
  repeat: null,
};

const EPSILON = 1e-9;

// Redondeo hacia abajo al múltiplo de 2,5 kg — salvo que el incremento del
// ejercicio no sea múltiplo de 2,5 (ej. mancuernas de a 1 kg): ahí se
// redondea al múltiplo del propio incremento, si no 22 − 1 = 21 terminaría
// en 20 (bajaría el doble de lo indicado).
function roundDownWeight(kg: number, weightIncrement: number): number {
  const ratio = weightIncrement / 2.5;
  const step = Math.abs(ratio - Math.round(ratio)) < EPSILON ? 2.5 : weightIncrement;
  const rounded = Math.floor((kg + EPSILON) / step) * step;
  return Math.round(rounded * 100) / 100;
}

export function suggestNextSet(params: {
  weight: number | null; // P — null/0 = peso corporal
  reps: number; // R
  repsMin: number | null;
  repsMax: number | null;
  rirTarget: number | null;
  weightIncrement: number;
}): SetProgressionSuggestion | null {
  const { weight, reps, rirTarget } = params;
  if (!Number.isFinite(reps) || reps <= 0) return null;

  // Un solo extremo cargado vale como mínimo y máximo (misma convención que
  // la etiqueta "Reps" del logger).
  const min = params.repsMin ?? params.repsMax;
  const max = params.repsMax ?? params.repsMin;
  const rir = rirTarget;

  if (min == null || max == null) {
    return { weight, reps, rir, progressionCase: "repeat" };
  }

  // Caso 4
  if (reps > max) {
    return { weight, reps: max, rir, progressionCase: "aim_max" };
  }

  // Caso 1
  if (reps >= min && reps - 1 >= min) {
    return { weight, reps: reps - 1, rir, progressionCase: "same_weight_one_less" };
  }

  // Casos 2 y 3: bajar el peso — si se puede.
  const increment = params.weightIncrement > 0 ? params.weightIncrement : 2.5;
  const lowered =
    weight != null && weight > 0 ? roundDownWeight(weight - increment, increment) : 0;
  if (lowered <= 0) {
    return { weight, reps, rir, progressionCase: "bodyweight_hold" };
  }
  return { weight: lowered, reps: max, rir, progressionCase: "lower_weight" };
}
