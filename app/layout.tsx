import type { Metadata, Viewport } from "next";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import { InstallBanner } from "@/components/install-banner";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
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
      className={`${bebasNeue.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <InstallBanner />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
