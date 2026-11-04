import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { ActiveWorkoutSession, MyRoutineDay } from "@/lib/supabase/client-routine";
import type { TodaySummary } from "@/lib/supabase/client-home";

// "Próximo entrenamiento" (jul-2026, movida a la pantalla de inicio en
// ago-2026): le dice al cliente exactamente qué le toca sin que tenga que
// acordarse solo. Estados, en este orden de prioridad:
// 0) activeWorkout: sesión abierta hoy → "Continuar entrenamiento".
// 1) trainedToday: ya entrenó HOY — manda incluso si quedan otros días
//    planificados sin completar esta semana (pudo haber adelantado el día
//    de mañana). 2) suggestedDay null: completó TODOS los días de la
//    semana (ver getWeekProgress en client-routine.ts). 3) suggestedDay:
//    caso normal, el día que le toca.
//
// Rediseño nov-2026 ("Vestuario en capas"): vive sobre el degradé de la
// zona de arriba de Inicio, sin caja propia — el nombre del día es el
// protagonista, el botón es una píldora con degradé y la semana se lee en
// círculos (uno por día planificado).
export function NextWorkoutCard({
  trainedToday = false,
  todaySummary = null,
  suggestedDay,
  completedCount,
  plannedCount,
  activeWorkout = null,
}: {
  // Oct-2026: Entrenar salió de la nav y esta tarjeta pasó a ser LA
  // entrada a entrenar — con una sesión abierta hoy, manda sobre los otros
  // tres estados y ofrece retomarla.
  activeWorkout?: ActiveWorkoutSession | null;
  trainedToday?: boolean;
  todaySummary?: TodaySummary | null;
  suggestedDay: MyRoutineDay | null;
  completedCount: number;
  plannedCount: number;
}) {
  // Acento vivo (nov-2026). Texto de 19px en negrita = "texto grande" para
  // el contraste (3:1) sobre la parte clara del degradé.
  const cta = "gradient-vivid glow-vivid mt-5 min-h-[56px] w-full rounded-full text-[1.1875rem] font-bold text-white";

  return (
    <div>
      {activeWorkout ? (
        <>
          <p className="text-sm text-(--hero-text-soft)">Tenés una sesión abierta</p>
          <p className="mt-1 font-display text-6xl leading-[0.9] tracking-wide text-[#f5f5f5] uppercase [text-wrap:balance]">
            {activeWorkout.dayName ?? "Tu sesión de hoy"}
          </p>
          <p className="mt-2 text-sm text-(--hero-text-soft)">Retomala donde quedaste.</p>
          <Link href={`/client/log-workout?day=${activeWorkout.dayId}`} className={buttonVariants({ className: cta })}>
            Continuar entrenamiento <ArrowRight className="size-5" aria-hidden />
          </Link>
        </>
      ) : trainedToday ? (
        <>
          <p className="text-sm text-(--hero-text-soft)">Hoy</p>
          <p className="mt-1 font-display text-5xl leading-[0.9] tracking-wide text-[#f5f5f5] uppercase">
            Ya entrenaste hoy 🔥
          </p>
          {todaySummary && (
            <p className="mt-2 text-sm text-(--hero-text-soft)">
              {todaySummary.dayName ?? "Entrenamiento"} · {todaySummary.totalSets} series
              {todaySummary.totalVolume > 0
                ? ` · ${todaySummary.totalVolume.toLocaleString("es-AR")} kg movidos`
                : ""}
            </p>
          )}
        </>
      ) : suggestedDay ? (
        <>
          <p className="text-sm text-(--hero-text-soft)">Hoy te toca</p>
          <p className="mt-1 font-display text-6xl leading-[0.9] tracking-wide text-[#f5f5f5] uppercase [text-wrap:balance]">
            {suggestedDay.name}
          </p>
          <p className="mt-2 text-sm text-(--hero-text-soft)">
            {suggestedDay.exercises.length} ejercicio
            {suggestedDay.exercises.length === 1 ? "" : "s"}
          </p>
          <Link href={`/client/log-workout?day=${suggestedDay.id}`} className={buttonVariants({ className: cta })}>
            Iniciar entrenamiento <ArrowRight className="size-5" aria-hidden />
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-(--hero-text-soft)">Esta semana</p>
          <p className="mt-1 font-display text-5xl leading-[0.9] tracking-wide text-[#f5f5f5] uppercase">
            Semana completa 🔥
          </p>
          <p className="mt-2 text-sm text-(--hero-text-soft)">Descansá, arrancás de nuevo el lunes.</p>
        </>
      )}

      {plannedCount > 0 && <WeekDots done={completedCount} planned={plannedCount} />}
    </div>
  );
}

// Un círculo por día planificado de la semana: rojo los hechos, contorno
// los que faltan. Tope de 7 (una rutina no tiene más días por semana).
function WeekDots({ done, planned }: { done: number; planned: number }) {
  const total = Math.min(planned, 7);
  const filled = Math.min(done, total);
  return (
    <div className="mt-5 flex items-center gap-3">
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) =>
          i < filled ? (
            <span key={i} className="flex size-6 items-center justify-center rounded-full bg-white">
              <Check className="size-3.5 text-(--accent-vivid-dark)" strokeWidth={3} />
            </span>
          ) : (
            <span key={i} className="size-6 rounded-full border-2 border-white/35" />
          )
        )}
      </div>
      <p className="text-sm text-(--hero-text-soft)">
        {done} de {planned} esta semana
      </p>
    </div>
  );
}
