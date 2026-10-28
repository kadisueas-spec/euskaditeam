import type { TrackingFields } from "@/lib/constants/tracking";

// Prescripción de un ejercicio según su tipo de registro (oct-2026). Un
// solo lugar para el texto ("3 × 10 por lado", "3 × 30–45 s", "20 min ·
// nivel 8") y para pasar del formulario del coach a lo que se guarda — lo
// usan el wizard, el editor, Mi Rutina, Mi Entrenamiento y Entrenar.

export type Prescription = {
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  rirTarget: number | null;
  secondsMin: number | null;
  secondsMax: number | null;
  minutesTarget: number | null;
  intensityTarget: number | null;
};

function range(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min}–${max}`;
  return String(min ?? max);
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

export function intensityLabel(tracking: TrackingFields, value: number): string {
  return tracking.cardioScale === "effort" ? `esfuerzo ${fmt(value)}` : `nivel ${fmt(value)}`;
}

// Etiquetas cortas (las "pastillas" de Mi Rutina y Mi Entrenamiento). El
// descanso no va acá: cada pantalla lo muestra a su manera.
export function prescriptionChips(p: Prescription, tracking: TrackingFields): string[] {
  const side = tracking.perSide ? " por lado" : "";
  switch (tracking.trackingType) {
    case "cardio": {
      const chips = [p.minutesTarget != null ? `${p.minutesTarget} min` : "Cardio"];
      if (p.intensityTarget != null) chips.push(intensityLabel(tracking, p.intensityTarget));
      return chips;
    }
    case "check":
      return ["Marcar hecho"];
    case "time": {
      const chips = [`${p.sets} series`];
      const s = range(p.secondsMin, p.secondsMax);
      if (s) chips.push(`${s} s${side}`);
      return chips;
    }
    default: {
      const chips = [`${p.sets} series`];
      const r = range(p.repsMin, p.repsMax);
      if (r) chips.push(`${r} reps${side}`);
      if (tracking.assistanceUnit) chips.push("asistida");
      if (p.rirTarget != null) chips.push(`RIR ${p.rirTarget}`);
      return chips;
    }
  }
}

// Una línea: "3 × 8–10 por lado · RIR 2", "3 × 30–45 s", "20 min · nivel 8".
export function prescriptionLine(p: Prescription, tracking: TrackingFields): string {
  const side = tracking.perSide ? " por lado" : "";
  switch (tracking.trackingType) {
    case "cardio":
      return [p.minutesTarget != null ? `${p.minutesTarget} min` : "Cardio", p.intensityTarget != null ? intensityLabel(tracking, p.intensityTarget) : null]
        .filter(Boolean)
        .join(" · ");
    case "check":
      return "Marcar hecho";
    case "time": {
      const s = range(p.secondsMin, p.secondsMax);
      return s ? `${p.sets} × ${s} s${side}` : `${p.sets} series`;
    }
    default: {
      const r = range(p.repsMin, p.repsMax);
      const base = r ? `${p.sets} × ${r}${side}` : `${p.sets} series`;
      return [base, tracking.assistanceUnit ? "asistida" : null, p.rirTarget != null ? `RIR ${p.rirTarget}` : null]
        .filter(Boolean)
        .join(" · ");
    }
  }
}

// --- Formulario del coach (todo como texto, igual que el resto del wizard) ---

export type PrescriptionInputs = {
  sets: string;
  repsMin: string;
  repsMax: string;
  rir: string;
  secondsMin: string;
  secondsMax: string;
  minutesTarget: string;
  intensityTarget: string;
};

function int(v: string): number | null {
  if (!v.trim()) return null;
  const n = Math.round(Number(v.replace(",", ".")));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function intOrZero(v: string): number | null {
  if (!v.trim()) return null;
  const n = Math.round(Number(v.replace(",", ".")));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function dec(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
}

// Lo que se guarda: solo los campos del tipo, el resto en null (así un
// ejercicio que cambió de tipo no arrastra reps viejas). Cardio y "check"
// son siempre UNA serie.
export function prescriptionFromInputs(
  inputs: PrescriptionInputs,
  tracking: TrackingFields
): Prescription {
  const none: Prescription = {
    sets: 1,
    repsMin: null,
    repsMax: null,
    rirTarget: null,
    secondsMin: null,
    secondsMax: null,
    minutesTarget: null,
    intensityTarget: null,
  };
  const sets = int(inputs.sets) ?? 1;
  switch (tracking.trackingType) {
    case "cardio":
      return { ...none, minutesTarget: int(inputs.minutesTarget), intensityTarget: dec(inputs.intensityTarget) };
    case "check":
      return none;
    case "time":
      return { ...none, sets, secondsMin: int(inputs.secondsMin), secondsMax: int(inputs.secondsMax) };
    default:
      return {
        ...none,
        sets,
        repsMin: int(inputs.repsMin),
        repsMax: int(inputs.repsMax),
        // RIR 0 vale (antes el formulario lo perdía: "0" se leía como vacío)
        rirTarget: intOrZero(inputs.rir),
      };
  }
}

export function inputsFromPrescription(p: Prescription): PrescriptionInputs {
  const s = (n: number | null) => (n != null ? String(n) : "");
  return {
    sets: String(p.sets),
    repsMin: s(p.repsMin),
    repsMax: s(p.repsMax),
    rir: s(p.rirTarget),
    secondsMin: s(p.secondsMin),
    secondsMax: s(p.secondsMax),
    minutesTarget: s(p.minutesTarget),
    intensityTarget: s(p.intensityTarget),
  };
}

// Qué falta para poder guardar (null = nada). Cardio y check no piden
// series: siempre es una.
export function missingPrescription(inputs: PrescriptionInputs, tracking: TrackingFields): string | null {
  if (tracking.trackingType === "cardio" || tracking.trackingType === "check") return null;
  if (!int(inputs.sets)) return "series";
  return null;
}

// Del formulario del wizard/editor (PrescriptionValues) a lo que espera
// createRoutine/updateRoutine. Lo que no corresponde al tipo queda en null o
// en su neutro: sin calentamiento fuera de peso + reps, sin descanso en
// cardio, incremento por defecto donde no se carga.
export type ExercisePrescriptionPayload = {
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  rir: number | null;
  restSeconds: number | null;
  weightIncrement: number;
  warmupType: "none" | "percentage_with_kg" | "percentage_of_max" | "fixed_weight";
  warmupFixedWeightKg: number | null;
  secondsMin: number | null;
  secondsMax: number | null;
  minutesTarget: number | null;
  intensityTarget: number | null;
};

export function exercisePayloadFromValues(
  values: {
    sets: string;
    repsMin: string;
    repsMax: string;
    rir: string;
    restSeconds: string;
    weightIncrement: string;
    warmupType: ExercisePrescriptionPayload["warmupType"];
    warmupFixedWeight: string;
    secondsMin?: string;
    secondsMax?: string;
    minutesTarget?: string;
    intensityTarget?: string;
  },
  tracking: TrackingFields,
  restMinutesToSeconds: (v: string) => number | null
): ExercisePrescriptionPayload {
  const p = prescriptionFromInputs(
    {
      sets: values.sets,
      repsMin: values.repsMin,
      repsMax: values.repsMax,
      rir: values.rir,
      secondsMin: values.secondsMin ?? "",
      secondsMax: values.secondsMax ?? "",
      minutesTarget: values.minutesTarget ?? "",
      intensityTarget: values.intensityTarget ?? "",
    },
    tracking
  );
  const type = tracking.trackingType;
  const withWarmup = type === "weight_reps";
  const noRest = type === "cardio" || type === "check";
  return {
    sets: p.sets,
    repsMin: p.repsMin,
    repsMax: p.repsMax,
    rir: p.rirTarget,
    restSeconds: noRest ? null : restMinutesToSeconds(values.restSeconds),
    weightIncrement: Number(values.weightIncrement.replace(",", ".")) || 2.5,
    warmupType: withWarmup ? values.warmupType : "none",
    warmupFixedWeightKg:
      withWarmup && values.warmupType === "fixed_weight" && values.warmupFixedWeight
        ? Number(values.warmupFixedWeight.replace(",", "."))
        : null,
    secondsMin: p.secondsMin,
    secondsMax: p.secondsMax,
    minutesTarget: p.minutesTarget,
    intensityTarget: p.intensityTarget,
  };
}
