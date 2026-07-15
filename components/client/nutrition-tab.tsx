import { Download, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { NutritionPlan } from "@/lib/supabase/nutrition";
import { formatDate } from "@/lib/utils/format-date";

function PlanVigencia({ plan }: { plan: NutritionPlan }) {
  if (!plan.validFrom && !plan.validUntil) return null;
  return (
    <p className="text-sm text-[#888888]">
      {plan.validFrom ? formatDate(plan.validFrom) : "?"} —{" "}
      {plan.validUntil ? formatDate(plan.validUntil) : "?"}
    </p>
  );
}

export function NutritionClientTab({ plans }: { plans: NutritionPlan[] }) {
  const activePlan = plans.find((p) => p.status === "active");
  const archivedPlans = plans.filter((p) => p.status !== "active");

  if (plans.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Tu coach está preparando tu plan de alimentación."
        description="En cuanto lo suba, lo vas a ver acá."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {activePlan && (
        <div className="flex flex-col gap-4 rounded-2xl border border-[#e8001c]/30 bg-[#e8001c]/5 p-5">
          <div>
            <p className="text-xs font-semibold tracking-widest text-[#e8001c] uppercase">
              Mi plan de alimentación
            </p>
            <h2 className="mt-1 font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
              {activePlan.name}
            </h2>
            <PlanVigencia plan={activePlan} />
          </div>
          {activePlan.downloadUrl && (
            <a
              href={activePlan.downloadUrl}
              download={activePlan.fileName}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#e8001c] px-4 font-display text-lg tracking-widest text-white uppercase active:bg-[#b8001a]"
            >
              <Download className="size-5" />
              Descargar PDF
            </a>
          )}
        </div>
      )}

      {archivedPlans.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-white">Planes anteriores</p>
          <ul className="flex flex-col gap-2">
            {archivedPlans.map((plan) => (
              <li
                key={plan.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4"
              >
                <div className="flex items-center gap-2">
                  <FileText className="size-4 shrink-0 text-[#888888]" />
                  <div>
                    <p className="text-sm font-medium text-white">{plan.name}</p>
                    <PlanVigencia plan={plan} />
                  </div>
                </div>
                {plan.downloadUrl && (
                  <a
                    href={plan.downloadUrl}
                    download={plan.fileName}
                    aria-label={`Descargar ${plan.name}`}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg bg-white/5 text-white active:bg-white/10"
                  >
                    <Download className="size-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
