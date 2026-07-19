// Service worker fuente de Serwist (swSrc en next.config.ts). Reemplaza al
// next-pwa customWorker de antes — ahora este archivo ES el service worker
// completo (precache + runtime caching + push/notificationclick/message),
// no solo código "extra" inyectado en un SW generado.
import { defaultCache } from "@serwist/next/worker";
import { CacheableResponsePlugin, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // La rutina activa y la pantalla de registro tienen su propio cache
    // (separado del bucket genérico de defaultCache, que comparte entradas
    // con toda la app y podría desalojarlas) para que SIEMPRE queden
    // disponibles offline.
    {
      matcher: ({ request, url }) =>
        self.origin === url.origin &&
        request.mode === "navigate" &&
        (url.pathname.startsWith("/client/my-routine") ||
          url.pathname.startsWith("/client/log-workout")),
      handler: new NetworkFirst({
        cacheName: "fitcoach-active-routine",
        networkTimeoutSeconds: 4,
        plugins: [
          new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 7 * 24 * 60 * 60 }),
          new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
    },
    // F6: el catch-all de páginas que trae defaultCache matchea CUALQUIER
    // página del mismo origen, login incluido, con NetworkFirst. Eso
    // causaba el "me pide login de nuevo" al reabrir la PWA: si la red
    // tardaba en responder, el SW servía una versión vieja cacheada de la
    // página en vez de esperar/redirigir según la sesión real. Las páginas
    // son dinámicas y dependen de la cookie de sesión vigente, así que no
    // deben cachearse nunca — excepto las dos rutas de rutina activa, que
    // ya tienen su propio cache arriba a propósito para funcionar offline.
    {
      matcher: ({ request, url }) =>
        self.origin === url.origin &&
        request.mode === "navigate" &&
        !url.pathname.startsWith("/client/my-routine") &&
        !url.pathname.startsWith("/client/log-workout"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "FitCoach", body: event.data.text() };
  }

  const title = payload.title || "FitCoach";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    data: { url: payload.url || "/client/my-routine" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/client/my-routine";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        const existing = clientsArr.find((c) => c.url.includes(url));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});

// Auditoría de seguridad jul-2026: al cerrar sesión, la página (ver
// lib/offline/purge.ts) manda este mensaje para que el SW borre sus propios
// caches con datos de rutina/entrenamiento — así no queda nada servible de
// un usuario para el siguiente que inicie sesión en el mismo dispositivo.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "fitcoach:logout-clear-caches") return;

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key.startsWith("fitcoach-")).map((key) => caches.delete(key))
      )
    )
  );
});
