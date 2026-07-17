import { paypalFetch } from "./client";

const PRODUCT_NAME = "Euskadi Team - Entrenamiento Personalizado";

type CreateProductResponse = { id: string };

// Se llama desde scratch-setup-paypal-product.mjs (setup manual, una sola
// vez) y desde generatePaymentLink() la primera vez que PAYPAL_PRODUCT_ID
// todavía no está seteado — en ese segundo caso, quien llama corta el
// flujo después de crear el producto (ver app/coach/clients/[id]/
// paypal-actions.ts) en vez de seguir creando plan+suscripción en el mismo
// request, para no arriesgarse a crear un producto duplicado en cada
// invocación mientras el env var todavía no se propagó a todas las
// instancias de Vercel.
export async function createPayPalProduct(): Promise<string> {
  const product = await paypalFetch<CreateProductResponse>("/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify({
      name: PRODUCT_NAME,
      type: "SERVICE",
      category: "EXERCISE_AND_FITNESS",
    }),
  });
  return product.id;
}

export function getExistingPayPalProductId(): string | null {
  return process.env.PAYPAL_PRODUCT_ID?.trim() || null;
}
