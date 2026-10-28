"use client";

import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";

// Cronómetro opcional de los isométricos (oct-2026): "Empezar" cuenta hacia
// arriba y "Listo" completa los segundos de la serie, para no tener que
// contar a mano. Cuenta desde una marca de tiempo real (no un contador que
// se reinicia), así no se atrasa si el teléfono frena el intervalo.
export function IsometricStopwatch({ onDone }: { onDone: (seconds: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const frame = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (startedAt == null) return;
    frame.current = setInterval(() => setNow(Date.now()), 200);
    return () => {
      if (frame.current) clearInterval(frame.current);
    };
  }, [startedAt]);

  const elapsed = startedAt != null ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

  if (startedAt == null) {
    return (
      <button
        type="button"
        onClick={() => {
          const t = Date.now();
          setNow(t);
          setStartedAt(t);
        }}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#1e1e1e] bg-white/5 text-sm font-medium text-[#f5f5f5] active:bg-white/10"
      >
        <Timer className="size-4" aria-hidden /> Cronómetro
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#e8001c]/40 bg-[#e8001c]/10 p-2">
      <span className="flex-1 text-center font-display text-4xl leading-none text-[#f5f5f5]" aria-live="off">
        {elapsed} s
      </span>
      <button
        type="button"
        onClick={() => setStartedAt(null)}
        className="min-h-11 rounded-lg px-3 text-sm text-[#888888] active:bg-white/10"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={() => {
          setStartedAt(null);
          if (elapsed > 0) onDone(elapsed);
        }}
        className="min-h-11 rounded-lg bg-[#e8001c] px-4 text-sm font-semibold text-white active:bg-[#c40018]"
      >
        Listo
      </button>
    </div>
  );
}
