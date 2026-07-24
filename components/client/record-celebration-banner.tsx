"use client";

import { useEffect, useState } from "react";
import type { SessionRecord } from "@/lib/utils/session-records";
import { recordBannerDetail } from "@/lib/utils/session-records";
import { randomRecordPhrase } from "@/lib/constants/record-phrases";

const AUTO_DISMISS_MS = 3000;
const EXIT_ANIMATION_MS = 250;

// Sistema de celebración de récords (jul-2026), Momento 1: banner parcial
// (~30-40% de pantalla) que sube desde abajo al completar una serie que
// superó el récord de la semana pasada — no interrumpe el flujo de carga
// de series, se cierra solo o al tocar. "leaving" separa el fade-out
// visual del unmount real (onDismiss) para que la animación de salida no
// se corte a mitad de camino.
export function RecordCelebrationBanner({
  record,
  onDismiss,
}: {
  record: SessionRecord;
  onDismiss: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [phrase] = useState(randomRecordPhrase);

  useEffect(() => {
    const dismissTimer = setTimeout(() => setLeaving(true), AUTO_DISMISS_MS);
    return () => clearTimeout(dismissTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id]);

  useEffect(() => {
    if (!leaving) return;
    const exitTimer = setTimeout(onDismiss, EXIT_ANIMATION_MS);
    return () => clearTimeout(exitTimer);
  }, [leaving, onDismiss]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      style={{ pointerEvents: "none" }}
    >
      <button
        type="button"
        role="status"
        aria-live="polite"
        onClick={() => setLeaving(true)}
        style={{ pointerEvents: "auto" }}
        className={`flex min-h-[44px] w-full max-w-sm flex-col items-center gap-2 rounded-3xl border border-[#e8001c]/50 bg-[#0d0d0d] px-6 py-7 text-center shadow-[0_0_40px_rgba(232,0,28,0.25)] ${
          leaving ? "animate-record-banner-out" : "animate-record-banner-in"
        }`}
      >
        <span className="glow-pulse flex size-14 items-center justify-center rounded-full bg-[#e8001c]/15 text-3xl">
          🏆
        </span>
        <p className="font-display text-3xl tracking-wide text-[#e8001c] uppercase">
          ¡Nuevo récord!
        </p>
        <p className="text-base font-semibold text-[#f5f5f5]">
          {recordBannerDetail(record)}
        </p>
        <p className="text-sm text-[#c9c9c9]">{phrase}</p>
      </button>
    </div>
  );
}
