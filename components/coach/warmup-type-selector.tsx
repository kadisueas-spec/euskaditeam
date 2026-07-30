import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeDecimalInput } from "@/lib/utils/decimal-input";

type WarmupTypeValue = "none" | "percentage_with_kg" | "percentage_of_max" | "fixed_weight";

// Nombres pensados para la decisión del coach, no para el mecanismo interno
// (ago-2026, reemplaza el dropdown "Porcentaje con kilos / Porcentaje del
// máximo" — no se distinguían entre sí de un vistazo). Cada opción dice para
// quién es: eso es lo que ayuda a elegir, no la mecánica de cálculo.
const WARMUP_OPTIONS: Array<{
  value: WarmupTypeValue;
  title: string;
  detail: string | null;
  hint: string | null;
  audience: string | null;
}> = [
  { value: "none", title: "Sin calentamiento", detail: null, hint: null, audience: null },
  {
    value: "percentage_with_kg",
    title: "Guiado — le muestro los kilos",
    detail: "3 series: 50% × 5, 70% × 3, 90% × 1",
    hint: "La app calcula los kilos desde su peso objetivo.",
    audience: "Para la mayoría de los clientes.",
  },
  {
    value: "percentage_of_max",
    title: "Autorregulado — sin kilos",
    detail: "3 series: 50% × 5, 70% × 3, 90% × 1 de su máximo",
    hint: "El cliente estima el peso solo.",
    audience: "Para gente con experiencia.",
  },
  {
    value: "fixed_weight",
    title: "Peso fijo — lo defino yo",
    detail: "3 series × 8 repeticiones con el peso que cargue.",
    hint: null,
    audience: "Para principiantes o casos puntuales.",
  },
];

export function WarmupTypeSelector({
  groupId,
  value,
  fixedWeightKg,
  onChange,
  onFixedWeightChange,
  isFirstOfDay,
}: {
  groupId: string;
  value: WarmupTypeValue;
  fixedWeightKg: string;
  onChange: (value: WarmupTypeValue) => void;
  onFixedWeightChange: (value: string) => void;
  isFirstOfDay: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">Calentamiento</Label>

      {isFirstOfDay && (
        <p className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-[#888888]">
          <Info className="mt-0.5 size-3.5 shrink-0 text-[#e8001c]" />
          Este es el primer ejercicio del día. El calentamiento se muestra
          antes de empezar la sesión.
        </p>
      )}

      <div role="radiogroup" aria-label="Tipo de calentamiento" className="flex flex-col gap-2">
        {WARMUP_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          const inputId = `${groupId}-${opt.value}`;
          return (
            <div key={opt.value}>
              <input
                type="radio"
                id={inputId}
                name={`warmup-${groupId}`}
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              <label
                htmlFor={inputId}
                className={`flex min-h-[44px] cursor-pointer flex-col gap-1.5 rounded-2xl border p-3 transition-colors duration-150 ${
                  selected
                    ? "border-[#e8001c] bg-[#e8001c]/5"
                    : "border-[#1e1e1e] bg-white/[0.02] hover:border-[#2a2a2a]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                      selected ? "border-[#e8001c]" : "border-[#2a2a2a]"
                    }`}
                  >
                    <span
                      className={`size-2 rounded-full bg-[#e8001c] transition-transform duration-150 ${
                        selected ? "scale-100" : "scale-0"
                      }`}
                    />
                  </span>
                  <span className="text-sm font-medium text-white">{opt.title}</span>
                </span>
                {(opt.detail || opt.hint || opt.audience) && (
                  <div className="flex flex-col gap-0.5 pl-[26px]">
                    {opt.detail && <p className="text-xs text-[#c9c9c9]">{opt.detail}</p>}
                    {opt.hint && <p className="text-xs text-[#888888]">{opt.hint}</p>}
                    {opt.audience && (
                      <p className="text-xs text-[#888888] italic">{opt.audience}</p>
                    )}
                  </div>
                )}
              </label>
              {opt.value === "fixed_weight" && selected && (
                <div className="mt-2 pl-[26px]">
                  <Label className="text-xs">Peso del calentamiento (kg)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="20"
                    value={fixedWeightKg}
                    onChange={(e) => onFixedWeightChange(sanitizeDecimalInput(e.target.value))}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
