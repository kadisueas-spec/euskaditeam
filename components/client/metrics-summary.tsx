"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

// Mejora Fase 9 (jul-2026): el tonelaje total y por grupo muscular salieron
// de acá (ver components/client/stats-charts.tsx) — es info que el coach
// interpreta, no el cliente. Queda solo la distribución de RIR, ahora en
// líneas en vez de barras apiladas.
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
        <p className="mb-3 text-sm font-medium text-white">
          Distribución de intensidad (RIR)
        </p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics.rirDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f51a" />
              <XAxis dataKey="bucket" stroke="#f5f5f580" fontSize={11} />
              <YAxis stroke="#f5f5f580" fontSize={11} width={32} unit="%" />
              <Tooltip {...tooltipProps} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="rir3" name="RIR 3+" stroke="#555555" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="rir2" name="RIR 2" stroke="#888888" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="rir1" name="RIR 1" stroke="#ff4d4d" strokeWidth={2} dot={{ r: 3 }} />
              <Line
                type="monotone"
                dataKey="rir0"
                name="RIR 0 / Fallo"
                stroke="#e8001c"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
