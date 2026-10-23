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
  // Caso 4: R > máximo, o R = máximo con RIR alto → subir el peso
  // (estimación de 1RM con las reps + el RIR real que cargó el cliente).
  | "raise_weight"
  // Caso 4 sin peso para subir (peso corporal): mismo peso, apuntar al máximo.
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
  raise_weight: "Te sobró resto: subimos el peso para que la serie cuente",
  lower_weight: "Bajá el peso para mantenerte en el rango.",
  aim_max: "Buen trabajo, apuntá al máximo del rango.",
  bodyweight_hold: "Mantené la técnica, hacé las que puedas.",
  repeat: null,
};

const EPSILON = 1e-9;
// Sin RIR objetivo cargado, "RIR alto" al tope del rango es 3 o más.
const HIGH_RIR_WITHOUT_TARGET = 3;

// Paso de redondeo: múltiplos de 2,5 kg, salvo que el incremento del
// ejercicio no sea múltiplo de 2,5 (mancuernas de a 1 kg).
function weightStep(weightIncrement: number): number {
  const ratio = weightIncrement / 2.5;
  return Math.abs(ratio - Math.round(ratio)) < EPSILON ? 2.5 : weightIncrement;
}

function roundUpWeight(kg: number, weightIncrement: number): number {
  const step = weightStep(weightIncrement);
  const rounded = Math.ceil((kg - EPSILON) / step) * step;
  return Math.round(rounded * 100) / 100;
}

// Epley con repeticiones hasta el fallo = reps hechas + RIR (las que
// sobraban). 1RM = P × (1 + (R + RIR) / 30).
export function estimateOneRepMax(weight: number, reps: number, rir: number): number {
  return weight * (1 + (reps + rir) / 30);
}

// Peso para que la serie caiga en el tope del rango con el RIR objetivo, a
// partir del 1RM estimado. Redondeo HACIA ARRIBA al paso del ejercicio (el
// de abajo podría volver a pasarse del rango) y nunca menos de un
// incremento por encima del peso actual. Las reps sugeridas son las que
// predice la misma fórmula con el peso nuevo, acotadas al rango.
function raisedSet(p: {
  weight: number;
  reps: number;
  rirActual: number | null;
  rirTarget: number | null;
  min: number;
  max: number;
  increment: number;
}): { weight: number; reps: number } {
  const oneRm = estimateOneRepMax(p.weight, p.reps, p.rirActual ?? 0);
  const targetRir = p.rirTarget ?? 0;
  const ideal = oneRm / (1 + (p.max + targetRir) / 30);
  const minimum = Math.round((p.weight + p.increment) * 100) / 100;
  const weight = Math.max(roundUpWeight(ideal, p.increment), minimum);
  const predicted = Math.floor(30 * (oneRm / weight - 1) - targetRir + EPSILON);
  return { weight, reps: Math.min(p.max, Math.max(p.min, predicted)) };
}

// Redondeo hacia abajo al múltiplo de 2,5 kg — salvo que el incremento del
// ejercicio no sea múltiplo de 2,5 (ej. mancuernas de a 1 kg): ahí se
// redondea al múltiplo del propio incremento, si no 22 − 1 = 21 terminaría
// en 20 (bajaría el doble de lo indicado).
function roundDownWeight(kg: number, weightIncrement: number): number {
  const step = weightStep(weightIncrement);
  const rounded = Math.floor((kg + EPSILON) / step) * step;
  return Math.round(rounded * 100) / 100;
}

export function suggestNextSet(params: {
  weight: number | null; // P — null/0 = peso corporal
  reps: number; // R
  repsMin: number | null;
  repsMax: number | null;
  rirTarget: number | null;
  // RIR que cargó el cliente en la serie anterior (null si no lo cargó).
  rirActual?: number | null;
  weightIncrement: number;
}): SetProgressionSuggestion | null {
  const { weight, reps, rirTarget } = params;
  const rirActual = params.rirActual ?? null;
  if (!Number.isFinite(reps) || reps <= 0) return null;

  // Un solo extremo cargado vale como mínimo y máximo (misma convención que
  // la etiqueta "Reps" del logger).
  const min = params.repsMin ?? params.repsMax;
  const max = params.repsMax ?? params.repsMin;
  const rir = rirTarget;

  if (min == null || max == null) {
    return { weight, reps, rir, progressionCase: "repeat" };
  }

  const increment = params.weightIncrement > 0 ? params.weightIncrement : 2.5;

  // Caso 4: se pasó del rango, o llegó al tope con más resto que el
  // objetivo → subir el peso. Bug oct-2026: 15 kg × 18 @RIR 3 (rango 10-14)
  // sugería 15 × 14, mantener el peso con resto de sobra.
  const highRirAtTop =
    reps === max &&
    rirActual != null &&
    (rirTarget != null ? rirActual > rirTarget : rirActual >= HIGH_RIR_WITHOUT_TARGET);
  if (reps > max || highRirAtTop) {
    if (weight == null || weight <= 0) {
      return { weight, reps: max, rir, progressionCase: "aim_max" };
    }
    const raised = raisedSet({ weight, reps, rirActual, rirTarget, min, max, increment });
    return { ...raised, rir, progressionCase: "raise_weight" };
  }

  // Caso 1
  if (reps >= min && reps - 1 >= min) {
    return { weight, reps: reps - 1, rir, progressionCase: "same_weight_one_less" };
  }

  // Casos 2 y 3: bajar el peso — si se puede.
  const lowered =
    weight != null && weight > 0 ? roundDownWeight(weight - increment, increment) : 0;
  if (lowered <= 0) {
    return { weight, reps, rir, progressionCase: "bodyweight_hold" };
  }
  return { weight: lowered, reps: max, rir, progressionCase: "lower_weight" };
}
