import { addDays, daysBetween } from "@/lib/reports/format";
import type { Period } from "@/lib/reports/schedule";
import type { ReportKind } from "@/lib/reports/types";

// Períodos libres de los reportes (oct-2026). Fechas "YYYY-MM-DD" de
// Paraguay.

export const MAX_RANGE_DAYS = 92;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(d: string): boolean {
  return DATE_RE.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
}

function lastDayOfMonth(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// Un rango que es exactamente un mes calendario es un reporte mensual; uno
// que es exactamente lunes a viernes de la misma semana, semanal; cualquier
// otro, libre. Así "Mes pasado" elegido a mano da el mismo reporte que el
// del día 1 (y no un duplicado "custom").
export function kindForRange(start: string, end: string): ReportKind {
  if (start.endsWith("-01") && end === lastDayOfMonth(start)) return "monthly";
  const dow = new Date(`${start}T00:00:00Z`).getUTCDay();
  if (dow === 1 && end === addDays(start, 4)) return "weekly";
  return "custom";
}

export function validateRange(start: string, end: string, today: string): string | null {
  if (!isRealDate(start) || !isRealDate(end)) return "Elegí las dos fechas.";
  if (start > end) return "La fecha de inicio tiene que ser anterior a la de fin.";
  if (end > today) return "El período no puede terminar después de hoy.";
  if (daysBetween(start, end) + 1 > MAX_RANGE_DAYS) return `El período puede tener hasta ${MAX_RANGE_DAYS} días.`;
  return null;
}

// Período anterior de igual duración (para comparar volumen, peso, etc.).
export function previousPeriodOf(start: string, end: string): Period {
  const len = daysBetween(start, end) + 1;
  return { start: addDays(start, -len), end: addDays(start, -1) };
}

// Atajos del selector de fechas.
export function rangeShortcuts(today: string): { label: string; start: string; end: string }[] {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = addDays(today, -((dow + 6) % 7));
  const [y, m] = today.split("-").map(Number);
  const lastMonthStart = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  return [
    { label: "Esta semana", start: monday, end: today },
    { label: "Semana pasada", start: addDays(monday, -7), end: addDays(monday, -1) },
    { label: "Mes pasado", start: lastMonthStart, end: lastDayOfMonth(lastMonthStart) },
    { label: "Últimos 30 días", start: addDays(today, -29), end: today },
  ];
}
