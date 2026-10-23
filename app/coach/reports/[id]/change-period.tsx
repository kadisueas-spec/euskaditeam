"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportRangePicker } from "@/components/coach/report-range-picker";
import type { DateRange } from "@/components/coach/report-range-picker";
import { changeReportPeriod } from "../actions";

// "Cambiar período" de un borrador (oct-2026): pide confirmación y
// regenera con las fechas nuevas. La nota y las tarjetas elegidas se
// conservan (van por clave, ver lib/reports/layout.ts).
export function ChangePeriod({
  reportId,
  start,
  end,
  today,
}: {
  reportId: string;
  start: string;
  end: string;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [range, setRange] = useState<DateRange>({ start, end });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const unchanged = range.start === start && range.end === end;

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <CalendarRange className="size-4" aria-hidden /> Cambiar período
      </Button>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
      <h2 className="text-sm font-semibold text-white">Cambiar período</h2>
      <ReportRangePicker
        idPrefix="change-period"
        today={today}
        value={range}
        onChange={(r) => {
          setRange(r);
          setConfirming(false);
          setError(null);
        }}
      />
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#f5c542]/40 bg-[#f5c542]/10 p-3 text-sm text-[#f5f5f5]">
          <span>¿Regenerar el reporte con estas fechas? Tu nota y tus tarjetas se mantienen.</span>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await changeReportPeriod(reportId, range.start, range.end);
                if (result.error) {
                  setError(result.error);
                  setConfirming(false);
                } else {
                  setOpen(false);
                  setConfirming(false);
                  router.refresh();
                }
              })
            }
          >
            {pending ? "Regenerando…" : "Sí, regenerar"}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            No
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={unchanged || !range.start || !range.end} onClick={() => setConfirming(true)}>
            Regenerar con estas fechas
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#e8001c]">
          {error}
        </p>
      )}
    </section>
  );
}
