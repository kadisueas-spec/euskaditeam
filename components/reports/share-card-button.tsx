"use client";

import { useState } from "react";
import { Share } from "lucide-react";
import { generateReportShareImage } from "@/lib/reports/share-image";
import type { ReportCard } from "@/lib/reports/types";
import styles from "./report-player.module.css";

type ShareCard = Extract<ReportCard, { type: "share" }>;

// Compartir con el menú nativo del teléfono (Instagram, WhatsApp...). Si el
// navegador no comparte archivos, se descarga la imagen.
export function ShareCardButton({ card, interactive }: { card: ShareCard; interactive: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    if (!interactive || busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await generateReportShareImage(card);
      if (!blob) throw new Error("canvas");
      const file = new File([blob], `euskadi-${card.monthLabel.toLowerCase()}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // Cerrar el menú de compartir sin elegir nada no es un error.
      if ((err as Error).name !== "AbortError") setError("No se pudo armar la imagen. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={styles.share} onClick={share} disabled={busy}>
        {busy ? "Armando la imagen…" : "Compartir imagen"} <Share aria-hidden />
      </button>
      {error && (
        <p role="alert" className={styles.hint} style={{ textAlign: "center" }}>
          {error}
        </p>
      )}
    </>
  );
}
