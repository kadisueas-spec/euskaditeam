"use client";

import { ExerciseProgressCharts } from "@/components/charts/exercise-progress-charts";
import type { ExerciseSessionSeries } from "@/lib/supabase/metrics";
import type { ClientStats } from "@/lib/supabase/stats";
import { FadeIn } from "@/components/motion/fade-in";

// Bloque 2 (jul-2026): hito de racha de días — se muestra tal cual mientras
// dailyStreak sea exactamente ese número (sin estado de "ya lo vio", así no
// hace falta ninguna tabla nueva: el mismo día que cruza el hito, lo ve).
const STREAK_MILESTONES: Record<number, string> = {
  7: "Una semana seguida. Eso es carácter.",
  30: "Un mes entero. Pocos llegan acá.",
};

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
  const milestone = STREAK_MILESTONES[stats.dailyStreak];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <FadeIn delay={0}>
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
            <p className="text-xs text-[#888888]">Racha de días 🔥</p>
            <p className="mt-1 font-display text-4xl text-[#e8001c]">
              {stats.dailyStreak}
              <span className="text-lg text-[#888888]">
                {" "}
                día{stats.dailyStreak === 1 ? "" : "s"}
              </span>
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
            <p className="text-xs text-[#888888]">Racha semanal 💪</p>
            <p className="mt-1 font-display text-4xl text-[#e8001c]">
              {stats.weeklyStreak}
              <span className="text-lg text-[#888888]">
                {" "}
                semana{stats.weeklyStreak === 1 ? "" : "s"}
              </span>
            </p>
          </div>
        </FadeIn>
      </div>

      {milestone && (
        <FadeIn delay={0.08}>
          <div className="glow-pulse rounded-2xl border border-[#e8001c]/30 bg-[#e8001c]/10 px-4 py-3 text-center">
            <p className="text-sm font-medium text-[#f5f5f5]">{milestone}</p>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-xs text-[#888888]">Adherencia del mes</p>
          <p className="mt-1 font-display text-4xl text-[#e8001c]">
            {stats.adherencePercent}
            <span className="text-lg text-[#888888]">%</span>
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.15}>
        <ExerciseProgressCharts series={sessionSeries} />
      </FadeIn>
    </div>
  );
}
