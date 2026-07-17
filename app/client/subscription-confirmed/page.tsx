import { getMySubscription } from "@/lib/supabase/subscriptions";
import { SubscriptionConfirmedView } from "./subscription-confirmed-view";

// return_url / cancel_url de PayPal (ver createSubscription en
// lib/paypal/subscriptions.ts). status=cancelled viene del cancel_url
// (el cliente cerró el checkout de PayPal sin aprobar).
export default async function SubscriptionConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  if (status === "cancelled") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="font-display text-xl tracking-wide text-white uppercase">
          Proceso cancelado
        </p>
        <p className="text-sm text-[#888888]">
          No se completó la suscripción. Pedile un nuevo link a tu coach cuando quieras
          intentar de nuevo.
        </p>
      </div>
    );
  }

  const subscription = await getMySubscription();
  return <SubscriptionConfirmedView initialStatus={subscription?.status ?? null} />;
}
