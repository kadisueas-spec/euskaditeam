// Cliente base de la API REST de PayPal — selecciona sandbox/live según
// PAYPAL_MODE y resuelve el OAuth2 de client_credentials en cada llamada
// (no cachea el token entre invocaciones: en Vercel cada request puede
// caer en una instancia serverless distinta, así que un cache en memoria
// no sería confiable y el endpoint de token es rápido).
const PAYPAL_MODE = process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";

export const PAYPAL_BASE_URL =
  PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Faltan PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET en las variables de entorno.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`PayPal OAuth falló (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// Wrapper genérico para llamadas autenticadas — evita repetir el fetch de
// token + headers en cada archivo de lib/paypal/*. idempotencyKey manda el
// header PayPal-Request-Id, para que un reintento de red no cree un plan o
// una suscripción duplicada.
export async function paypalFetch<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {}
): Promise<T> {
  const token = await getPayPalAccessToken();
  const { idempotencyKey, headers, ...rest } = init;

  const res = await fetch(`${PAYPAL_BASE_URL}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "PayPal-Request-Id": idempotencyKey } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    throw new Error(`PayPal API error (${res.status} ${path}): ${await res.text()}`);
  }

  // Varios endpoints (cancel, activate) devuelven 204 sin body.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
