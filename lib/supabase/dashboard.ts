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

type DashboardClientRow = {
  id: string;
  user_id: string;
  is_active: boolean;
  subscription_status: string;
  subscription_end_date: string | null;
  profiles: { full_name: string | null; email: string } | null;
  workout_logs: {
    id: string;
    workout_date: string;
    is_completed: boolean;
  }[];
};

// Antes: 3 round trips secuenciales (clients -> profiles -> logs). Ahora: 1
// sola consulta con profiles y workout_logs embebidos (ordenados por fecha
// descendente vía referencedTable, igual que antes).
export async function getCoachDashboardData(): Promise<CoachDashboardData> {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select(
      `id, user_id, is_active, subscription_status, subscription_end_date,
       profiles!clients_user_id_fkey ( full_name, email ),
       workout_logs ( id, workout_date, is_completed )`
    )
    .order("workout_date", { ascending: false, referencedTable: "workout_logs" })
    .returns<DashboardClientRow[]>();

  const clientRows = clients ?? [];

  const summaries: ClientSummary[] = clientRows.map((c) => ({
    id: c.id,
    userId: c.user_id,
    fullName: c.profiles?.full_name ?? null,
    email: c.profiles?.email ?? "",
    isActive: c.is_active,
    subscriptionStatus: c.subscription_status,
    subscriptionEndDate: c.subscription_end_date,
    lastWorkoutDate: c.workout_logs[0]?.workout_date ?? null,
  }));

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
  const allLogs = clientRows.flatMap((c) =>
    c.workout_logs.map((log) => ({ ...log, client_id: c.id }))
  );
  // Igual que antes: el primer log de cada cliente ya viene ordenado por
  // fecha desc, pero entre clientes distintos hay que volver a ordenar
  // para tomar los 10 más recientes globales.
  allLogs.sort(
    (a, b) => new Date(b.workout_date).getTime() - new Date(a.workout_date).getTime()
  );

  const recentLogs: RecentLog[] = allLogs.slice(0, 10).map((log) => {
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
