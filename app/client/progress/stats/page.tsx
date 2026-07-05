import { getClientStats } from "@/lib/supabase/stats";
import { StatsCharts } from "@/components/client/stats-charts";

export default async function ProgressStatsPage() {
  const stats = await getClientStats();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          Estadísticas
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>
      <StatsCharts stats={stats} />
    </div>
  );
}
