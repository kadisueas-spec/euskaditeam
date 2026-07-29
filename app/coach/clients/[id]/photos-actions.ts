"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PhotoCategory } from "@/lib/supabase/progress-photos";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — ya viene comprimida del cliente
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
export async function uploadClientProgressPhoto(
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
    return { error: "Elegí una foto." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: "La foto no puede pesar más de 8MB." };
  }
  if (!(await hasValidImageSignature(file))) {
    return { error: "El archivo no es una imagen válida." };
  }

  const storagePath = `${clientId}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("progress-photos")
    .upload(storagePath, file, { contentType: "image/jpeg" });
  if (uploadError) {
    console.error("uploadClientProgressPhoto storage error:", uploadError);
    return { error: "No se pudo subir la foto." };
  }

  const { error: insertError } = await supabase.from("progress_photos").insert({
    client_id: clientId,
    taken_at: new Date().toISOString().slice(0, 10),
    category,
    storage_path: storagePath,
    uploaded_by: "coach",
  });
  if (insertError) {
    console.error("uploadClientProgressPhoto insert error:", insertError);
    await supabase.storage.from("progress-photos").remove([storagePath]);
    return { error: "No se pudo guardar la foto." };
  }

  revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/client/progress");
  return { success: true };
}
