import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { MyRoutineDay } from "@/lib/supabase/client-routine";
import type { TodaySummary } from "@/lib/supabase/client-home";

// "Próximo entrenamiento" (jul-2026, movida a la pantalla de inicio en
// ago-2026): le dice al cliente exactamente qué le toca sin que tenga que
// acordarse solo. Tres estados posibles, en este orden de prioridad:
// 1) trainedToday: ya entrenó HOY — manda incluso si quedan otros días
//    planificados sin completar esta semana (pudo haber adelantado el día
//    de mañana). 2) suggestedDay null: completó TODOS los días de la
//    semana (ver getWeekProgress en client-routine.ts). 3) suggestedDay:
//    caso normal, el día que le toca.
export function NextWorkoutCard({
  trainedToday = false,
  todaySummary = null,
  suggestedDay,
  completedCount,
  plannedCount,
}: {
  trainedToday?: boolean;
  todaySummary?: TodaySummary | null;
  suggestedDay: MyRoutineDay | null;
  completedCount: number;
  plannedCount: number;
}) {
  const percent =
    plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;

  return (
    <div className="rounded-2xl border border-[#e8001c]/40 bg-[#111111] p-5">
      <p className="text-xs font-semibold tracking-widest text-[#e8001c] uppercase">
        {trainedToday ? "Hoy" : suggestedDay ? "Tu próximo entrenamiento" : "Esta semana"}
      </p>

      {trainedToday ? (
        <>
          <p className="mt-1 font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
            Ya entrenaste hoy 🔥
          </p>
          {todaySummary && (
            <p className="text-sm text-[#888888]">
              {todaySummary.dayName ?? "Entrenamiento"} · {todaySummary.totalSets} series
              {todaySummary.totalVolume > 0
                ? ` · ${todaySummary.totalVolume.toLocaleString("es-AR")} kg movidos`
                : ""}
            </p>
          )}
        </>
      ) : suggestedDay ? (
        <>
          <p className="mt-1 font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
            {suggestedDay.name}
          </p>
          <p className="text-sm text-[#888888]">
            {suggestedDay.exercises.length} ejercicio
            {suggestedDay.exercises.length === 1 ? "" : "s"}
          </p>
          <Link
            href={`/client/log-workout?day=${suggestedDay.id}`}
            className={buttonVariants({
              className: "mt-4 min-h-[52px] w-full text-base",
            })}
          >
            Iniciar entrenamiento
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1 font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
            Semana completa 🔥
          </p>
          <p className="text-sm text-[#888888]">
            Descansá, arrancás de nuevo el lunes.
          </p>
        </>
      )}

      {plannedCount > 0 && (
        <div className="mt-4">
          <p className="text-xs text-[#888888]">
            {completedCount} de {plannedCount} completados esta semana
          </p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#e8001c] transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
