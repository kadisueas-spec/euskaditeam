"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type WorkoutLogActionState = { error: string } | { success: true } | undefined;

// La RLS ("Coach updates/deletes client workout logs", migración
// 20260711) ya garantiza que el coach solo puede tocar workout_logs de
// SUS clientes — no hace falta un chequeo de dueño extra acá.
export async function updateWorkoutLog(
  clientId: string,
  logId: string,
  patch: { workoutDate: string; isCompleted: boolean }
): Promise<WorkoutLogActionState> {
  if (!patch.workoutDate) return { error: "La fecha es obligatoria." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase
    .from("workout_logs")
    .update({ workout_date: patch.workoutDate, is_completed: patch.isCompleted })
    .eq("id", logId);

  if (error) {
    console.error("updateWorkoutLog error:", error);
    return { error: "No se pudo actualizar el entrenamiento." };
  }

  revalidatePath(`/coach/clients/${clientId}`);
  return { success: true };
}

export async function deleteWorkoutLog(
  clientId: string,
  logId: string
): Promise<WorkoutLogActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase.from("workout_logs").delete().eq("id", logId);

  if (error) {
    console.error("deleteWorkoutLog error:", error);
    return { error: "No se pudo eliminar el entrenamiento." };
  }

  revalidatePath(`/coach/clients/${clientId}`);
  return { success: true };
}
