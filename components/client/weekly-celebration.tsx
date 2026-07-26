"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { WeeklyCelebrationSummary } from "@/app/client/log-workout/actions";
import {
  randomWeeklyCelebrationPhrase,
  FIRST_COMPLETE_WEEK_PHRASE,
} from "@/lib/constants/weekly-celebration-phrases";

// Confeti más abundante y de mayor duración que el de la celebración de
// sesión (10 piezas / 1.8s en workout-logger.tsx) — posiciones y demoras
// fijas, no Math.random en cada render, mismo criterio que el resto de
// las coreografías CSS de la app.
const WEEKLY_CONFETTI_PIECES = [
  { left: "4%", delay: "0s", color: "#e8001c" },
  { left: "11%", delay: "0.2s", color: "#f5f5f5" },
  { left: "18%", delay: "0.05s", color: "#e8001c" },
  { left: "25%", delay: "0.3s", color: "#f5f5f5" },
  { left: "32%", delay: "0.1s", color: "#e8001c" },
  { left: "39%", delay: "0.35s", color: "#f5f5f5" },
  { left: "46%", delay: "0.15s", color: "#e8001c" },
  { left: "53%", delay: "0.4s", color: "#f5f5f5" },
  { left: "60%", delay: "0.05s", color: "#e8001c" },
  { left: "67%", delay: "0.25s", color: "#f5f5f5" },
  { left: "74%", delay: "0.1s", color: "#e8001c" },
  { left: "81%", delay: "0.3s", color: "#f5f5f5" },
  { left: "88%", delay: "0.2s", color: "#e8001c" },
  { left: "95%", delay: "0.4s", color: "#f5f5f5" },
  { left: "8%", delay: "0.45s", color: "#e8001c" },
  { left: "29%", delay: "0.5s", color: "#f5f5f5" },
  { left: "50%", delay: "0.45s", color: "#e8001c" },
  { left: "71%", delay: "0.5s", color: "#f5f5f5" },
  { left: "92%", delay: "0.55s", color: "#e8001c" },
  { left: "43%", delay: "0.55s", color: "#f5f5f5" },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
      <p className="font-display text-4xl text-[#e8001c]">{value}</p>
      <p className="text-xs text-[#888888] uppercase">{label}</p>
    </div>
  );
}

// Celebración semanal (jul-2026): pantalla completa, más impactante que la
// celebración de sesión — se dispara una sola vez por semana desde
// finishWorkout (ver checkWeeklyCompletion en app/client/log-workout/
// actions.ts) cuando esa sesión completó todos los días planificados.
// Entrada escalonada (título -> números -> mensaje) reusando
// animate-fade-in-up con animationDelay por bloque, CSS puro.
export function WeeklyCelebration({
  summary,
  onClose,
}: {
  summary: WeeklyCelebrationSummary;
  onClose: () => void;
}) {
  const [phrase] = useState(() =>
    summary.isFirstCompleteWeek
      ? FIRST_COMPLETE_WEEK_PHRASE
      : randomWeeklyCelebrationPhrase()
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#080808] px-5 text-center"
      onClick={onClose}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden">
        {WEEKLY_CONFETTI_PIECES.map((c, i) => (
          <span
            key={i}
            className="animate-confetti-fall-slow absolute top-0 size-2 rounded-sm"
            style={{
              left: c.left,
              backgroundColor: c.color,
              animationDelay: c.delay,
            }}
          />
        ))}
      </div>

      <div
        className="relative flex w-full max-w-sm flex-col items-center gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="animate-fade-in-up flex flex-col gap-1.5">
          <h1 className="font-display text-5xl tracking-wide text-[#e8001c] uppercase">
            Semana completa
          </h1>
          <p className="text-base text-[#f5f5f5]">
            {summary.weeklyStreak === 1
              ? "1 semana consecutiva 💪"
              : `${summary.weeklyStreak} semanas consecutivas 💪`}
          </p>
        </div>

        <div
          className="animate-fade-in-up grid w-full grid-cols-2 gap-3"
          style={{ animationDelay: "0.15s" }}
        >
          <Stat
            label="Entrenamientos"
            value={`${summary.completedDays} de ${summary.plannedDays}`}
          />
          <Stat label="Series totales" value={String(summary.totalSets)} />
          <Stat
            label="Kg volumen"
            value={summary.totalVolume.toLocaleString("es-AR")}
          />
          <Stat label="Récords" value={String(summary.records.length)} />
        </div>

        <p
          className="animate-fade-in-up text-sm text-[#c9c9c9]"
          style={{ animationDelay: "0.3s" }}
        >
          {phrase}
        </p>

        <Button
          onClick={onClose}
          className="min-h-[52px] w-full max-w-xs text-base"
        >
          Seguir
        </Button>
      </div>
    </div>
  );
}
