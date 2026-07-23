"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function saveCoachPushSubscription(
  subscription: PushSubscriptionInput
): Promise<{ error: string } | undefined> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "No autenticado." };

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      coach_id: authUser.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("saveCoachPushSubscription error:", error);
    return { error: "No se pudo guardar la suscripción." };
  }

  return undefined;
}

// Ver el comentario equivalente en app/client/actions.ts (caso Fabrizzio,
// jul-2026) — mismo chequeo contra la fuente de verdad real para el coach.
export async function hasCoachPushSubscription(): Promise<boolean> {
  const authUser = await getAuthUser();
  if (!authUser) return false;

  const supabase = await createClient();
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", authUser.id);

  return (count ?? 0) > 0;
}
