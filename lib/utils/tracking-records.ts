import type { TrackingFields } from "@/lib/constants/tracking";
import type { TrackingSet } from "@/lib/utils/tracking-progression";

// Récords de los tipos de registro que no son peso + reps (oct-2026).
// Peso + reps sigue con detectWeeklyRecord / personalBests de siempre.
//
// Qué cuenta como récord (siempre contra una referencia: la semana pasada
// en Entrenar y la celebración semanal, la mejor marca histórica anterior
// al período en los reportes). Cada criterio pide empatar el anterior:
// - Peso corporal: más lastre → más reps con el mismo lastre → más RIR.
// - Asistido: MENOS ayuda → más reps con la misma ayuda → más RIR.
// - Isométrico: más lastre → más segundos con el mismo lastre.
// - Cardio: más intensidad sin bajar los minutos → más minutos sin bajar
//   la intensidad → más distancia sin más minutos. La intensidad solo se
//   compara si las dos sesiones la tienen.
// - Check: nunca.

export type TrackingRecordType = "load" | "reps" | "rir" | "assistance" | "seconds" | "minutes" | "intensity" | "distance";

export type TrackingRecord = {
  type: TrackingRecordType;
  // Siempre positiva: cuánto mejoró (en asistencia, cuántos kg/niveles menos).
  delta: number;
  previous: number;
  current: number;
};

const EPS = 0.001;

function v(x: number | null): number {
  return x ?? 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function rec(type: TrackingRecordType, previous: number, current: number, lowerIsBetter = false): TrackingRecord {
  return { type, previous, current, delta: round2(lowerIsBetter ? previous - current : current - previous) };
}

export function detectTrackingRecord(tracking: TrackingFields, prev: TrackingSet, cur: TrackingSet): TrackingRecord | null {
  switch (tracking.trackingType) {
    case "bodyweight_reps": {
      if (cur.reps == null || prev.reps == null) return null;
      if (tracking.assistanceUnit) {
        if (cur.assistance == null || prev.assistance == null) return null;
        if (cur.assistance < prev.assistance - EPS) return rec("assistance", prev.assistance, cur.assistance, true);
        if (cur.assistance > prev.assistance + EPS) return null;
      } else {
        const cl = v(cur.weight);
        const pl = v(prev.weight);
        if (cl > pl + EPS) return rec("load", pl, cl);
        if (cl < pl - EPS) return null;
      }
      if (cur.reps > prev.reps) return rec("reps", prev.reps, cur.reps);
      if (cur.reps < prev.reps) return null;
      if (cur.rir != null && prev.rir != null && cur.rir > prev.rir) return rec("rir", prev.rir, cur.rir);
      return null;
    }
    case "time": {
      if (cur.seconds == null || prev.seconds == null) return null;
      const cl = v(cur.weight);
      const pl = v(prev.weight);
      if (cl > pl + EPS) return rec("load", pl, cl);
      if (cl < pl - EPS) return null;
      if (cur.seconds > prev.seconds) return rec("seconds", prev.seconds, cur.seconds);
      return null;
    }
    case "cardio": {
      if (cur.seconds == null || prev.seconds == null) return null;
      const bothIntensity = cur.intensity != null && prev.intensity != null;
      if (bothIntensity && cur.intensity! > prev.intensity! + EPS && cur.seconds >= prev.seconds) {
        return rec("intensity", prev.intensity!, cur.intensity!);
      }
      const intensityKept = !bothIntensity || cur.intensity! >= prev.intensity! - EPS;
      if (intensityKept && cur.seconds > prev.seconds) {
        return rec("minutes", Math.round(prev.seconds / 60), Math.round(cur.seconds / 60));
      }
      if (
        intensityKept &&
        cur.seconds <= prev.seconds &&
        cur.distanceKm != null &&
        prev.distanceKm != null &&
        cur.distanceKm > prev.distanceKm + EPS
      ) {
        return rec("distance", prev.distanceKm, cur.distanceKm);
      }
      return null;
    }
    default:
      return null;
  }
}

// Prioridad por impacto, igual que en peso + reps (1º la carga, 2º el
// volumen de trabajo, 3º el resto): ordena récords de tipos distintos.
export const TRACKING_RECORD_PRIORITY: Record<TrackingRecordType, number> = {
  load: 2,
  assistance: 2,
  intensity: 2,
  reps: 1,
  seconds: 1,
  minutes: 1,
  distance: 0.5,
  rir: 0,
};

function fmt(n: number): string {
  const r = round2(n);
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

// "+2,5 kg de lastre", "−5 kg de ayuda", "+10 s", "+3 min", "nivel 7 → 8".
export function trackingRecordDiff(tracking: TrackingFields, r: TrackingRecord): string {
  switch (r.type) {
    case "load":
      return `+${fmt(r.delta)} kg de lastre`;
    case "assistance":
      return tracking.assistanceUnit === "band" ? `banda ${fmt(r.previous)} → ${fmt(r.current)}` : `−${fmt(r.delta)} kg de ayuda`;
    case "reps":
      return `+${fmt(r.delta)} ${r.delta === 1 ? "rep" : "reps"}`;
    case "seconds":
      return `+${fmt(r.delta)} s`;
    case "minutes":
      return `+${fmt(r.delta)} min`;
    case "intensity":
      return `${tracking.cardioScale === "effort" ? "esfuerzo" : "nivel"} ${fmt(r.previous)} → ${fmt(r.current)}`;
    case "distance":
      return `+${fmt(r.delta)} km`;
    case "rir":
      return `RIR ${fmt(r.current)} (antes ${fmt(r.previous)})`;
  }
}

// Detalle del banner de Entrenar ("¡Nuevo récord!" + esto).
export function trackingRecordBanner(tracking: TrackingFields, r: TrackingRecord): string {
  switch (r.type) {
    case "assistance":
      return tracking.assistanceUnit === "band"
        ? `Bajaste de banda: ${fmt(r.previous)} → ${fmt(r.current)} 💪`
        : `${fmt(r.delta)} kg menos de ayuda que la semana pasada 💪`;
    case "load":
      return `+${fmt(r.delta)} kg de lastre más que la semana pasada`;
    case "reps":
      return `+${fmt(r.delta)} reps más que la semana pasada`;
    case "seconds":
      return `+${fmt(r.delta)} s más que la semana pasada`;
    case "minutes":
      return `+${fmt(r.delta)} min más que la semana pasada`;
    case "intensity":
      return `Subiste de ${tracking.cardioScale === "effort" ? "esfuerzo" : "nivel"}: ${fmt(r.previous)} → ${fmt(r.current)}`;
    case "distance":
      return `+${fmt(r.delta)} km en el mismo tiempo`;
    case "rir":
      return `Mismas reps, con ${fmt(r.delta)} más en reserva 💪`;
  }
}
