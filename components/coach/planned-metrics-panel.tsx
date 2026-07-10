"use client";

import { useEffect, useState } from "react";
import { Activity, ChevronDown } from "lucide-react";
import {
  computePlannedMetrics,
  VOLUME_DANGER_THRESHOLD,
  VOLUME_WARNING_THRESHOLD,
  type PlannedDayInput,
  type VolumeStatus,
} from "@/lib/planned-metrics";
import type { ExerciseOption } from "@/lib/supabase/routines";

const STATUS_BAR_CLASS: Record<VolumeStatus, string> = {
  ok: "bg-[#f5f5f5]/70",
  warning: "bg-amber-400",
  danger: "bg-[#e8001c]",
};

const STATUS_TEXT_CLASS: Record<VolumeStatus, string> = {
  ok: "text-[#f5f5f5]",
  warning: "text-amber-400",
  danger: "text-[#e8001c]",
};

// Mismos colores que la distribución de RIR "real" en
// components/coach/client-metrics-tab.tsx — misma semántica de color en las
// dos pantallas de RIR de la app (planificado acá, real ahí).
const RIR_SEGMENTS: {
  key: "rir3" | "rir2" | "rir1" | "rir0";
  label: string;
  color: string;
}[] = [
  { key: "rir3", label: "RIR 3+", color: "#555555" },
  { key: "rir2", label: "RIR 2", color: "#888888" },
  { key: "rir1", label: "RIR 1", color: "#ff4d4d" },
  { key: "rir0", label: "RIR 0 / Fallo", color: "#e8001c" },
];

// Panel de métricas PLANIFICADAS (lo que el coach está diseñando), hermano
// del tab "Métricas" de /coach/clients/[id] que muestra lo REAL ya
// entrenado. Cálculo 100% client-side (ver lib/planned-metrics.ts): se
// recalcula en cada render del wizard/editor, así que cada tecla que
// cambia series/RIR/reps se refleja al instante, sin ida y vuelta a la base.
export function PlannedMetricsPanel({
  days,
  exercises,
}: {
  days: PlannedDayInput[];
  exercises: ExerciseOption[];
}) {
  // Colapsado por defecto en mobile para no interferir con el flujo de
  // armar la rutina; en desktop el coach tiene lugar de sobra y arma
  // rutinas ahí más seguido, así que arranca expandido.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(min-width: 640px)").matches) setExpanded(true);
  }, []);

  const muscleGroupByExerciseId = new Map(
    exercises.map((e) => [e.id, e.muscleGroup])
  );
  const metrics = computePlannedMetrics(days, muscleGroupByExerciseId);
  const worstStatus: VolumeStatus = metrics.volumeByGroup.some(
    (g) => g.status === "danger"
  )
    ? "danger"
    : metrics.volumeByGroup.some((g) => g.status === "warning")
      ? "warning"
      : "ok";
  const alertCount = metrics.volumeByGroup.filter(
    (g) => g.status !== "ok"
  ).length;
  const maxTonnage = Math.max(1, ...metrics.tonnageByGroup.map((g) => g.units));

  return (
    <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="planned-metrics-content"
        className="flex min-h-[44px] w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="flex items-center gap-2">
          <Activity className="size-4 text-[#888888]" />
          <span className="text-sm font-bold tracking-wide text-white uppercase">
            Métricas planificadas
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-baseline gap-1">
            <span
              className={`font-display text-2xl leading-none ${STATUS_TEXT_CLASS[worstStatus]}`}
            >
              {metrics.totalSets}
            </span>
            <span className="text-xs text-[#888888]">series/sem</span>
          </span>
          {!expanded && alertCount > 0 && (
            <span
              className={`flex size-2 rounded-full ${STATUS_BAR_CLASS[worstStatus]}`}
              title={`${alertCount} grupo(s) fuera de rango`}
            />
          )}
          <ChevronDown
            className={`size-4 text-[#888888] transition-transform duration-200 motion-reduce:transition-none ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      <div
        id="planned-metrics-content"
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-5 border-t border-[#1e1e1e] p-4">
            {metrics.totalSets === 0 ? (
              <p className="text-sm text-[#888888]">
                Agregá ejercicios para ver las métricas de esta rutina.
              </p>
            ) : (
              <>
                <section className="flex flex-col gap-2">
                  <p className="text-xs text-[#888888]">
                    Volumen semanal por grupo muscular
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {metrics.volumeByGroup.map((g) => (
                      <div key={g.group} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate text-xs text-[#c9c9c9]">
                          {g.group}
                        </span>
                        <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                          <span
                            className={`absolute inset-y-0 left-0 rounded-full ${STATUS_BAR_CLASS[g.status]}`}
                            style={{
                              width: `${Math.min(100, (g.sets / VOLUME_DANGER_THRESHOLD) * 100)}%`,
                            }}
                          />
                        </span>
                        <span
                          className={`w-6 shrink-0 text-right font-display text-sm ${STATUS_TEXT_CLASS[g.status]}`}
                        >
                          {g.sets}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#666666]">
                    Amarillo {">"} {VOLUME_WARNING_THRESHOLD} series/sem · rojo{" "}
                    {">"} {VOLUME_DANGER_THRESHOLD} series/sem
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <p className="text-xs text-[#888888]">
                    Distribución de RIR planificado
                  </p>
                  {metrics.rir.ratedSets === 0 ? (
                    <p className="text-sm text-[#666666]">
                      Asigná RIR a los ejercicios para ver la distribución.
                    </p>
                  ) : (
                    <>
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
                        {RIR_SEGMENTS.map((seg) => {
                          const value = metrics.rir[seg.key];
                          if (value <= 0) return null;
                          return (
                            <span
                              key={seg.key}
                              style={{
                                width: `${value}%`,
                                backgroundColor: seg.color,
                              }}
                              title={`${seg.label}: ${value}%`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {RIR_SEGMENTS.map((seg) => (
                          <span
                            key={seg.key}
                            className="flex items-center gap-1.5 text-[11px] text-[#c9c9c9]"
                          >
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: seg.color }}
                            />
                            {seg.label} · {metrics.rir[seg.key]}%
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <p className="text-xs text-[#888888]">
                    Tonelaje proyectado por grupo (referencia relativa)
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {metrics.tonnageByGroup.map((g) => (
                      <div key={g.group} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate text-xs text-[#c9c9c9]">
                          {g.group}
                        </span>
                        <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full bg-white/25"
                            style={{ width: `${(g.units / maxTonnage) * 100}%` }}
                          />
                        </span>
                        <span className="w-10 shrink-0 text-right font-display text-sm text-[#f5f5f5]">
                          {g.units}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
