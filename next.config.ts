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
    //
    // Hardening (no confirmado como causa raíz de un bug puntual, ver
    // conversación): este urlPattern matcheaba por pathname solamente. next-pwa
    // ya registra la ruta con method "GET" internamente, así que en la
    // práctica un POST (Server Action) nunca la matchea — pero eso depende
    // de un detalle interno de next-pwa/Workbox, no de este archivo. Dejar
    // request.mode === "navigate" explícito acá (igual que ya hace el
    // catch-all de abajo) hace la intención inequívoca en el código fuente:
    // esta regla es solo para el documento de la página, nunca para
    // mutaciones — sin depender de ese detalle interno para estar seguros.
    {
      urlPattern: ({ request, url }: { request: Request; url: URL }) =>
        self.origin === url.origin &&
        request.mode === "navigate" &&
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
    // F6: el catch-all "others" que trae next-pwa por defecto (más abajo,
    // via defaultRuntimeCaching) matchea CUALQUIER página del mismo origen,
    // login incluido, y la guarda con NetworkFirst (10s de timeout, 24hs de
    // cache). Eso es lo que causaba el "me pide login de nuevo" al reabrir
    // la PWA: si la red tardaba en responder al reabrir la app, el service
    // worker servía una versión vieja cacheada de la página en vez de
    // esperar/redirigir según la sesión real. Las páginas son dinámicas y
    // dependen de la cookie de sesión vigente, así que no deben cachearse
    // nunca — excepto las dos rutas de rutina activa, que ya tienen su
    // propio cache arriba a propósito para funcionar offline.
    {
      urlPattern: ({ request, url }: { request: Request; url: URL }) =>
        self.origin === url.origin &&
        request.mode === "navigate" &&
        !url.pathname.startsWith("/client/my-routine") &&
        !url.pathname.startsWith("/client/log-workout"),
      handler: "NetworkOnly",
    },
    ...defaultRuntimeCaching,
  ],
});

// Auditoría de seguridad jul-2026, sección 10: no había ningún header de
// seguridad configurado. Arrancó como Content-Security-Policy-Report-Only
// (solo loguea violaciones, no bloquea) para confirmar que no rompía el
// embed de YouTube ni el Service Worker — verificado en producción sin
// warnings, así que ahora es Content-Security-Policy en modo enforcing.
const SUPABASE_ORIGIN = "https://yrqmussybkmuwxpbqlyw.supabase.co";
const SUPABASE_WS_ORIGIN = "wss://yrqmussybkmuwxpbqlyw.supabase.co";

const CSP_DIRECTIVES = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://img.youtube.com ${SUPABASE_ORIGIN}`,
  `font-src 'self' data:`,
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS_ORIGIN}`,
  `frame-src https://www.youtube.com https://www.youtube-nocookie.com`,
  `worker-src 'self'`,
  `manifest-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
];

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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withPWA(nextConfig);
