// Reglas de "Generar ahora" (oct-2026), puras para poder testearlas:
// - sin reporte del período → se crea el borrador;
// - ya enviado → no se toca;
// - borrador / programado / descartado → se pregunta antes de regenerarlo;
//   con la confirmación se regenera (uno descartado vuelve a borrador).
export type ExistingStatus = "draft" | "scheduled" | "sent" | "discarded";

export type GenerateNowDecision =
  | { action: "create" }
  | { action: "blocked-sent" }
  | { action: "ask"; status: Exclude<ExistingStatus, "sent"> }
  | { action: "regenerate"; restoreFromDiscarded: boolean };

export function decideGenerateNow(existing: ExistingStatus | null, confirmed: boolean): GenerateNowDecision {
  if (!existing) return { action: "create" };
  if (existing === "sent") return { action: "blocked-sent" };
  if (!confirmed) return { action: "ask", status: existing };
  return { action: "regenerate", restoreFromDiscarded: existing === "discarded" };
}
