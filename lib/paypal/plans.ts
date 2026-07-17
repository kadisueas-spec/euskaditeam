import { paypalFetch } from "./client";

type CreatePlanResponse = { id: string };

// Un Plan nuevo por cada combinación cliente/precio, todos colgando del
// mismo Product (PAYPAL_PRODUCT_ID) — la API de Billing Plans de PayPal no
// tiene un concepto de "precio libre por suscripción", así que un plan
// dedicado por cliente es la forma soportada de tener un precio distinto
// para cada uno. status: "ACTIVE" directo en la creación para no necesitar
// una segunda llamada de activación.
export async function createBillingPlan(
  productId: string,
  priceUsd: number,
  clientLabel: string
): Promise<string> {
  const plan = await paypalFetch<CreatePlanResponse>("/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      name: `Euskadi Team - ${clientLabel}`,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // 0 = indefinido, se renueva hasta que se cancele
          pricing_scheme: {
            fixed_price: { value: priceUsd.toFixed(2), currency_code: "USD" },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 1,
      },
    }),
  });
  return plan.id;
}
