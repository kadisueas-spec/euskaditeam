"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import { createDraft, regenerateReport, sendReport } from "@/lib/reports/service";
import { latestClosedPeriod, nextSundayAt } from "@/lib/reports/schedule";
import { decideGenerateNow } from "@/lib/reports/generate-now";
import { kindForRange, validateRange } from "@/lib/reports/periods";
import { parseCardLayout } from "@/lib/reports/layout";
import { todayInParaguay } from "@/lib/utils/today";
import type { Period } from "@/lib/reports/schedule";
import type { ReportKind } from "@/lib/reports/types";

// Acciones de la bandeja de reportes (oct-2026). La propiedad se verifica
// SIEMPRE con la sesión del coach (RLS "Coach manages own clients
// reports"); enviar y regenerar después usan el service role (la push y la
// lectura de datos del cliente lo necesitan).

type Result = { error?: string };

const NOTE_MAX = 1000;

async function ownedReport(reportId: string) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "coach") return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("progress_reports")
    .select("id, status")
    .eq("id", reportId)
    .eq("coach_id", profile.id)
    .maybeSingle<{ id: string; status: string }>();
  return data ? { supabase, profile, report: data } : null;
}

function revalidate(reportId: string) {
  revalidatePath("/coach/reports");
  revalidatePath(`/coach/reports/${reportId}`);
}

export async function saveReportNote(reportId: string, note: string): Promise<Result> {
  const owned = await ownedReport(reportId);
  if (!owned) return { error: "No se encontró el reporte." };
  if (owned.report.status === "sent") return { error: "El reporte ya se envió." };
  const text = note.trim().slice(0, NOTE_MAX);
  const { error } = await owned.supabase
    .from("progress_reports")
    .update({ coach_note: text || null, updated_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) return { error: "No se pudo guardar la nota." };
  revalidate(reportId);
  return {};
}

export async function sendReportNow(reportId: string, note: string): Promise<Result> {
  const saved = await saveReportNote(reportId, note);
  if (saved.error) return saved;
  const result = await sendReport(reportId);
  revalidate(reportId);
  return result;
}

export async function scheduleReportForSunday(reportId: string, note: string, hour: number): Promise<Result> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { error: "Elegí una hora válida." };
  const saved = await saveReportNote(reportId, note);
  if (saved.error) return saved;
  const owned = await ownedReport(reportId);
  if (!owned) return { error: "No se encontró el reporte." };

  // La hora elegida queda como default para los próximos.
  await owned.supabase.from("profiles").update({ report_sunday_hour: hour }).eq("id", owned.profile.id);

  const { error } = await owned.supabase
    .from("progress_reports")
    .update({
      status: "scheduled",
      scheduled_for: nextSundayAt(hour).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .in("status", ["draft", "scheduled"]);
  if (error) return { error: "No se pudo programar el envío." };
  revalidate(reportId);
  return {};
}

export async function unscheduleReport(reportId: string): Promise<Result> {
  const owned = await ownedReport(reportId);
  if (!owned) return { error: "No se encontró el reporte." };
  const { error } = await owned.supabase
    .from("progress_reports")
    .update({ status: "draft", scheduled_for: null, updated_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "scheduled");
  if (error) return { error: "No se pudo cancelar el envío programado." };
  revalidate(reportId);
  return {};
}

export async function discardReport(reportId: string): Promise<Result> {
  const owned = await ownedReport(reportId);
  if (!owned) return { error: "No se encontró el reporte." };
  const { error } = await owned.supabase
    .from("progress_reports")
    .update({ status: "discarded", scheduled_for: null, updated_at: new Date().toISOString() })
    .eq("id", reportId)
    .in("status", ["draft", "scheduled"]);
  if (error) return { error: "No se pudo descartar el reporte." };
  revalidate(reportId);
  return {};
}

export async function regenerateReportAction(reportId: string): Promise<Result> {
  const owned = await ownedReport(reportId);
  if (!owned) return { error: "No se encontró el reporte." };
  const result = await regenerateReport(reportId);
  revalidate(reportId);
  return result;
}

// "Generar ahora" (oct-2026): arma UN borrador del último período cerrado
// para el cliente elegido, con el mismo generador que el cron
// (createDraft). Solo crea o regenera borradores: nunca envía ni manda
// push. Si ya hay un reporte de ese período: enviado → no se toca;
// borrador/programado/descartado → pide confirmación antes de regenerarlo
// (la nota del coach se conserva; uno descartado vuelve a borrador).
export type GenerateNowResult =
  | { reportId: string }
  | { needsConfirm: { status: "draft" | "scheduled" | "discarded" } }
  | { error: string };

// Qué período generar: el último semanal/mensual cerrado, o un rango libre
// (que si coincide con un mes calendario o un lunes a viernes, se guarda
// como mensual o semanal — ver kindForRange).
export type GenerateSelection =
  | { mode: "weekly" | "monthly" }
  | { mode: "range"; start: string; end: string };

function resolveSelection(selection: GenerateSelection): { kind: ReportKind; period: Period } | { error: string } {
  if (selection.mode === "weekly" || selection.mode === "monthly") {
    return { kind: selection.mode, period: latestClosedPeriod(selection.mode) };
  }
  if (selection.mode !== "range") return { error: "Tipo de reporte inválido." };
  const invalid = validateRange(selection.start, selection.end, todayInParaguay());
  if (invalid) return { error: invalid };
  return { kind: kindForRange(selection.start, selection.end), period: { start: selection.start, end: selection.end } };
}

export async function generateReportNow(
  clientId: string,
  selection: GenerateSelection,
  confirmRegenerate: boolean
): Promise<GenerateNowResult> {
  const resolved = resolveSelection(selection);
  if ("error" in resolved) return { error: resolved.error };
  const { kind, period } = resolved;
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "coach") return { error: "No autorizado." };
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("coach_id", profile.id)
    .maybeSingle();
  if (!client) return { error: "Elegí uno de tus clientes." };

  const { data: existing } = await supabase
    .from("progress_reports")
    .select("id, status")
    .eq("client_id", clientId)
    .eq("kind", kind)
    .eq("period_start", period.start)
    .eq("period_end", period.end)
    .maybeSingle<{ id: string; status: "draft" | "scheduled" | "sent" | "discarded" }>();

  const decision = decideGenerateNow(existing?.status ?? null, confirmRegenerate);
  if (decision.action === "blocked-sent") {
    return { error: "Ese reporte ya se envió: no se toca. Lo podés ver en Enviados." };
  }
  if (decision.action === "ask") return { needsConfirm: { status: decision.status } };
  if (decision.action === "regenerate" && existing) {
    if (decision.restoreFromDiscarded) {
      const { error } = await supabase
        .from("progress_reports")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("status", "discarded");
      if (error) return { error: "No se pudo recuperar el borrador descartado." };
    }
    const result = await regenerateReport(existing.id);
    if (result.error) return { error: result.error };
    revalidate(existing.id);
    return { reportId: existing.id };
  }

  try {
    const result = await createDraft(clientId, profile.id, kind, period);
    if (result.status === "no-data") {
      return { error: "Este cliente no tiene rutina ni entrenamientos: no hay nada que reportar." };
    }
    if (result.status === "exists") return { needsConfirm: { status: "draft" } };
    revalidate(result.reportId);
    return { reportId: result.reportId };
  } catch (err) {
    console.error("generateReportNow:", err);
    return { error: "No se pudo generar el borrador." };
  }
}

// Tarjetas elegidas por el coach (prendidas/apagadas y orden). Se guardan en
// el borrador y sobreviven a "Volver a generar" (van por clave). Validado:
// solo arrays/booleanos; lo privado y el peso oculto no existen en el
// catálogo, así que ningún interruptor los puede mandar al cliente.
export async function saveCardLayout(reportId: string, layout: unknown): Promise<Result> {
  const parsed = parseCardLayout(layout);
  if (!parsed) return { error: "Tarjetas inválidas." };
  const owned = await ownedReport(reportId);
  if (!owned) return { error: "No se encontró el reporte." };
  if (owned.report.status === "sent") return { error: "El reporte ya se envió." };
  const { error } = await owned.supabase
    .from("progress_reports")
    .update({ card_layout: parsed, updated_at: new Date().toISOString() })
    .eq("id", reportId)
    .neq("status", "sent");
  if (error) return { error: "No se pudieron guardar las tarjetas." };
  revalidatePath(`/coach/reports/${reportId}`);
  return {};
}

// "Cambiar período" de un borrador: nuevas fechas y se regenera con los
// datos de ese rango. La nota y las tarjetas elegidas se conservan (la
// bandeja pregunta antes de llamar). Si ya existe otro reporte del cliente
// con ese mismo período, no se pisa.
export async function changeReportPeriod(reportId: string, start: string, end: string): Promise<Result> {
  const invalid = validateRange(start, end, todayInParaguay());
  if (invalid) return { error: invalid };
  const owned = await ownedReport(reportId);
  if (!owned) return { error: "No se encontró el reporte." };
  if (owned.report.status === "sent") return { error: "El reporte ya se envió: no se toca." };

  const { data: current } = await owned.supabase
    .from("progress_reports")
    .select("client_id")
    .eq("id", reportId)
    .maybeSingle<{ client_id: string }>();
  if (!current) return { error: "No se encontró el reporte." };

  const kind = kindForRange(start, end);
  const { data: clash } = await owned.supabase
    .from("progress_reports")
    .select("id")
    .eq("client_id", current.client_id)
    .eq("kind", kind)
    .eq("period_start", start)
    .eq("period_end", end)
    .neq("id", reportId)
    .maybeSingle();
  if (clash) return { error: "Ya hay otro reporte de ese cliente con ese mismo período." };

  const { error } = await owned.supabase
    .from("progress_reports")
    .update({ kind, period_start: start, period_end: end, updated_at: new Date().toISOString() })
    .eq("id", reportId)
    .neq("status", "sent");
  if (error) return { error: "No se pudo cambiar el período." };
  const result = await regenerateReport(reportId);
  revalidate(reportId);
  return result;
}
