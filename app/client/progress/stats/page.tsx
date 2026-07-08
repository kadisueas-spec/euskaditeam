import { getClientStats } from "@/lib/supabase/stats";
import { getMyMetrics } from "@/lib/supabase/metrics";
import { StatsCharts } from "@/components/client/stats-charts";
import { MetricsSummary } from "@/components/client/metrics-summary";

export default async function ProgressStatsPage() {
  const [stats, metricsWeek, metricsMonth, metricsBlock] = await Promise.all([
    getClientStats(),
    getMyMetrics("week"),
    getMyMetrics("month"),
    getMyMetrics("block"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          Estadísticas
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>
      <StatsCharts stats={stats} />

      {metricsWeek && metricsMonth && metricsBlock && (
        <>
          <div>
            <h2 className="font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
              Volumen e intensidad
            </h2>
            <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
          </div>
          <MetricsSummary
            metricsByRange={{ week: metricsWeek, month: metricsMonth, block: metricsBlock }}
          />
        </>
      )}
    </div>
  );
}
