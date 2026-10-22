import Link from "next/link";
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/motion/fade-in";
import { getClientReports } from "@/lib/supabase/progress-reports";

// Historial de reportes de progreso del cliente (oct-2026). Reemplaza a
// Mi Mes: el resumen del mes ahora es el reporte mensual.
export default async function ClientReportsPage() {
  const reports = await getClientReports();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/client/progress"
        className="-ml-2 flex min-h-[44px] w-fit items-center gap-1.5 px-2 text-sm text-[#888888] active:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden /> Progreso
      </Link>
      <div>
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">Mis reportes</h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Todavía no tenés reportes."
          description="Tu coach te manda el resumen de cada semana y de cada mes. Van a aparecer acá."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r, i) => (
            <FadeIn key={r.id} delay={Math.min(i * 0.04, 0.3)}>
              <Link
                href={`/client/progress/reports/${r.id}`}
                className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4 active:bg-white/5"
              >
                <div>
                  <p className="font-display text-xl tracking-wide text-white uppercase">{r.title}</p>
                  <p className="text-sm text-[#888888]">{r.periodLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!r.completedAt && (
                    <span className="rounded-full bg-[#e8001c] px-2 py-0.5 text-xs font-bold text-[#080808]">
                      Nuevo
                    </span>
                  )}
                  <ChevronRight className="size-5 text-[#888888]" aria-hidden />
                </div>
              </Link>
            </FadeIn>
          ))}
        </ul>
      )}
    </div>
  );
}
