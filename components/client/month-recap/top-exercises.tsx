import { MiniProgressChart } from "@/components/charts/mini-progress-chart";
import type { MonthTopExercise } from "@/lib/supabase/month-summary";

function formatWeight(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

// Bloque estrella (jul-2026): top 3 ejercicios con mayor progresión de
// peso máximo en el mes — filtrado en el servidor a los que tuvieron al
// menos 2 sesiones reales (una sola sesión no es progresión, es ruido).
export function MonthRecapTopExercises({
  topExercises,
}: {
  topExercises: MonthTopExercise[];
}) {
  return (
    <div className="flex flex-col gap-4 py-10">
      <p className="text-center font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
        Dónde más progresaste
      </p>

      {topExercises.length === 0 ? (
        <p className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-5 text-center text-sm text-[#888888]">
          Este mes fue de sostener el nivel. La próxima, a subir números.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {topExercises.map((ex) => (
            <div
              key={ex.exerciseId}
              className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4"
            >
              <p className="font-display text-xl tracking-wide text-[#f5f5f5] uppercase">
                {ex.exerciseName}
              </p>
              <p className="mt-1 text-sm text-[#888888]">
                {formatWeight(ex.firstWeight)}kg → {formatWeight(ex.lastWeight)}kg
                <span className="ml-2 font-semibold text-[#e8001c]">
                  +{formatWeight(ex.diff)}kg
                </span>
              </p>
              <div className="mt-2">
                <MiniProgressChart points={ex.points} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
