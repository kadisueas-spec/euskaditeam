// B2 (jul-2026): ventana de edición para sesiones de entrenamiento ya
// finalizadas — más atrás de esto distorsiona métricas y récords ya
// cerrados. Compartido entre los server actions que validan la edición
// (app/client/log-workout/actions.ts) y la UI que decide si mostrar los
// controles de edición (app/client/progress/[id]).
export const EDIT_WINDOW_DAYS = 7;

// Se mide en días de calendario (no horas): workout_date es date, no
// timestamp.
export function daysAgo(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const today = Date.UTC(ty, tm - 1, td);
  return Math.round((today - target) / 86400000);
}

export function isWithinEditWindow(dateStr: string): boolean {
  return daysAgo(dateStr) <= EDIT_WINDOW_DAYS;
}
