// Sistema de celebración de récords (jul-2026): mensaje motivador rotativo
// del banner de "¡Nuevo récord!" — mismo patrón que
// lib/constants/motivational-phrases.ts (Bloque 4), módulo separado porque
// la voz acá es específica del momento (superar la semana pasada), no la
// motivación genérica de la pantalla principal.
export const RECORD_PHRASES = [
  "Eso es progreso real. Seguí así.",
  "Tu cuerpo recuerda cada kilo. Bien hecho.",
  "Semana a semana. Así se construye.",
  "Lo que parecía difícil, hoy fue tuyo.",
] as const;

export function randomRecordPhrase(): string {
  return RECORD_PHRASES[Math.floor(Math.random() * RECORD_PHRASES.length)];
}
