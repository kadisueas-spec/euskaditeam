import { NextResponse, type NextRequest } from "next/server";
import { handleWebhookEvent, verifyWebhookSignature, type PayPalWebhookEvent } from "@/lib/paypal/webhooks";

// PAYPAL_VERIFY_WEBHOOK=false en sandbox (mientras todavía no existe
// PAYPAL_WEBHOOK_ID — ver el orden de deploy acordado: primero se deploya
// este endpoint, después se registra la URL en el Dashboard de PayPal, eso
// da el webhook ID, y recién ahí se prende la verificación). En producción
// tiene que ser "true" siempre — sin esto, cualquiera podría pegarle a
// este endpoint con un evento inventado (ej. BILLING.SUBSCRIPTION.ACTIVATED
// para un client_id ajeno) y activarse el acceso gratis.
const VERIFY_WEBHOOK = process.env.PAYPAL_VERIFY_WEBHOOK === "true";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    console.error("paypal webhook: body no es JSON válido.");
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  console.log(
    `paypal webhook recibido: ${event.event_type} (resource ${event.resource?.id ?? "?"})`
  );

  if (VERIFY_WEBHOOK) {
    const isValid = await verifyWebhookSignature(request.headers, rawBody);
    if (!isValid) {
      console.error(`paypal webhook: firma inválida para ${event.event_type}, descartado.`);
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  } else {
    console.warn(
      "paypal webhook: PAYPAL_VERIFY_WEBHOOK=false, procesando SIN verificar firma (solo válido en sandbox)."
    );
  }

  try {
    await handleWebhookEvent(event);
  } catch (error) {
    // PayPal reintenta automáticamente si no devolvemos 200 — logueamos el
    // error real pero respondemos 200 igual para no entrar en un loop de
    // reintentos por un evento que de todas formas no vamos a poder
    // procesar distinto la próxima vez (ej. un client_id que ya no existe).
    console.error(`paypal webhook: error procesando ${event.event_type}:`, error);
  }

  return NextResponse.json({ received: true });
}
