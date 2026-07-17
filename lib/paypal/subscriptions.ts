import { paypalFetch } from "./client";

type CreateSubscriptionResponse = {
  id: string;
  status: string;
  links: { rel: string; href: string }[];
};

export type CreateSubscriptionResult = {
  subscriptionId: string;
  approvalUrl: string;
};

// custom_id: clientId — así el webhook puede mapear el evento de vuelta al
// cliente sin depender de haber guardado nada más de antemano (además,
// como red de seguridad, el webhook también busca por
// subscriptions.paypal_subscription_id para los eventos que no traen
// custom_id, ver lib/paypal/webhooks.ts).
export async function createSubscription(
  planId: string,
  clientId: string,
  returnUrl: string,
  cancelUrl: string
): Promise<CreateSubscriptionResult> {
  const sub = await paypalFetch<CreateSubscriptionResponse>("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      custom_id: clientId,
      application_context: {
        brand_name: "Euskadi Team",
        return_url: returnUrl,
        cancel_url: cancelUrl,
        user_action: "SUBSCRIBE_NOW",
      },
    }),
  });

  const approvalLink = sub.links.find((l) => l.rel === "approve");
  if (!approvalLink) throw new Error("PayPal no devolvió un link de aprobación.");

  return { subscriptionId: sub.id, approvalUrl: approvalLink.href };
}

export type PayPalSubscriptionDetail = {
  id: string;
  status: string;
  subscriber?: { email_address?: string };
};

export async function getSubscription(
  subscriptionId: string
): Promise<PayPalSubscriptionDetail> {
  return paypalFetch<PayPalSubscriptionDetail>(
    `/v1/billing/subscriptions/${subscriptionId}`,
    { method: "GET" }
  );
}

// 204 sin body en éxito.
export async function cancelSubscription(
  subscriptionId: string,
  reason: string
): Promise<void> {
  await paypalFetch<void>(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
