import { addWeeks, mondayKeyFor, previousMondayKey } from "@/lib/utils/week";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayBefore(dateStr: string): string {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - DAY_MS)
    .toISOString()
    .slice(0, 10);
}

// Bloque 2 (jul-2026): dos rachas en paralelo, ver especificación de Luis.
//
// weeklyStreak = "X semanas consecutivas 💪": la lógica original de C2 sin
// cambios — cuenta semanas (lunes-domingo) consecutivas donde se llegó a la
// cantidad de días planificados por la rutina activa.
//
// dailyStreak = "estás en racha hace X días 🔥": suma un día por cada día
// calendario, incluidos los de descanso planificado, MIENTRAS ninguna
// semana YA CERRADA haya fallado el plan. Las dos rachas comparten el mismo
// punto de quiebre (la semana fallida más reciente) — por eso se calculan
// juntas acá, caminando hacia atrás semana por semana una sola vez.
//
// El ancla de dailyStreak es el día exacto en que la racha "no cuenta
// todavía": el lunes siguiente a la semana fallida (así ese lunes da
// exactamente 0, y crece de a 1 por día desde ahí), o el domingo anterior a
// la primera semana con datos si nunca falló (así el primer lunes ya da 1,
// reproduciendo el ejemplo de Luis: domingo=7, lunes siguiente=8).
export function computeStreaks(
  datesDesc: string[],
  plannedPerWeek: number,
  today: Date
): { dailyStreak: number; weeklyStreak: number } {
  if (plannedPerWeek <= 0 || datesDesc.length === 0) {
    return { dailyStreak: 0, weeklyStreak: 0 };
  }

  const countByWeekStart = new Map<string, number>();
  for (const d of datesDesc) {
    const key = mondayKeyFor(d);
    countByWeekStart.set(key, (countByWeekStart.get(key) ?? 0) + 1);
  }

  const todayStr = today.toISOString().slice(0, 10);
  let cursor = mondayKeyFor(todayStr);
  let weeklyStreak = 0;

  // La semana en curso suma a la racha si ya se cumplió el plan, pero no la
  // corta si todavía no se cumplió (la semana no terminó).
  if ((countByWeekStart.get(cursor) ?? 0) >= plannedPerWeek) {
    weeklyStreak++;
  }
  cursor = previousMondayKey(cursor);

  while ((countByWeekStart.get(cursor) ?? 0) >= plannedPerWeek) {
    weeklyStreak++;
    cursor = previousMondayKey(cursor);
  }
  // cursor = lunes de la semana más reciente que NO llegó al plan (una
  // falla real, o una semana anterior a que existiera cualquier dato).

  const earliestMonday = mondayKeyFor(datesDesc[datesDesc.length - 1]);
  const realFailure = cursor >= earliestMonday;
  const anchor = realFailure ? addWeeks(cursor, 1) : dayBefore(earliestMonday);

  const anchorMs = new Date(`${anchor}T00:00:00Z`).getTime();
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  const dailyStreak = Math.max(0, Math.round((todayMs - anchorMs) / DAY_MS));

  return { dailyStreak, weeklyStreak };
}
