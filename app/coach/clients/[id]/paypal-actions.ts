"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPayPalProduct, getExistingPayPalProductId } from "@/lib/paypal/products";
import { createBillingPlan } from "@/lib/paypal/plans";
import { createSubscription, cancelSubscription } from "@/lib/paypal/subscriptions";

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "euskaditeam.vercel.app";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export type GeneratePaymentLinkState =
  | { success: true; approvalUrl: string }
  | { error: string }
  | undefined;

export async function generatePaymentLink(
  clientId: string,
  _prevState: GeneratePaymentLinkState,
  formData: FormData
): Promise<GeneratePaymentLinkState> {
  const priceRaw = String(formData.get("monthly_price_usd") ?? "").trim();
  const price = Number(priceRaw.replace(",", "."));
  if (!Number.isFinite(price) || price <= 0 || price > 10000) {
    return { error: "Ingresá un precio mensual válido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, coach_id, profiles!clients_user_id_fkey ( full_name )")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (clientError) {
    console.error("generatePaymentLink client lookup error:", clientError);
    return { error: "No se pudo verificar el cliente." };
  }
  if (!client) return { error: "Cliente no encontrado." };

  // Opción A acordada: un solo Product para toda la app, creado la primera
  // vez que haga falta. Si no existe todavía, se crea acá y se corta el
  // flujo — no sigue creando plan+suscripción en este mismo request, para
  // no arriesgarse a crear un Product duplicado en cada invocación
  // mientras PAYPAL_PRODUCT_ID todavía no se propagó a Vercel.
  let productId = getExistingPayPalProductId();
  if (!productId) {
    try {
      productId = await createPayPalProduct();
    } catch (error) {
      console.error("generatePaymentLink: error creando el producto de PayPal:", error);
      return { error: "No se pudo crear el producto de PayPal. Revisá las credenciales." };
    }
    console.error(
      `PAYPAL_PRODUCT_ID creado por primera vez: ${productId} — agregalo a .env.local y a Vercel, y volvé a generar el link.`
    );
    return {
      error: `Se creó el producto de PayPal por primera vez (ID: ${productId}). Agregá PAYPAL_PRODUCT_ID=${productId} a las variables de entorno y volvé a intentar.`,
    };
  }

  const profiles = client.profiles as { full_name: string | null }[] | { full_name: string | null } | null;
  const profile = Array.isArray(profiles) ? profiles[0] : profiles;
  const clientLabel = profile?.full_name ?? clientId;

  let planId: string;
  let subscriptionId: string;
  let approvalUrl: string;
  try {
    planId = await createBillingPlan(productId, price, clientLabel);
    const baseUrl = await getBaseUrl();
    const result = await createSubscription(
      planId,
      clientId,
      `${baseUrl}/client/subscription-confirmed`,
      `${baseUrl}/client/subscription-confirmed?status=cancelled`
    );
    subscriptionId = result.subscriptionId;
    approvalUrl = result.approvalUrl;
  } catch (error) {
    console.error("generatePaymentLink: error creando plan/suscripción en PayPal:", error);
    return { error: "No se pudo generar el link de pago. Revisá la consola del servidor." };
  }

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("subscriptions").insert({
    client_id: clientId,
    status: "pending",
    paypal_subscription_id: subscriptionId,
    paypal_plan_id: planId,
  });
  if (insertError) {
    // No cortamos: el link ya existe en PayPal y sigue sirviendo — el
    // webhook de ACTIVATED igual puede mapear el cliente por custom_id
    // aunque esta fila "pending" no se haya guardado.
    console.error("generatePaymentLink: error guardando la suscripción pendiente:", insertError);
  }

  await supabase.from("clients").update({ payment_method: "paypal" }).eq("id", clientId);

  revalidatePath(`/coach/clients/${clientId}`);
  return { success: true, approvalUrl };
}

export type CancelPaypalState =
  | { success: true; message: string }
  | { warning: string }
  | { error: string }
  | undefined;

export async function cancelPaypalSubscription(
  clientId: string,
  _prevState: CancelPaypalState,
  _formData: FormData
): Promise<CancelPaypalState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .maybeSingle();
  if (clientError) {
    console.error("cancelPaypalSubscription client lookup error:", clientError);
    return { error: "No se pudo verificar el cliente." };
  }
  if (!client) return { error: "Cliente no encontrado." };

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("paypal_subscription_id")
    .eq("client_id", clientId)
    .neq("status", "canceled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.paypal_subscription_id) {
    return { error: "Este cliente no tiene una suscripción de PayPal activa." };
  }

  try {
    await cancelSubscription(sub.paypal_subscription_id, "Cancelada por el coach desde el panel");
    await admin
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("paypal_subscription_id", sub.paypal_subscription_id);
  } catch (error) {
    console.error("cancelPaypalSubscription: error cancelando en PayPal:", error);
    return {
      warning:
        "Hubo un problema al cancelar en PayPal. Verificá manualmente en tu panel de PayPal.",
    };
  }

  await supabase.from("clients").update({ subscription_status: "canceled" }).eq("id", clientId);
  revalidatePath(`/coach/clients/${clientId}`);

  return { success: true, message: "Suscripción de PayPal cancelada correctamente." };
}
