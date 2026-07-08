"use client";

import { useState } from "react";

// Fase 9: tabs simples con CSS puro (mismo patrón visual que los pasos del
// creador de rutina). Ambos paneles quedan montados y se ocultan con
// `hidden` en vez de desmontarse, para no perder el estado del selector de
// ejercicio ni volver a animar el FadeIn al cambiar de tab.
export function ClientDetailTabs({
  resumen,
  metricas,
}: {
  resumen: React.ReactNode;
  metricas: React.ReactNode;
}) {
  const [tab, setTab] = useState<"resumen" | "metricas">("resumen");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setTab("resumen")}
          className={`min-h-[44px] flex-1 rounded-full text-center font-display tracking-widest uppercase transition-colors ${
            tab === "resumen"
              ? "bg-[#e8001c] text-white shadow-[0_0_12px_rgba(232,0,28,0.4)]"
              : "bg-white/5 text-[#888888]"
          }`}
        >
          Resumen
        </button>
        <button
          type="button"
          onClick={() => setTab("metricas")}
          className={`min-h-[44px] flex-1 rounded-full text-center font-display tracking-widest uppercase transition-colors ${
            tab === "metricas"
              ? "bg-[#e8001c] text-white shadow-[0_0_12px_rgba(232,0,28,0.4)]"
              : "bg-white/5 text-[#888888]"
          }`}
        >
          Métricas
        </button>
      </div>

      <div className={tab === "resumen" ? "flex flex-col gap-6" : "hidden"}>{resumen}</div>
      <div className={tab === "metricas" ? "flex flex-col gap-6" : "hidden"}>{metricas}</div>
    </div>
  );
}
