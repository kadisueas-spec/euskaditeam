// @ts-nocheck -- Deno edge runtime, no corre por el tsconfig/eslint de Next.
// Cron sugerido (hora Paraguay, UTC-4 todo el año): lunes/miércoles/viernes
// 9am PYT = 13:00 UTC → "0 13 * * 1,3,5"
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
        console.error("weekly-reminders push error:", error);
      }
    }
  }
}

function mondayOfWeek(date) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async () => {
  const now = new Date();
  const day = now.getUTCDay(); // 1 = lunes, 3 = miércoles, 5 = viernes

  if (![1, 3, 5].includes(day)) {
    return new Response("skip: hoy no es lunes/miércoles/viernes");
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .eq("subscription_status", "active");

  for (const client of clients ?? []) {
    let title;
    let body;

    if (day === 1) {
      title = "Nueva semana 💪";
      body = "¿Ya tenés tu entrenamiento agendado?";
    } else if (day === 5) {
      title = "Terminá la semana sintiéndote bien 🔥";
      body = "Vamos con el último empujón de la semana.";
    } else {
      const weekStart = mondayOfWeek(now);
      const { count } = await supabase
        .from("workout_logs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("is_completed", true)
        .gte("workout_date", weekStart);
      title = "¡Seguí así! 🔥";
      body = `Vas ${count ?? 0} sesión${count === 1 ? "" : "es"} esta semana. ¡Seguí así!`;
    }

    await sendPushToClient(client.id, { title, body, url: "/client/my-routine" });
  }

  return new Response("ok");
});
