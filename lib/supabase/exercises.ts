import { createClient } from "@/lib/supabase/server";

export { MUSCLE_GROUPS } from "@/lib/constants/exercises";

export type ExerciseListItem = {
  id: string;
  name: string;
  muscleGroup: string | null;
  equipment: string | null;
  videoId: string | null;
};

export async function getExercisesList(
  muscleGroup?: string
): Promise<ExerciseListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("exercises")
    .select("id, name, muscle_group, equipment, video_url")
    .order("name", { ascending: true });

  if (muscleGroup) {
    query = query.eq("muscle_group", muscleGroup);
  }

  const { data } = await query;

  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscle_group,
    equipment: e.equipment,
    videoId: e.video_url,
  }));
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
};

export async function getExerciseDetail(
  id: string
): Promise<ExerciseDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("exercises")
    .select(
      "id, name, description, video_url, muscle_group, secondary_muscles, equipment, movement_pattern, technique_tips, common_mistakes"
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
  };
}
