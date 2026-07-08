"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ClientMetrics, MetricsRange } from "@/lib/supabase/metrics";

const RANGE_LABEL: Record<MetricsRange, string> = {
  week: "Semana",
  month: "Mes",
  block: "Bloque",
};

const RANGES: MetricsRange[] = ["week", "month", "block"];

const tooltipProps = {
  contentStyle: { background: "#111111", border: "1px solid #f5f5f51a", borderRadius: 8 },
  labelStyle: { color: "#fff" },
};

// Fase 8: versión resumida para el cliente — sin desglose ejercicio por
// ejercicio (eso queda para la vista del coach en /coach/clients/[id]).
export function MetricsSummary({
  metricsByRange,
}: {
  metricsByRange: Record<MetricsRange, ClientMetrics>;
}) {
  const [range, setRange] = useState<MetricsRange>("week");
  const metrics = metricsByRange[range];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`min-h-[36px] flex-1 rounded-full text-xs font-semibold tracking-wide uppercase transition-colors ${
              range === r ? "bg-[#e8001c] text-white" : "bg-white/5 text-[#888888]"
            }`}
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="text-xs text-[#888888]">Tonelaje total</p>
        <p className="mt-1 font-display text-4xl text-[#e8001c]">
          {metrics.totalTonnage.toLocaleString("es-AR")}
          <span className="text-lg text-[#888888]"> kg</span>
        </p>
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="mb-3 text-sm font-medium text-white">Tonelaje por grupo muscular</p>
        {metrics.muscleGroupTotals.length === 0 ? (
          <p className="text-sm text-[#888888]">Sin datos en este período.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {metrics.muscleGroupTotals.map((mg) => (
              <li key={mg.muscleGroup} className="flex items-center justify-between text-sm">
                <span className="text-[#888888]">{mg.muscleGroup}</span>
                <span className="font-mono text-white">
                  {mg.tonnage.toLocaleString("es-AR")} kg
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="mb-3 text-sm font-medium text-white">
          Distribución de intensidad (RIR)
        </p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.rirDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f51a" />
              <XAxis dataKey="bucket" stroke="#f5f5f580" fontSize={11} />
              <YAxis stroke="#f5f5f580" fontSize={11} width={32} unit="%" />
              <Tooltip {...tooltipProps} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="rir3" stackId="rir" name="RIR 3+" fill="#555555" />
              <Bar dataKey="rir2" stackId="rir" name="RIR 2" fill="#888888" />
              <Bar dataKey="rir1" stackId="rir" name="RIR 1" fill="#ff4d4d" />
              <Bar dataKey="rir0" stackId="rir" name="RIR 0 / Fallo" fill="#e8001c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
