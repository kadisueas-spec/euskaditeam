import { createClient } from "@/lib/supabase/server";

export type ClientListItem = {
  id: string;
  fullName: string | null;
  email: string;
  isActive: boolean;
  subscriptionStatus: string;
  subscriptionEndDate: string | null;
  lastWorkoutDate: string | null;
  activeRoutineName: string | null;
};

type ClientListRow = {
  id: string;
  is_active: boolean;
  subscription_status: string;
  subscription_end_date: string | null;
  profiles: { full_name: string | null; email: string } | null;
  workout_logs: { workout_date: string }[];
  routines: { name: string; is_active: boolean }[];
};

// Antes: 1 (clients) + 3 en paralelo (profiles, logs, routines) = efectivo
// 2 round trips. Ahora: 1 sola consulta con todo embebido.
export async function getClientsList(): Promise<ClientListItem[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("clients")
    .select(
      `id, is_active, subscription_status, subscription_end_date,
       profiles!clients_user_id_fkey ( full_name, email ),
       workout_logs ( workout_date ),
       routines ( name, is_active )`
    )
    .order("created_at", { ascending: false })
    .order("workout_date", { ascending: false, referencedTable: "workout_logs" })
    .returns<ClientListRow[]>();

  return (data ?? []).map((c) => {
    const activeRoutine = c.routines.find((r) => r.is_active);
    return {
      id: c.id,
      fullName: c.profiles?.full_name ?? null,
      email: c.profiles?.email ?? "",
      isActive: c.is_active,
      subscriptionStatus: c.subscription_status,
      subscriptionEndDate: c.subscription_end_date,
      lastWorkoutDate: c.workout_logs[0]?.workout_date ?? null,
      activeRoutineName: activeRoutine?.name ?? null,
    };
  });
}

export type ClientDetail = {
  id: string;
  userId: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  birthDate: string | null;
  weightKg: number | null;
  heightCm: number | null;
  goal: string | null;
  trainingExperience: string | null;
  notesCoach: string | null;
  isActive: boolean;
  subscriptionStatus: string;
  subscriptionEndDate: string | null;
  paymentMethod: string | null;
  routines: { id: string; name: string; isActive: boolean; createdAt: string }[];
  recentLogs: { id: string; workoutDate: string; isCompleted: boolean }[];
};

type ClientDetailRow = {
  id: string;
  user_id: string;
  birth_date: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  goal: string | null;
  training_experience: string | null;
  notes_coach: string | null;
  is_active: boolean;
  subscription_status: string;
  subscription_end_date: string | null;
  payment_method: string | null;
  profiles: { full_name: string | null; email: string; avatar_url: string | null } | null;
  routines: { id: string; name: string; is_active: boolean; created_at: string }[];
  workout_logs: { id: string; workout_date: string; is_completed: boolean }[];
};

// Antes: 1 (client) + 3 en paralelo (profile, routines, logs) = efectivo 2
// round trips. Ahora: 1 sola consulta con todo embebido (ordering y límite
// de logs vía referencedTable, igual que antes).
export async function getClientDetail(
  clientId: string
): Promise<ClientDetail | null> {
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select(
      `id, user_id, birth_date, weight_kg, height_cm, goal, training_experience,
       notes_coach, is_active, subscription_status, subscription_end_date, payment_method,
       profiles!clients_user_id_fkey ( full_name, email, avatar_url ),
       routines ( id, name, is_active, created_at ),
       workout_logs ( id, workout_date, is_completed )`
    )
    .eq("id", clientId)
    .order("created_at", { ascending: false, referencedTable: "routines" })
    .order("workout_date", { ascending: false, referencedTable: "workout_logs" })
    .limit(10, { referencedTable: "workout_logs" })
    .single()
    .returns<ClientDetailRow>();

  if (!client) return null;

  return {
    id: client.id,
    userId: client.user_id,
    fullName: client.profiles?.full_name ?? null,
    email: client.profiles?.email ?? "",
    avatarUrl: client.profiles?.avatar_url ?? null,
    birthDate: client.birth_date,
    weightKg: client.weight_kg,
    heightCm: client.height_cm,
    goal: client.goal,
    trainingExperience: client.training_experience,
    notesCoach: client.notes_coach,
    isActive: client.is_active,
    subscriptionStatus: client.subscription_status,
    subscriptionEndDate: client.subscription_end_date,
    paymentMethod: client.payment_method,
    routines: client.routines.map((r) => ({
      id: r.id,
      name: r.name,
      isActive: r.is_active,
      createdAt: r.created_at,
    })),
    recentLogs: client.workout_logs.map((log) => ({
      id: log.id,
      workoutDate: log.workout_date,
      isCompleted: log.is_completed,
    })),
  };
}
