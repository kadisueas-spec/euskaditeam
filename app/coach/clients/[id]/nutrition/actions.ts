"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPushToClient } from "@/lib/push/send-push";
import {
  NEW_NUTRITION_PLAN_PUSH_BODY,
  NEW_NUTRITION_PLAN_PUSH_TITLE,
} from "@/lib/constants/push-copy";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export type UploadPlanFormState = { error: string } | undefined;

export async function uploadNutritionPlan(
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
    return { error: "Elegí un archivo PDF." };
  }
  if (file.type !== "application/pdf") {
    return { error: "El archivo tiene que ser un PDF." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: "El PDF no puede pesar más de 20MB." };
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
    return { error: "No se pudo archivar el plan anterior." };
  }

  const filePath = `${clientId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("nutrition-plans")
    .upload(filePath, file, { contentType: "application/pdf" });
  if (uploadError) {
    console.error("uploadNutritionPlan storage error:", uploadError);
    return { error: "No se pudo subir el archivo." };
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
    return { error: "No se pudo guardar el plan." };
  }

  revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/client/progress");

  sendPushToClient(clientId, {
    title: NEW_NUTRITION_PLAN_PUSH_TITLE,
    body: NEW_NUTRITION_PLAN_PUSH_BODY,
    url: "/client/progress?tab=nutricion",
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
  revalidatePath("/client/progress");
  return { success: true };
}
