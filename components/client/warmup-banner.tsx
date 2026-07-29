"use client";

import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import type { WarmupType } from "@/lib/supabase/client-routine";

const WARMUP_PERCENTAGES = [50, 70, 90];
const WARMUP_REPS = [5, 3, 1];

// Redondeo al múltiplo de 2,5 kg más cercano, hacia ABAJO — nunca hacia
// arriba, para no sugerir un peso más pesado que el porcentaje real (ej.
// objetivo 47,5 kg -> 50% = 23,75 -> se muestra 22,5 kg, no 25).
function floorToNearest2_5(value: number): number {
  return Math.floor(value / 2.5) * 2.5;
}

type WarmupRow = {
  pct: number;
  reps: number;
  kg: number | null;
};

function buildFixedWeightRows(weightKg: number): WarmupRow[] {
  return [0, 1, 2].map(() => ({ pct: 0, reps: 8, kg: weightKg }));
}

function buildPercentageRows(suggestedWeightKg: number | null): WarmupRow[] {
  return WARMUP_PERCENTAGES.map((pct, i) => ({
    pct,
    reps: WARMUP_REPS[i],
    kg: suggestedWeightKg != null ? floorToNearest2_5(suggestedWeightKg * (pct / 100)) : null,
  }));
}

// Banner de calentamiento (ago-2026) — series de aproximación del primer
// ejercicio del día únicamente, antes de arrancar a registrar. Se cierra
// tocando afuera o con el botón (a diferencia de RoutineWelcomeBanner, acá
// sí se permite tap-afuera porque no hay una decisión que registrar, es
// solo información).
export function WarmupBanner({
  exerciseName,
  warmupType,
  warmupFixedWeightKg,
  suggestedWeightKg,
  onClose,
}: {
  exerciseName: string;
  warmupType: WarmupType;
  warmupFixedWeightKg: number | null;
  suggestedWeightKg: number | null;
  onClose: () => void;
}) {
  const isFixed = warmupType === "fixed_weight" && warmupFixedWeightKg != null;
  const rows = isFixed
    ? buildFixedWeightRows(warmupFixedWeightKg as number)
    : buildPercentageRows(warmupType === "percentage_with_kg" ? suggestedWeightKg : null);

  // "Tanteá con un peso..." aparece cuando no hay kilos calculados que
  // mostrar: Tipo B siempre, o Tipo A cuando el cliente nunca hizo el
  // ejercicio (sin dato de referencia).
  const showTanteoHint = !isFixed && rows.every((r) => r.kg == null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#080808]/95 px-5 text-center backdrop-blur-xl"
      onClick={onClose}
    >
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <FadeIn className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
              Antes de arrancar
            </h1>
            <p className="text-sm text-[#888888]">
              Series de aproximación para {exerciseName}
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
            {rows.map((row, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5"
              >
                <span className="text-sm font-medium text-[#888888]">Serie {i + 1}</span>
                <span className="flex items-baseline gap-2">
                  <span className="font-display text-2xl text-[#e8001c]">
                    {row.kg != null
                      ? `${row.kg} kg`
                      : isFixed
                        ? "—"
                        : `${row.pct}% de tu máximo`}
                  </span>
                  <span className="text-sm text-white">× {row.reps} reps</span>
                </span>
              </div>
            ))}
          </div>

          {showTanteoHint && (
            <p className="text-sm text-[#888888]">
              Tanteá con un peso que puedas mover cómodo y andá subiendo.
            </p>
          )}

          <p className="rounded-xl bg-[#e8001c]/10 p-3 text-sm font-medium text-[#e8001c]">
            Estas series NO se registran. Son solo para preparar el músculo y el sistema
            nervioso. Empezá a anotar recién en tu primera serie efectiva.
          </p>

          <Button onClick={onClose} className="min-h-[52px] w-full text-base">
            Entendido, vamos
          </Button>
        </FadeIn>
      </div>
    </div>
  );
}
