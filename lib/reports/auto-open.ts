import { paraguayDateOf } from "@/lib/utils/today";

// Reporte que se abre solo al entrar a Inicio (oct-2026). Reglas:
// - Solo reportes enviados que el cliente todavía no abrió (opened_at =
//   pasó de la portada).
// - Como mucho 1 vez por día (fecha de Paraguay) y 3 veces por reporte
//   (auto_open_count / auto_open_last_at, en el servidor).
// - Si hay más de uno, el más reciente; los demás quedan con su tarjeta.
// - Nunca con un entrenamiento en curso (espera a que termine).
// - Nunca encima del banner "Empecemos" ni del recorrido: el componente
//   espera a que se cierren (ver HomeReports).

export const AUTO_OPEN_MAX_PER_REPORT = 3;

export type AutoOpenCandidate = {
  id: string;
  sentAt: string;
  openedAt: string | null;
  autoOpenCount: number;
  autoOpenLastAt: string | null;
};

export function pickAutoOpenReport(params: {
  reports: AutoOpenCandidate[];
  today: string; // fecha de Paraguay (YYYY-MM-DD)
  workoutInProgress: boolean;
}): string | null {
  if (params.workoutInProgress) return null;
  const eligible = params.reports
    .filter((r) => r.openedAt == null)
    .filter((r) => r.autoOpenCount < AUTO_OPEN_MAX_PER_REPORT)
    .filter((r) => r.autoOpenLastAt == null || paraguayDateOf(r.autoOpenLastAt) !== params.today)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  return eligible[0]?.id ?? null;
}
