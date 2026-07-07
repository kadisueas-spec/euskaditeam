"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { getMonthKey } from "@/lib/supabase/monthly-goals";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type MonthlyGoalFormState = { error: string } | undefined;

export async function createMonthlyGoal(
  _prevState: MonthlyGoalFormState,
  formData: FormData
): Promise<MonthlyGoalFormState> {
  const mainGoal = String(formData.get("main_goal") ?? "").trim();
  const weightKg = String(formData.get("weight_kg") ?? "").trim();
  const motivationLevel = String(formData.get("motivation_level") ?? "").trim();
  const improveNote = String(formData.get("improve_note") ?? "").trim();

  if (!mainGoal) return { error: "Contanos cuál es tu objetivo del mes." };
  if (!weightKg) return { error: "Ingresá tu peso actual." };
  if (!motivationLevel) return { error: "Elegí tu nivel de energía." };

  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const supabase = await createClient();
  const { error } = await supabase.from("monthly_goals").insert({
    client_id: client.id,
    month: getMonthKey(),
    main_goal: mainGoal,
    weight_kg: Number(weightKg),
    motivation_level: Number(motivationLevel),
    improve_note: improveNote || null,
  });

  if (error) {
    console.error("createMonthlyGoal error:", error);
    return { error: "No se pudo guardar. Intentá de nuevo." };
  }

  // F4: "Mi Perfil" muestra clients.weight_kg/goal (el dato "vigente" del
  // cliente), no los objetivos mensuales — sin este update quedaban en "-"
  // para siempre, porque nada más los escribe.
  const { error: clientUpdateError } = await supabase
    .from("clients")
    .update({ weight_kg: Number(weightKg), goal: mainGoal })
    .eq("id", client.id);

  if (clientUpdateError) {
    console.error("createMonthlyGoal client update error:", clientUpdateError);
  }

  revalidatePath("/", "layout");
  return undefined;
}

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function savePushSubscription(
  subscription: PushSubscriptionInput
): Promise<{ error: string } | undefined> {
  const client = await getCurrentClientRecord();
  if (!client) return { error: "No se encontró tu perfil de cliente." };

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      client_id: client.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("savePushSubscription error:", error);
    return { error: "No se pudo guardar la suscripción." };
  }

  return undefined;
}
