// @ts-nocheck -- Deno edge runtime, no corre por el tsconfig/eslint de Next.
// Cron sugerido (hora Paraguay, UTC-4 todo el año): todos los días 8am PYT
// = 12:00 UTC → "0 12 * * *"
//
// Archivo autocontenido a propósito (sin imports compartidos) para poder
// pegarlo directo en el editor de Edge Functions del Dashboard de Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT"),
  Deno.env.get("VAPID_PUBLIC_KEY"),
  Deno.env.get("VAPID_PRIVATE_KEY")
);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
);

async function sendPushToClient(clientId, payload) {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("client_id", clientId);

  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error("daily-checks push error:", error);
      }
    }
  }
}

function isMonthEndToday(date) {
  const totalDays = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return date.getUTCDate() === totalDays;
}

function daysAgo(dateStr, now) {
  const then = new Date(`${dateStr}T00:00:00Z`).getTime();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return Math.round((today - then) / 86400000);
}

Deno.serve(async () => {
  const now = new Date();
  const monthUnlocked = isMonthEndToday(now);

  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .eq("subscription_status", "active");

  for (const client of clients ?? []) {
    if (monthUnlocked) {
      await sendPushToClient(client.id, {
        title: "Se desbloqueó tu resumen del mes 🔓",
        body: "Mirá tu progreso, tu adherencia y el mensaje de tu coach.",
        url: "/client/my-month",
      });
    }

    const { data: lastLog } = await supabase
      .from("workout_logs")
      .select("workout_date")
      .eq("client_id", client.id)
      .order("workout_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastLog && daysAgo(lastLog.workout_date, now) === 3) {
      await sendPushToClient(client.id, {
        title: "Te extrañamos 👋",
        body: "¿Todo bien? Hace 3 días que no registrás un entrenamiento.",
        url: "/client/my-routine",
      });
    }
  }

  return new Response("ok");
});
