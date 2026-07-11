"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, WifiOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { isNetworkError } from "@/lib/utils/is-network-error";

// Vista compartida por todos los error.tsx de la app (Bloque 1 — Solidez,
// jul-2026): nunca una pantalla blanca en blanco. Un solo componente para
// que el trato visual/de copy sea idéntico en cualquier segmento que
// explote — coach, cliente o público.
export function ErrorState({
  error,
  reset,
  homeHref,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref: string;
}) {
  const networkIssue = isNetworkError(error);

  useEffect(() => {
    console.error("Error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full border border-[#e8001c]/30 bg-[#e8001c]/10">
        {networkIssue ? (
          <WifiOff className="size-7 text-[#e8001c]" />
        ) : (
          <AlertTriangle className="size-7 text-[#e8001c]" />
        )}
      </span>

      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
          {networkIssue ? "Sin conexión" : "Algo se rompió"}
        </h1>
        <p className="max-w-xs text-sm text-[#888888]">
          {networkIssue
            ? "Revisá tu red y reintentá."
            : "No es tu culpa, es nuestra. Reintentá o volvé al inicio."}
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={reset}>Reintentar</Button>
        <Link href={homeHref} className={buttonVariants({ variant: "outline" })}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
