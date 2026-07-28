import { ArrowDown, ArrowUp } from "lucide-react";
import type { MonthNumberComparison, MonthSummaryNumbers } from "@/lib/supabase/month-summary";

function ComparisonBadge({
  comparison,
  previousMonthLabel,
}: {
  comparison: MonthNumberComparison;
  previousMonthLabel: string | null;
}) {
  if (!comparison || !previousMonthLabel) return null;
  const Icon = comparison.direction === "up" ? ArrowUp : ArrowDown;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[#888888]">
      <Icon
        className={`size-3 ${comparison.direction === "up" ? "text-[#e8001c]" : "text-[#888888]"}`}
      />
      {comparison.diffPercent}% vs {previousMonthLabel}
    </p>
  );
}

function StatCard({
  label,
  value,
  suffix,
  comparison,
  previousMonthLabel,
}: {
  label: string;
  value: string;
  suffix?: string;
  comparison: MonthNumberComparison;
  previousMonthLabel: string | null;
}) {
  return (
    <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
      <p className="text-xs text-[#888888] uppercase">{label}</p>
      <p className="mt-1 font-display text-4xl text-[#e8001c]">
        {value}
        {suffix && <span className="text-lg text-[#888888]">{suffix}</span>}
      </p>
      <ComparisonBadge comparison={comparison} previousMonthLabel={previousMonthLabel} />
    </div>
  );
}

export function MonthRecapNumbers({ numbers }: { numbers: MonthSummaryNumbers }) {
  return (
    <div className="flex flex-col gap-4 py-10">
      <p className="text-center font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
        Los números del mes
      </p>
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Entrenamientos"
          value={`${numbers.trainedDays}`}
          suffix={`/${numbers.plannedDays}`}
          comparison={numbers.vsTrainedDays}
          previousMonthLabel={numbers.previousMonthLabel}
        />
        <StatCard
          label="Adherencia"
          value={`${numbers.adherencePercent}`}
          suffix="%"
          comparison={numbers.vsAdherencePercent}
          previousMonthLabel={numbers.previousMonthLabel}
        />
        <StatCard
          label="Series totales"
          value={`${numbers.totalSets}`}
          comparison={numbers.vsTotalSets}
          previousMonthLabel={numbers.previousMonthLabel}
        />
        <StatCard
          label="Volumen"
          value={numbers.totalVolume.toLocaleString("es-AR")}
          suffix=" kg"
          comparison={numbers.vsTotalVolume}
          previousMonthLabel={numbers.previousMonthLabel}
        />
      </div>
    </div>
  );
}
