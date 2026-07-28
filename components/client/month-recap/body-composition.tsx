import type { MonthBodyComposition } from "@/lib/supabase/month-summary";

function formatDiff(n: number, unit: string): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })}${unit}`;
}

function Row({
  label,
  first,
  last,
  diff,
  unit,
}: {
  label: string;
  first: number;
  last: number;
  diff: number;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#1e1e1e] py-2.5 last:border-0">
      <span className="text-sm text-[#888888]">{label}</span>
      <span className="text-sm text-white">
        {first.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
        {unit} → {last.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
        {unit}{" "}
        <span className="font-semibold text-[#e8001c]">{formatDiff(diff, unit)}</span>
      </span>
    </div>
  );
}

// Solo se monta si hubo evaluaciones antropométricas este mes (chequeado
// en el orquestador) — comparación primera vs última evaluación del mes.
export function MonthRecapBodyComposition({ data }: { data: MonthBodyComposition }) {
  return (
    <div className="flex flex-col gap-4 py-10">
      <p className="text-center font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
        Composición corporal
      </p>
      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] px-4">
        <Row
          label="Peso"
          first={data.weightKg.first}
          last={data.weightKg.last}
          diff={data.weightKg.diff}
          unit="kg"
        />
        {data.bodyFatPercentage && (
          <Row
            label="% Grasa"
            first={data.bodyFatPercentage.first}
            last={data.bodyFatPercentage.last}
            diff={data.bodyFatPercentage.diff}
            unit="%"
          />
        )}
        {data.muscleMassKg && (
          <Row
            label="Masa muscular"
            first={data.muscleMassKg.first}
            last={data.muscleMassKg.last}
            diff={data.muscleMassKg.diff}
            unit="kg"
          />
        )}
      </div>
    </div>
  );
}
