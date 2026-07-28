"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { ExerciseSessionPoint } from "@/lib/supabase/metrics";

// Variante compacta de exercise-progress-charts.tsx: sin ejes, sin
// tooltip, sin selector — solo la forma de la curva, pensada para vivir
// adentro de una card chica dentro del recorrido de Mi Mes. Mismo
// LineChart/Line de Recharts que el resto de los gráficos de la app, no
// una implementación nueva de charting.
export function MiniProgressChart({ points }: { points: ExerciseSessionPoint[] }) {
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <Line
            type="monotone"
            dataKey="maxWeight"
            stroke="#e8001c"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
