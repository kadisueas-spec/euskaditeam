import Link from "next/link";
import { AlertTriangle, ChevronRight, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/motion/fade-in";
import { getCoachReports } from "@/lib/supabase/progress-reports";
import type { CoachReportListItem } from "@/lib/supabase/progress-reports";
import { whenLabel } from "@/lib/reports/format";
import { getClientsForSelect } from "@/lib/supabase/routines";
import { latestClosedPeriod } from "@/lib/reports/schedule";
import { reportPeriodLabel } from "@/lib/supabase/progress-reports";
import { GenerateNow } from "./generate-now";
import { todayInParaguay } from "@/lib/utils/today";

// Bandeja de reportes de progreso (oct-2026): todo borrador pasa por acá
// antes de llegar al cliente. Nada se envía solo.

const KIND_LABEL = { weekly: "Semanal", monthly: "Mensual", custom: "Progreso" } as const;

function Row({ r }: { r: CoachReportListItem }) {
  let status: string;
  if (r.status === "scheduled" && r.scheduledFor) status = `Se envía el ${whenLabel(r.scheduledFor)}`;
  else if (r.status === "sent")
    status = r.completedAt ? "Lo vio completo" : r.openedAt ? "Lo abrió, no lo terminó" : "Enviado, sin abrir";
  else status = "Para revisar";

  return (
    <Link
      href={`/coach/reports/${r.id}`}
      className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4 hover:border-[#2a2a2a] active:bg-white/5"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-white">{r.clientName}</p>
        <p className="text-sm text-[#888888]">
          {KIND_LABEL[r.kind]} · {r.periodLabel} · {status}
        </p>
        {r.status !== "sent" && r.missingMonthMessage && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[#f5c542]">
            <AlertTriangle className="size-4" aria-hidden /> Falta tu mensaje de cierre de mes
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {r.status !== "sent" && r.noticesCount > 0 && (
          <span className="rounded-full bg-[#f5c542]/15 px-2 py-0.5 text-xs font-bold text-[#f5c542]">
            {r.noticesCount} {r.noticesCount === 1 ? "aviso" : "avisos"}
          </span>
        )}
        <ChevronRight className="size-5 text-[#888888]" aria-hidden />
      </div>
    </Link>
  );
}

function Section({ title, items }: { title: string; items: CoachReportListItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-white">
        {title} <span className="text-[#888888]">({items.length})</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((r, i) => (
          <FadeIn key={r.id} delay={Math.min(i * 0.03, 0.3)}>
            <li>
              <Row r={r} />
            </li>
          </FadeIn>
        ))}
      </ul>
    </section>
  );
}

export default async function CoachReportsPage() {
  const [reports, clients] = await Promise.all([getCoachReports(), getClientsForSelect()]);
  const weekly = latestClosedPeriod("weekly");
  const monthly = latestClosedPeriod("monthly");
  const periodLabels = {
    weekly: reportPeriodLabel("weekly", weekly.start, weekly.end),
    monthly: reportPeriodLabel("monthly", monthly.start, monthly.end),
  };
  const drafts = reports.filter((r) => r.status === "draft");
  const scheduled = reports.filter((r) => r.status === "scheduled");
  const sent = reports.filter((r) => r.status === "sent");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">Reportes</h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
        <p className="mt-3 max-w-prose text-sm text-[#888888]">
          Los borradores semanales se arman el sábado a la mañana y los mensuales el día 1. Ninguno le llega al
          cliente hasta que lo envíes o lo programes.
        </p>
      </div>

      <GenerateNow
        clients={clients.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name))}
        periodLabels={periodLabels}
        today={todayInParaguay()}
      />

      {reports.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Todavía no hay reportes."
          description="El primer borrador semanal aparece acá el sábado a la mañana."
        />
      ) : (
        <>
          <Section title="Para revisar" items={drafts} />
          <Section title="Programados" items={scheduled} />
          <Section title="Enviados" items={sent} />
        </>
      )}
    </div>
  );
}
