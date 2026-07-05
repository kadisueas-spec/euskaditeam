"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ClientStats } from "@/lib/supabase/stats";
import { FadeIn } from "@/components/motion/fade-in";

export function StatsCharts({ stats }: { stats: ClientStats }) {
  const [exerciseId, setExerciseId] = useState(
    stats.weightProgress[0]?.exerciseId ?? ""
  );

  const selectedSeries = stats.weightProgress.find(
    (s) => s.exerciseId === exerciseId
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <FadeIn delay={0}>
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
            <p className="text-xs text-[#888888]">Racha actual</p>
            <p className="mt-1 font-display text-4xl text-[#e8001c]">
              {stats.streak}
              <span className="text-lg text-[#888888]">
                {" "}
                día{stats.streak === 1 ? "" : "s"}
              </span>
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
            <p className="text-xs text-[#888888]">Adherencia del mes</p>
            <p className="mt-1 font-display text-4xl text-[#e8001c]">
              {stats.adherencePercent}
              <span className="text-lg text-[#888888]">%</span>
            </p>
          </div>
        </FadeIn>
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-white">Progreso de peso</p>
          {stats.weightProgress.length > 0 && (
            <select
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              className="min-h-[44px] rounded-lg border border-[#1e1e1e] bg-white/5 px-2 text-sm text-white"
            >
              {stats.weightProgress.map((s) => (
                <option key={s.exerciseId} value={s.exerciseId}>
                  {s.exerciseName}
                </option>
              ))}
            </select>
          )}
        </div>
        {selectedSeries ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={selectedSeries.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f51a" />
                <XAxis dataKey="week" stroke="#f5f5f580" fontSize={12} />
                <YAxis stroke="#f5f5f580" fontSize={12} width={32} />
                <Tooltip
                  contentStyle={{
                    background: "#111111",
                    border: "1px solid #f5f5f51a",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "#fff" }}
                />
                <Line
                  type="monotone"
                  dataKey="maxWeight"
                  stroke="#e8001c"
                  strokeWidth={2}
                  connectNulls
                  dot={{ fill: "#e8001c", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-[#888888]">
            Todavía no hay datos de peso registrados.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="mb-3 text-sm font-medium text-white">
          Volumen total por semana
        </p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.weeklyVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f51a" />
              <XAxis dataKey="week" stroke="#f5f5f580" fontSize={12} />
              <YAxis stroke="#f5f5f580" fontSize={12} width={40} />
              <Tooltip
                contentStyle={{
                  background: "#111111",
                  border: "1px solid #f5f5f51a",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#fff" }}
              />
              <Bar dataKey="volume" fill="#e8001c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
