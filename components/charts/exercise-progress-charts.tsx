"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
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
import type { ExerciseSessionSeries } from "@/lib/supabase/metrics";

// Compartido entre coach (client-metrics-tab.tsx) y cliente
// (client-progress-charts.tsx) — mismo par de gráficos "peso máximo" /
// "peso promedio" por ejercicio en las dos vistas (mejora Fase 9, jul-2026).
// A diferencia del resto de los gráficos de esta sección (que agregan por
// bucket semana/mes/bloque), acá el eje X es una sesión real entrenada —
// por eso viene de getExerciseSessionSeries/getMyExerciseSessionSeries, no
// de getClientMetrics/getMyMetrics.

type RangeMode = "total" | "block";
const BLOCK_MS = 28 * 24 * 60 * 60 * 1000; // mesociclo estándar de 4 semanas

function pointsForRange(points: ExerciseSessionSeries["points"], mode: RangeMode) {
  if (mode === "total") return points;
  const cutoff = Date.now() - BLOCK_MS;
  return points.filter((p) => new Date(`${p.date}T00:00:00Z`).getTime() >= cutoff);
}

function ChartTooltip({
  active,
  payload,
  label,
  exerciseName,
  unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  exerciseName: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#f5f5f51a] bg-[#111111] px-3 py-2">
      <p className="text-xs text-[#888888]">{label}</p>
      <p className="text-xs text-white">{exerciseName}</p>
      <p className="font-display text-lg text-[#e8001c]">
        {payload[0].value} {unit}
      </p>
    </div>
  );
}

function SingleMetricChart({
  title,
  dataKey,
  unit,
  points,
  exerciseName,
}: {
  title: string;
  dataKey: "maxWeight" | "avgWeight";
  unit: string;
  points: ExerciseSessionSeries["points"];
  exerciseName: string;
}) {
  const latest = points[points.length - 1];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-white">{title}</p>
        {latest && (
          <p className="font-display text-2xl leading-none text-[#e8001c]">
            {latest[dataKey]}
            <span className="text-xs text-[#888888]"> {unit}</span>
          </p>
        )}
      </div>
      {points.length < 2 ? (
        <p className="rounded-lg bg-white/5 px-3 py-6 text-center text-sm text-[#888888]">
          Seguí entrenando para ver tu evolución.
        </p>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f51a" />
              <XAxis dataKey="label" stroke="#f5f5f580" fontSize={11} />
              <YAxis stroke="#f5f5f580" fontSize={11} width={36} />
              <Tooltip
                content={<ChartTooltip exerciseName={exerciseName} unit={unit} />}
                cursor={{ stroke: "#f5f5f51a" }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
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

export function ExerciseProgressCharts({
  series,
}: {
  series: ExerciseSessionSeries[];
}) {
  const [exerciseId, setExerciseId] = useState(series[0]?.exerciseId ?? "");
  const [rangeMode, setRangeMode] = useState<RangeMode>("total");

  const selected =
    series.find((s) => s.exerciseId === exerciseId) ?? series[0];

  if (!selected) {
    return (
      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="mb-1 text-sm font-medium text-white">
          Peso máximo y promedio por ejercicio
        </p>
        <EmptyState
          icon={TrendingUp}
          title="Todavía no hay series con peso registradas."
          className="py-4"
        />
      </div>
    );
  }

  const points = pointsForRange(selected.points, rangeMode);

  return (
    <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <NativeSelect
          value={selected.exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
          className="min-h-[44px] flex-1"
        >
          {series.map((s) => (
            <option key={s.exerciseId} value={s.exerciseId}>
              {s.exerciseName}
            </option>
          ))}
        </NativeSelect>
        <div className="flex shrink-0 gap-1 rounded-full bg-white/5 p-1">
          {(["total", "block"] as RangeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setRangeMode(mode)}
              className={`min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation rounded-full px-3 text-xs font-semibold tracking-wide uppercase transition-colors ${
                rangeMode === mode
                  ? "bg-[#e8001c] text-white"
                  : "text-[#888888]"
              }`}
            >
              {mode === "total" ? "Total" : "Bloque"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <SingleMetricChart
          title="Peso máximo"
          dataKey="maxWeight"
          unit="kg"
          points={points}
          exerciseName={selected.exerciseName}
        />
        <SingleMetricChart
          title="Peso promedio"
          dataKey="avgWeight"
          unit="kg"
          points={points}
          exerciseName={selected.exerciseName}
        />
      </div>
    </div>
  );
}
