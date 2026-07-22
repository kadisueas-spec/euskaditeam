// @ts-nocheck -- Deno edge runtime, no corre por el tsconfig/eslint de Next.
// Cron sugerido (hora Paraguay, UTC-4 todo el año): todos los días 9am PYT
// = 13:00 UTC → "0 13 * * *"
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

// Sistema de renovaciones y retención (jul-2026): al quinto día sin acceso
// (subscription_status inactive) se elimina toda la data de coaching del
// cliente. El login (auth.users) SÍ se borra a propósito — no puede volver
// a entrar con ese email sin que el coach lo invite de nuevo. Orden fijo:
// 1) snapshot en deleted_clients_log, 2) archivos de Storage (no cascadea
// solo con borrar la fila), 3) las dos únicas tablas sin ON DELETE CASCADE
// hacia clients (monthly_goals/monthly_reviews), 4) admin.deleteUser()
// -> cascada automática de profiles -> clients -> todo el resto
// (feedback, rutinas, workout_logs/set_logs, evaluaciones antropométricas,
// nutrition_plans, weight_logs, subscriptions, push_subscriptions).
async function deleteInactiveClient(client, clientName) {
  // Re-chequeo justo antes de borrar: si el coach ya reactivó el acceso
  // entre el chequeo de arriba y este punto, no se borra nada.
  const { data: fresh } = await supabase
    .from("clients")
    .select("subscription_status")
    .eq("id", client.id)
    .maybeSingle();
  if (!fresh || fresh.subscription_status !== "inactive") return;

  await supabase.from("deleted_clients_log").insert({
    client_id: client.id,
    coach_id: client.coach_id,
    full_name: client.profiles?.full_name ?? null,
    email: client.profiles?.email ?? null,
    subscription_end_date: client.subscription_end_date,
  });

  const { data: files } = await supabase.storage.from("nutrition-plans").list(client.id);
  if (files?.length) {
    await supabase.storage
      .from("nutrition-plans")
      .remove(files.map((f) => `${client.id}/${f.name}`));
  }

  await supabase.from("monthly_goals").delete().eq("client_id", client.id);
  await supabase.from("monthly_reviews").delete().eq("client_id", client.id);

  if (client.user_id) {
    const { error } = await supabase.auth.admin.deleteUser(client.user_id);
    if (error) {
      console.error("daily-checks: error borrando auth user", client.id, error);
      return; // no se manda la confirmación si el borrado falló
    }
  } else {
    // No debería pasar en el flujo normal de la app (todo cliente real
    // tiene un user_id vinculado desde el registro), pero por las dudas:
    // sin user_id no hay nada de qué cascadear, se borra la fila directo.
    await supabase.from("clients").delete().eq("id", client.id);
  }

  await sendPushToCoach(client.coach_id, {
    title: "Cliente eliminado",
    body: `Los datos de ${clientName} fueron eliminados de la base de datos por inactividad.`,
    url: "/coach/clients",
  });
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

  // Renovaciones y retención (jul-2026): 5 chequeos sobre
  // subscription_end_date, usando daysAgo tal cual (positivo = venció hace
  // N días, negativo = vence en N días) para que coincida directo con el
  // "hoy ± N" de la spec.
  const { data: expiringClients } = await supabase
    .from("clients")
    .select(
      `id, user_id, coach_id, subscription_status, subscription_end_date,
       profiles!clients_user_id_fkey ( full_name, email )`
    )
    .not("subscription_end_date", "is", null)
    .in("subscription_status", ["active", "inactive"]);

  for (const client of expiringClients ?? []) {
    if (!client.coach_id) continue;
    const clientName =
      client.profiles?.full_name ?? client.profiles?.email ?? "Tu cliente";
    const days = daysAgo(client.subscription_end_date.slice(0, 10), now);

    // (a) Vence mañana, todavía activo -> avisar a cliente y coach.
    if (client.subscription_status === "active" && days === -1) {
      await sendPushToClient(client.id, {
        title: "Tu plan vence mañana",
        body: "Renová la suscripción de tu plan para seguir mejorando y no perder tus registros!",
        url: "/client/profile",
      });
      await sendPushToCoach(client.coach_id, {
        title: "Vencimiento mañana",
        body: `El plan de ${clientName} vence mañana. ¿Ya coordinaste el pago?`,
        url: `/coach/clients/${client.id}`,
      });
      continue;
    }

    // (b) Venció ayer, todavía marcado activo -> desactivar, sin aviso.
    if (client.subscription_status === "active" && days === 1) {
      await supabase
        .from("clients")
        .update({ subscription_status: "inactive" })
        .eq("id", client.id);
      continue;
    }

    if (client.subscription_status !== "inactive") continue;

    // (c) 2 días sin acceso -> avisar solo al coach.
    if (days === 2) {
      await sendPushToCoach(client.coach_id, {
        title: "Cliente sin acceso",
        body: `${clientName} lleva 2 días sin acceso. ¿Ya coordinaste el pago?`,
        url: `/coach/clients/${client.id}`,
      });
      continue;
    }

    // (d) 4 días sin acceso -> aviso de eliminación en 24hs.
    if (days === 4) {
      await sendPushToCoach(client.coach_id, {
        title: "Eliminación en 24 horas",
        body: `Los datos de ${clientName} se eliminarán en 24 horas si no renovó su plan. Activá el acceso si ya pagó.`,
        url: `/coach/clients/${client.id}`,
      });
      continue;
    }

    // (e) 5 días sin acceso -> eliminar en cascada.
    if (days === 5) {
      await deleteInactiveClient(client, clientName);
    }
  }

  return new Response("ok");
});
