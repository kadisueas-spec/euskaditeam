import { createClient } from "@/lib/supabase/server";

export { MUSCLE_GROUPS } from "@/lib/constants/exercises";

export type ExerciseListItem = {
  id: string;
  name: string;
  muscleGroup: string | null;
  equipment: string | null;
  videoId: string | null;
  isGlobal: boolean;
};

// coach_id = NULL es un ejercicio "global" (base de Euskadi, compartida
// entre todos los coaches — ver TAREA 1, jul-2026). RLS ya filtra qué fila
// puede ver cada coach (las suyas + todas las globales); acá solo se
// ordena para que las globales aparezcan primero en la biblioteca.
export async function getExercisesList(
  muscleGroup?: string
): Promise<ExerciseListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("exercises")
    .select("id, name, muscle_group, equipment, video_url, coach_id")
    .order("name", { ascending: true });

  if (muscleGroup) {
    query = query.eq("muscle_group", muscleGroup);
  }

  const { data } = await query;

  const items = (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscle_group,
    equipment: e.equipment,
    videoId: e.video_url,
    isGlobal: e.coach_id === null,
  }));

  return items.sort((a, b) => {
    if (a.isGlobal !== b.isGlobal) return a.isGlobal ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export type ExerciseDetail = {
  id: string;
  name: string;
  description: string | null;
  videoId: string | null;
  muscleGroup: string | null;
  secondaryMuscles: string[];
  equipment: string | null;
  movementPattern: string | null;
  techniqueTips: string | null;
  commonMistakes: string | null;
  isGlobal: boolean;
};

export async function getExerciseDetail(
  id: string
): Promise<ExerciseDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("exercises")
    .select(
      "id, name, description, video_url, muscle_group, secondary_muscles, equipment, movement_pattern, technique_tips, common_mistakes, coach_id"
    )
    .eq("id", id)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    videoId: data.video_url,
    muscleGroup: data.muscle_group,
    secondaryMuscles: data.secondary_muscles ?? [],
    equipment: data.equipment,
    movementPattern: data.movement_pattern,
    techniqueTips: data.technique_tips,
    commonMistakes: data.common_mistakes,
    isGlobal: data.coach_id === null,
  };
}
