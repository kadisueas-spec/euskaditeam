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
