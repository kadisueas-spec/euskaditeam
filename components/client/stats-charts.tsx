"use client";

import { ExerciseProgressCharts } from "@/components/charts/exercise-progress-charts";
import type { ExerciseSessionSeries } from "@/lib/supabase/metrics";
import type { ClientStats } from "@/lib/supabase/stats";
import { FadeIn } from "@/components/motion/fade-in";

// Mejora Fase 9 (jul-2026): el tonelaje/volumen semanal salió de la vista
// del cliente (es info para el coach, no lo interpretan) — racha y
// adherencia se quedan porque sí motivan, y "Progreso de peso" (bucketed
// por semana) se reemplaza por los dos gráficos por sesión real de
// ExerciseProgressCharts, que ahora son el centro de la pantalla.
export function StatsCharts({
  stats,
  sessionSeries,
}: {
  stats: ClientStats;
  sessionSeries: ExerciseSessionSeries[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <FadeIn delay={0}>
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
            <p className="text-xs text-[#888888]">Racha actual</p>
            <p className="mt-1 font-display text-4xl text-[#e8001c]">
              {stats.streak}
              <span className="text-lg text-[#888888]">
                {" "}
                semana{stats.streak === 1 ? "" : "s"}
              </span>
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
            <p className="text-xs text-[#888888]">Adherencia del mes</p>
            <p className="mt-1 font-display text-4xl text-[#e8001c]">
              {stats.adherencePercent}
              <span className="text-lg text-[#888888]">%</span>
            </p>
          </div>
        </FadeIn>
      </div>

      <FadeIn delay={0.1}>
        <ExerciseProgressCharts series={sessionSeries} />
      </FadeIn>
    </div>
  );
}
