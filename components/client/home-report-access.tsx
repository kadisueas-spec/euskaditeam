"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";
import { ReportViewer } from "@/components/client/report-viewer";
import { markReportAutoOpened } from "@/app/client/progress/reports/actions";
import { HOME_TOUR_DONE_EVENT, WELCOME_BANNER_CLOSED_EVENT } from "@/lib/constants/onboarding-tour";
import type { ClientReport } from "@/lib/supabase/progress-reports";

// Reportes en Inicio (oct-2026):
// - Una tarjeta fija "Tu … está listo" por cada reporte enviado que el
//   cliente todavía no vio hasta el final (más reciente primero).
// - Desde la push (?report=<id>) se abre ese reporte al toque.
// - Si no, el que eligió el servidor (autoOpenId, lib/reports/auto-open.ts:
//   sin abrir, 1 vez por día, 3 por reporte, nunca con un entrenamiento en
//   curso) se abre solo a pantalla completa — pero recién después del
//   banner "Empecemos" y del recorrido de bienvenida, nunca encima.
//   Cada apertura automática se guarda en el servidor
//   (markReportAutoOpened) para que valga en todos los dispositivos.
export function HomeReportAccess({
  reports,
  requested,
  autoOpenId,
  waitForWelcomeBanner,
  waitForTour,
}: {
  reports: ClientReport[];
  requested: ClientReport | null;
  autoOpenId: string | null;
  waitForWelcomeBanner: boolean;
  waitForTour: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(requested?.id ?? null);
  const autoOpened = useRef(false);

  // Apertura automática: espera a lo que tenga que salir antes. El
  // recorrido ya espera al banner, así que con recorrido alcanza su evento.
  useEffect(() => {
    if (requested || !autoOpenId || autoOpened.current) return;
    const gate = waitForTour ? HOME_TOUR_DONE_EVENT : waitForWelcomeBanner ? WELCOME_BANNER_CLOSED_EVENT : null;
    const open = () => {
      if (autoOpened.current) return;
      autoOpened.current = true;
      setOpenId(autoOpenId);
      markReportAutoOpened(autoOpenId).catch(() => {});
    };
    if (!gate) {
      // Un instante para que Inicio termine de pintarse debajo.
      const timer = setTimeout(open, 400);
      return () => clearTimeout(timer);
    }
    const handler = () => setTimeout(open, 400);
    window.addEventListener(gate, handler);
    return () => window.removeEventListener(gate, handler);
  }, [requested, autoOpenId, waitForTour, waitForWelcomeBanner]);

  function close() {
    setOpenId(null);
    // Saca ?report= de la URL (si no, volver atrás lo reabre).
    if (requested) router.replace("/client/home");
    router.refresh();
  }

  const all = requested && !reports.some((r) => r.id === requested.id) ? [requested, ...reports] : reports;
  const open = all.find((r) => r.id === openId) ?? null;
  const cards = all.filter((r) => !r.completedAt);

  return (
    <>
      {cards.length > 0 && (
        <div className="flex flex-col gap-2">
          {cards.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => setOpenId(report.id)}
              className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[#e8001c]/60 bg-[#e8001c] px-4 py-3 text-left text-[#080808] active:opacity-90"
            >
              <Sparkles className="size-6 shrink-0" aria-hidden />
              <span className="flex-1">
                <span className="block font-display text-2xl leading-none tracking-wide uppercase">
                  {report.kind === "weekly"
                    ? "Tu semana está lista"
                    : report.kind === "monthly"
                      ? `Tu ${report.periodLabel.split(" ")[0].toLowerCase()} está listo`
                      : "Tu progreso está listo"}
                </span>
                <span className="mt-1 block text-sm font-bold">{report.periodLabel} · Tocá para verlo</span>
              </span>
              <ChevronRight className="size-5 shrink-0" aria-hidden />
            </button>
          ))}
        </div>
      )}
      {open && <ReportViewer key={open.id} report={open} onClose={close} />}
    </>
  );
}
