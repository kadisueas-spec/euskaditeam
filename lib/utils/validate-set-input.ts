// Auditoría de seguridad jul-2026, sección 3: addSet/updateSet solo tenían
// el tipo de TypeScript como "validación" (no se aplica en runtime — un
// request directo al Server Action con un payload manipulado podía mandar
// cualquier cosa). Antes esto lo único que frenaba era el tipo de columna
// de Postgres (numeric), que devuelve un 500 poco descriptivo en vez de un
// error controlado. Rangos generosos, solo para descartar basura evidente
// (negativos, strings, Infinity, valores absurdos) — no reemplazan el
// límite de RIR 0-5 que ya impone el input del UI, son la red de
// seguridad del servidor, no la UX.
const WEIGHT_KG_MAX = 500;
const REPS_MAX = 200;
const RIR_MIN = 0;
const RIR_MAX = 5;

export type SetInputLike = {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
};

export function validateSetInput(input: SetInputLike): string | null {
  if (input.weightKg != null) {
    if (
      !Number.isFinite(input.weightKg) ||
      input.weightKg < 0 ||
      input.weightKg > WEIGHT_KG_MAX
    ) {
      return "El peso ingresado no es válido.";
    }
  }
  if (input.reps != null) {
    if (
      !Number.isFinite(input.reps) ||
      !Number.isInteger(input.reps) ||
      input.reps < 0 ||
      input.reps > REPS_MAX
    ) {
      return "Las repeticiones ingresadas no son válidas.";
    }
  }
  if (input.rir != null) {
    if (!Number.isFinite(input.rir) || input.rir < RIR_MIN || input.rir > RIR_MAX) {
      return "El RIR ingresado no es válido.";
    }
  }
  return null;
}
