import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCoachReport } from "@/lib/supabase/progress-reports";
import { ReportReview } from "./report-review";
import { todayInParaguay } from "@/lib/utils/today";

export default async function CoachReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getCoachReport(id);
  if (!report) notFound();

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/coach/reports"
        className="-ml-2 flex min-h-[44px] w-fit items-center gap-1.5 px-2 text-sm text-[#888888] hover:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden /> Reportes
      </Link>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">{report.clientName}</h1>
        <p className="mt-1 text-sm text-[#888888]">
          {report.kind === "weekly" ? "Reporte semanal" : report.kind === "monthly" ? "Reporte mensual" : "Reporte de período libre"} · {report.periodLabel}
        </p>
      </div>
      <ReportReview report={report} today={todayInParaguay()} />
    </div>
  );
}
