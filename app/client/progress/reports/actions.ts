"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

// Seguimiento del reporte por parte del cliente (oct-2026): abrió / llegó a
// la última tarjeta. El cliente no tiene UPDATE sobre progress_reports (ver
// migración 20261022): la propiedad se verifica con SU sesión (RLS: solo ve
// los suyos enviados) y la escritura de esa única columna va con el service
// role — mismo patrón que markTourSeen y dismissWelcomeBanner.
async function stamp(reportId: string, column: "opened_at" | "completed_at"): Promise<{ error?: string }> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No autenticado." };

  const supabase = await createClient();
  const { data: own } = await supabase
    .from("progress_reports")
    .select("id")
    .eq("id", reportId)
    .eq("client_id", client.id)
    .eq("status", "sent")
    .maybeSingle();
  if (!own) return { error: "Reporte no encontrado." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("progress_reports")
    .update({ [column]: new Date().toISOString() })
    .eq("id", reportId)
    .eq("client_id", client.id)
    .is(column, null);
  if (error) {
    console.error(`reportes: no se pudo marcar ${column}:`, error);
    return { error: "No se pudo guardar." };
  }
  return {};
}

export async function markReportOpened(reportId: string) {
  return stamp(reportId, "opened_at");
}

export async function markReportCompleted(reportId: string) {
  const result = await stamp(reportId, "completed_at");
  // El acceso destacado de Inicio desaparece al verlo completo.
  if (!result.error) revalidatePath("/client/home");
  return result;
}
