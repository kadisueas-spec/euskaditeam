import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  // Notificaciones con el mismo tag se reemplazan en vez de apilarse.
  tag?: string;
};

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

async function deliver(
  subscriptions: Subscription[],
  payload: PushPayload,
  supabase: ReturnType<typeof createAdminClient>
): Promise<boolean[]> {
  // true = entregada a ese dispositivo (para contar quién la recibió).
  return Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          // urgency "high": sin esto el default es "normal", y en iOS eso
          // hace que el sistema pueda demorar la entrega hasta que la app
          // se abra en vez de mostrarla enseguida en background.
          { urgency: "high" }
        );
        return true;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("sendPush error:", error);
        }
        return false;
      }
    })
  );
}

// Envía una push a todos los dispositivos suscriptos de un cliente. Borra
// las suscripciones que el navegador ya invalidó (410 Gone / 404).
export async function sendPushToClient(
  clientId: string,
  payload: PushPayload
): Promise<void> {
  const supabase = createAdminClient();

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("client_id", clientId);

  if (!subscriptions || subscriptions.length === 0) return;

  await deliver(subscriptions, payload, supabase);
}

// Igual que sendPushToClient pero para el coach — avisos de mesociclo por
// terminar y de adherencia del cliente (ver Fase 7, push notifications).
export async function sendPushToCoach(
  coachId: string,
  payload: PushPayload
): Promise<void> {
  const supabase = createAdminClient();

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("coach_id", coachId);

  if (!subscriptions || subscriptions.length === 0) return;

  await deliver(subscriptions, payload, supabase);
}

// Push a varios clientes a la vez (novedades, oct-2026). Los que no tienen
// push activado se saltean sin error. Devuelve cuántos clientes la
// recibieron en al menos un dispositivo, cuántos no tienen push y cuántos
// tenían push pero no se les pudo entregar.
export async function sendPushToClients(
  clientIds: string[],
  payload: PushPayload
): Promise<{ delivered: number; withoutPush: number; failed: number }> {
  if (clientIds.length === 0) return { delivered: 0, withoutPush: 0, failed: 0 };
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, client_id")
    .in("client_id", clientIds)
    .returns<(Subscription & { client_id: string })[]>();
  const subs = data ?? [];
  const results = await deliver(subs, payload, supabase);
  const reached = new Set<string>();
  const withSubs = new Set<string>();
  subs.forEach((sub, i) => {
    withSubs.add(sub.client_id);
    if (results[i]) reached.add(sub.client_id);
  });
  return {
    delivered: reached.size,
    withoutPush: clientIds.filter((id) => !withSubs.has(id)).length,
    failed: withSubs.size - reached.size,
  };
}

// Cuántos de estos clientes tienen push activado en al menos un dispositivo
// (vista previa de la pantalla de novedades; no envía nada).
export async function countClientsWithPush(clientIds: string[]): Promise<number> {
  if (clientIds.length === 0) return 0;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("client_id")
    .in("client_id", clientIds)
    .returns<{ client_id: string }[]>();
  return new Set((data ?? []).map((d) => d.client_id)).size;
}
