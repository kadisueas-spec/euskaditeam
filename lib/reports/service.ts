import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToClient } from "@/lib/push/send-push";
import { buildWeeklyReport } from "@/lib/reports/build-weekly";
import { buildMonthlyReport } from "@/lib/reports/build-monthly";
import { loadReportInput } from "@/lib/reports/load-input";
import { monthName } from "@/lib/reports/format";
import type { Period } from "@/lib/reports/schedule";
import type { BuiltReport, ReportCard, ReportKind } from "@/lib/reports/types";

// Generación y envío de reportes (service role). Nunca se envía nada sin
// una decisión del coach: el cron solo crea BORRADORES y manda los que el
// coach PROGRAMÓ.

export const REPORT_PUSH = {
  weekly: { title: "Tu semana está lista 🔥", body: "Mirá cómo te fue esta semana" },
  monthly: (monthStart: string) => ({
    title: `Tu ${monthName(monthStart)} está listo`,
    body: "Entrá a ver todo lo que hiciste",
  }),
};

// null si el cliente no existe o no tiene coach, y también si no tiene
// rutina ni ningún entrenamiento: no hay nada que reportar.
export async function buildReport(
  clientId: string,
  kind: ReportKind,
  period: Period
): Promise<BuiltReport | null> {
  const input = await loadReportInput({ clientId, kind, periodStart: period.start, periodEnd: period.end });
  if (!input || (!input.routine && input.sessions.length === 0)) return null;
  return kind === "weekly" ? buildWeeklyReport(input) : buildMonthlyReport(input);
}

// Crea los borradores del período para todos los clientes activos que no lo
// tengan todavía (si el coach lo descartó, la fila existe y no se recrea).
export async function generateDrafts(kind: ReportKind, period: Period): Promise<{ created: number; failed: number }> {
  const admin = createAdminClient();
  const [{ data: clients }, { data: existing }] = await Promise.all([
    admin
      .from("clients")
      .select("id, coach_id")
      .eq("subscription_status", "active")
      .not("coach_id", "is", null)
      .returns<{ id: string; coach_id: string }[]>(),
    admin
      .from("progress_reports")
      .select("client_id")
      .eq("kind", kind)
      .eq("period_start", period.start)
      .returns<{ client_id: string }[]>(),
  ]);
  const done = new Set((existing ?? []).map((r) => r.client_id));

  let created = 0;
  let failed = 0;
  for (const c of clients ?? []) {
    if (done.has(c.id)) continue;
    try {
      const built = await buildReport(c.id, kind, period);
      if (!built) continue;
      const { data: row, error } = await admin
        .from("progress_reports")
        .upsert(
          {
            client_id: c.id,
            coach_id: c.coach_id,
            kind,
            period_start: period.start,
            period_end: period.end,
            cards: built.cards,
            phrase_keys: built.phraseKeys,
          },
          { onConflict: "client_id,kind,period_start", ignoreDuplicates: true }
        )
        .select("id")
        .maybeSingle<{ id: string }>();
      if (error) throw error;
      if (row) {
        await admin
          .from("progress_report_private")
          .upsert({ report_id: row.id, coach_id: c.coach_id, notices: built.notices });
        created++;
      }
    } catch (err) {
      failed++;
      console.error(`reportes: falló el borrador ${kind} ${period.start} del cliente ${c.id}:`, err);
    }
  }
  return { created, failed };
}

// "Volver a generar" (bandeja del coach): recalcula con los datos de hoy un
// borrador o programado. La nota del coach y el estado no se tocan.
export async function regenerateReport(reportId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data: report } = await admin
    .from("progress_reports")
    .select("id, client_id, coach_id, kind, period_start, period_end, status")
    .eq("id", reportId)
    .maybeSingle<{
      id: string;
      client_id: string;
      coach_id: string;
      kind: ReportKind;
      period_start: string;
      period_end: string;
      status: string;
    }>();
  if (!report) return { error: "No se encontró el reporte." };
  if (report.status === "sent") return { error: "El reporte ya se envió." };

  const built = await buildReport(report.client_id, report.kind, {
    start: report.period_start,
    end: report.period_end,
  });
  if (!built) return { error: "No se pudieron leer los datos del cliente." };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("progress_reports")
    .update({ cards: built.cards, phrase_keys: built.phraseKeys, generated_at: now, updated_at: now })
    .eq("id", reportId)
    .neq("status", "sent");
  if (error) return { error: "No se pudo regenerar el reporte." };
  await admin
    .from("progress_report_private")
    .upsert({ report_id: reportId, coach_id: report.coach_id, notices: built.notices, updated_at: now });
  return {};
}

// Envía un reporte: le suma la nota del coach como última tarjeta, lo marca
// enviado y manda la push. El UPDATE es condicional (solo si todavía no
// estaba enviado): si el cron y el coach lo envían a la vez, la push sale
// una sola vez.
export async function sendReport(reportId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data: report } = await admin
    .from("progress_reports")
    .select("id, client_id, coach_id, kind, period_start, status, cards, coach_note")
    .eq("id", reportId)
    .maybeSingle<{
      id: string;
      client_id: string;
      coach_id: string;
      kind: ReportKind;
      period_start: string;
      status: string;
      cards: ReportCard[];
      coach_note: string | null;
    }>();
  if (!report) return { error: "No se encontró el reporte." };
  if (report.status === "sent") return {};
  if (report.status === "discarded") return { error: "El reporte está descartado." };

  let cards: ReportCard[] = report.cards.filter((c) => c.type !== "coach-note");
  const note = report.coach_note?.trim();
  if (note) {
    const { data: coach } = await admin
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", report.coach_id)
      .maybeSingle<{ full_name: string | null; avatar_url: string | null }>();
    const noteCard: ReportCard = {
      type: "coach-note",
      theme: "oxblood",
      text: note,
      coachName: coach?.full_name?.trim() || "Tu coach",
      coachAvatarUrl: coach?.avatar_url ?? null,
    };
    // La nota va antes de la imagen para compartir (que siempre cierra el mensual).
    const shareIndex = cards.findIndex((c) => c.type === "share");
    cards = shareIndex >= 0 ? [...cards.slice(0, shareIndex), noteCard, ...cards.slice(shareIndex)] : [...cards, noteCard];
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("progress_reports")
    .update({ status: "sent", sent_at: now, scheduled_for: null, cards, updated_at: now })
    .eq("id", reportId)
    .in("status", ["draft", "scheduled"])
    .select("id");
  if (error) return { error: "No se pudo enviar el reporte." };
  if (!updated || updated.length === 0) return {};

  const push = report.kind === "weekly" ? REPORT_PUSH.weekly : REPORT_PUSH.monthly(report.period_start);
  await sendPushToClient(report.client_id, {
    ...push,
    url: `/client/home?report=${report.id}`,
    tag: "progress-report",
  }).catch((err) => console.error("reportes: falló la push:", err));
  return {};
}

export async function sendDueReports(now: Date = new Date()): Promise<{ sent: number }> {
  const admin = createAdminClient();
  const { data: due } = await admin
    .from("progress_reports")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .returns<{ id: string }[]>();
  let sent = 0;
  for (const r of due ?? []) {
    const result = await sendReport(r.id);
    if (!result.error) sent++;
    else console.error(`reportes: no se pudo enviar el programado ${r.id}: ${result.error}`);
  }
  return { sent };
}
