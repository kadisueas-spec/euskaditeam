"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractYouTubeId } from "@/lib/constants/youtube";

export type ExerciseFormState = { error: string } | undefined;

function parseSecondaryMuscles(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

function exerciseFieldsFromForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  return {
    name,
    muscle_group: String(formData.get("muscle_group") ?? "").trim() || null,
    secondary_muscles: parseSecondaryMuscles(formData.get("secondary_muscles")),
    equipment: String(formData.get("equipment") ?? "").trim() || null,
    movement_pattern:
      String(formData.get("movement_pattern") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    technique_tips:
      String(formData.get("technique_tips") ?? "").trim() || null,
    common_mistakes:
      String(formData.get("common_mistakes") ?? "").trim() || null,
  };
}

// video_url guarda solo el ID de YouTube (no la URL completa) para poder
// armar el embed y la miniatura sin volver a parsear la URL pegada.
function resolveVideoId(
  formData: FormData
): { videoId: string | null; error?: string } {
  const raw = String(formData.get("video_url") ?? "").trim();
  if (!raw) return { videoId: null };

  const videoId = extractYouTubeId(raw);
  if (!videoId) {
    return { videoId: null, error: "Pegá una URL válida de YouTube." };
  }
  return { videoId };
}

export async function createExercise(
  _prevState: ExerciseFormState,
  formData: FormData
): Promise<ExerciseFormState> {
  const fields = exerciseFieldsFromForm(formData);
  if (!fields.name) return { error: "El nombre es obligatorio." };

  const { videoId, error: videoError } = resolveVideoId(formData);
  if (videoError) return { error: videoError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase
    .from("exercises")
    .insert({ ...fields, video_url: videoId, coach_id: user.id });

  if (error) {
    console.error("createExercise error:", error);
    return { error: "No se pudo crear el ejercicio. Intentá de nuevo." };
  }

  revalidatePath("/coach/exercises");
  redirect("/coach/exercises");
}

export async function updateExercise(
  exerciseId: string,
  _prevState: ExerciseFormState,
  formData: FormData
): Promise<ExerciseFormState> {
  const fields = exerciseFieldsFromForm(formData);
  if (!fields.name) return { error: "El nombre es obligatorio." };

  const { videoId, error: videoError } = resolveVideoId(formData);
  if (videoError) return { error: videoError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("exercises")
    .update({ ...fields, video_url: videoId })
    .eq("id", exerciseId);

  if (error) {
    console.error("updateExercise error:", error);
    return { error: "No se pudo guardar el ejercicio. Intentá de nuevo." };
  }

  revalidatePath("/coach/exercises");
  redirect("/coach/exercises");
}
