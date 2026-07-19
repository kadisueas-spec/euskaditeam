import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Migración next-pwa → Serwist (jul-2026, deuda técnica de la auditoría de
// seguridad: next-pwa está sin mantenimiento y arrastraba 7 vulnerabilidades
// de npm audit vía su cadena de dependencias). El comportamiento de runtime
// caching (cache dedicado de la rutina activa + NetworkOnly para el resto de
// las páginas) se movió como código a worker/index.js, que ahora es el
// service worker fuente completo de Serwist (swSrc) en vez de un simple
// "extra" inyectado — ver ese archivo para el detalle de cada regla.
// register: false porque el registro ya se hace a mano en
// components/service-worker-register.tsx (necesario con next-pwa en App
// Router; se mantiene igual acá para no duplicar el registro del SW).
const withSerwist = withSerwistInit({
  swSrc: "worker/index.js",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  register: false,
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
  // Serwist, igual que next-pwa antes, adjunta un plugin de webpack para
  // compilar swSrc e inyectar el manifest de precache — Turbopack (default
  // en Next.js 16) no ejecuta plugins de webpack. En dev Serwist está
  // deshabilitado arriba, así que esto solo evita el warning de mismatch;
  // producción sigue necesitando `next build --webpack` (ver package.json).
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

export default withSerwist(nextConfig);
