import { startOfParaguayDayMs } from "@/lib/utils/today";

export const PAYMENT_METHODS = ["cash", "transfer", "paypal"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  paypal: "PayPal",
};

// subscription_end_date se guarda como medianoche UTC del día que elige el
// coach ("Vence el 15" -> 2026-10-15T00:00Z), que en Paraguay son las 21hs
// del 14 — el acceso se cortaba 3 horas antes (bug oct-2026). Se toma la
// fecha elegida y se corta a las 00:00 de Paraguay de ese día: mismo
// criterio que daily-checks, que el día del vencimiento ya lo pasa a
// inactive (y avisa "vence mañana" el día anterior).
function accessEndMs(subscriptionEndDate: string): number {
  return startOfParaguayDayMs(new Date(subscriptionEndDate).toISOString().slice(0, 10));
}

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
  return accessEndMs(subscriptionEndDate) > Date.now();
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
      const endTime = accessEndMs(subscriptionEndDate);
      if (endTime <= Date.now()) return "expired";
      const daysLeft = (endTime - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysLeft <= EXPIRING_SOON_DAYS) return "expiring_soon";
    }
    return "active";
  }
  return "inactive";
}
