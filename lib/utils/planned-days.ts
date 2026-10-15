import { paraguayDateOf } from "@/lib/utils/today";

const DAY_MS = 24 * 60 * 60 * 1000;

// access_activated_at y routines.created_at son timestamptz: una activación
// a las 22hs de Paraguay ya es "mañana" en UTC — se toma la fecha de
// Paraguay (routines.starts_at es DATE y pasa sin cambios).
function toDateOnly(value: string): string {
  return paraguayDateOf(value);
}

// Días planificados de entrenamiento en un rango de fechas, arrancando NO
// necesariamente el día 1 del rango pedido sino desde la fecha más tardía
// entre: el inicio del rango, la activación de acceso del cliente, y la
// asignación de la rutina activa (starts_at si el coach la cargó, si no
// created_at) — un cliente que se sumó a mitad de mes, o al que se le
// asignó rutina después de activar el acceso, no puede "deber" días previos
// a que esa rutina existiera para él. Bug real (ago-2026): Ana Siani
// activó acceso el 06/07 pero el cálculo contaba desde el 01/07, mostrando
// 12/20 en vez de 12/16.
export function plannedDaysInRange(params: {
  rangeStart: string; // "YYYY-MM-DD", inclusive
  rangeEnd: string; // "YYYY-MM-DD", inclusive
  plannedPerWeek: number;
  accessActivatedAt: string | null;
  routineAssignedAt: string | null;
}): number {
  const { rangeStart, rangeEnd, plannedPerWeek, accessActivatedAt, routineAssignedAt } = params;
  if (plannedPerWeek <= 0) return 0;

  let effectiveStart = rangeStart;
  if (accessActivatedAt) {
    const activatedDate = toDateOnly(accessActivatedAt);
    if (activatedDate > effectiveStart) effectiveStart = activatedDate;
  }
  if (routineAssignedAt) {
    const assignedDate = toDateOnly(routineAssignedAt);
    if (assignedDate > effectiveStart) effectiveStart = assignedDate;
  }

  if (effectiveStart > rangeEnd) return 0;

  const startMs = new Date(`${effectiveStart}T00:00:00Z`).getTime();
  const endMs = new Date(`${rangeEnd}T00:00:00Z`).getTime();
  const daySpan = Math.round((endMs - startMs) / DAY_MS) + 1;
  const weeksSpan = Math.ceil(daySpan / 7);
  return plannedPerWeek * weeksSpan;
}
