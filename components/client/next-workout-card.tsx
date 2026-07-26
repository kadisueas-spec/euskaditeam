import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { MyRoutineDay } from "@/lib/supabase/client-routine";

// "Próximo entrenamiento" (jul-2026): card destacada arriba de la lista de
// días en Mi Rutina — le dice al cliente exactamente qué le toca sin que
// tenga que acordarse solo. suggestedDay null = ya completó todos los días
// planificados de la semana (ver getWeekProgress en client-routine.ts).
export function NextWorkoutCard({
  suggestedDay,
  completedCount,
  plannedCount,
}: {
  suggestedDay: MyRoutineDay | null;
  completedCount: number;
  plannedCount: number;
}) {
  const percent =
    plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;

  return (
    <div className="rounded-2xl border border-[#e8001c]/40 bg-[#111111] p-5">
      <p className="text-xs font-semibold tracking-widest text-[#e8001c] uppercase">
        {suggestedDay ? "Tu próximo entrenamiento" : "Esta semana"}
      </p>

      {suggestedDay ? (
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
