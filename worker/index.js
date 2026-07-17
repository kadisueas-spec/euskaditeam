// Código extra inyectado en el service worker generado por next-pwa
// (ver customWorkerDir en next-pwa). Maneja push notifications y el click
// sobre una notificación.

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
