// Auditoría de seguridad jul-2026, sección 7: nada limpiaba el cache del
// Service Worker ni el IndexedDB al cerrar sesión — en un dispositivo
// compartido, la rutina/series de un cliente podían quedar servidas
// brevemente al siguiente que iniciara sesión ahí. Se llama desde
// LogoutButton, ANTES de ejecutar el server action de logout.
const CACHE_PREFIX = "fitcoach-";
const OFFLINE_DB_NAME = "fitcoach-offline";

export async function purgeOfflineData(): Promise<void> {
  // Le avisamos al Service Worker activo para que borre sus propios caches
  // con este prefijo. Cache Storage ya es compartido por origen (lo de
  // abajo alcanza solo), pero el mensaje además cubre el caso de que haya
  // OTRA pestaña con este mismo SW controlándola.
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    registration?.active?.postMessage({ type: "fitcoach:logout-clear-caches" });
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key))
    );
  }

  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(OFFLINE_DB_NAME);
    // onblocked pasa si quedó una conexión abierta (workout-store.ts cierra
    // la suya después de cada operación, así que no debería pasar en la
    // práctica) — no bloqueamos el logout por esto, seguimos igual.
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
