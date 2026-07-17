"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FEEDBACK_TYPES } from "@/lib/constants/feedback";
import type { FeedbackType } from "@/lib/constants/feedback";
import { getMonthKey } from "@/lib/supabase/monthly-goals";
import { PAYMENT_METHODS } from "@/lib/constants/access";
import type { PaymentMethod } from "@/lib/constants/access";
import { sendPushToClient } from "@/lib/push/send-push";
import { FEEDBACK_PUSH_TITLES, pickPushCopy } from "@/lib/constants/push-copy";
import { cancelSubscription } from "@/lib/paypal/subscriptions";

export type FeedbackFormState = { error: string } | { success: true } | undefined;

export async function createFeedback(
  clientId: string,
  _prevState: FeedbackFormState,
  formData: FormData
): Promise<FeedbackFormState> {
  const type = String(formData.get("type") ?? "") as FeedbackType;
  const message = String(formData.get("message") ?? "").trim();
  const workoutLogIdRaw = String(formData.get("workout_log_id") ?? "");
  const routineExerciseIdRaw = String(formData.get("routine_exercise_id") ?? "");

  if (!FEEDBACK_TYPES.includes(type)) {
    return { error: "Elige un tipo de feedback." };
  }
  if (!message) return { error: "El mensaje no puede estar vacío." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase.from("feedback").insert({
    coach_id: user.id,
    client_id: clientId,
    type,
    message,
    workout_log_id: workoutLogIdRaw !== "none" ? workoutLogIdRaw || null : null,
    routine_exercise_id:
      routineExerciseIdRaw !== "none" ? routineExerciseIdRaw || null : null,
  });

  if (error) {
    console.error("createFeedback error:", error);
    return { error: "No se pudo guardar el feedback." };
  }

  sendPushToClient(clientId, {
    title: pickPushCopy(FEEDBACK_PUSH_TITLES),
    body: message,
    url: "/client/feedback",
  }).catch((pushError) => {
    console.error("createFeedback push error:", pushError);
  });

  revalidatePath(`/coach/clients/${clientId}`);
  return { success: true };
}

export type MonthlyReviewFormState = { error: string } | undefined;

export async function saveMonthlyReview(
  clientId: string,
  _prevState: MonthlyReviewFormState,
  formData: FormData
): Promise<MonthlyReviewFormState> {
  const summary = String(formData.get("summary") ?? "").trim();
  const nextMonthGoals = String(formData.get("next_month_goals") ?? "").trim();
  const planAdjustments = String(
    formData.get("plan_adjustments") ?? ""
  ).trim();

  if (!summary) return { error: "Escribe un resumen del mes." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase.from("monthly_reviews").upsert(
    {
      client_id: clientId,
      coach_id: user.id,
      month: getMonthKey(),
      summary,
      next_month_goals: nextMonthGoals || null,
      plan_adjustments: planAdjustments || null,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "client_id,month" }
  );

  if (error) {
    console.error("saveMonthlyReview error:", error);
    return { error: "No se pudo guardar el cierre de mes." };
  }

  revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/coach/dashboard");
  return undefined;
}

export type AccessFormState = { error: string } | undefined;

export async function activateClientAccess(
  clientId: string,
  _prevState: AccessFormState,
  formData: FormData
): Promise<AccessFormState> {
  const paymentMethod = String(formData.get("payment_method") ?? "") as PaymentMethod;
  const endDate = String(formData.get("subscription_end_date") ?? "").trim();

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return { error: "Elige un método de pago." };
  }
  if (!endDate) return { error: "Ingresa la fecha de vencimiento del acceso." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      subscription_status: "active",
      subscription_end_date: new Date(endDate).toISOString(),
      payment_method: paymentMethod,
    })
    .eq("id", clientId);

  if (error) {
    console.error("activateClientAccess error:", error);
    return { error: "No se pudo activar el acceso." };
  }

  revalidatePath(`/coach/clients/${clientId}`);
  return undefined;
}

export type DeactivateAccessState =
  | { success: true; message: string }
  | { warning: string }
  | { error: string }
  | undefined;

// Cash/transferencia: solo corta el acceso en la app, como siempre. PayPal:
// además cancela la suscripción real (si no, PayPal le sigue cobrando al
// cliente aunque ya no tenga acceso) — pero el acceso se corta en la app
// SIEMPRE, incluso si la llamada a PayPal falla, nunca al revés.
export async function deactivateClientAccess(
  clientId: string,
  _prevState: DeactivateAccessState,
  _formData: FormData
): Promise<DeactivateAccessState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, payment_method")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .maybeSingle();
  if (clientError) {
    console.error("deactivateClientAccess client lookup error:", clientError);
    return { error: "No se pudo verificar el cliente." };
  }
  if (!client) return { error: "Cliente no encontrado." };

  let paypalWarning: string | null = null;

  if (client.payment_method === "paypal") {
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("paypal_subscription_id")
      .eq("client_id", clientId)
      .neq("status", "canceled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub?.paypal_subscription_id) {
      try {
        await cancelSubscription(sub.paypal_subscription_id, "Acceso desactivado por el coach");
        await admin
          .from("subscriptions")
          .update({ status: "canceled", canceled_at: new Date().toISOString() })
          .eq("paypal_subscription_id", sub.paypal_subscription_id);
      } catch (error) {
        console.error("deactivateClientAccess: error cancelando en PayPal:", error);
        paypalWarning =
          "Acceso desactivado, pero hubo un problema al cancelar en PayPal. Verificá manualmente en tu panel de PayPal.";
      }
    }
  }

  const { error } = await supabase
    .from("clients")
    .update({ subscription_status: "inactive" })
    .eq("id", clientId);

  revalidatePath(`/coach/clients/${clientId}`);

  if (error) {
    console.error("deactivateClientAccess error:", error);
    return { error: "No se pudo desactivar el acceso." };
  }
  if (paypalWarning) return { warning: paypalWarning };

  return {
    success: true,
    message:
      client.payment_method === "paypal"
        ? "Acceso desactivado y suscripción de PayPal cancelada correctamente."
        : "Acceso desactivado.",
  };
}

export type DeleteClientState = { error: string } | { success: true } | undefined;

// Borra a un cliente y todos sus datos. Solo permitido con acceso
// desactivado (guardia server-side, no solo el botón oculto en la UI).
//
// Orden de borrado: la mayoría de las tablas hijas de `clients` tienen ON
// DELETE CASCADE (feedback, rutinas, push_subscriptions, subscriptions), así
// que borrar el usuario de auth al final cascadea todo eso solo. Pero dos
// casos NO cascadean y hay que limpiarlos a mano primero:
//   - monthly_goals / monthly_reviews: su FK a clients no tiene ON DELETE,
//     bloquearían el borrado si quedan filas.
//   - workout_set_logs.routine_exercise_id tampoco tiene ON DELETE, así que
//     si se borraran las rutinas ANTES que los workout_logs, el borrado en
//     cascada de routine_exercises fallaría con series todavía colgando.
//     Por eso acá los workout_logs se borran primero explícitamente (eso ya
//     cascadea sus propias series) y las rutinas se dejan para el cascade
//     final del borrado de auth.
//   - invite_codes.used_by tampoco tiene ON DELETE: si este cliente se
//     registró con un código de invitación, ese código bloquearía el
//     borrado del usuario de auth. Se desvincula (used_by = null) sin
//     borrar el código, para no perder el historial de invitaciones.
export async function deleteClient(
  clientId: string,
  _formData: FormData
): Promise<DeleteClientState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: client } = await supabase
    .from("clients")
    .select("id, user_id, subscription_status")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (!client) return { error: "No se encontró el cliente." };
  if (client.subscription_status !== "inactive") {
    return { error: "Solo se pueden eliminar clientes con acceso desactivado." };
  }

  const admin = createAdminClient();

  const { error: logsError } = await admin
    .from("workout_logs")
    .delete()
    .eq("client_id", clientId);
  if (logsError) {
    console.error("deleteClient workout_logs error:", logsError);
    return { error: "No se pudo eliminar el historial de entrenamientos." };
  }

  const { error: goalsError } = await admin
    .from("monthly_goals")
    .delete()
    .eq("client_id", clientId);
  if (goalsError) {
    console.error("deleteClient monthly_goals error:", goalsError);
    return { error: "No se pudieron eliminar los objetivos mensuales." };
  }

  const { error: reviewsError } = await admin
    .from("monthly_reviews")
    .delete()
    .eq("client_id", clientId);
  if (reviewsError) {
    console.error("deleteClient monthly_reviews error:", reviewsError);
    return { error: "No se pudieron eliminar los cierres de mes." };
  }

  if (client.user_id) {
    await admin.from("invite_codes").update({ used_by: null }).eq("used_by", client.user_id);

    const { error: authError } = await admin.auth.admin.deleteUser(client.user_id);
    if (authError) {
      // El usuario de auth no se pudo borrar (p. ej. problema de permisos
      // puntual) — se borra igual el registro de clients para que
      // desaparezca de la app; cascadea feedback/rutinas/etc igual.
      console.error("deleteClient auth.admin.deleteUser error:", authError);
      const { error: clientError } = await admin.from("clients").delete().eq("id", clientId);
      if (clientError) {
        console.error("deleteClient clients fallback error:", clientError);
        return { error: "No se pudo eliminar el cliente." };
      }
    }
  } else {
    const { error: clientError } = await admin.from("clients").delete().eq("id", clientId);
    if (clientError) {
      console.error("deleteClient clients error:", clientError);
      return { error: "No se pudo eliminar el cliente." };
    }
  }

  revalidatePath("/coach/clients");
  revalidatePath("/coach/dashboard");
  return { success: true };
}
