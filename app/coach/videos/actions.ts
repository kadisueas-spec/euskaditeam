"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractYouTubeId } from "@/lib/constants/youtube";
import { VIDEO_CATEGORIES, type VideoCategory } from "@/lib/constants/videos";
import { sendPushToClient } from "@/lib/push/send-push";
import { newVideoAssignedPushTitle, NEW_VIDEO_ASSIGNED_PUSH_BODY } from "@/lib/constants/push-copy";

export type VideoFormState = { error: string } | undefined;

function videoFieldsFromForm(
  formData: FormData
): { title: string; description: string | null; category: VideoCategory } | { error: string } {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "El título es obligatorio." };

  const category = String(formData.get("category") ?? "") as VideoCategory;
  if (!VIDEO_CATEGORIES.includes(category)) {
    return { error: "Elegí una categoría." };
  }

  return {
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    category,
  };
}

// Mismo criterio que resolveVideoId en app/coach/exercises/actions.ts —
// acá el link SIEMPRE es obligatorio (a diferencia del video demostrativo
// de un ejercicio, que es opcional).
function resolveYoutubeId(formData: FormData): { youtubeId: string } | { error: string } {
  const raw = String(formData.get("youtube_url") ?? "").trim();
  if (!raw) return { error: "Pegá el link de YouTube." };

  const youtubeId = extractYouTubeId(raw);
  if (!youtubeId) return { error: "Pegá una URL válida de YouTube." };
  return { youtubeId };
}

function assignedClientIdsFromForm(formData: FormData): string[] {
  return formData.getAll("assigned_client_ids").map((v) => String(v));
}

// Reconciliación de asignaciones: borra todas las filas actuales de
// video_assignments para este video y las reemplaza por el set nuevo
// (nunca se llama si is_general, ver create/updateVideo) — más simple que
// diffear updates/inserts/deletes fila por fila, y a esta escala (unos
// pocos clientes por video) el costo es irrelevante. Devuelve los
// client_id que NO estaban asignados antes, para saber a quién avisar por
// push (asignar de nuevo a alguien que ya lo tenía no debe re-notificar).
async function reconcileAssignments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  videoId: string,
  newClientIds: string[]
): Promise<string[]> {
  const { data: existing } = await supabase
    .from("video_assignments")
    .select("client_id")
    .eq("video_id", videoId);
  const existingIds = new Set((existing ?? []).map((a) => a.client_id));

  await supabase.from("video_assignments").delete().eq("video_id", videoId);

  if (newClientIds.length > 0) {
    await supabase
      .from("video_assignments")
      .insert(newClientIds.map((clientId) => ({ video_id: videoId, client_id: clientId })));
  }

  return newClientIds.filter((id) => !existingIds.has(id));
}

function notifyNewlyAssignedClients(clientIds: string[], videoTitle: string, videoId: string): void {
  for (const clientId of clientIds) {
    sendPushToClient(clientId, {
      title: newVideoAssignedPushTitle(videoTitle),
      body: NEW_VIDEO_ASSIGNED_PUSH_BODY,
      url: `/client/videos/${videoId}`,
    }).catch((error) => {
      console.error("video push error:", error);
    });
  }
}

export async function createVideo(
  _prevState: VideoFormState,
  formData: FormData
): Promise<VideoFormState> {
  const fields = videoFieldsFromForm(formData);
  if ("error" in fields) return fields;

  const youtubeResult = resolveYoutubeId(formData);
  if ("error" in youtubeResult) return youtubeResult;

  const isGeneral = formData.get("visibility") === "general";
  const assignedClientIds = isGeneral ? [] : assignedClientIdsFromForm(formData);
  if (!isGeneral && assignedClientIds.length === 0) {
    return { error: "Elegí al menos un cliente, o marcá el video como general." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: video, error } = await supabase
    .from("videos")
    .insert({
      coach_id: user.id,
      title: fields.title,
      description: fields.description,
      youtube_id: youtubeResult.youtubeId,
      category: fields.category,
      is_general: isGeneral,
    })
    .select("id")
    .single();

  if (error || !video) {
    console.error("createVideo error:", error);
    return { error: "No se pudo crear el video. Intenta de nuevo." };
  }

  if (!isGeneral && assignedClientIds.length > 0) {
    const { error: assignError } = await supabase
      .from("video_assignments")
      .insert(assignedClientIds.map((clientId) => ({ video_id: video.id, client_id: clientId })));
    if (assignError) {
      console.error("createVideo assignment error:", assignError);
      return { error: "El video se creó, pero no se pudo asignar a los clientes." };
    }
    notifyNewlyAssignedClients(assignedClientIds, fields.title, video.id);
  }

  revalidatePath("/coach/videos");
  redirect("/coach/videos");
}

export async function updateVideo(
  videoId: string,
  _prevState: VideoFormState,
  formData: FormData
): Promise<VideoFormState> {
  const fields = videoFieldsFromForm(formData);
  if ("error" in fields) return fields;

  const youtubeResult = resolveYoutubeId(formData);
  if ("error" in youtubeResult) return youtubeResult;

  const isGeneral = formData.get("visibility") === "general";
  const assignedClientIds = isGeneral ? [] : assignedClientIdsFromForm(formData);
  if (!isGeneral && assignedClientIds.length === 0) {
    return { error: "Elegí al menos un cliente, o marcá el video como general." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("videos")
    .update({
      title: fields.title,
      description: fields.description,
      youtube_id: youtubeResult.youtubeId,
      category: fields.category,
      is_general: isGeneral,
      updated_at: new Date().toISOString(),
    })
    .eq("id", videoId);

  if (error) {
    console.error("updateVideo error:", error);
    return { error: "No se pudo guardar el video. Intenta de nuevo." };
  }

  if (isGeneral) {
    await supabase.from("video_assignments").delete().eq("video_id", videoId);
  } else {
    const newlyAssigned = await reconcileAssignments(supabase, videoId, assignedClientIds);
    if (newlyAssigned.length > 0) {
      notifyNewlyAssignedClients(newlyAssigned, fields.title, videoId);
    }
  }

  revalidatePath("/coach/videos");
  redirect("/coach/videos");
}

export async function deleteVideo(videoId: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient();

  const { error } = await supabase.from("videos").delete().eq("id", videoId);

  if (error) {
    console.error("deleteVideo error:", error);
    return { error: "No se pudo eliminar el video. Intenta de nuevo." };
  }

  revalidatePath("/coach/videos");
}
