"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { generateMonthShareImage, type MonthShareData } from "@/lib/utils/month-share-image";

export function ShareMonthButton({ data }: { data: MonthShareData }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    setPending(true);
    setError(null);
    try {
      const blob = await generateMonthShareImage(data);
      if (!blob) throw new Error("No se pudo generar la imagen.");

      const fileName = `mi-mes-${data.monthLabel.toLowerCase().replace(/\s+/g, "-")}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Mi mes en Euskadi Team — ${data.monthLabel}`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // AbortError = el cliente cerró el share sheet sin elegir nada, no es un error real.
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("ShareMonthButton error:", err);
      setError("No se pudo generar la imagen. Probá de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        onClick={handleShare}
        disabled={pending}
        className="min-h-[52px] w-full max-w-xs text-base"
      >
        {pending ? (
          <Spinner size="sm" className="border-white/30 border-t-white" />
        ) : (
          <Share2 className="size-4" />
        )}
        {pending ? "Generando..." : "Compartir mi mes"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
