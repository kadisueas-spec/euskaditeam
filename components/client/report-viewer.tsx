"use client";

import { useEffect, useRef } from "react";
import { ReportPlayer } from "@/components/reports/report-player";
import { markReportCompleted, markReportOpened } from "@/app/client/progress/reports/actions";
import type { ClientReport } from "@/lib/supabase/progress-reports";

// Reporte a pantalla completa para el cliente: marca "abierto" al montar y
// "visto completo" al llegar a la última tarjeta.
export function ReportViewer({ report, onClose }: { report: ClientReport; onClose: () => void }) {
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    markReportOpened(report.id).catch(() => {});
  }, [report.id]);

  return (
    <ReportPlayer
      cards={report.cards}
      title={report.title}
      periodLabel={report.periodLabel}
      variant="fullscreen"
      onClose={onClose}
      onComplete={() => {
        if (!report.completedAt) markReportCompleted(report.id).catch(() => {});
      }}
    />
  );
}
