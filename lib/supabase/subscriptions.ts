import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";

export type ClientSubscription = {
  id: string;
  status: string;
  paypalSubscriptionId: string | null;
  paypalPayerEmail: string | null;
  canceledAt: string | null;
  createdAt: string;
};

type SubscriptionRow = {
  id: string;
  status: string;
  paypal_subscription_id: string | null;
  paypal_payer_email: string | null;
  canceled_at: string | null;
  created_at: string;
};

// La más reciente para este cliente (puede haber varias históricas si se
// suscribió, canceló, y volvió a generar un link nuevo) — nunca la que no
// esté cancelada, se ordena por fecha así siempre gana la última.
export async function getClientSubscription(
  clientId: string
): Promise<ClientSubscription | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("id, status, paypal_subscription_id, paypal_payer_email, canceled_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .returns<SubscriptionRow>();

  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    paypalSubscriptionId: data.paypal_subscription_id,
    paypalPayerEmail: data.paypal_payer_email,
    canceledAt: data.canceled_at,
    createdAt: data.created_at,
  };
}

// Vista del cliente sobre su propia suscripción — misma query RLS-scoped
// que getClientSubscription, funciona igual para el cliente gracias a la
// policy "Client views own subscriptions".
export async function getMySubscription(): Promise<ClientSubscription | null> {
  const client = await getCurrentClientRecord();
  if (!client) return null;
  return getClientSubscription(client.id);
}
