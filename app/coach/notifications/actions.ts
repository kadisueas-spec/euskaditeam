"use server";

import { getBroadcastAudience } from "@/lib/supabase/broadcast";
import { sendPushToClients } from "@/lib/push/send-push";
import { buildBroadcastPayload } from "@/lib/push/broadcast";

export type BroadcastResult =
  | { delivered: number; withoutPush: number; failed: number; total: number }
  | { error: string };

// Envía la novedad a todos los clientes con acceso activo del coach. Solo
// el coach (getBroadcastAudience verifica el rol); los destinatarios se
// calculan acá en el servidor, nunca vienen del navegador. Los que no
// tienen push activado se saltean.
export async function sendBroadcast(title: string, body: string): Promise<BroadcastResult> {
  const audience = await getBroadcastAudience();
  if (!audience) return { error: "No autorizado." };
  const built = buildBroadcastPayload({ title, body });
  if ("error" in built) return { error: built.error };
  if (audience.clientIds.length === 0) return { error: "No tenés clientes con acceso activo." };
  try {
    const result = await sendPushToClients(audience.clientIds, built.payload);
    return { ...result, total: audience.clientIds.length };
  } catch (err) {
    console.error("sendBroadcast error:", err);
    return { error: "No se pudo enviar. Probá de nuevo." };
  }
}
