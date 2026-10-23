"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { ReportPlayer, reportPlayerStyles as s } from "@/components/reports/report-player";
import type { ExtraSlide } from "@/components/reports/report-player";
import { whenLabel } from "@/lib/reports/format";
import type { CoachReportDetail } from "@/lib/supabase/progress-reports";
import type { ReportCard } from "@/lib/reports/types";
import { clientCards, layoutAfterRegenerate, withCoachNote } from "@/lib/reports/layout";
import type { CardLayout } from "@/lib/reports/layout";
import { CardsPanel } from "./cards-panel";
import { ChangePeriod } from "./change-period";
import {
  discardReport,
  regenerateReportAction,
  saveCardLayout,
  saveReportNote,
  scheduleReportForSunday,
  sendReportNow,
  unscheduleReport,
} from "../actions";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

const LAYOUT_SAVE_DELAY_MS = 500;

export function ReportReview({ report, today }: { report: CoachReportDetail; today: string }) {
  const router = useRouter();
  const [note, setNote] = useState(report.coachNote);
  const [hour, setHour] = useState(report.sundayHour);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pending, startTransition] = useTransition();
  const editable = report.status === "draft" || report.status === "scheduled";
  const [layout, setLayout] = useState<CardLayout | null>(report.cardLayout);
  const [layoutState, setLayoutState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);
  // Regenerar con textos editados: primero se pregunta si conservarlos.
  const [askKeepTexts, setAskKeepTexts] = useState(false);
  // Textos conservados cuyos datos cambiaron al regenerar.
  const [review, setReview] = useState<string[]>([]);
  const editedCount = Object.keys(layout?.texts ?? {}).length;

  // Antes de regenerar (o cambiar el período): se guarda ya el layout, con
  // o sin los textos editados, así el servidor regenera sobre lo último.
  async function flushLayout(keepTexts: boolean): Promise<{ error?: string }> {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const next = layoutAfterRegenerate(layout, keepTexts);
    if (!next) return {};
    setLayout(next);
    const result = await saveCardLayout(report.id, next);
    setLayoutState(result.error ? "error" : "saved");
    return result;
  }

  function regenerate(keepTexts: boolean) {
    setAskKeepTexts(false);
    setReview([]);
    run(async () => {
      const flushed = await flushLayout(keepTexts);
      if (flushed.error) return flushed;
      const result = await regenerateReportAction(report.id);
      if (result.review) setReview(result.review);
      return result;
    });
  }

  // Vista previa en vivo: las tarjetas prendidas en el orden elegido + la
  // nota, en el mismo lugar que las deja sendReport (lib/reports/layout.ts).
  const previewCards = useMemo(() => {
    if (!editable) return report.cards;
    const text = note.trim();
    const noteCard: ReportCard | null = text
      ? { type: "coach-note", theme: "oxblood", text, coachName: "Vos", coachAvatarUrl: null }
      : null;
    return withCoachNote(clientCards(report.cards, layout), noteCard);
  }, [editable, report.cards, layout, note]);

  function changeLayout(next: CardLayout) {
    setLayout(next);
    setLayoutState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const result = await saveCardLayout(report.id, next);
      setLayoutState(result.error ? "error" : "saved");
    }, LAYOUT_SAVE_DELAY_MS);
  }

  const privateSlide: ExtraSlide = {
    key: "private",
    theme: "oxblood",
    content: (
      <div className={s.slow} style={{ margin: "auto 0" }}>
        <div className={s.coachOnly}>
          <span className={s.coachTag}>Solo lo ves vos</span>
          <p className={s.phraseLg} style={{ color: "var(--ink)" }}>
            {report.missingMonthMessage ? "Falta tu mensaje de cierre de mes" : "Avisos de este reporte"}
          </p>
          {report.missingMonthMessage && (
            <p className={s.sub} style={{ color: "#c9c9c9" }}>
              Escribí el cierre en la ficha y tocá “Volver a generar”: tu mensaje entra al reporte, firmado por vos.
              Si lo enviás sin escribirlo, esa tarjeta no aparece.
            </p>
          )}
          {report.notices.length > 0 ? (
            <ul className={s.notices}>
              {report.notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : (
            !report.missingMonthMessage && <p className={s.sub}>Sin avisos.</p>
          )}
        </div>
      </div>
    ),
  };

  function run(action: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Vista previa: lo mismo que ve el cliente, en un marco de teléfono */}
      <div className="mx-auto w-full max-w-[390px] shrink-0 lg:mx-0">
        <div className="h-[760px] overflow-hidden rounded-[40px] border-4 border-[#1e1e1e] bg-[#080808]">
          <ReportPlayer
            key={previewCards.map((c) => c.key ?? c.type).join("|")}
            cards={previewCards}
            title={report.title}
            periodLabel={report.periodLabel}
            variant="embedded"
            extraSlides={editable ? [privateSlide] : []}
          />
        </div>
        <p className="mt-2 text-center text-xs text-[#888888]">
          Tocá a la derecha o a la izquierda del teléfono para pasar tarjetas.
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {report.status === "sent" ? (
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4 text-sm text-[#c9c9c9]">
            <p className="font-medium text-white">Enviado el {report.sentAt ? whenLabel(report.sentAt) : "—"}</p>
            <p className="mt-1">
              {report.completedAt
                ? `Lo vio completo el ${whenLabel(report.completedAt)}.`
                : report.openedAt
                  ? `Lo abrió el ${whenLabel(report.openedAt)}, todavía no lo terminó.`
                  : "Todavía no lo abrió."}
            </p>
          </div>
        ) : report.status === "discarded" ? (
          <p className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4 text-sm text-[#c9c9c9]">
            Descartado. No le llega al cliente.
          </p>
        ) : (
          <>
            <ChangePeriod
              reportId={report.id}
              start={report.periodStart}
              end={report.periodEnd}
              today={today}
              editedCount={editedCount}
              beforeChange={flushLayout}
              onReview={setReview}
            />

            {review.length > 0 && (
              <div role="status" className="flex items-start gap-3 rounded-2xl border border-[#f5c542]/40 bg-[#f5c542]/10 p-4 text-sm">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#f5c542]" aria-hidden />
                <div className="text-[#f5f5f5]">
                  <p className="font-medium">Revisá tus textos: cambiaron los datos de estas tarjetas</p>
                  <ul className="mt-1 list-disc pl-5 text-[#c9c9c9]">
                    {review.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[#c9c9c9]">Quedan marcadas con “Revisar” en Tarjetas.</p>
                </div>
              </div>
            )}

            {report.status === "scheduled" && report.scheduledFor && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e8001c]/40 bg-[#e8001c]/10 p-4 text-sm">
                <span className="text-white">Programado para el {whenLabel(report.scheduledFor)}.</span>
                <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => unscheduleReport(report.id))}>
                  Cancelar envío
                </Button>
              </div>
            )}

            {report.missingMonthMessage && (
              <div className="flex items-start gap-3 rounded-2xl border border-[#f5c542]/40 bg-[#f5c542]/10 p-4 text-sm">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#f5c542]" aria-hidden />
                <div className="text-[#f5f5f5]">
                  <p className="font-medium">Falta tu mensaje de cierre de mes</p>
                  <p className="mt-1 text-[#c9c9c9]">
                    Escribilo en el{" "}
                    <Link href={`/coach/clients/${report.clientId}`} className="text-[#f5c542] underline">
                      cierre de mes de {report.clientName.split(" ")[0]}
                    </Link>{" "}
                    y después tocá “Volver a generar”.
                  </p>
                </div>
              </div>
            )}

            {report.notices.length > 0 && (
              <section className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
                <h2 className="text-sm font-semibold text-white">Avisos para vos</h2>
                <p className="text-xs text-[#888888]">No le llegan al cliente.</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {report.notices.map((n) => (
                    <li key={n} className="rounded-xl border border-[#f5c542]/30 bg-[#f5c542]/10 px-3 py-2 text-sm text-[#f5f5f5]">
                      {n}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <CardsPanel
              cards={report.cards}
              layout={layout}
              onChange={changeLayout}
              hideWeight={report.hideWeight}
              saveState={layoutState}
            />

            <section className="flex flex-col gap-2">
              <label htmlFor="coach-note" className="text-sm font-semibold text-white">
                Nota personal (opcional)
              </label>
              <Textarea
                id="coach-note"
                value={note}
                maxLength={1000}
                rows={4}
                placeholder="Si la escribís, va como última tarjeta, firmada por vos."
                onChange={(e) => {
                  setNote(e.target.value);
                  setSaved(false);
                }}
              />
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending || note === report.coachNote}
                  onClick={() => run(() => saveReportNote(report.id, note), () => setSaved(true))}
                >
                  Guardar nota
                </Button>
                {saved && <span className="text-sm text-[#888888]">Guardada ✓</span>}
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
              <Button size="lg" className="min-h-11" disabled={pending} onClick={() => run(() => sendReportNow(report.id, note))}>
                {pending ? "Procesando…" : "Enviar ahora"}
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => run(() => scheduleReportForSunday(report.id, note, hour))}
                >
                  Programar para el domingo
                </Button>
                <label htmlFor="sunday-hour" className="sr-only">
                  Hora del domingo
                </label>
                <NativeSelect
                  id="sunday-hour"
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="w-28"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </NativeSelect>
                <span className="text-xs text-[#888888]">hora de Paraguay</span>
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-2">
              {askKeepTexts ? (
                <span className="flex flex-wrap items-center gap-2 rounded-xl border border-[#f5c542]/40 bg-[#f5c542]/10 p-3 text-sm text-[#f5f5f5]">
                  {editedCount === 1 ? "Editaste 1 texto." : `Editaste ${editedCount} textos.`} ¿Conservarlos al regenerar?
                  <Button size="sm" disabled={pending} onClick={() => regenerate(true)}>
                    Conservar mis textos
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => regenerate(false)}>
                    Volver a los originales
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => setAskKeepTexts(false)}>
                    Cancelar
                  </Button>
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => (editedCount > 0 ? setAskKeepTexts(true) : regenerate(true))}
                >
                  <RefreshCw className="size-4" aria-hidden /> Volver a generar con los datos de hoy
                </Button>
              )}
              {confirmDiscard ? (
                <span className="flex items-center gap-2 text-sm text-[#c9c9c9]">
                  ¿Descartarlo? No le va a llegar.
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => discardReport(report.id), () => router.push("/coach/reports"))}
                  >
                    Sí, descartar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDiscard(false)}>
                    No
                  </Button>
                </span>
              ) : (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirmDiscard(true)}>
                  Descartar
                </Button>
              )}
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-[#e8001c]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
