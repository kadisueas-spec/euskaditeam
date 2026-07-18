import { Scale } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { EvolutionChart } from "@/components/charts/evaluation-evolution-chart";
import { shortDateLabel, type ChartPoint } from "@/lib/utils/chart-points";
import type { WeightLogEntry } from "@/lib/supabase/weight-logs";

// Solo lectura — el coach ve el peso diario que el cliente se autorregistra
// (RLS "Coach views weight logs of own clients" es solo SELECT, no hay
// ningún action de escritura acá), como complemento a las evaluaciones
// antropométricas formales. Independiente de si hay evaluaciones o no: un
// cliente puede estar pesándose todos los días sin tener aún ninguna
// evaluación formal cargada por el coach.
//
// Este es un Server Component (sin "use client") — shortDateLabel se
// importa de lib/utils/chart-points.ts, NO de evaluation-evolution-chart.tsx
// (que tiene "use client"): llamar una función exportada de un archivo
// "use client" directamente desde código de servidor (no como JSX) tira
// "Attempted to call X() from the server but X is on the client" — el bug
// real que causaba el error boundary acá.
export function ClientWeightChart({ logs }: { logs: WeightLogEntry[] }) {
  const points: ChartPoint[] = logs.map((l) => ({
    date: l.date,
    label: shortDateLabel(l.date),
    value: l.weightKg,
  }));

  return (
    <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
      <p className="mb-3 text-xs text-[#888888]">
        Peso diario auto-registrado por el cliente
      </p>
      {logs.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="El cliente todavía no registró su peso diario."
          className="py-4"
        />
      ) : (
        <EvolutionChart
          title="Peso corporal"
          unit="kg"
          points={points}
          emptyMessage="El cliente todavía no registró suficientes pesajes para ver la evolución."
        />
      )}
    </div>
  );
}
