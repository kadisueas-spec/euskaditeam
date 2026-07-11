// Heurística para distinguir "se cayó la conexión" de cualquier otro error
// (DB, bug, etc.) en los error.tsx — no hay forma 100% confiable de
// detectarlo desde el mensaje de un Error genérico, pero estas son las
// firmas reales que tiran fetch/Next en cada entorno (Chrome, Safari,
// Node/undici del lado del server).
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    message.includes("load failed") || // Safari/WebKit
    message.includes("network request failed") ||
    message.includes("networkerror") ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  );
}
