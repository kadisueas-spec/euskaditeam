import Link from "next/link";
import { redirect } from "next/navigation";
import { History, Sparkles, Target, TrendingUp } from "lucide-react";
import { getCurrentMonthGoal, getMonthKey } from "@/lib/supabase/monthly-goals";
import { capitalize, monthName } from "@/lib/reports/format";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/motion/fade-in";
import { getWorkoutHistory } from "@/lib/supabase/workout-history";
import { formatFriendlyDate } from "@/lib/utils/format-date";

// Pestañas que se mudaron a /client/body (oct-2026) — los links viejos
// (push notifications ya enviadas, ej. "Nueva evaluación disponible" ->
// /client/progress?tab=cuerpo) se redirigen para no caer en el historial.
const BODY_TABS = ["cuerpo", "peso", "nutricion"];

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  if (tab && BODY_TABS.includes(tab)) redirect(`/client/body?tab=${tab}`);

  const [history, goal] = await Promise.all([getWorkoutHistory(), getCurrentMonthGoal()]);
  const monthLabel = capitalize(monthName(getMonthKey()));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          Progreso
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>

      {/* Objetivo del mes en curso (antes vivía en Mi Mes, oct-2026). */}
      {goal && (
        <FadeIn>
          <div className="flex items-start gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
            <Target className="mt-0.5 size-5 shrink-0 text-[#e8001c]" aria-hidden />
            <div>
              <p className="text-xs font-medium text-[#888888]">Tu objetivo de {monthLabel}</p>
              <p className="mt-0.5 font-medium text-white">{goal.mainGoal}</p>
            </div>
          </div>
        </FadeIn>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/client/progress/stats"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-white/5 px-3 text-sm font-medium text-[#e8001c] active:bg-white/10"
        >
          <TrendingUp className="size-4" />
          Estadísticas
        </Link>
        <Link
          href="/client/progress/reports"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-white/5 px-3 text-sm font-medium text-[#e8001c] active:bg-white/10"
        >
          <Sparkles className="size-4" />
          Mis reportes
        </Link>
      </div>

      <h2 className="text-lg font-semibold text-white">Historial</h2>

      {history.length === 0 ? (
        <EmptyState
          icon={History}
          title="Completá tu primer entrenamiento para ver tu historial."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {history.map((log, i) => (
            <FadeIn key={log.id} delay={Math.min(i * 0.04, 0.3)}>
              <Link
                href={`/client/progress/${log.id}`}
                className="flex min-h-[44px] items-center justify-between rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4 active:bg-white/5"
              >
                <div>
                  <p className="font-medium text-white">{log.dayName ?? "Entrenamiento"}</p>
                  <p className="text-sm text-[#888888]">
                    {formatFriendlyDate(log.workoutDate)}
                  </p>
                </div>
                <Badge variant={log.isCompleted ? "default" : "outline"}>
                  {log.isCompleted ? "Completado" : "En curso"}
                </Badge>
              </Link>
            </FadeIn>
          ))}
        </ul>
      )}
    </div>
  );
}
