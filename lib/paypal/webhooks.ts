import { paypalFetch } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

export type PayPalWebhookEvent = {
  id: string;
  event_type: string;
  resource_type: string;
  resource: {
    id: string;
    custom_id?: string;
    plan_id?: string;
    billing_agreement_id?: string;
    subscriber?: { email_address?: string };
  };
};

type VerifySignatureResponse = { verification_status: string };

// Gateada desde afuera por PAYPAL_VERIFY_WEBHOOK (ver app/api/paypal/
// webhook/route.ts) — mientras no exista PAYPAL_WEBHOOK_ID (todavía no se
// registró la URL del webhook en el Dashboard de PayPal) esto no se puede
// llamar en serio, por eso el flag de sandbox.
export async function verifyWebhookSignature(
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("paypal webhook: PAYPAL_WEBHOOK_ID no configurado, no se puede verificar.");
    return false;
  }

  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  const transmissionSig = headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    console.error("paypal webhook: faltan headers de firma, request descartado.");
    return false;
  }

  const verification = await paypalFetch<VerifySignatureResponse>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    }
  );

  return verification.verification_status === "SUCCESS";
}

function extractSubscriptionId(event: PayPalWebhookEvent): string | null {
  if (event.resource_type === "subscription") return event.resource.id;
  if (event.event_type === "PAYMENT.SALE.COMPLETED") {
    return event.resource.billing_agreement_id ?? null;
  }
  return null;
}

async function findClientIdForSubscription(
  admin: ReturnType<typeof createAdminClient>,
  paypalSubscriptionId: string
): Promise<string | null> {
  const { data } = await admin
    .from("subscriptions")
    .select("client_id")
    .eq("paypal_subscription_id", paypalSubscriptionId)
    .maybeSingle();
  return data?.client_id ?? null;
}

// El cliente de Supabase no tira excepción en un error de base — devuelve
// { error }. Sin chequearlo acá, un fallo de escritura (ej. el bug real
// que encontramos: ON CONFLICT contra un índice parcial, código 42P10)
// queda completamente silencioso: el webhook responde 200, no hay ningún
// log, y el estado en la base nunca cambia. Estas dos funciones son la
// única forma de escribir subscriptions/clients desde acá — loguean el
// error real si algo falla, en vez de tragárselo.
async function updateSubscriptionRow(
  admin: ReturnType<typeof createAdminClient>,
  match: { paypal_subscription_id: string } | { client_id: string; paypal_subscription_id: string },
  patch: Record<string, unknown>,
  isUpsert: boolean
): Promise<void> {
  const query = isUpsert
    ? admin.from("subscriptions").upsert({ ...match, ...patch }, { onConflict: "paypal_subscription_id" })
    : admin.from("subscriptions").update(patch).eq("paypal_subscription_id", match.paypal_subscription_id);

  const { error } = await query;
  if (error) {
    console.error("paypal webhook: error escribiendo en subscriptions:", error);
  }
}

async function updateClientStatus(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  subscriptionStatus: string
): Promise<void> {
  const { error } = await admin
    .from("clients")
    .update({ subscription_status: subscriptionStatus })
    .eq("id", clientId);
  if (error) {
    console.error("paypal webhook: error actualizando clients.subscription_status:", error);
  }
}

// Vocabulario de subscriptions.status / clients.subscription_status:
// "active" | "past_due" | "canceled" | "pending" (mismo que ya usa
// STATUS_LABEL en app/client/profile/page.tsx — "canceled" con una sola
// "l", no el CANCELLED de los nombres de evento de PayPal).
export async function handleWebhookEvent(event: PayPalWebhookEvent): Promise<void> {
  const admin = createAdminClient();
  const subscriptionId = extractSubscriptionId(event);

  if (!subscriptionId) {
    console.log(`paypal webhook: ${event.event_type} sin subscription id asociado, ignorado.`);
    return;
  }

  switch (event.event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const clientId =
        event.resource.custom_id ?? (await findClientIdForSubscription(admin, subscriptionId));
      if (!clientId) {
        console.error(`paypal webhook: no se encontró client_id para ${subscriptionId}.`);
        return;
      }

      await updateSubscriptionRow(
        admin,
        { client_id: clientId, paypal_subscription_id: subscriptionId },
        {
          paypal_plan_id: event.resource.plan_id ?? null,
          paypal_payer_email: event.resource.subscriber?.email_address ?? null,
          status: "active",
        },
        true
      );
      await updateClientStatus(admin, clientId, "active");
      break;
    }

    case "BILLING.SUBSCRIPTION.CANCELLED": {
      const clientId =
        event.resource.custom_id ?? (await findClientIdForSubscription(admin, subscriptionId));
      if (!clientId) {
        console.error(`paypal webhook: no se encontró client_id para ${subscriptionId}.`);
        return;
      }

      await updateSubscriptionRow(
        admin,
        { paypal_subscription_id: subscriptionId },
        { status: "canceled", canceled_at: new Date().toISOString() },
        false
      );
      await updateClientStatus(admin, clientId, "canceled");
      break;
    }

    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
      const clientId =
        event.resource.custom_id ?? (await findClientIdForSubscription(admin, subscriptionId));
      if (!clientId) {
        console.error(`paypal webhook: no se encontró client_id para ${subscriptionId}.`);
        return;
      }

      await updateSubscriptionRow(
        admin,
        { paypal_subscription_id: subscriptionId },
        { status: "past_due" },
        false
      );
      await updateClientStatus(admin, clientId, "past_due");
      break;
    }

    case "PAYMENT.SALE.COMPLETED": {
      const clientId = await findClientIdForSubscription(admin, subscriptionId);
      if (!clientId) {
        console.error(`paypal webhook: no se encontró client_id para ${subscriptionId}.`);
        return;
      }

      await updateSubscriptionRow(
        admin,
        { paypal_subscription_id: subscriptionId },
        { status: "active", current_period_start: new Date().toISOString() },
        false
      );
      await updateClientStatus(admin, clientId, "active");
      break;
    }

    default:
      console.log(`paypal webhook: ${event.event_type} no manejado, ignorado.`);
  }
}
