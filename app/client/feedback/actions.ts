"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

// D2: revalidatePath acá (Server Action) sí invalida el router cache del
// layout de /client, donde vive el badge "Tenés mensajes nuevos" — llamarlo
// durante el render de la página de detalle (como antes) no alcanzaba.
export async function markFeedbackRead(id: string): Promise<void> {
  const client = await getCurrentClientRecord();
  if (!client) return;

  const supabase = await createClient();
  await supabase
    .from("feedback")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", client.id)
    .eq("is_read", false);

  revalidatePath("/client", "layout");
}
