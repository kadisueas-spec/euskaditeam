"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Ruler } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import type { EvaluationDetail } from "@/lib/supabase/anthropometrics";
import {
  PERIMETER_LABELS,
  PERIMETER_TYPES,
  SKINFOLD_LABELS,
  type PerimeterType,
} from "@/lib/anthropometrics/constants";
import { formatDate } from "@/lib/utils/format-date";

type ChartPoint = { date: string; label: string; value: number };

function shortDateLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T00:00:00Z`));
}

function trendOf(points: ChartPoint[]) {
  if (points.length === 0) return null;
  const current = points[points.length - 1].value;
  const delta = points.length >= 2 ? current - points[points.length - 2].value : null;
  return { current, delta };
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#f5f5f51a] bg-[#111111] px-3 py-2">
      <p className="text-xs text-[#888888]">{label}</p>
      <p className="font-display text-lg text-[#e8001c]">
        {payload[0].value} {unit}
      </p>
    </div>
  );
}

function EvolutionChart({
  title,
  unit,
  points,
}: {
  title: string;
  unit: string;
  points: ChartPoint[];
}) {
  const trend = trendOf(points);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-white">{title}</p>
        {trend && (
          <p className="flex items-center gap-1 font-display text-2xl leading-none text-[#e8001c]">
            {trend.current}
            <span className="text-xs text-[#888888]"> {unit}</span>
            {trend.delta != null && trend.delta !== 0 && (
              <span className="ml-1 flex items-center text-xs text-[#888888]">
                {trend.delta > 0 ? (
                  <ArrowUp className="size-3" />
                ) : (
                  <ArrowDown className="size-3" />
                )}
                {Math.abs(trend.delta).toFixed(1)}
              </span>
            )}
          </p>
        )}
      </div>
      {points.length < 2 ? (
        <p className="rounded-lg bg-white/5 px-3 py-6 text-center text-sm text-[#888888]">
          Hace falta más de una evaluación para ver la evolución.
        </p>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f51a" />
              <XAxis dataKey="label" stroke="#f5f5f580" fontSize={11} />
              <YAxis stroke="#f5f5f580" fontSize={11} width={36} />
              <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: "#f5f5f51a" }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#c9c9c9"
                strokeWidth={2}
                dot={{ fill: "#e8001c", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#e8001c" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

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
