"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import type { PhotoCategory } from "@/lib/supabase/progress-photos";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — ya viene comprimida del cliente
const VALID_CATEGORIES: PhotoCategory[] = ["front", "side", "back"];

// Auditoría de seguridad jul-2026, sección 3 (mismo criterio que los PDFs
// de nutrición): file.type es el MIME que REPORTA el navegador, no el
// contenido real. compressImage() en el cliente siempre reencodea a JPEG,
// así que alcanza con validar la firma JPEG (FF D8 FF) — pero se acepta
// también PNG por las dudas de que el compressor falle y algún caller
// mande el archivo original sin pasar por la compresión.
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function hasValidImageSignature(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, PNG_SIGNATURE.length).arrayBuffer());
  const matches = (sig: number[]) => sig.every((byte, i) => header[i] === byte);
  return matches(JPEG_SIGNATURE) || matches(PNG_SIGNATURE);
}

export type UploadPhotoResult = { success: true } | { error: string };

// El cliente sube sus propias fotos de progreso — comprimidas en el
// browser antes de llegar acá (compressImage, lib/utils/compress-image.ts).
// Fecha automática (taken_at = hoy, no la elige el cliente), categoría
// opcional.
export async function uploadProgressPhoto(formData: FormData): Promise<UploadPhotoResult> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const file = formData.get("file");
  const categoryRaw = String(formData.get("category") ?? "");
  const category = VALID_CATEGORIES.includes(categoryRaw as PhotoCategory)
    ? (categoryRaw as PhotoCategory)
    : null;

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí una foto." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: "La foto no puede pesar más de 8MB." };
  }
  if (!(await hasValidImageSignature(file))) {
    return { error: "El archivo no es una imagen válida." };
  }

  const supabase = await createClient();
  const storagePath = `${client.id}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("progress-photos")
    .upload(storagePath, file, { contentType: "image/jpeg" });
  if (uploadError) {
    console.error("uploadProgressPhoto storage error:", uploadError);
    return { error: "No se pudo subir la foto." };
  }

  const { error: insertError } = await supabase.from("progress_photos").insert({
    client_id: client.id,
    taken_at: new Date().toISOString().slice(0, 10),
    category,
    storage_path: storagePath,
  });
  if (insertError) {
    console.error("uploadProgressPhoto insert error:", insertError);
    await supabase.storage.from("progress-photos").remove([storagePath]);
    return { error: "No se pudo guardar la foto." };
  }

  revalidatePath("/client/progress");
  return { success: true };
}

export type DeletePhotoResult = { success: true } | { error: string };

export async function deleteProgressPhoto(photoId: string): Promise<DeletePhotoResult> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const supabase = await createClient();

  const { data: photo } = await supabase
    .from("progress_photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .eq("client_id", client.id)
    .maybeSingle();
  if (!photo) return { error: "Foto no encontrada." };

  const { error: deleteError } = await supabase
    .from("progress_photos")
    .delete()
    .eq("id", photoId);
  if (deleteError) {
    console.error("deleteProgressPhoto delete error:", deleteError);
    return { error: "No se pudo eliminar la foto." };
  }

  await supabase.storage.from("progress-photos").remove([photo.storage_path]);

  revalidatePath("/client/progress");
  return { success: true };
}

// Descartar el recordatorio mensual de fotos (jul-2026) — snooze de 7 días,
// ver PHOTO_REMINDER_SNOOZE_DAYS en lib/supabase/progress-photos.ts.
export async function dismissProgressPhotoReminder(): Promise<void> {
  const client = await getCurrentClientRecord();
  if (!client) return;

  const supabase = await createClient();
  await supabase
    .from("clients")
    .update({ progress_photo_reminder_dismissed_at: new Date().toISOString() })
    .eq("id", client.id);

  revalidatePath("/client/progress");
}
