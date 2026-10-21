"use server";

import { debugError, describeFormFile } from "@/lib/utils/debug-error";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPushToClient } from "@/lib/push/send-push";
import {
  NEW_NUTRITION_PLAN_PUSH_BODY,
  NEW_NUTRITION_PLAN_PUSH_TITLE,
} from "@/lib/constants/push-copy";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants/uploads";

// Oct-2026: 20MB -> 4MB, el tope real de un Server Action (ver
// lib/constants/uploads.ts) — por encima no llegaba ni a esta validación.
const MAX_FILE_SIZE_BYTES = MAX_UPLOAD_BYTES;
const PDF_SIGNATURE = "%PDF-";

// Auditoría de seguridad jul-2026, sección 3: file.type es el MIME que
// REPORTA el navegador, no el contenido real — un archivo renombrado con
// Content-Type falseado lo pasaba igual. Todo PDF real arranca con estos 5
// bytes ("%PDF-" en ASCII), así que lo chequeamos directo del contenido.
async function hasValidPdfSignature(file: File): Promise<boolean> {
  const header = await file.slice(0, PDF_SIGNATURE.length).text();
  return header === PDF_SIGNATURE;
}

export type UploadPlanFormState = { error: string } | undefined;

async function uploadNutritionPlanInner(
  clientId: string,
  _prevState: UploadPlanFormState,
  formData: FormData
): Promise<UploadPlanFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .maybeSingle();
  if (!client) return { error: "Cliente no encontrado." };

  const file = formData.get("file");
  const name = String(formData.get("name") ?? "").trim();
  const validFrom = String(formData.get("valid_from") ?? "") || null;
  const validUntil = String(formData.get("valid_until") ?? "") || null;

  if (!name) return { error: "El nombre del plan es obligatorio." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: `Elegí un archivo PDF. ${debugError("Archivo recibido", describeFormFile(file))}` };
  }
  if (file.type !== "application/pdf") {
    return { error: `El archivo tiene que ser un PDF. ${debugError("Archivo recibido", describeFormFile(file))}` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: `El PDF no puede pesar más de ${MAX_UPLOAD_LABEL}.` };
  }
  if (!(await hasValidPdfSignature(file))) {
    return { error: `El archivo no es un PDF válido. ${debugError("Archivo recibido", describeFormFile(file))}` };
  }

  // Como máximo un plan activo por cliente (índice único en la base) — se
  // archiva el anterior antes de subir el nuevo.
  const { error: archiveError } = await supabase
    .from("nutrition_plans")
    .update({ status: "archived" })
    .eq("client_id", clientId)
    .eq("status", "active");
  if (archiveError) {
    console.error("uploadNutritionPlan archive error:", archiveError);
    return { error: debugError("Tabla nutrition_plans (archivar anterior)", archiveError) };
  }

  // Fix oct-2026: el path era `<client_id>/<uuid>-<nombre original>` y
  // Storage rechaza claves con tildes, ñ y algunos símbolos ("Invalid key",
  // 400) — "Plan de Alimentación - Daniela Espínola.pdf" fallaba siempre.
  // El path ahora es solo ASCII generado; el nombre original se guarda en
  // nutrition_plans.file_name (para mostrarlo y como nombre de la descarga,
  // ver lib/supabase/nutrition.ts). Fotos de progreso y GIFs ya usaban
  // paths generados, sin el nombre original.
  const filePath = `${clientId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("nutrition-plans")
    .upload(filePath, file, { contentType: "application/pdf" });
  if (uploadError) {
    console.error("uploadNutritionPlan storage error:", uploadError);
    return { error: debugError(`Storage nutrition-plans (subida, path="${filePath}")`, uploadError) };
  }

  const { error: insertError } = await supabase.from("nutrition_plans").insert({
    client_id: clientId,
    coach_id: user.id,
    name,
    valid_from: validFrom,
    valid_until: validUntil,
    status: "active",
    file_path: filePath,
    file_name: file.name,
  });
  if (insertError) {
    console.error("uploadNutritionPlan insert error:", insertError);
    await supabase.storage.from("nutrition-plans").remove([filePath]);
    return { error: debugError("Tabla nutrition_plans (insert)", insertError) };
  }

  revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/client/body");

  sendPushToClient(clientId, {
    title: NEW_NUTRITION_PLAN_PUSH_TITLE,
    body: NEW_NUTRITION_PLAN_PUSH_BODY,
    url: "/client/body?tab=nutricion",
  }).catch((error) => {
    console.error("uploadNutritionPlan push error:", error);
  });

  return undefined;
}

export type DeletePlanResult = { success: true } | { error: string };

export async function deleteNutritionPlan(
  clientId: string,
  planId: string
): Promise<DeletePlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id, file_path, client_id, clients!inner(coach_id)")
    .eq("id", planId)
    .eq("clients.coach_id", user.id)
    .maybeSingle();
  if (!plan) return { error: "Plan no encontrado." };

  const { error: deleteError } = await supabase
    .from("nutrition_plans")
    .delete()
    .eq("id", planId);
  if (deleteError) {
    console.error("deleteNutritionPlan delete error:", deleteError);
    return { error: "No se pudo eliminar el plan." };
  }

  await supabase.storage.from("nutrition-plans").remove([plan.file_path]);

  revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/client/body");
  return { success: true };
}

// TEMPORAL (diagnóstico de subidas, ver lib/utils/debug-error.ts): cualquier
// excepción se devuelve como mensaje visible en vez de romper la pantalla.
export async function uploadNutritionPlan(clientId: string, prevState: UploadPlanFormState, formData: FormData): Promise<UploadPlanFormState> {
  try {
    return await uploadNutritionPlanInner(clientId, prevState, formData);
  } catch (err) {
    console.error("uploadNutritionPlan excepción:", err);
    return { error: debugError("Excepción en el servidor", err) };
  }
}
