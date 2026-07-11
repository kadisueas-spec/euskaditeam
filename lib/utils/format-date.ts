export function formatDate(value: string) {
  // timeZone: "UTC" evita que una fecha guardada como medianoche UTC
  // (ej. "2026-08-15") se muestre como el día anterior en servidores
  // con zona horaria negativa (América).
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Bloque 4 (jul-2026): "Hoy" / "Ayer" / "Hace N días" para actividad
// reciente del cliente (historial, feedback) — a partir del 7mo día vuelve
// a la fecha real de formatDate(), que ya es más útil que "hace 12 días".
// Sirve tanto para columnas DATE puras (workout_date, "2026-07-10") como
// para timestamptz completos (created_at) — se compara por día calendario
// UTC en los dos casos, no por el timestamp crudo, para no desfasarse un
// día en servidores con zona horaria negativa (misma convención que
// mondayKeyFor/getClientStats).
export function formatFriendlyDate(value: string): string {
  const target = new Date(value);
  const targetDayMs = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate()
  );
  const now = new Date();
  const todayDayMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const diffDays = Math.round((todayDayMs - targetDayMs) / DAY_MS);

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays > 1 && diffDays < 7) return `Hace ${diffDays} días`;
  return formatDate(value);
}
