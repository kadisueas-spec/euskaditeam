"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { getMySubscription } from "@/lib/supabase/subscriptions";
import { cancelSubscription } from "@/lib/paypal/subscriptions";

export type CancelMyPaypalState =
  | { success: true; message: string }
  | { warning: string }
  | { error: string }
  | undefined;

// Asimetría deliberada con cancelPaypalSubscription del coach (ver
// app/coach/clients/[id]/paypal-actions.ts): ahí, si PayPal falla, el
// acceso se corta igual — porque el riesgo es que un cliente se quede con
// acceso gratis. Acá es al revés: si PayPal falla, NO tocamos
// subscription_status — porque el riesgo es que el cliente pierda el
// acceso mientras PayPal le sigue cobrando. Mejor dejarlo como estaba y
// avisarle que hable con el coach.
export async function cancelMyPaypalSubscription(
  _prevState: CancelMyPaypalState,
  _formData: FormData
): Promise<CancelMyPaypalState> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("paypal_subscription_id")
    .eq("client_id", client.id)
    .neq("status", "canceled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.paypal_subscription_id) {
    return { error: "No tenés una suscripción de PayPal activa." };
  }

  try {
    await cancelSubscription(
      sub.paypal_subscription_id,
      "Cancelada por el cliente desde su perfil"
    );
    await admin
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("paypal_subscription_id", sub.paypal_subscription_id);
  } catch (error) {
    console.error("cancelMyPaypalSubscription: error cancelando en PayPal:", error);
    return {
      warning: "Hubo un problema al cancelar tu suscripción. Contactá a tu coach.",
    };
  }

  const supabase = await createClient();
  await supabase.from("clients").update({ subscription_status: "canceled" }).eq("id", client.id);
  revalidatePath("/client/profile");

  return { success: true, message: "Tu suscripción fue cancelada correctamente." };
}

// Usado por el polling de /client/subscription-confirmed — nunca activa
// nada por sí mismo, solo lee el estado que el webhook ya actualizó (o
// todavía no, si PayPal tarda unos segundos en mandar el evento).
export async function checkMySubscriptionStatus(): Promise<string | null> {
  const subscription = await getMySubscription();
  return subscription?.status ?? null;
}
