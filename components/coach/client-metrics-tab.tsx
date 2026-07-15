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
import { ExerciseProgressCharts } from "@/components/charts/exercise-progress-charts";
import type { ClientMetrics, ExerciseSessionSeries, MetricsRange } from "@/lib/supabase/metrics";

const RANGE_LABEL: Record<MetricsRange, string> = {
  week: "Semana",
  month: "Mes",
  block: "Bloque",
};

const RANGES: MetricsRange[] = ["week", "month", "block"];

const MUSCLE_GROUP_COLORS = [
  "#e8001c",
  "#f5f5f5",
  "#888888",
  "#ff4d4d",
  "#555555",
  "#c0392b",
  "#aaaaaa",
  "#ff8080",
  "#333333",
  "#ff1a1a",
];

const tooltipProps = {
  contentStyle: { background: "#111111", border: "1px solid #f5f5f51a", borderRadius: 8 },
  labelStyle: { color: "#fff" },
};

// Fase 9: pensado para que el coach evalúe el progreso del cliente a fin
// de mes. Las tres granularidades ya vienen calculadas desde el server (ver
// lib/supabase/metrics.ts) — acá solo se elige cuál mostrar, sin refetch.
export function ClientMetricsTab({
  metricsByRange,
  sessionSeries,
}: {
  metricsByRange: Record<MetricsRange, ClientMetrics>;
  sessionSeries: ExerciseSessionSeries[];
}) {
  const [range, setRange] = useState<MetricsRange>("week");
  const metrics = metricsByRange[range];

  const [exerciseId, setExerciseId] = useState(metrics.exerciseTotals[0]?.exerciseId ?? "");
  const exerciseOptions = metrics.exerciseTotals;
  const selectedExerciseId = exerciseOptions.some((e) => e.exerciseId === exerciseId)
    ? exerciseId
    : (exerciseOptions[0]?.exerciseId ?? "");

  const tonnageSeries = metrics.exerciseTonnageOverTime.find(
    (s) => s.exerciseId === selectedExerciseId
  );
  const loadSeries = metrics.exerciseLoadOverTime.find(
    (s) => s.exerciseId === selectedExerciseId
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`min-h-[44px] min-w-[44px] flex-1 cursor-pointer touch-manipulation rounded-full text-xs font-semibold tracking-wide uppercase transition-colors ${
              range === r ? "bg-[#e8001c] text-white" : "bg-white/5 text-[#888888]"
            }`}
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-xs text-[#888888]">Tonelaje total</p>
          <p className="mt-1 font-display text-3xl text-[#e8001c]">
            {metrics.totalTonnage.toLocaleString("es-AR")}
            <span className="text-sm text-[#888888]"> kg</span>
          </p>
        </div>
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-xs text-[#888888]">Series efectivas</p>
          <p className="mt-1 font-display text-3xl text-[#e8001c]">{metrics.totalSets}</p>
        </div>
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
                  {mg.tonnage.toLocaleString("es-AR")} kg · {mg.sets} series
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="mb-3 text-sm font-medium text-white">
          Evolución de tonelaje por grupo muscular
        </p>
        {metrics.muscleGroupTonnageOverTime.muscleGroups.length === 0 ? (
          <p className="text-sm text-[#888888]">Sin datos en este período.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.muscleGroupTonnageOverTime.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f51a" />
                <XAxis dataKey="label" stroke="#f5f5f580" fontSize={11} />
                <YAxis stroke="#f5f5f580" fontSize={11} width={36} />
                <Tooltip {...tooltipProps} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {metrics.muscleGroupTonnageOverTime.muscleGroups.map((mg, i) => (
                  <Line
                    key={mg}
                    type="monotone"
                    dataKey={mg}
                    stroke={MUSCLE_GROUP_COLORS[i % MUSCLE_GROUP_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-white">Por ejercicio</p>
          {exerciseOptions.length > 0 && (
            <select
              value={selectedExerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              className="min-h-[36px] rounded-lg border border-[#1e1e1e] bg-white/5 px-2 text-xs text-white"
            >
              {exerciseOptions.map((ex) => (
                <option key={ex.exerciseId} value={ex.exerciseId}>
                  {ex.exerciseName}
                </option>
              ))}
            </select>
          )}
        </div>

        {tonnageSeries ? (
          <>
            <p className="mb-1 text-xs text-[#888888]">Tonelaje</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tonnageSeries.points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f51a" />
                  <XAxis dataKey="label" stroke="#f5f5f580" fontSize={11} />
                  <YAxis stroke="#f5f5f580" fontSize={11} width={36} />
                  <Tooltip {...tooltipProps} />
                  <Line
                    type="monotone"
                    dataKey="tonnage"
                    stroke="#c9c9c9"
                    strokeWidth={2}
                    dot={{ fill: "#e8001c", r: 3 }}
                    activeDot={{ r: 5, fill: "#e8001c" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-4 mb-1 text-xs text-[#888888]">Carga máxima</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={loadSeries?.points ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f51a" />
                  <XAxis dataKey="label" stroke="#f5f5f580" fontSize={11} />
                  <YAxis stroke="#f5f5f580" fontSize={11} width={36} />
                  <Tooltip {...tooltipProps} />
                  <Line
                    type="monotone"
                    dataKey="maxWeight"
                    stroke="#c9c9c9"
                    strokeWidth={2}
                    connectNulls
                    dot={{ fill: "#e8001c", r: 3 }}
                    activeDot={{ r: 5, fill: "#e8001c" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="text-sm text-[#888888]">Sin datos de ejercicios en este período.</p>
        )}
      </div>

      <ExerciseProgressCharts series={sessionSeries} />

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="mb-3 text-sm font-medium text-white">
          Distribución de intensidad (RIR)
        </p>
        <div className="h-52">
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

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="mb-3 text-sm font-medium text-white">
          Volumen por sesión (series totales)
        </p>
        {metrics.sessionVolume.length === 0 ? (
          <p className="text-sm text-[#888888]">Sin sesiones en este período.</p>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.sessionVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f51a" />
                <XAxis dataKey="label" stroke="#f5f5f580" fontSize={11} />
                <YAxis stroke="#f5f5f580" fontSize={11} width={40} />
                <Tooltip {...tooltipProps} />
                <Line
                  type="monotone"
                  dataKey="totalSets"
                  stroke="#c9c9c9"
                  strokeWidth={2}
                  dot={{ fill: "#e8001c", r: 3 }}
                  activeDot={{ r: 5, fill: "#e8001c" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
