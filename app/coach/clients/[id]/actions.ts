"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABEL } from "@/lib/constants/feedback";
import type { FeedbackType } from "@/lib/constants/feedback";
import { getMonthKey } from "@/lib/supabase/monthly-goals";
import { PAYMENT_METHODS } from "@/lib/constants/access";
import type { PaymentMethod } from "@/lib/constants/access";
import { sendPushToClient } from "@/lib/push/send-push";

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
    return { error: "Elegí un tipo de feedback." };
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
    title: `Nuevo feedback de tu coach: ${FEEDBACK_TYPE_LABEL[type]}`,
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

  if (!summary) return { error: "Escribí un resumen del mes." };

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
    return { error: "Elegí un método de pago." };
  }
  if (!endDate) return { error: "Ingresá la fecha de vencimiento del acceso." };

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

export async function deactivateClientAccess(
  clientId: string,
  _formData: FormData
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("clients")
    .update({ subscription_status: "inactive" })
    .eq("id", clientId);

  revalidatePath(`/coach/clients/${clientId}`);
}
