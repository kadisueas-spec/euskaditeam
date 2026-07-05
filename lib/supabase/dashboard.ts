import { createClient } from "@/lib/supabase/server";

export type ClientSummary = {
  id: string;
  userId: string;
  fullName: string | null;
  email: string;
  isActive: boolean;
  subscriptionStatus: string;
  subscriptionEndDate: string | null;
  lastWorkoutDate: string | null;
};

export type RecentLog = {
  id: string;
  clientId: string;
  clientName: string;
  workoutDate: string;
  isCompleted: boolean;
};

export type CoachDashboardData = {
  activeCount: number;
  inactiveCount: number;
  expiringSoon: ClientSummary[];
  recentLogs: RecentLog[];
  staleClients: ClientSummary[];
};

export async function getCoachDashboardData(): Promise<CoachDashboardData> {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, user_id, is_active, subscription_status, subscription_end_date");

  const clientRows = clients ?? [];
  const userIds = clientRows.map((c) => c.user_id).filter((id): id is string => Boolean(id));

  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const clientIds = clientRows.map((c) => c.id);
  const { data: logs } = clientIds.length
    ? await supabase
        .from("workout_logs")
        .select("id, client_id, workout_date, is_completed")
        .in("client_id", clientIds)
        .order("workout_date", { ascending: false })
    : {
        data: [] as {
          id: string;
          client_id: string;
          workout_date: string;
          is_completed: boolean;
        }[],
      };

  const logRows = logs ?? [];

  const lastWorkoutByClient = new Map<string, string>();
  for (const log of logRows) {
    if (!lastWorkoutByClient.has(log.client_id)) {
      lastWorkoutByClient.set(log.client_id, log.workout_date);
    }
  }

  const summaries: ClientSummary[] = clientRows.map((c) => {
    const profile = c.user_id ? profileById.get(c.user_id) : undefined;
    return {
      id: c.id,
      userId: c.user_id,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? "",
      isActive: c.is_active,
      subscriptionStatus: c.subscription_status,
      subscriptionEndDate: c.subscription_end_date,
      lastWorkoutDate: lastWorkoutByClient.get(c.id) ?? null,
    };
  });

  const activeCount = summaries.filter((c) => c.isActive).length;
  const inactiveCount = summaries.length - activeCount;

  const now = Date.now();
  const in7Days = now + 7 * 24 * 60 * 60 * 1000;
  const expiringSoon = summaries.filter((c) => {
    if (!c.subscriptionEndDate) return false;
    const end = new Date(c.subscriptionEndDate).getTime();
    return end >= now && end <= in7Days;
  });

  const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000;
  const staleClients = summaries.filter((c) => {
    if (!c.isActive) return false;
    if (!c.lastWorkoutDate) return true;
    return new Date(c.lastWorkoutDate).getTime() < fiveDaysAgo;
  });

  const clientById = new Map(summaries.map((c) => [c.id, c]));
  const recentLogs: RecentLog[] = logRows.slice(0, 10).map((log) => {
    const client = clientById.get(log.client_id);
    return {
      id: log.id,
      clientId: log.client_id,
      clientName: client?.fullName ?? client?.email ?? "Cliente",
      workoutDate: log.workout_date,
      isCompleted: log.is_completed,
    };
  });

  return { activeCount, inactiveCount, expiringSoon, recentLogs, staleClients };
}
