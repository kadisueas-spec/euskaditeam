"use server";

import { debugError, describeFormFile } from "@/lib/utils/debug-error";

import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants/uploads";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PhotoCategory } from "@/lib/supabase/progress-photos";
import { todayInParaguay } from "@/lib/utils/today";

// Ya viene comprimida del cliente; tope = el del Server Action (oct-2026).
const MAX_FILE_SIZE_BYTES = MAX_UPLOAD_BYTES;
const VALID_CATEGORIES: PhotoCategory[] = ["front", "side", "back"];

// Mismo criterio que app/client/progress/photos-actions.ts — nunca confiar
// en file.type, validar la firma real del archivo.
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function hasValidImageSignature(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, PNG_SIGNATURE.length).arrayBuffer());
  const matches = (sig: number[]) => sig.every((byte, i) => header[i] === byte);
  return matches(JPEG_SIGNATURE) || matches(PNG_SIGNATURE);
}

export type UploadClientPhotoResult = { success: true } | { error: string };

// El coach sube una foto de progreso de un cliente suyo (ej. en una
// evaluación presencial) — comprimida en el browser antes de llegar acá,
// mismo compressImage() que usa el cliente. Marcada uploaded_by='coach'
// (el RLS lo exige igual a nivel de base, ver migración 20260802). El
// consentimiento de uso público ya no vive en progress_photos (ago-2026,
// pasó a ser una sola decisión por cliente) — el coach nunca lo toca.
async function uploadClientProgressPhotoInner(
  clientId: string,
  formData: FormData
): Promise<UploadClientPhotoResult> {
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
  const categoryRaw = String(formData.get("category") ?? "");
  const category = VALID_CATEGORIES.includes(categoryRaw as PhotoCategory)
    ? (categoryRaw as PhotoCategory)
    : null;

  if (!(file instanceof File) || file.size === 0) {
    return { error: `Elegí una foto. ${debugError("Archivo recibido", describeFormFile(file))}` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: `La foto no puede pesar más de ${MAX_UPLOAD_LABEL}.` };
  }
  if (!(await hasValidImageSignature(file))) {
    return { error: `El archivo no es una imagen válida. ${debugError("Archivo recibido", describeFormFile(file))}` };
  }

  const storagePath = `${clientId}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("progress-photos")
    .upload(storagePath, file, { contentType: "image/jpeg" });
  if (uploadError) {
    console.error("uploadClientProgressPhoto storage error:", uploadError);
    return { error: debugError(`Storage progress-photos (subida, path="${storagePath}")`, uploadError) };
  }

  const { error: insertError } = await supabase.from("progress_photos").insert({
    client_id: clientId,
    taken_at: todayInParaguay(),
    category,
    storage_path: storagePath,
    uploaded_by: "coach",
  });
  if (insertError) {
    console.error("uploadClientProgressPhoto insert error:", insertError);
    await supabase.storage.from("progress-photos").remove([storagePath]);
    return { error: debugError("Tabla progress_photos (insert)", insertError) };
  }

  revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/client/body");
  return { success: true };
}

// TEMPORAL (diagnóstico de subidas, ver lib/utils/debug-error.ts): cualquier
// excepción se devuelve como mensaje visible en vez de romper la pantalla.
export async function uploadClientProgressPhoto(clientId: string, formData: FormData): Promise<UploadClientPhotoResult> {
  try {
    return await uploadClientProgressPhotoInner(clientId, formData);
  } catch (err) {
    console.error("uploadClientProgressPhoto excepción:", err);
    return { error: debugError("Excepción en el servidor", err) };
  }
}
