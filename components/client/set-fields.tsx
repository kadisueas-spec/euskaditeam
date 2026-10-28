"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeDecimalInput } from "@/lib/utils/decimal-input";
import type { TrackingFields } from "@/lib/constants/tracking";
import type { TrackingSet } from "@/lib/utils/tracking-progression";

// Campos de una serie según el tipo de registro (oct-2026), compartidos por
// Entrenar (serie nueva y corrección) y el historial de una sesión pasada.
// Peso + reps no pasa por acá: Entrenar conserva su formulario de siempre.

// Fondo cálido de "sugerido" (mismo que el formulario de peso + reps).
const SUGGESTED_CLASS = "border-amber-400/50 bg-amber-400/10 text-amber-200";

// Campos extra del formulario de los tipos que no son peso + reps.
export type TrackingForm = {
  seconds: string;
  minutes: string;
  distance: string;
  intensity: string;
  assistance: string;
};

export const EMPTY_TRACKING_FORM: TrackingForm = { seconds: "", minutes: "", distance: "", intensity: "", assistance: "" };

export function numOrNull(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function str(v: number | null | undefined): string {
  return v != null ? String(v) : "";
}

// Sugerencia (TrackingSet) → campos del formulario.
export function trackingFormFrom(set: TrackingSet, cardio: boolean): TrackingForm {
  return {
    seconds: cardio ? "" : str(set.seconds),
    minutes: cardio && set.seconds != null ? String(Math.round(set.seconds / 60)) : "",
    distance: str(set.distanceKm),
    intensity: str(set.intensity),
    assistance: str(set.assistance),
  };
}

export type SetFieldValues = { weight: string; reps: string; rir: string } & TrackingForm;
export type SetFieldKey = keyof SetFieldValues;

// Campos de una serie para los tipos que no son peso + reps (oct-2026):
// peso corporal (reps; lastre o ayuda; RIR opcional), isométrico
// (segundos; lastre) y cardio (minutos; km; nivel o esfuerzo). Lo usan el
// formulario de la serie nueva (size "lg", con lo sugerido resaltado) y la
// corrección de una serie ya cargada (size "sm").
export function SetFields({
  tracking,
  values,
  onChange,
  size,
  suggested,
}: {
  tracking: TrackingFields;
  values: SetFieldValues;
  onChange: (key: SetFieldKey, value: string) => void;
  size: "lg" | "sm";
  suggested?: Partial<Record<SetFieldKey, boolean>>;
}) {
  const side = tracking.perSide ? " por lado" : "";
  const fields: { key: SetFieldKey; label: string; decimal: boolean; tour?: string }[] = [];
  if (tracking.trackingType === "bodyweight_reps") {
    fields.push({ key: "reps", label: `Reps${side}`, decimal: false });
    if (tracking.assistanceUnit === "kg") fields.push({ key: "assistance", label: "Ayuda (kg)", decimal: true });
    else if (tracking.assistanceUnit === "band") fields.push({ key: "assistance", label: "Banda (nivel)", decimal: true });
    else fields.push({ key: "weight", label: "Lastre (kg)", decimal: true });
    fields.push({ key: "rir", label: "RIR", decimal: false, tour: "rir" });
  } else if (tracking.trackingType === "time") {
    fields.push({ key: "seconds", label: `Segundos${side}`, decimal: false });
    fields.push({ key: "weight", label: "Lastre (kg)", decimal: true });
  } else if (tracking.trackingType === "cardio") {
    fields.push({ key: "minutes", label: "Minutos", decimal: true });
    fields.push({ key: "distance", label: "Km", decimal: true });
    fields.push({ key: "intensity", label: tracking.cardioScale === "effort" ? "Esfuerzo 1-10" : "Nivel", decimal: true });
  }
  return (
    <div className={`grid gap-2 ${fields.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
      {fields.map((f) => (
        <div key={f.key} data-tour={f.tour} className="flex flex-col gap-1">
          {size === "lg" && <Label className="text-xs">{f.label}</Label>}
          <Input
            type={f.decimal ? "text" : "number"}
            inputMode={f.decimal ? "decimal" : "numeric"}
            min={0}
            value={values[f.key]}
            aria-label={f.label}
            placeholder={size === "sm" ? f.label : f.key === "rir" || f.key === "weight" || f.key === "distance" ? "opcional" : undefined}
            onChange={(e) => onChange(f.key, f.decimal ? sanitizeDecimalInput(e.target.value) : e.target.value)}
            className={
              size === "lg"
                ? `h-[72px] text-center text-2xl font-bold ${suggested?.[f.key] ? SUGGESTED_CLASS : ""}`
                : "h-11 text-center"
            }
          />
        </div>
      ))}
    </div>
  );
}


// Serie guardada → campos (cardio: los segundos se muestran en minutos).
export function fieldsFromSaved(
  tracking: TrackingFields,
  saved: {
    weightKg: number | null;
    reps: number | null;
    rir: number | null;
    durationSeconds: number | null;
    distanceKm: number | null;
    intensity: number | null;
    assistance: number | null;
  }
): SetFieldValues {
  const cardio = tracking.trackingType === "cardio";
  return {
    weight: str(saved.weightKg),
    reps: str(saved.reps),
    rir: str(saved.rir),
    seconds: cardio ? "" : str(saved.durationSeconds),
    minutes: cardio && saved.durationSeconds != null ? String(Math.round((saved.durationSeconds / 60) * 10) / 10) : "",
    distance: str(saved.distanceKm),
    intensity: str(saved.intensity),
    assistance: str(saved.assistance),
  };
}

// Campos → lo que se guarda, según el tipo. Peso + reps devuelve solo
// peso/reps/RIR (las columnas nuevas no se tocan).
export function payloadFromFields(tracking: TrackingFields, v: SetFieldValues) {
  const type = tracking.trackingType;
  const weight = numOrNull(v.weight);
  const base = {
    weightKg: type === "cardio" || tracking.assistanceUnit ? null : weight,
    reps: type === "time" || type === "cardio" ? null : v.reps ? Number(v.reps) : null,
    rir: type === "time" || type === "cardio" ? null : v.rir !== "" ? Number(v.rir) : null,
  };
  if (type === "weight_reps") return base;
  const minutes = numOrNull(v.minutes);
  const seconds = numOrNull(v.seconds);
  return {
    ...base,
    durationSeconds:
      type === "cardio"
        ? minutes != null && minutes > 0
          ? Math.round(minutes * 60)
          : null
        : type === "time" && seconds != null && seconds > 0
          ? Math.round(seconds)
          : null,
    distanceKm: type === "cardio" ? numOrNull(v.distance) : null,
    intensity: type === "cardio" ? numOrNull(v.intensity) : null,
    assistance: tracking.assistanceUnit ? numOrNull(v.assistance) : null,
  };
}
