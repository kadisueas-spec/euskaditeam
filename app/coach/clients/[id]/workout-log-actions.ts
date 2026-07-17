"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type WorkoutLogActionState = { error: string } | { success: true } | undefined;

// Auditoría de seguridad jul-2026, sección 4: la RLS ("Coach
// updates/deletes client workout logs", migración 20260711) ya garantiza
// que el coach solo puede tocar workout_logs de SUS clientes — sigue
// siendo la protección real. Este chequeo es defensa en profundidad
// (mismo patrón que deleteClient en actions.ts): no depender de una sola
// capa si esa policy alguna vez se toca o se rompe.
async function assertOwnsWorkoutLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  logId: string,
  coachId: string
): Promise<string | null> {
  const { data: log, error } = await supabase
    .from("workout_logs")
    .select("id, clients!inner(coach_id)")
    .eq("id", logId)
    .eq("client_id", clientId)
    .eq("clients.coach_id", coachId)
    .maybeSingle();

  if (error) {
    console.error("assertOwnsWorkoutLog lookup error:", error);
    return "No se pudo verificar el entrenamiento.";
  }
  if (!log) return "Entrenamiento no encontrado.";
  return null;
}

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

  const ownershipError = await assertOwnsWorkoutLog(supabase, clientId, logId, user.id);
  if (ownershipError) return { error: ownershipError };

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

  const ownershipError = await assertOwnsWorkoutLog(supabase, clientId, logId, user.id);
  if (ownershipError) return { error: ownershipError };

  const { error } = await supabase.from("workout_logs").delete().eq("id", logId);

  if (error) {
    console.error("deleteWorkoutLog error:", error);
    return { error: "No se pudo eliminar el entrenamiento." };
  }

  revalidatePath(`/coach/clients/${clientId}`);
  return { success: true };
}
