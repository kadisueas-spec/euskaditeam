import { paraguayNow } from "@/lib/utils/today";

// Formatos de los reportes: números en es-AR (coma decimal, punto de miles)
// y fechas cortas en español. Las fechas son "YYYY-MM-DD" de Paraguay.

export function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

export function fmtKg(n: number): string {
  return fmtNum(Math.round(n * 10) / 10, 1);
}

// Signo menos tipográfico (−), no guion.
export function signed(n: number, decimals = 1): string {
  const abs = fmtNum(Math.abs(Math.round(n * 10 ** decimals) / 10 ** decimals), decimals);
  return n < 0 ? `−${abs}` : `+${abs}`;
}

function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function monthName(date: string): string {
  return new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" }).format(utc(date));
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "12 – 16 oct" / "29 sep – 3 oct"
export function weekRangeLabel(start: string, end: string): string {
  const fmt = (d: string, withMonth: boolean) =>
    new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      ...(withMonth ? { month: "short" } : {}),
      timeZone: "UTC",
    })
      .format(utc(d))
      .replace(".", "");
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${fmt(start, !sameMonth)} – ${fmt(end, true)}`;
}

// "Septiembre 2026"
export function monthYearLabel(monthStart: string): string {
  return `${capitalize(monthName(monthStart))} ${monthStart.slice(0, 4)}`;
}

// "12/09"
export function dayMonth(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

// Mes apilado para la portada y el cierre (Bebas a 104px entran ~7 letras
// por línea a 390px). Septiembre va en 3 como en el diseño aprobado.
const MONTH_WORDS: Record<string, string[]> = {
  "01": ["Enero"],
  "02": ["Febrero"],
  "03": ["Marzo"],
  "04": ["Abril"],
  "05": ["Mayo"],
  "06": ["Junio"],
  "07": ["Julio"],
  "08": ["Agosto"],
  "09": ["Sep", "tiem", "bre"],
  "10": ["Octubre"],
  "11": ["Noviem", "bre"],
  "12": ["Diciem", "bre"],
};

export function monthWords(monthStart: string): string[] {
  return MONTH_WORDS[monthStart.slice(5, 7)];
}

export function addDays(date: string, days: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86400000);
}

// "domingo, 18 oct, 10:00" en hora de Paraguay. Offset fijo (paraguayNow),
// nunca "America/Asuncion": ver lib/utils/today.ts.
export function whenLabel(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(paraguayNow(new Date(iso)));
}
