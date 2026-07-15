import type { Protocol, SkinfoldType } from "./formulas";

export type PerimeterType =
  | "waist"
  | "hip"
  | "thigh_right"
  | "thigh_left"
  | "arm_right_relaxed"
  | "arm_right_flexed"
  | "arm_left_relaxed"
  | "arm_left_flexed"
  | "chest_perimeter";

export type MeasurementType = PerimeterType | SkinfoldType;

export const PERIMETER_LABELS: Record<PerimeterType, string> = {
  waist: "Cintura",
  hip: "Cadera",
  thigh_right: "Muslo derecho",
  thigh_left: "Muslo izquierdo",
  arm_right_relaxed: "Brazo derecho relajado",
  arm_right_flexed: "Brazo derecho contraído",
  arm_left_relaxed: "Brazo izquierdo relajado",
  arm_left_flexed: "Brazo izquierdo contraído",
  chest_perimeter: "Pecho",
};

export const PERIMETER_TYPES = Object.keys(PERIMETER_LABELS) as PerimeterType[];

export const SKINFOLD_LABELS: Record<SkinfoldType, string> = {
  biceps: "Bíceps",
  triceps: "Tríceps",
  subscapular: "Subescapular",
  suprailiac: "Suprailíaco",
  chest_skinfold: "Pecho",
  midaxillary: "Axilar medio",
  abdominal: "Abdominal",
  thigh_skinfold: "Muslo",
  iliac_crest: "Cresta ilíaca",
  calf: "Gemelo",
};

export const PROTOCOL_LABELS: Record<Protocol, string> = {
  DW4: "DW4 — Durnin-Womersley (4 pliegues)",
  JP3: "JP3 — Jackson-Pollock (3 pliegues)",
  YUHASZ6: "Yuhasz (6 pliegues)",
  JP7: "JP7 — Jackson-Pollock (7 pliegues)",
  ISAK8: "ISAK8 — perfil restringido (8 pliegues)",
};

export const PROTOCOLS: Protocol[] = ["DW4", "JP3", "YUHASZ6", "JP7", "ISAK8"];
