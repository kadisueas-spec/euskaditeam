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
        JSON.stringify(payload),
        // urgency "high": el default "normal" deja que iOS demore la
        // entrega en background hasta que se abra la app.
        { urgency: "high" }
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

async function sendPushToCoach(coachId, payload) {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("coach_id", coachId);

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
        console.error("daily-checks coach push error:", error);
      }
    }
  }
}

// Bloque 5 (jul-2026) — "Voz Euskadi": voseo para el cliente, "tienes" para
// el coach. Cuando hay más de una variante, se elige al azar en cada envío.
function pick(options) {
  return options[Math.floor(Math.random() * options.length)];
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

function daysUntil(dateStr, now) {
  return -daysAgo(dateStr, now);
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
      const [unlockTitle, unlockBody] = pick([
        ["Terminaste el mes.", "Ahora viene la verdad, vamos a descubrirlo."],
        ["Tu mes está completo.", "¿Llegaste a tu objetivo? Vamos a descubrirlo."],
      ]);
      await sendPushToClient(client.id, {
        title: unlockTitle,
        body: unlockBody,
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
      const [inactiveTitle, inactiveBody] = pick([
        ["Hace 3 días que no aparecés.", "Tu rutina te está esperando."],
        ["El progreso no espera.", "¿Volvemos?"],
      ]);
      await sendPushToClient(client.id, {
        title: inactiveTitle,
        body: inactiveBody,
        url: "/client/my-routine",
      });
    }
  }

  // Avisos al coach de mesociclo por terminar (7 y 2 días antes). Al
  // correr una vez por día, el chequeo por día exacto (=== 7, === 2) evita
  // mandar el mismo aviso más de una vez.
  const { data: routines } = await supabase
    .from("routines")
    .select(
      `id, ends_at, coach_id,
       clients ( id, profiles!clients_user_id_fkey ( full_name, email ) )`
    )
    .eq("is_active", true)
    .not("ends_at", "is", null);

  for (const routine of routines ?? []) {
    if (!routine.coach_id || !routine.ends_at) continue;
    const days = daysUntil(routine.ends_at, now);
    if (days !== 7 && days !== 2) continue;

    const clientName =
      routine.clients?.profiles?.full_name ??
      routine.clients?.profiles?.email ??
      "Tu cliente";

    const [mesocicloTitle, mesocicloBody] =
      days === 7
        ? [`El mesociclo de ${clientName} termina en 7 días.`, "¿Ya tienes su próxima rutina?"]
        : [`Quedan 2 días para que ${clientName} termine su bloque.`, "Prepárale lo que sigue."];

    await sendPushToCoach(routine.coach_id, {
      title: mesocicloTitle,
      body: mesocicloBody,
      url: routine.clients?.id ? `/coach/clients/${routine.clients.id}` : "/coach/dashboard",
    });
  }

  return new Response("ok");
});
