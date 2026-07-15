// Fórmulas antropométricas para los 5 protocolos del módulo de evaluación.
// Todos los coeficientes vienen de fuentes provistas directamente por Luis
// (nutricionista) — no se adivina ningún número acá. Funciones puras, sin
// acceso a DB, para poder testearlas con casos conocidos antes de
// conectarlas a la UI.

export type Sex = "male" | "female";
export type Protocol = "DW4" | "JP3" | "YUHASZ6" | "JP7" | "ISAK8";

// measurement_type de body_measurements — mismo vocabulario que la DB para
// no necesitar traducción entre capas.
export type SkinfoldType =
  | "biceps"
  | "triceps"
  | "subscapular"
  | "suprailiac"
  | "chest_skinfold"
  | "midaxillary"
  | "abdominal"
  | "thigh_skinfold"
  | "iliac_crest"
  | "calf";

export type SkinfoldValues = Partial<Record<SkinfoldType, number>>;

// Siri (1961): fórmula estándar para pasar de densidad corporal a % grasa.
export function siriBodyFatPercentage(bodyDensity: number): number {
  return 495 / bodyDensity - 450;
}

// --- DW4: Durnin-Womersley (1974) ---
// ∑4 = bíceps + tríceps + subescapular + suprailíaco (mm)
// Densidad = C - M × log10(∑4), coeficientes por franja etaria y sexo.
type AgeCoefficient = { minAge: number; maxAge: number; c: number; m: number };

const DW4_COEFFICIENTS: Record<Sex, AgeCoefficient[]> = {
  male: [
    { minAge: 17, maxAge: 19, c: 1.162, m: 0.063 },
    { minAge: 20, maxAge: 29, c: 1.1631, m: 0.0632 },
    { minAge: 30, maxAge: 39, c: 1.1422, m: 0.0544 },
    { minAge: 40, maxAge: 49, c: 1.162, m: 0.07 },
    { minAge: 50, maxAge: Infinity, c: 1.1715, m: 0.0779 },
  ],
  female: [
    { minAge: 17, maxAge: 19, c: 1.1549, m: 0.0678 },
    { minAge: 20, maxAge: 29, c: 1.1599, m: 0.0717 },
    { minAge: 30, maxAge: 39, c: 1.1423, m: 0.0632 },
    { minAge: 40, maxAge: 49, c: 1.1333, m: 0.0612 },
    { minAge: 50, maxAge: Infinity, c: 1.1339, m: 0.0645 },
  ],
};

export const DW4_REQUIRED_SKINFOLDS: SkinfoldType[] = [
  "biceps",
  "triceps",
  "subscapular",
  "suprailiac",
];

// null si falta algún pliegue o la edad no entra en ninguna franja (ej.
// menor de 17) — mejor no calcular que adivinar con la franja equivocada.
export function calculateDW4(
  skinfolds: SkinfoldValues,
  age: number,
  sex: Sex
): number | null {
  const { biceps, triceps, subscapular, suprailiac } = skinfolds;
  if (
    biceps == null ||
    triceps == null ||
    subscapular == null ||
    suprailiac == null
  ) {
    return null;
  }
  const bracket = DW4_COEFFICIENTS[sex].find(
    (b) => age >= b.minAge && age <= b.maxAge
  );
  if (!bracket) return null;

  const sum4 = biceps + triceps + subscapular + suprailiac;
  const density = bracket.c - bracket.m * Math.log10(sum4);
  return siriBodyFatPercentage(density);
}

// --- JP3: Jackson-Pollock 3 pliegues (1978 hombres / 1980 mujeres) ---
export const JP3_REQUIRED_SKINFOLDS: Record<Sex, SkinfoldType[]> = {
  male: ["chest_skinfold", "abdominal", "thigh_skinfold"],
  female: ["triceps", "suprailiac", "thigh_skinfold"],
};

export function calculateJP3(
  skinfolds: SkinfoldValues,
  age: number,
  sex: Sex
): number | null {
  let sum3: number;
  let density: number;

  if (sex === "male") {
    const { chest_skinfold, abdominal, thigh_skinfold } = skinfolds;
    if (chest_skinfold == null || abdominal == null || thigh_skinfold == null) {
      return null;
    }
    sum3 = chest_skinfold + abdominal + thigh_skinfold;
    density = 1.10938 - 0.0008267 * sum3 + 0.0000016 * sum3 ** 2 - 0.0002574 * age;
  } else {
    const { triceps, suprailiac, thigh_skinfold } = skinfolds;
    if (triceps == null || suprailiac == null || thigh_skinfold == null) {
      return null;
    }
    sum3 = triceps + suprailiac + thigh_skinfold;
    density =
      1.0994921 - 0.0009929 * sum3 + 0.0000023 * sum3 ** 2 - 0.0001392 * age;
  }

  return siriBodyFatPercentage(density);
}

// --- YUHASZ6: Yuhasz (1974) — % grasa directo, sin pasar por densidad ---
export const YUHASZ6_REQUIRED_SKINFOLDS: SkinfoldType[] = [
  "triceps",
  "subscapular",
  "suprailiac",
  "abdominal",
  "thigh_skinfold",
  "calf",
];

export function calculateYuhasz6(
  skinfolds: SkinfoldValues,
  sex: Sex
): number | null {
  const { triceps, subscapular, suprailiac, abdominal, thigh_skinfold, calf } =
    skinfolds;
  if (
    triceps == null ||
    subscapular == null ||
    suprailiac == null ||
    abdominal == null ||
    thigh_skinfold == null ||
    calf == null
  ) {
    return null;
  }
  const sum6 = triceps + subscapular + suprailiac + abdominal + thigh_skinfold + calf;
  return sex === "male" ? sum6 * 0.097 + 3.64 : sum6 * 0.148 + 3.98;
}

// --- JP7: Jackson-Pollock 7 pliegues (1978) ---
export const JP7_REQUIRED_SKINFOLDS: SkinfoldType[] = [
  "chest_skinfold",
  "midaxillary",
  "triceps",
  "subscapular",
  "suprailiac",
  "abdominal",
  "thigh_skinfold",
];

export function calculateJP7(
  skinfolds: SkinfoldValues,
  age: number,
  sex: Sex
): number | null {
  const {
    chest_skinfold,
    midaxillary,
    triceps,
    subscapular,
    suprailiac,
    abdominal,
    thigh_skinfold,
  } = skinfolds;
  if (
    chest_skinfold == null ||
    midaxillary == null ||
    triceps == null ||
    subscapular == null ||
    suprailiac == null ||
    abdominal == null ||
    thigh_skinfold == null
  ) {
    return null;
  }

  const sum7 =
    chest_skinfold +
    midaxillary +
    triceps +
    subscapular +
    suprailiac +
    abdominal +
    thigh_skinfold;

  const density =
    sex === "male"
      ? 1.112 - 0.00043499 * sum7 + 0.00000055 * sum7 ** 2 - 0.00028826 * age
      : 1.097 - 0.00046971 * sum7 + 0.00000056 * sum7 ** 2 - 0.00012828 * age;

  return siriBodyFatPercentage(density);
}

// --- ISAK8: perfil restringido ISAK — solo ∑8, sin conversión a % grasa ---
export const ISAK8_REQUIRED_SKINFOLDS: SkinfoldType[] = [
  "biceps",
  "triceps",
  "subscapular",
  "suprailiac",
  "iliac_crest",
  "abdominal",
  "thigh_skinfold",
  "calf",
];

export function calculateISAK8Sum(skinfolds: SkinfoldValues): number | null {
  const {
    biceps,
    triceps,
    subscapular,
    suprailiac,
    iliac_crest,
    abdominal,
    thigh_skinfold,
    calf,
  } = skinfolds;
  if (
    biceps == null ||
    triceps == null ||
    subscapular == null ||
    suprailiac == null ||
    iliac_crest == null ||
    abdominal == null ||
    thigh_skinfold == null ||
    calf == null
  ) {
    return null;
  }
  return (
    biceps +
    triceps +
    subscapular +
    suprailiac +
    iliac_crest +
    abdominal +
    thigh_skinfold +
    calf
  );
}

export const PROTOCOL_REQUIRED_SKINFOLDS: Record<
  Protocol,
  SkinfoldType[] | Record<Sex, SkinfoldType[]>
> = {
  DW4: DW4_REQUIRED_SKINFOLDS,
  JP3: JP3_REQUIRED_SKINFOLDS,
  YUHASZ6: YUHASZ6_REQUIRED_SKINFOLDS,
  JP7: JP7_REQUIRED_SKINFOLDS,
  ISAK8: ISAK8_REQUIRED_SKINFOLDS,
};

// --- Métricas universales (no dependen del protocolo) ---
export function calculateBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function calculateWaistHipRatio(
  waistCm: number,
  hipCm: number
): number {
  return waistCm / hipCm;
}

export function calculateFatMassKg(
  weightKg: number,
  bodyFatPercentage: number
): number {
  return (weightKg * bodyFatPercentage) / 100;
}

// Simplificado a propósito (sin hueso/vísceras) — es peso menos masa
// grasa, no una estimación real de masa muscular magra.
export function calculateMuscleMassKg(
  weightKg: number,
  fatMassKg: number
): number {
  return weightKg - fatMassKg;
}

export type EvaluationInput = {
  protocol: Protocol;
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  waistCm: number | null;
  hipCm: number | null;
  skinfolds: SkinfoldValues;
};

export type EvaluationResult = {
  bodyFatPercentage: number | null;
  fatMassKg: number | null;
  muscleMassKg: number | null;
  bmi: number;
  waistHipRatio: number | null;
  skinfoldSum: number | null; // solo tiene valor para ISAK8
};

// Orquestador: dado el protocolo + todos los datos de una evaluación,
// calcula todo lo que va a anthropometric_evaluations. Único punto de
// entrada que va a usar la server action de creación de evaluaciones.
export function calculateEvaluation(input: EvaluationInput): EvaluationResult {
  const bmi = calculateBmi(input.weightKg, input.heightCm);
  const waistHipRatio =
    input.waistCm != null && input.hipCm != null
      ? calculateWaistHipRatio(input.waistCm, input.hipCm)
      : null;

  if (input.protocol === "ISAK8") {
    const skinfoldSum = calculateISAK8Sum(input.skinfolds);
    return {
      bodyFatPercentage: null,
      fatMassKg: null,
      muscleMassKg: null,
      bmi,
      waistHipRatio,
      skinfoldSum,
    };
  }

  let bodyFatPercentage: number | null;
  switch (input.protocol) {
    case "DW4":
      bodyFatPercentage = calculateDW4(input.skinfolds, input.age, input.sex);
      break;
    case "JP3":
      bodyFatPercentage = calculateJP3(input.skinfolds, input.age, input.sex);
      break;
    case "YUHASZ6":
      bodyFatPercentage = calculateYuhasz6(input.skinfolds, input.sex);
      break;
    case "JP7":
      bodyFatPercentage = calculateJP7(input.skinfolds, input.age, input.sex);
      break;
  }

  const fatMassKg =
    bodyFatPercentage != null
      ? calculateFatMassKg(input.weightKg, bodyFatPercentage)
      : null;
  const muscleMassKg =
    fatMassKg != null ? calculateMuscleMassKg(input.weightKg, fatMassKg) : null;

  return {
    bodyFatPercentage,
    fatMassKg,
    muscleMassKg,
    bmi,
    waistHipRatio,
    skinfoldSum: null,
  };
}
