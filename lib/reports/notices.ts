import { addDays } from "@/lib/reports/format";
import type { ReportInput } from "@/lib/reports/input";

// Avisos "Solo lo ves vos" comunes a los dos reportes. Nunca llegan al
// cliente (van a progress_report_private).

const SKIPPED_DAY_AFTER_DAYS = 21;

// "5/09"
export function shortDate(date: string): string {
  return `${Number(date.slice(8, 10))}/${date.slice(5, 7)}`;
}

export function routineNotices(input: ReportInput): string[] {
  const { routine, client, sessions, periodEnd } = input;
  if (!routine) return [`${client.firstName} no tiene rutina activa`];
  const out: string[] = [];

  if (routine.endsAt && routine.endsAt < periodEnd) {
    out.push(`La rutina de ${client.firstName} terminó el ${shortDate(routine.endsAt)}`);
  }

  // Un día de la rutina que no hace hace 3+ semanas mientras sí entrena los
  // otros (Luz: dejó Brazos el 5/09 y siguió con los otros 3 días).
  const cutoff = addDays(periodEnd, -SKIPPED_DAY_AFTER_DAYS);
  const recent = sessions.filter((s) => s.date > cutoff && s.date <= periodEnd);
  if (routine.days.length >= 2 && recent.length > 0) {
    for (const day of routine.days) {
      const done = sessions.filter((s) => s.dayId === day.id && s.date <= periodEnd);
      const last = done.length ? done[done.length - 1].date : null;
      if (last && last <= cutoff) {
        out.push(`${client.firstName} no hace el día ${day.name} desde el ${shortDate(last)}`);
      } else if (!last && routine.assignedAt && routine.assignedAt.slice(0, 10) <= cutoff) {
        out.push(`${client.firstName} todavía no hizo el día ${day.name}`);
      }
    }
  }
  return out;
}
