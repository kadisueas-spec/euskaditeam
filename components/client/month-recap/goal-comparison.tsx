import { Target } from "lucide-react";
import type { MonthGoalComparison, MonthGoalWeightComparison } from "@/lib/supabase/month-summary";

// Copy sin castigo (jul-2026, pedido explícito): ningún estado suena a
// fracaso, ni siquiera "missed" — ese caso no inventa una distancia a un
// objetivo numérico que no existe en la base (monthly_goals.weight_kg es
// el peso de arranque, no un target), solo reconoce que el peso no se
// movió como buscaba y lo deja abierto al mes que viene.
function weightMessage(w: MonthGoalWeightComparison): string {
  const abs = Math.abs(w.diffKg).toLocaleString("es-AR", { maximumFractionDigits: 1 });
  const verb = w.diffKg < 0 ? "Bajaste" : w.diffKg > 0 ? "Subiste" : "Te mantuviste";
  if (w.status === "met") return `${verb} ${abs}kg este mes. Así se hace.`;
  if (w.status === "close") return `${verb} ${abs}kg — vas en la dirección correcta.`;
  return "Este mes el peso no se movió como buscabas. El mes que viene lo retomás.";
}

const STATUS_STYLE: Record<MonthGoalWeightComparison["status"], { label: string; className: string }> = {
  met: { label: "Cumplido", className: "bg-[#e8001c]/15 text-[#e8001c]" },
  close: { label: "Cerca", className: "bg-white/10 text-[#f5f5f5]" },
  missed: { label: "En camino", className: "bg-white/5 text-[#888888]" },
};

// Solo se monta si el cliente cargó objetivo mensual (chequeado en el
// orquestador). weightComparison puede venir null igual (objetivo sin
// dirección de peso clara, o sin peso final registrado ese mes) — en ese
// caso se muestra el objetivo/motivación/nota igual, sin la comparación.
export function MonthRecapGoal({ goal }: { goal: MonthGoalComparison }) {
  const statusStyle = goal.weightComparison ? STATUS_STYLE[goal.weightComparison.status] : null;

  return (
    <div className="flex flex-col gap-4 py-10">
      <p className="text-center font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
        Tu objetivo del mes
      </p>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <div className="flex items-start gap-3">
          <Target className="mt-0.5 size-5 shrink-0 text-[#e8001c]" />
          <p className="text-sm text-white">{goal.mainGoal}</p>
        </div>

        {goal.weightComparison && statusStyle && (
          <div className="flex flex-col gap-2 border-t border-[#1e1e1e] pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-[#888888]">
                {goal.weightComparison.startWeightKg.toLocaleString("es-AR", {
                  maximumFractionDigits: 1,
                })}
                kg{" → "}
                {goal.weightComparison.endWeightKg.toLocaleString("es-AR", {
                  maximumFractionDigits: 1,
                })}
                kg
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle.className}`}
              >
                {statusStyle.label}
              </span>
            </div>
            <p className="text-sm text-white">{weightMessage(goal.weightComparison)}</p>
          </div>
        )}

        {goal.motivationLevel != null && (
          <p className="border-t border-[#1e1e1e] pt-3 text-sm text-[#888888]">
            Motivación al arrancar el mes:{" "}
            <span className="font-semibold text-white">{goal.motivationLevel}/5</span>
          </p>
        )}

        {goal.improveNote && (
          <p className="border-t border-[#1e1e1e] pt-3 text-sm text-[#888888]">
            Querías mejorar: <span className="text-white">{goal.improveNote}</span>
          </p>
        )}
      </div>
    </div>
  );
}
