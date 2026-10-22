// Qué sesión cuenta como "día entrenado" para la adherencia (oct-2026):
// finalizada Y con al menos 1 serie registrada. Mismo criterio en toda la
// app — dashboard del cliente (stats.ts), Mi Mes (my-month.ts), resumen de
// mes (month-summary.ts), push del 80% al coach (log-workout/actions.ts) y
// los reportes de progreso. Bug real: Luz Aranda abrió Entrenar el 20/10 y
// no cargó nada; esa sesión vacía le sumaba un día entrenado.

// Select de PostgREST para traer cada sesión con su cantidad de series
// embebida (una sola consulta, sin traer las series).
export const TRAINING_SESSION_SELECT = "workout_date, is_completed, workout_set_logs(count)";

export type TrainingSessionRow = {
  workout_date: string;
  is_completed: boolean;
  workout_set_logs: { count: number }[];
};

export function countsAsTraining(session: { isCompleted: boolean; setCount: number }): boolean {
  return session.isCompleted && session.setCount > 0;
}

function rowCounts(row: TrainingSessionRow): boolean {
  return countsAsTraining({
    isCompleted: row.is_completed,
    setCount: row.workout_set_logs[0]?.count ?? 0,
  });
}

// Fechas distintas entrenadas (dos sesiones el mismo día = un día),
// ordenadas de más vieja a más nueva.
export function trainedDates(rows: TrainingSessionRow[]): string[] {
  return Array.from(new Set(rows.filter(rowCounts).map((r) => r.workout_date))).sort();
}

export function adherencePercent(trainedDays: number, plannedDays: number): number {
  return plannedDays > 0 ? Math.min(100, Math.round((trainedDays / plannedDays) * 100)) : 0;
}
