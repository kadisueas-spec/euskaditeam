import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export type WeightLogEntry = {
  id: string;
  date: string;
  weightKg: number;
};

type WeightLogRow = {
  id: string;
  date: string;
  weight_kg: number;
};

// Ascendente por fecha — mismo orden que usan las evaluaciones
// antropométricas, sirve tanto para el gráfico como para derivar "hoy ya
// registró" (último elemento) sin una segunda consulta.
export async function getMyWeightLogs(): Promise<WeightLogEntry[]> {
  const client = await getCurrentClientRecord();
  if (!client) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("weight_logs")
    .select("id, date, weight_kg")
    .eq("client_id", client.id)
    .order("date", { ascending: true })
    .returns<WeightLogRow[]>();

  return (data ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    weightKg: row.weight_kg,
  }));
}

// Vista del coach — mismo patrón que getEvaluationsForClient/
// getClientBodyEvaluations: sin chequeo de ownership acá, la página que
// llama a esto ya resolvió al cliente vía getClientDetail(id) (404 si no
// es de este coach) y la RLS ("Coach views weight logs of own clients")
// scoping el resto. Es de solo lectura por diseño — no hay ninguna acción
// de escritura para el coach sobre esta tabla.
export async function getClientWeightLogs(clientId: string): Promise<WeightLogEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weight_logs")
    .select("id, date, weight_kg")
    .eq("client_id", clientId)
    .order("date", { ascending: true })
    .returns<WeightLogRow[]>();

  return (data ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    weightKg: row.weight_kg,
  }));
}
