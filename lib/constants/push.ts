// applicationServerKey necesita un Uint8Array, no el base64url que entrega
// la VAPID pública.
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export const PUSH_PROMPTED_KEY = "fitcoach:push-prompted";
export const PUSH_PROMPTED_KEY_COACH = "fitcoach:push-prompted-coach";

// Diagnóstico jul-2026: en Android, "No se pudo activar" sin más detalle no
// alcanza — el console.error correspondiente vive en la consola del propio
// navegador del cliente, invisible tanto para el coach como para nosotros
// sin depuración remota por USB. Mostrar name/message/code directo en la
// UI deja que el cliente lea o mande una foto del error real sin depurar
// nada.
export function formatErrorDetail(err: unknown): string {
  if (err instanceof Error) {
    const withCode = err as Error & { code?: string | number };
    const parts = [err.name, err.message];
    if (withCode.code != null) parts.push(`code ${withCode.code}`);
    return parts.filter(Boolean).join(" — ");
  }
  return String(err);
}
