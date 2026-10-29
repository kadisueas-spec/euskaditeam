import type { PushPayload } from "@/lib/push/send-push";

// Push de novedades a todos los clientes activos (oct-2026). Lógica pura:
// textos por defecto, validación y armado del payload. El envío vive en
// app/coach/notifications/actions.ts.

export const BROADCAST_DEFAULTS = {
  title: "Estamos mejorando la app 💪",
  body: "Sumamos mejoras en tus entrenamientos y reportes. Cerrá y volvé a abrir la app para verlas.",
};

export const BROADCAST_TITLE_MAX = 60;
export const BROADCAST_BODY_MAX = 200;
// Web Push admite ~4 KB cifrados; el JSON queda muy por debajo con estos
// topes, pero se controla en bytes (UTF-8: una tilde o un emoji ocupan más
// de un byte) por las dudas.
export const BROADCAST_PAYLOAD_MAX_BYTES = 3000;

// Al tocarla abre Inicio. Tag propio: una novedad nueva reemplaza a la
// anterior en vez de apilarse.
export const BROADCAST_URL = "/client/home";
export const BROADCAST_TAG = "novedades";

// Segundos que queda bloqueado "Enviar a todos" después de un envío, para
// que un doble toque no la mande dos veces.
export const BROADCAST_COOLDOWN_SECONDS = 15;

// Prueba "solo a mí" (oct-2026): mismo título y texto, pero al tocarla abre
// la pantalla de Novedades del coach (Inicio del cliente no existe para el
// coach) y con su propio tag (no reemplaza una novedad real).
export const BROADCAST_TEST_URL = "/coach/notifications";
export const BROADCAST_TEST_TAG = "novedades-prueba";

export type BroadcastInput = { title: string; body: string };

// Normaliza Unicode a NFC: las tildes y la ñ llegan como un solo carácter
// aunque se hayan pegado desde otro lado con la letra y la tilde separadas.
export function normalizeBroadcastText(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function buildBroadcastTestPayload(input: BroadcastInput): { payload: PushPayload } | { error: string } {
  const built = buildBroadcastPayload(input);
  if ("error" in built) return built;
  return { payload: { ...built.payload, url: BROADCAST_TEST_URL, tag: BROADCAST_TEST_TAG } };
}

export function buildBroadcastPayload(
  input: BroadcastInput
): { payload: PushPayload } | { error: string } {
  const title = normalizeBroadcastText(input.title ?? "");
  const body = normalizeBroadcastText(input.body ?? "");
  if (!title) return { error: "Escribí un título." };
  if (!body) return { error: "Escribí el texto." };
  if ([...title].length > BROADCAST_TITLE_MAX) return { error: `El título puede tener hasta ${BROADCAST_TITLE_MAX} caracteres.` };
  if ([...body].length > BROADCAST_BODY_MAX) return { error: `El texto puede tener hasta ${BROADCAST_BODY_MAX} caracteres.` };
  const payload: PushPayload = { title, body, url: BROADCAST_URL, tag: BROADCAST_TAG };
  if (new TextEncoder().encode(JSON.stringify(payload)).length > BROADCAST_PAYLOAD_MAX_BYTES) {
    return { error: "El mensaje es demasiado largo." };
  }
  return { payload };
}
