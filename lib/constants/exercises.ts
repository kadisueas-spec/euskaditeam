// jul-2026: se saca "Piernas" (grupo genérico que no sirve para las
// métricas por grupo muscular del planificador — no distingue cuádriceps
// de isquiosurales de glúteos) y se renombran Pecho/Hombros/Core a los
// nombres anatómicos exactos que usa el planificador. Se migraron los
// ejercicios ya cargados con estos grupos viejos (ver conversación jul-2026).
// Cardio/Full Body quedan porque no son grupos musculares — sirven para
// categorizar ejercicios que no tienen uno solo.
export const MUSCLE_GROUPS = [
  "Cuádriceps",
  "Isquiosurales",
  "Glúteos",
  "Aductores",
  "Gemelos",
  "Pectoral",
  "Espalda",
  "Deltoides",
  "Bíceps",
  "Tríceps",
  "Abdomen/Core",
  "Cardio",
  "Full Body",
] as const;
