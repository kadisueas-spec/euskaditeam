"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Ruler } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import {
  EvolutionChart,
  shortDateLabel,
  type ChartPoint,
} from "@/components/charts/evaluation-evolution-chart";
import type { EvaluationDetail } from "@/lib/supabase/anthropometrics";
import {
  PERIMETER_LABELS,
  PERIMETER_TYPES,
  SKINFOLD_LABELS,
  type PerimeterType,
} from "@/lib/anthropometrics/constants";
import { formatDate } from "@/lib/utils/format-date";

function ComparisonRow({
  label,
  first,
  last,
}: {
  label: string;
  first: number;
  last: number;
}) {
  const delta = Math.round((last - first) * 10) / 10;
  return (
    <li className="flex items-center justify-between text-sm">
      <span className="text-[#888888]">{label}</span>
      <span className="flex items-center gap-2 font-mono text-white">
        {first} → {last}
        {delta !== 0 && (
          <span className="flex items-center gap-0.5 text-xs text-[#888888]">
            {delta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(delta)}
          </span>
        )}
      </span>
    </li>
  );
}

export function BodyTab({ evaluations }: { evaluations: EvaluationDetail[] }) {
  const [perimeterType, setPerimeterType] = useState<PerimeterType>("waist");

  if (evaluations.length === 0) {
    return (
      <EmptyState
        icon={Ruler}
        title="Tu coach todavía no cargó ninguna evaluación."
        description="Cuando tengas tu primera evaluación antropométrica, la vas a ver acá."
      />
    );
  }

  const latest = evaluations[evaluations.length - 1];
  const latestWithBodyFat = [...evaluations].reverse().find((e) => e.bodyFatPercentage != null);
  const latestWithMuscleMass = [...evaluations].reverse().find((e) => e.muscleMassKg != null);

  const weightPoints: ChartPoint[] = evaluations.map((e) => ({
    date: e.evaluationDate,
    label: shortDateLabel(e.evaluationDate),
    value: e.weightKg,
  }));

  const bodyFatPoints: ChartPoint[] = evaluations
    .filter((e) => e.bodyFatPercentage != null)
    .map((e) => ({
      date: e.evaluationDate,
      label: shortDateLabel(e.evaluationDate),
      value: e.bodyFatPercentage!,
    }));

  const muscleMassPoints: ChartPoint[] = evaluations
    .filter((e) => e.muscleMassKg != null)
    .map((e) => ({
      date: e.evaluationDate,
      label: shortDateLabel(e.evaluationDate),
      value: e.muscleMassKg!,
    }));

  const perimeterPoints: ChartPoint[] = evaluations
    .filter((e) => e.measurements[perimeterType] != null)
    .map((e) => ({
      date: e.evaluationDate,
      label: shortDateLabel(e.evaluationDate),
      value: e.measurements[perimeterType]!,
    }));

  const first = evaluations[0];
  const showComparison = evaluations.length >= 2 && first.id !== latest.id;

  const comparisonMeasurementTypes = [
    ...PERIMETER_TYPES,
    ...(Object.keys(SKINFOLD_LABELS) as (keyof typeof SKINFOLD_LABELS)[]),
  ].filter((t) => first.measurements[t] != null && latest.measurements[t] != null);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-xs text-[#888888]">Grasa corporal</p>
          <p className="mt-1 font-display text-3xl text-[#e8001c]">
            {latestWithBodyFat?.bodyFatPercentage != null
              ? `${latestWithBodyFat.bodyFatPercentage.toFixed(1)}%`
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-xs text-[#888888]">Masa muscular</p>
          <p className="mt-1 font-display text-3xl text-[#e8001c]">
            {latestWithMuscleMass?.muscleMassKg != null
              ? `${latestWithMuscleMass.muscleMassKg.toFixed(1)} kg`
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-xs text-[#888888]">Peso actual</p>
          <p className="mt-1 font-display text-3xl text-[#e8001c]">{latest.weightKg} kg</p>
        </div>
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-xs text-[#888888]">Última evaluación</p>
          <p className="mt-1 text-sm font-medium text-white">{formatDate(latest.evaluationDate)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <EvolutionChart title="Peso corporal" unit="kg" points={weightPoints} />
      </div>

      {bodyFatPoints.length > 0 && (
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <EvolutionChart title="% de grasa corporal" unit="%" points={bodyFatPoints} />
        </div>
      )}

      {muscleMassPoints.length > 0 && (
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <EvolutionChart title="Masa muscular" unit="kg" points={muscleMassPoints} />
        </div>
      )}

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <div className="mb-4">
          <NativeSelect
            value={perimeterType}
            onChange={(e) => setPerimeterType(e.target.value as PerimeterType)}
            className="min-h-[44px] w-full"
          >
            {PERIMETER_TYPES.map((t) => (
              <option key={t} value={t}>
                {PERIMETER_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {perimeterPoints.length === 0 ? (
          <p className="text-sm text-[#888888]">
            Todavía no hay mediciones de {PERIMETER_LABELS[perimeterType].toLowerCase()}.
          </p>
        ) : (
          <EvolutionChart
            title={PERIMETER_LABELS[perimeterType]}
            unit="cm"
            points={perimeterPoints}
          />
        )}
      </div>

      {showComparison && (
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="mb-3 text-sm font-medium text-white">
            Comparación: {formatDate(first.evaluationDate)} → {formatDate(latest.evaluationDate)}
          </p>
          <ul className="flex flex-col gap-2">
            <ComparisonRow label="Peso (kg)" first={first.weightKg} last={latest.weightKg} />
            {first.bodyFatPercentage != null && latest.bodyFatPercentage != null && (
              <ComparisonRow
                label="Grasa corporal (%)"
                first={first.bodyFatPercentage}
                last={latest.bodyFatPercentage}
              />
            )}
            {first.muscleMassKg != null && latest.muscleMassKg != null && (
              <ComparisonRow
                label="Masa muscular (kg)"
                first={first.muscleMassKg}
                last={latest.muscleMassKg}
              />
            )}
            <ComparisonRow label="IMC" first={first.bmi} last={latest.bmi} />
            {comparisonMeasurementTypes.map((t) => (
              <ComparisonRow
                key={t}
                label={PERIMETER_LABELS[t as PerimeterType] ?? SKINFOLD_LABELS[t as keyof typeof SKINFOLD_LABELS]}
                first={first.measurements[t]!}
                last={latest.measurements[t]!}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
