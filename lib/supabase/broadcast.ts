import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import { isAccessActive } from "@/lib/constants/access";

// Destinatarios de las novedades (oct-2026): los clientes del coach con
// acceso activo, con el mismo criterio que el resto de la app
// (isAccessActive: status "active" y sin vencer). Lectura con la sesión del
// coach (RLS: solo ve sus clientes). null si no es coach.
export async function getBroadcastAudience(): Promise<{ coachId: string; clientIds: string[] } | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "coach") return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, subscription_status, subscription_end_date")
    .eq("coach_id", profile.id)
    .returns<{ id: string; subscription_status: string | null; subscription_end_date: string | null }[]>();
  const clientIds = (data ?? [])
    .filter((c) => isAccessActive(c.subscription_status ?? "inactive", c.subscription_end_date))
    .map((c) => c.id);
  return { coachId: profile.id, clientIds };
}
