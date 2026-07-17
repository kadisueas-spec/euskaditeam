import Link from "next/link";
import { Plus, Ruler } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/motion/fade-in";
import { ClientBodyAnalysis } from "@/components/coach/client-body-analysis";
import type { EvaluationDetail, EvaluationListItem } from "@/lib/supabase/anthropometrics";
import { PROTOCOL_LABELS } from "@/lib/anthropometrics/constants";
import { formatDate } from "@/lib/utils/format-date";

export function EvaluationsTab({
  clientId,
  evaluations,
  bodyEvaluations,
}: {
  clientId: string;
  evaluations: EvaluationListItem[];
  bodyEvaluations: EvaluationDetail[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/coach/clients/${clientId}/evaluations/new`}
        className={buttonVariants({ variant: "default", className: "min-h-[44px] w-full" })}
      >
        <Plus className="size-4" />
        Nueva evaluación
      </Link>

      {evaluations.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="Todavía no hay evaluaciones cargadas."
          description="Creá la primera para empezar a trackear el progreso."
        />
      ) : (
        <>
          <ClientBodyAnalysis evaluations={bodyEvaluations} />

          <p className="text-sm font-medium text-white">Todas las evaluaciones</p>

          <ul className="flex flex-col gap-3">
            {evaluations.map((ev, i) => (
              <FadeIn key={ev.id} delay={Math.min(i * 0.05, 0.4)}>
                <Link
                  href={`/coach/clients/${clientId}/evaluations/${ev.id}`}
                  className="flex min-h-[44px] items-center justify-between rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4 transition-colors duration-200 hover:border-[#e8001c]"
                >
                  <div>
                    <p className="font-medium text-white">{formatDate(ev.evaluationDate)}</p>
                    <p className="text-sm text-[#888888]">{PROTOCOL_LABELS[ev.protocol]}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl text-[#e8001c]">
                      {ev.bodyFatPercentage != null ? `${ev.bodyFatPercentage.toFixed(1)}%` : "—"}
                    </p>
                    <p className="text-xs text-[#888888]">{ev.weightKg} kg</p>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
