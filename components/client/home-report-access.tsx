"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";
import { ReportViewer } from "@/components/client/report-viewer";
import type { ClientReport } from "@/lib/supabase/progress-reports";

// Acceso destacado arriba de todo en Inicio (oct-2026): el reporte enviado
// que el cliente todavía no vio hasta el final. Se abre solo si llegó desde
// la push (?report=<id>); si lo cierra antes de terminar, el acceso queda
// hasta que lo vea completo.
export function HomeReportAccess({ report, autoOpen }: { report: ClientReport; autoOpen: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const router = useRouter();

  function close() {
    setOpen(false);
    // Saca ?report= de la URL (si no, volver atrás lo reabre).
    router.replace("/client/home");
    router.refresh();
  }

  const showAccess = !report.completedAt;
  return (
    <>
      {showAccess && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[#e8001c]/60 bg-[#e8001c] px-4 py-3 text-left text-[#080808] active:opacity-90"
        >
          <Sparkles className="size-6 shrink-0" aria-hidden />
          <span className="flex-1">
            <span className="block font-display text-2xl leading-none tracking-wide uppercase">
              {report.kind === "weekly"
                ? "Tu semana está lista"
                : `Tu ${report.periodLabel.split(" ")[0].toLowerCase()} está listo`}
            </span>
            <span className="mt-1 block text-sm font-bold">{report.periodLabel} · Tocá para verlo</span>
          </span>
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </button>
      )}
      {open && <ReportViewer report={report} onClose={close} />}
    </>
  );
}
