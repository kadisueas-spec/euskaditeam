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
