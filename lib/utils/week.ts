const DAY_MS = 24 * 60 * 60 * 1000;

// Lunes de la semana ISO (lunes-domingo) que contiene esa fecha, como
// "YYYY-MM-DD". Compartido entre stats.ts (racha) y metrics.ts (todo lo
// que se agrupa por semana) para que ambos partan la semana en el mismo
// día.
export function mondayKeyFor(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=domingo, 1=lunes, ..., 6=sábado
  const diffToMonday = day === 0 ? 6 : day - 1;
  return new Date(d.getTime() - diffToMonday * DAY_MS).toISOString().slice(0, 10);
}

export function previousMondayKey(mondayKey: string): string {
  return new Date(new Date(`${mondayKey}T00:00:00Z`).getTime() - 7 * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function addWeeks(mondayKey: string, weeks: number): string {
  return new Date(
    new Date(`${mondayKey}T00:00:00Z`).getTime() + weeks * 7 * DAY_MS
  )
    .toISOString()
    .slice(0, 10);
}
