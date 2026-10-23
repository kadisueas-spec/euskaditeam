import { paraguayNow } from "@/lib/utils/today";
import { addDays } from "@/lib/reports/format";

// Calendario de los reportes, siempre en hora de Paraguay (UTC-3 fijo, ver
// lib/utils/today.ts). El cron corre cada hora; estas funciones dicen qué
// toca hacer en cada corrida. Todo es idempotente: si un borrador ya
// existe (o el coach lo descartó), no se vuelve a crear.

// Semanal desde el sábado a las 11:00; mensual desde el día 1 a las 7:00.
const WEEKLY_FROM_HOUR = 11;
const MONTHLY_FROM_HOUR = 7;
const PARAGUAY_OFFSET_HOURS = 3;

export type Period = { start: string; end: string };

// Semanal: lunes a viernes de la semana en curso. Se genera desde el sábado
// a las 11:00 (y el domingo, por si el sábado el cron no corrió).
export function weeklyPeriodToGenerate(now: Date = new Date()): Period | null {
  const py = paraguayNow(now);
  const dow = py.getUTCDay(); // 0 domingo, 6 sábado
  const hour = py.getUTCHours();
  const today = py.toISOString().slice(0, 10);
  if (dow === 6 && hour >= WEEKLY_FROM_HOUR) {
    const monday = addDays(today, -5);
    return { start: monday, end: addDays(monday, 4) };
  }
  if (dow === 0) {
    const monday = addDays(today, -6);
    return { start: monday, end: addDays(monday, 4) };
  }
  return null;
}

// Mensual: el mes anterior completo. Se genera desde el día 1 a las 7:00
// (y los días 2 y 3, por si el cron no corrió).
export function monthlyPeriodToGenerate(now: Date = new Date()): Period | null {
  const py = paraguayNow(now);
  const day = py.getUTCDate();
  if (day > 3 || (day === 1 && py.getUTCHours() < MONTHLY_FROM_HOUR)) return null;
  const firstOfThis = new Date(Date.UTC(py.getUTCFullYear(), py.getUTCMonth(), 1));
  const start = new Date(Date.UTC(py.getUTCFullYear(), py.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(firstOfThis.getTime() - 86400000).toISOString().slice(0, 10);
  return { start, end };
}

// "Programar para el domingo": el próximo domingo a la hora elegida (hora
// de Paraguay). Si hoy es domingo y esa hora todavía no pasó, es hoy.
// Devuelve el instante real (UTC) para progress_reports.scheduled_for.
export function nextSundayAt(hour: number, now: Date = new Date()): Date {
  const py = paraguayNow(now);
  const today = py.toISOString().slice(0, 10);
  const dow = py.getUTCDay();
  let sunday = addDays(today, (7 - dow) % 7);
  const candidate = Date.parse(`${sunday}T00:00:00Z`) + (hour + PARAGUAY_OFFSET_HOURS) * 3600000;
  if (candidate <= now.getTime()) {
    sunday = addDays(sunday, 7);
    return new Date(Date.parse(`${sunday}T00:00:00Z`) + (hour + PARAGUAY_OFFSET_HOURS) * 3600000);
  }
  return new Date(candidate);
}

// "Generar ahora" (bandeja del coach): el último período ya cerrado.
// Semanal: el lunes a viernes de esta semana si hoy es sábado o domingo
// (igual que el cron), si no el de la semana pasada. Mensual: el mes
// anterior.
export function latestClosedPeriod(kind: "weekly" | "monthly", now: Date = new Date()): Period {
  const py = paraguayNow(now);
  const today = py.toISOString().slice(0, 10);
  if (kind === "weekly") {
    const dow = py.getUTCDay();
    const mondayThisWeek = addDays(today, -((dow + 6) % 7));
    const monday = dow === 6 || dow === 0 ? mondayThisWeek : addDays(mondayThisWeek, -7);
    return { start: monday, end: addDays(monday, 4) };
  }
  const start = new Date(Date.UTC(py.getUTCFullYear(), py.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(py.getUTCFullYear(), py.getUTCMonth(), 0)).toISOString().slice(0, 10);
  return { start, end };
}
