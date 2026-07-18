"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortDateLabel, trendOf, type ChartPoint } from "@/lib/utils/chart-points";

// Extraído de BodyTab (vista del cliente) para reusarlo tal cual en el
// análisis antropométrico del coach (`/coach/clients/[id]` → Evaluaciones)
// — mismo componente, misma estética, en vez de duplicar el chart.
// shortDateLabel/trendOf/ChartPoint viven en lib/utils/chart-points.ts (sin
// "use client") y se re-exportan acá para no romper los imports existentes
// — ver el comentario en ese archivo para el porqué.
export { shortDateLabel, trendOf, type ChartPoint };

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

export function EvolutionChart({
  title,
  unit,
  points,
  emptyMessage = "Hace falta más de una evaluación para ver la evolución.",
}: {
  title: string;
  unit: string;
  points: ChartPoint[];
  emptyMessage?: string;
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
          {emptyMessage}
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
