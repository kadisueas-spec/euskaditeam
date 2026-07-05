export const PAYMENT_METHODS = ["cash", "transfer", "paypal"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  paypal: "PayPal",
};

/**
 * El acceso está activo solo si el coach lo marcó como "active" Y la fecha
 * de vencimiento (si existe) todavía no pasó. Se calcula en el momento de
 * cada request en vez de depender de un cron que actualice el estado
 * guardado, así el vencimiento aplica al instante sin infraestructura extra.
 */
export function isAccessActive(
  subscriptionStatus: string,
  subscriptionEndDate: string | null
): boolean {
  if (subscriptionStatus !== "active") return false;
  if (!subscriptionEndDate) return true;
  return new Date(subscriptionEndDate).getTime() >= Date.now();
}

export type AccessDisplayStatus =
  | "active"
  | "expiring_soon"
  | "expired"
  | "inactive";

const EXPIRING_SOON_DAYS = 7;

export function getAccessDisplayStatus(
  subscriptionStatus: string,
  subscriptionEndDate: string | null
): AccessDisplayStatus {
  if (subscriptionStatus === "active") {
    if (subscriptionEndDate) {
      const endTime = new Date(subscriptionEndDate).getTime();
      if (endTime < Date.now()) return "expired";
      const daysLeft = (endTime - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysLeft <= EXPIRING_SOON_DAYS) return "expiring_soon";
    }
    return "active";
  }
  return "inactive";
}
