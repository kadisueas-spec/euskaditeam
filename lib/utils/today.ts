// Zona horaria de la app: Paraguay, UTC-3 FIJO (oct-2026).
//
// Bug real: "hoy" se calculaba en UTC (new Date().toISOString().slice(0, 10)
// y getUTC*), así que a partir de las 21hs de Paraguay ya era "mañana" —
// un entrenamiento a las 21:30 quedaba guardado con la fecha del día
// siguiente y la adherencia/rachas/mes cambiaban de día 3 horas antes.
//
// Offset fijo y NO "America/Asuncion" a propósito: Paraguay abolió el
// horario de verano en oct-2024 y quedó en UTC-3 todo el año. Un Node/ICU
// con tzdata anterior a 2024b todavía aplicaría UTC-4 de marzo a octubre
// y el bug volvería con una hora de diferencia. Si algún día Paraguay
// vuelve a cambiar de huso, este es el único lugar a tocar.
const PARAGUAY_OFFSET_MS = 3 * 60 * 60 * 1000;

// Date corrido -3h: sus campos UTC (getUTCDate, getUTCDay, getUTCMonth,
// toISOString().slice(0, 10)...) dan la fecha/hora de pared de Paraguay.
// Así toda la lógica que ya estaba escrita con getUTC* sigue igual, solo
// cambia de dónde sale el "ahora". NUNCA usarlo como instante real (para
// guardar un timestamptz o comparar con uno) — para eso, new Date().
export function paraguayNow(now: Date = new Date()): Date {
  return new Date(now.getTime() - PARAGUAY_OFFSET_MS);
}

// "YYYY-MM-DD" de hoy en Paraguay.
export function todayInParaguay(now: Date = new Date()): string {
  return paraguayNow(now).toISOString().slice(0, 10);
}

// "YYYY-MM-DD" (fecha de Paraguay) de un timestamp real (timestamptz,
// ej. created_at). Para columnas DATE puras ("2026-10-15") devuelve la
// misma fecha sin tocarla — no tienen hora que convertir.
export function paraguayDateOf(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return paraguayNow(new Date(value)).toISOString().slice(0, 10);
}

// Primer instante (real, en ms) del día "YYYY-MM-DD" en Paraguay: 00:00 de
// Paraguay = 03:00 UTC del mismo día.
export function startOfParaguayDayMs(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00-03:00`).getTime();
}
