// Piernas queda además de Cuádriceps/Isquiosurales/Gemelos por
// compatibilidad con ejercicios ya cargados con ese grupo genérico — no
// se migran datos viejos, solo se suman las categorías más específicas
// para la base global de ejercicios (ver TAREA 2, jul-2026).
export const MUSCLE_GROUPS = [
  "Pecho",
  "Espalda",
  "Hombros",
  "Bíceps",
  "Tríceps",
  "Piernas",
  "Cuádriceps",
  "Isquiosurales",
  "Glúteos",
  "Gemelos",
  "Core",
  "Cardio",
  "Full Body",
] as const;
