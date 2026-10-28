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

// Tipos de registro (oct-2026): segundos (isométrico y cardio), distancia,
// intensidad (nivel o esfuerzo) y asistencia. Opcionales: peso + reps no
// los manda.
const DURATION_SECONDS_MAX = 6 * 60 * 60;
const DISTANCE_KM_MAX = 200;
const INTENSITY_MAX = 100;
const ASSISTANCE_MAX = 300;

export type SetInputLike = {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  durationSeconds?: number | null;
  distanceKm?: number | null;
  intensity?: number | null;
  assistance?: number | null;
};

function outOfRange(v: number | null | undefined, max: number, integer = false): boolean {
  if (v == null) return false;
  return !Number.isFinite(v) || v < 0 || v > max || (integer && !Number.isInteger(v));
}

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
  if (outOfRange(input.durationSeconds, DURATION_SECONDS_MAX, true) || input.durationSeconds === 0) {
    return "El tiempo ingresado no es válido.";
  }
  if (outOfRange(input.distanceKm, DISTANCE_KM_MAX)) return "La distancia ingresada no es válida.";
  if (outOfRange(input.intensity, INTENSITY_MAX)) return "La intensidad ingresada no es válida.";
  if (outOfRange(input.assistance, ASSISTANCE_MAX)) return "La asistencia ingresada no es válida.";
  return null;
}

// Columnas nuevas de workout_set_logs. Al insertar van todas (null si no
// vienen); al actualizar, solo las que vienen — así una corrección hecha
// desde una pantalla que todavía no las conoce no las borra.
export function trackingSetColumns(input: SetInputLike, mode: "insert" | "update") {
  const columns: Record<string, number | null> = {};
  const pairs: [string, number | null | undefined][] = [
    ["duration_seconds", input.durationSeconds],
    ["distance_km", input.distanceKm],
    ["intensity", input.intensity],
    ["assistance", input.assistance],
  ];
  for (const [column, value] of pairs) {
    if (value !== undefined) columns[column] = value;
    else if (mode === "insert") columns[column] = null;
  }
  return columns;
}
