import type { Metadata, Viewport } from "next";
import { Bebas_Neue, DM_Sans, Anton } from "next/font/google";
import { AppHeightFix } from "@/components/app-height-fix";
import { InstallBanner } from "@/components/install-banner";
import { JsErrorCatcher } from "@/components/js-error-catcher";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { TouchActiveFix } from "@/components/touch-active-fix";
import "./globals.css";

// Bebas Neue: títulos y números grandes de alto impacto. DM Sans: cuerpo y UI.
const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  weight: "400",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

// Anton: SOLO el wordmark "Euskadi Team" del hero de auth (font-hero en
// globals.css). Excepción puntual confirmada con Luis — el resto de la app
// sigue en Bebas Neue. Ver DESIGN.md.
const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Euskadi Team",
  description: "Entrenamiento personalizado con Luis Mineur",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Euskadi Team",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  other: {
    // Next only emits the modern `mobile-web-app-capable` tag for
    // appleWebApp.capable; keep the legacy Apple-prefixed one too for
    // older iOS Safari versions that don't recognize the standard tag.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#080808",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${bebasNeue.variable} ${dmSans.variable} ${anton.variable} h-full antialiased`}
      // AppHeightFix corre con strategy="beforeInteractive" y le agrega un
      // style={--app-height} a este <html> ANTES de que React hidrate —
      // React lo marca como mismatch de atributo (no de contenido, así que
      // no revierte nada, solo avisa por consola). Es intencional: sin
      // esto la advertencia ensucia la consola en cada carga.
      suppressHydrationWarning
    >
      {/* min-h-dvh (no min-h-full): min-h-full depende de una cadena de
          alturas en porcentaje (html 100% -> body 100%) que en iOS no
          siempre recalcula al toque con la barra dinámica de Safari o el
          safe-area-inset-bottom. dvh es el viewport real, dinámico, mismo
          criterio que ya usa cada layout (h-dvh) para su contenedor raíz. */}
      <body className="min-h-dvh flex flex-col">
        <JsErrorCatcher />
        <AppHeightFix />
        {children}
        <InstallBanner />
        <ServiceWorkerRegister />
        <TouchActiveFix />
      </body>
    </html>
  );
}
