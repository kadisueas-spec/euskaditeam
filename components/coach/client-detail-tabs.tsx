"use client";

import { useState } from "react";

// Fase 9: tabs simples con CSS puro (mismo patrón visual que los pasos del
// creador de rutina). Ambos paneles quedan montados y se ocultan con
// `hidden` en vez de desmontarse, para no perder el estado del selector de
// ejercicio ni volver a animar el FadeIn al cambiar de tab.
//
// BUG (jul-2026) — "el tab de Métricas no funciona": el tab SÍ cambiaba de
// estado, pero los gráficos de Recharts quedaban completamente en blanco
// (cero <svg> renderizados). Causa raíz: el panel de Métricas se montaba
// oculto (`hidden` = display:none) desde el arranque de la página porque
// "ambos paneles quedan montados"; el ResponsiveContainer de cada chart mide
// su contenedor al montarse, mide 0×0 por estar en display:none, y con esa
// versión de Recharts nunca se recupera aunque el panel se vuelva visible
// después (bug documentado de la librería, no específico de esta app).
// Fix: el panel de Métricas recién se monta la PRIMERA vez que se visita
// (ya visible en ese momento, así Recharts mide bien desde el arranque);
// de ahí en más se mantiene montado y se oculta con `hidden` como antes,
// preservando el estado del selector de ejercicio en switches posteriores.
export function ClientDetailTabs({
  resumen,
  metricas,
}: {
  resumen: React.ReactNode;
  metricas: React.ReactNode;
}) {
  const [tab, setTab] = useState<"resumen" | "metricas">("resumen");
  const [metricasVisited, setMetricasVisited] = useState(false);

  function selectTab(next: "resumen" | "metricas") {
    if (next === "metricas") setMetricasVisited(true);
    setTab(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => selectTab("resumen")}
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
          onClick={() => selectTab("metricas")}
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
      {metricasVisited && (
        <div className={tab === "metricas" ? "flex flex-col gap-6" : "hidden"}>{metricas}</div>
      )}
    </div>
  );
}
