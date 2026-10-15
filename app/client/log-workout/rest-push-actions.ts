"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { sendPushToClient } from "@/lib/push/send-push";
import { REST_END_PUSH } from "@/lib/constants/push-copy";

// Push al terminar el descanso (oct-2026). En iOS una PWA en segundo plano
// no ejecuta JS ni reproduce audio — el único aviso posible en pantalla
// bloqueada es una push, y la tiene que mandar el SERVIDOR a la hora justa
// (Web Push no tiene envío programado). Por eso: al arrancar el
// temporizador se guarda un token en clients.rest_timer_push_token y una
// tarea en segundo plano (after()) espera hasta endsAt y manda la push
// solo si el token sigue siendo el mismo. Ajustar el tiempo, saltear,
// completar otra serie o ver el 0:00 con la app abierta cambia o borra el
// token, y la tarea vieja se descarta sola al despertar.
//
// Tope: la función serverless vive como máximo maxDuration (300s, ver
// page.tsx) — descansos más largos que REST_PUSH_MAX_DELAY_MS no se avisan
// por push (el temporizador en pantalla sigue funcionando igual).
const REST_PUSH_MAX_DELAY_MS = 280_000;
// Margen para que el "cancelar" del cliente (si vio el 0:00 con la app
// abierta) llegue antes de que el servidor decida mandar.
const REST_PUSH_GRACE_MS = 1_500;

export async function scheduleRestEndPush(
  token: string,
  endsAt: number,
  url: string
): Promise<void> {
  const delay = endsAt - Date.now();
  if (delay <= 0 || delay > REST_PUSH_MAX_DELAY_MS) {
    await cancelRestEndPush();
    return;
  }

  const client = await getCurrentClientRecord();
  if (!client) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ rest_timer_push_token: token })
    .eq("id", client.id);
  if (error) {
    console.error("scheduleRestEndPush token error:", error);
    return;
  }

  // Solo rutas internas — la url termina en el click de la notificación.
  const safeUrl = url.startsWith("/client/") ? url : "/client/log-workout";
  const clientId = client.id;

  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, delay + REST_PUSH_GRACE_MS));

    const admin = createAdminClient();
    // Se "consume" el token en la misma consulta: si dos tareas despertaran
    // juntas con el mismo token, solo una encuentra la fila.
    const { data } = await admin
      .from("clients")
      .update({ rest_timer_push_token: null })
      .eq("id", clientId)
      .eq("rest_timer_push_token", token)
      .select("id");
    if (!data || data.length === 0) return;

    await sendPushToClient(clientId, { ...REST_END_PUSH, url: safeUrl, tag: "rest-timer" });
  });
}

export async function cancelRestEndPush(): Promise<void> {
  const client = await getCurrentClientRecord();
  if (!client) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ rest_timer_push_token: null })
    .eq("id", client.id);
  if (error) console.error("cancelRestEndPush error:", error);
}
