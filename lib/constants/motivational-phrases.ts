// Bloque 4 (jul-2026): rotan en la pantalla principal del cliente — una al
// azar por carga de página (Server Component, se recalcula en cada
// navegación/reload, no hace falta estado ni cliente).
export const MOTIVATIONAL_PHRASES = [
  "La constancia construye lo que el talento no puede.",
  "Cada serie cuenta. Cada sesión suma.",
  "El progreso no se ve en el espejo, se ve en los números.",
  "No hay atajos. Hay método.",
  "Hoy es un buen día para ser mejor que ayer.",
] as const;

export function randomMotivationalPhrase(): string {
  return MOTIVATIONAL_PHRASES[
    Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)
  ];
}
