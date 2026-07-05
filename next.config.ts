import type { NextConfig } from "next";
// next-pwa ships no type definitions.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const defaultRuntimeCaching = require("next-pwa/cache");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    // La rutina activa y la pantalla de registro tienen su propio cache
    // (separado del bucket genérico "others" de next-pwa, que comparte 32
    // entradas con toda la app y podría desalojarlas) para que SIEMPRE
    // queden disponibles offline.
    {
      urlPattern: ({ url }: { url: URL }) =>
        self.origin === url.origin &&
        (url.pathname.startsWith("/client/my-routine") ||
          url.pathname.startsWith("/client/log-workout")),
      handler: "NetworkFirst",
      options: {
        cacheName: "fitcoach-active-routine",
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 16, maxAgeSeconds: 7 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    ...defaultRuntimeCaching,
  ],
});

const nextConfig: NextConfig = {
  // next-pwa always attaches a `webpack` config, which Turbopack (default in
  // Next.js 16) refuses to run under silently. In dev, next-pwa is disabled
  // above so the webpack function is a no-op — this just silences the
  // Turbopack/webpack mismatch warning. Production builds still need
  // `next build --webpack` (see package.json) for the service worker to
  // actually be generated, since Turbopack does not execute webpack plugins.
  turbopack: {},
  // Permite acceder al dev server desde la IP de red local (celular en la
  // misma WiFi); sin esto Next.js bloquea el recurso HMR cross-origin y la
  // página queda en blanco/negro.
  allowedDevOrigins: ["192.168.100.9", "172.20.10.6"],
};

export default withPWA(nextConfig);
