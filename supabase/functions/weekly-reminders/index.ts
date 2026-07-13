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
        JSON.stringify(payload),
        // urgency "high": el default "normal" deja que iOS demore la
        // entrega en background hasta que se abra la app.
        { urgency: "high" }
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
      title = "Arrancá tu semana con todo";
      body = "Empezá tu rutina esta semana.";
    } else if (day === 5) {
      title = "Cerrá la semana fuerte";
      body = "Vamos a entrenar.";
    } else {
      // Miércoles: combina el dato real (sesiones ya completadas esta
      // semana) con la voz Euskadi. Sin datos (0 sesiones o sin registros
      // todavía) cae al fallback genérico en vez de decir "Ya vas por 0
      // sesiones", que sonaría a reproche.
      const weekStart = mondayOfWeek(now);
      const { count } = await supabase
        .from("workout_logs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("is_completed", true)
        .gte("workout_date", weekStart);

      if (count && count > 0) {
        title = `Ya vas por ${count} sesión${count === 1 ? "" : "es"} esta semana.`;
        body = "No aflojes ahora.";
      } else {
        title = "Mitad de semana.";
        body = "¿Cómo vas con tu rutina?";
      }
    }

    await sendPushToClient(client.id, { title, body, url: "/client/my-routine" });
  }

  return new Response("ok");
});
