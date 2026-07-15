import { ArrowDown, ArrowUp } from "lucide-react";

// Card de una métrica con delta vs. la evaluación anterior — neutral (sin
// rojo/verde semántico "bien/mal", ya que subir o bajar puede ser el
// objetivo según el cliente). El rojo de marca queda reservado como
// acento, no como indicador de bueno/malo acá.
export function DiffStat({
  label,
  value,
  unit,
  previousValue,
  decimals = 1,
}: {
  label: string;
  value: number;
  unit: string;
  previousValue?: number | null;
  decimals?: number;
}) {
  const delta =
    previousValue != null ? Math.round((value - previousValue) * 10 ** decimals) / 10 ** decimals : null;

  return (
    <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-3">
      <p className="font-display text-2xl text-[#e8001c]">
        {value.toFixed(decimals)}
        <span className="ml-1 text-sm text-[#888888]">{unit}</span>
      </p>
      <p className="text-xs text-[#888888] uppercase">{label}</p>
      {delta != null && delta !== 0 && (
        <p className="mt-1 flex items-center gap-1 text-xs text-[#f5f5f5]">
          {delta > 0 ? (
            <ArrowUp className="size-3 shrink-0" />
          ) : (
            <ArrowDown className="size-3 shrink-0" />
          )}
          {Math.abs(delta).toFixed(decimals)} {unit} vs. anterior
        </p>
      )}
    </div>
  );
}
