import type { TrackingFields } from "@/lib/constants/tracking";

// Cómo se lee una serie ya cargada según el tipo de registro (oct-2026):
// "60 kg · 10 reps · RIR 2", "12 reps · +5 kg", "45 s por lado",
// "20 min · 3,2 km · nivel 8", "10 reps · ayuda 20 kg", "Hecho".
// Lo usan Entrenar, el historial del cliente y la sesión que ve el coach.

export type SetValues = {
  weight: number | null;
  reps: number | null;
  rir: number | null;
  seconds: number | null;
  distanceKm: number | null;
  intensity: number | null;
  assistance: number | null;
};

function n(v: number): string {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, "0")} min`;
}

export function formatSet(tracking: TrackingFields, v: SetValues): string {
  const side = tracking.perSide ? " por lado" : "";
  const parts: string[] = [];
  switch (tracking.trackingType) {
    case "check":
      return "Hecho";
    case "cardio":
      // Registro viejo (antes de los tipos): quedó con peso y reps
      if (v.seconds == null) return legacy(v);
      parts.push(formatDuration(v.seconds));
      if (v.distanceKm != null) parts.push(`${n(v.distanceKm)} km`);
      if (v.intensity != null) parts.push(tracking.cardioScale === "effort" ? `esfuerzo ${n(v.intensity)}` : `nivel ${n(v.intensity)}`);
      return parts.join(" · ");
    case "time":
      if (v.seconds == null) return legacy(v);
      parts.push(`${v.seconds} s${side}`);
      if (v.weight != null && v.weight > 0) parts.push(`+${n(v.weight)} kg`);
      return parts.join(" · ");
    case "bodyweight_reps":
      parts.push(v.reps != null ? `${v.reps} reps${side}` : "- reps");
      if (tracking.assistanceUnit) {
        if (v.assistance != null) {
          parts.push(tracking.assistanceUnit === "band" ? `banda ${n(v.assistance)}` : `ayuda ${n(v.assistance)} kg`);
        }
      } else if (v.weight != null && v.weight > 0) {
        parts.push(`+${n(v.weight)} kg`);
      }
      if (v.rir != null) parts.push(`RIR ${v.rir}`);
      return parts.join(" · ");
    default:
      parts.push(`${v.weight != null ? n(v.weight) : "-"} kg`, `${v.reps != null ? v.reps : "-"} reps${side}`);
      if (v.rir != null) parts.push(`RIR ${v.rir}`);
      return parts.join(" · ");
  }
}

// Series cargadas antes de que el ejercicio tuviera su tipo: se muestran tal
// cual se anotaron, sin interpretarlas.
function legacy(v: SetValues): string {
  const parts: string[] = [];
  if (v.weight != null) parts.push(`${n(v.weight)} kg`);
  if (v.reps != null) parts.push(`${v.reps} reps`);
  return parts.length > 0 ? `${parts.join(" · ")} (registro anterior)` : "-";
}
