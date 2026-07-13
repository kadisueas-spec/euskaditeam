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
};

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

async function deliver(
  subscriptions: Subscription[],
  payload: PushPayload,
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  await Promise.all(
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
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("sendPush error:", error);
        }
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
