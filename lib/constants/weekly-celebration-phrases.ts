// Celebración semanal (jul-2026): mensaje motivador rotativo al completar
// TODOS los días planificados de la semana — mismo patrón que
// record-phrases.ts/motivational-phrases.ts, módulo separado porque la voz
// acá es específica del cierre de semana.
export const WEEKLY_CELEBRATION_PHRASES = [
  "Semana completa. Así se construye.",
  "Cuatro de cuatro. Eso no es suerte, es decisión.",
  "Cumpliste con todo lo que te propusiste esta semana.",
  "La constancia no se negocia. Y vos la cumpliste.",
  "Semana cerrada. Tu cuerpo ya lo sabe.",
] as const;

export const FIRST_COMPLETE_WEEK_PHRASE =
  "Tu primera semana completa. Es el principio de todo.";

export function randomWeeklyCelebrationPhrase(): string {
  return WEEKLY_CELEBRATION_PHRASES[
    Math.floor(Math.random() * WEEKLY_CELEBRATION_PHRASES.length)
  ];
}
