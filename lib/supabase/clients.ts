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

export async function getClientsList(): Promise<ClientListItem[]> {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, user_id, is_active, subscription_status, subscription_end_date")
    .order("created_at", { ascending: false });

  const clientRows = clients ?? [];
  if (clientRows.length === 0) return [];

  const userIds = clientRows
    .map((c) => c.user_id)
    .filter((id): id is string => Boolean(id));
  const clientIds = clientRows.map((c) => c.id);

  const [{ data: profiles }, { data: logs }, { data: routines }] =
    await Promise.all([
      userIds.length
        ? supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", userIds)
        : Promise.resolve({
            data: [] as { id: string; full_name: string | null; email: string }[],
          }),
      supabase
        .from("workout_logs")
        .select("client_id, workout_date")
        .in("client_id", clientIds)
        .order("workout_date", { ascending: false }),
      supabase
        .from("routines")
        .select("client_id, name")
        .in("client_id", clientIds)
        .eq("is_active", true),
    ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const lastWorkoutByClient = new Map<string, string>();
  for (const log of logs ?? []) {
    if (!lastWorkoutByClient.has(log.client_id)) {
      lastWorkoutByClient.set(log.client_id, log.workout_date);
    }
  }

  const activeRoutineByClient = new Map<string, string>();
  for (const routine of routines ?? []) {
    if (routine.client_id && !activeRoutineByClient.has(routine.client_id)) {
      activeRoutineByClient.set(routine.client_id, routine.name);
    }
  }

  return clientRows.map((c) => {
    const profile = c.user_id ? profileById.get(c.user_id) : undefined;
    return {
      id: c.id,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? "",
      isActive: c.is_active,
      subscriptionStatus: c.subscription_status,
      subscriptionEndDate: c.subscription_end_date,
      lastWorkoutDate: lastWorkoutByClient.get(c.id) ?? null,
      activeRoutineName: activeRoutineByClient.get(c.id) ?? null,
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

export async function getClientDetail(
  clientId: string
): Promise<ClientDetail | null> {
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, user_id, birth_date, weight_kg, height_cm, goal, training_experience, notes_coach, is_active, subscription_status, subscription_end_date, payment_method"
    )
    .eq("id", clientId)
    .single();

  if (!client) return null;

  const [{ data: profile }, { data: routines }, { data: logs }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", client.user_id)
        .single(),
      supabase
        .from("routines")
        .select("id, name, is_active, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("workout_logs")
        .select("id, workout_date, is_completed")
        .eq("client_id", client.id)
        .order("workout_date", { ascending: false })
        .limit(10),
    ]);

  return {
    id: client.id,
    userId: client.user_id,
    fullName: profile?.full_name ?? null,
    email: profile?.email ?? "",
    avatarUrl: profile?.avatar_url ?? null,
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
    routines: (routines ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      isActive: r.is_active,
      createdAt: r.created_at,
    })),
    recentLogs: (logs ?? []).map((log) => ({
      id: log.id,
      workoutDate: log.workout_date,
      isCompleted: log.is_completed,
    })),
  };
}
