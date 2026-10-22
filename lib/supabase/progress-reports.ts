import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { monthYearLabel, weekRangeLabel } from "@/lib/reports/format";
import type { ReportCard, ReportKind } from "@/lib/reports/types";

// Lecturas de reportes de progreso con la sesión del usuario (RLS): el
// coach ve los de sus clientes; el cliente, solo los suyos ENVIADOS. Las
// escrituras viven en lib/reports/service.ts y en las server actions.

export type ReportStatus = "draft" | "scheduled" | "sent" | "discarded";

export function reportPeriodLabel(kind: ReportKind, periodStart: string, periodEnd: string): string {
  return kind === "weekly" ? weekRangeLabel(periodStart, periodEnd) : monthYearLabel(periodStart);
}

export function reportTitle(kind: ReportKind): string {
  return kind === "weekly" ? "Tu semana" : "Tu mes";
}

// Un mensual sin la tarjeta del cierre: el coach todavía no escribió (o no
// completó) su mensaje de cierre de mes cuando se generó.
function missingMonthMessage(kind: ReportKind, cards: ReportCard[]): boolean {
  return kind === "monthly" && !cards.some((c) => c.type === "coach-message");
}

export type CoachReportListItem = {
  id: string;
  clientId: string;
  clientName: string;
  kind: ReportKind;
  periodLabel: string;
  status: ReportStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  openedAt: string | null;
  completedAt: string | null;
  noticesCount: number;
  missingMonthMessage: boolean;
};

type CoachRow = {
  id: string;
  client_id: string;
  kind: ReportKind;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  cards: ReportCard[];
  clients: { profiles: { full_name: string | null } | null } | null;
  progress_report_private: { notices: string[] } | null;
};

const SENT_VISIBLE_DAYS = 45;

export async function getCoachReports(): Promise<CoachReportListItem[]> {
  const supabase = await createClient();
  const sentSince = new Date(Date.now() - SENT_VISIBLE_DAYS * 86400000).toISOString();
  const { data } = await supabase
    .from("progress_reports")
    .select(
      `id, client_id, kind, period_start, period_end, status, scheduled_for, sent_at, opened_at, completed_at, cards,
       clients ( profiles!clients_user_id_fkey ( full_name ) ),
       progress_report_private ( notices )`
    )
    .or(`status.in.(draft,scheduled),sent_at.gte.${sentSince}`)
    .order("period_start", { ascending: false })
    .returns<CoachRow[]>();

  return (data ?? []).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.clients?.profiles?.full_name ?? "Cliente",
    kind: r.kind,
    periodLabel: reportPeriodLabel(r.kind, r.period_start, r.period_end),
    status: r.status,
    scheduledFor: r.scheduled_for,
    sentAt: r.sent_at,
    openedAt: r.opened_at,
    completedAt: r.completed_at,
    noticesCount: r.progress_report_private?.notices.length ?? 0,
    missingMonthMessage: missingMonthMessage(r.kind, r.cards),
  }));
}

export async function countReportsToReview(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("progress_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");
  return count ?? 0;
}

export type CoachReportDetail = {
  id: string;
  clientId: string;
  clientName: string;
  kind: ReportKind;
  title: string;
  periodLabel: string;
  periodStart: string;
  status: ReportStatus;
  cards: ReportCard[];
  coachNote: string;
  notices: string[];
  scheduledFor: string | null;
  sentAt: string | null;
  openedAt: string | null;
  completedAt: string | null;
  missingMonthMessage: boolean;
  sundayHour: number;
};

export async function getCoachReport(reportId: string): Promise<CoachReportDetail | null> {
  const supabase = await createClient();
  const [{ data: r }, { data: auth }] = await Promise.all([
    supabase
      .from("progress_reports")
      .select(
        `id, client_id, kind, period_start, period_end, status, scheduled_for, sent_at, opened_at, completed_at, cards, coach_note,
         clients ( profiles!clients_user_id_fkey ( full_name ) ),
         progress_report_private ( notices )`
      )
      .eq("id", reportId)
      .maybeSingle<CoachRow & { coach_note: string | null }>(),
    supabase.auth.getUser(),
  ]);
  if (!r) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("report_sunday_hour")
    .eq("id", auth.user?.id ?? "")
    .maybeSingle<{ report_sunday_hour: number }>();

  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.clients?.profiles?.full_name ?? "Cliente",
    kind: r.kind,
    title: reportTitle(r.kind),
    periodLabel: reportPeriodLabel(r.kind, r.period_start, r.period_end),
    periodStart: r.period_start,
    status: r.status,
    cards: r.cards,
    coachNote: r.coach_note ?? "",
    notices: r.progress_report_private?.notices ?? [],
    scheduledFor: r.scheduled_for,
    sentAt: r.sent_at,
    openedAt: r.opened_at,
    completedAt: r.completed_at,
    missingMonthMessage: missingMonthMessage(r.kind, r.cards),
    sundayHour: profile?.report_sunday_hour ?? 10,
  };
}

// --- Cliente ---

export type ClientReportSummary = {
  id: string;
  kind: ReportKind;
  title: string;
  periodLabel: string;
  sentAt: string;
  completedAt: string | null;
};

export type ClientReport = ClientReportSummary & { cards: ReportCard[] };

type ClientRow = {
  id: string;
  kind: ReportKind;
  period_start: string;
  period_end: string;
  sent_at: string;
  completed_at: string | null;
  cards?: ReportCard[];
};

function toSummary(r: ClientRow): ClientReportSummary {
  return {
    id: r.id,
    kind: r.kind,
    title: reportTitle(r.kind),
    periodLabel: reportPeriodLabel(r.kind, r.period_start, r.period_end),
    sentAt: r.sent_at,
    completedAt: r.completed_at,
  };
}

export async function getClientReports(): Promise<ClientReportSummary[]> {
  const client = await getCurrentClientRecord();
  if (!client) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("progress_reports")
    .select("id, kind, period_start, period_end, sent_at, completed_at")
    .eq("client_id", client.id)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .returns<ClientRow[]>();
  return (data ?? []).map(toSummary);
}

export async function getClientReport(reportId: string): Promise<ClientReport | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("progress_reports")
    .select("id, kind, period_start, period_end, sent_at, completed_at, cards")
    .eq("id", reportId)
    .eq("client_id", client.id)
    .eq("status", "sent")
    .maybeSingle<ClientRow>();
  if (!data) return null;
  return { ...toSummary(data), cards: data.cards ?? [] };
}

// El reporte enviado más reciente que el cliente todavía no vio hasta el
// final: queda como acceso destacado arriba de todo en Inicio.
export async function getPendingClientReport(): Promise<ClientReport | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("progress_reports")
    .select("id, kind, period_start, period_end, sent_at, completed_at, cards")
    .eq("client_id", client.id)
    .eq("status", "sent")
    .is("completed_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle<ClientRow>();
  if (!data) return null;
  return { ...toSummary(data), cards: data.cards ?? [] };
}
