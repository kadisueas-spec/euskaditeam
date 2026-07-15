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
//
// BUG SEPARADO (jul-2026) — nada en esta página respondía al toque en un
// iPhone con iOS 16.0-16.3 específicamente (ni este botón ni "Eliminar
// cliente", tampoco un botón de prueba sin nada alrededor). Causa raíz real:
// el bundle de JS compartido (`main-*.js`, se carga en TODA la app) traía
// class static blocks (`static { ... }`), sintaxis ES2022 que Safari recién
// soportó en la versión 16.4 — en versiones anteriores el archivo entero
// falla al parsear y ningún script corre, sin ningún error visible para el
// usuario. Next.js/SWC solo baja el nivel de sintaxis moderna a algo
// compatible si hay un target de "browserslist" configurado; el proyecto no
// tenía ninguno. Fix real en package.json (campo "browserslist", agrega
// "iOS >= 14" / "Safari >= 14"), no acá — este componente nunca tuvo el bug.
type Tab = "resumen" | "metricas" | "evaluaciones" | "nutricion";

const TAB_LABELS: Record<Tab, string> = {
  resumen: "Resumen",
  metricas: "Métricas",
  evaluaciones: "Evaluaciones",
  nutricion: "Nutrición",
};

export function ClientDetailTabs({
  resumen,
  metricas,
  evaluaciones,
  nutricion,
}: {
  resumen: React.ReactNode;
  metricas: React.ReactNode;
  evaluaciones: React.ReactNode;
  nutricion: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("resumen");
  // Métricas y Evaluaciones recién se montan la primera vez que se visitan
  // (mismo motivo que el bug de Recharts documentado arriba: un chart
  // montado oculto mide 0×0 y no se recupera).
  const [visited, setVisited] = useState<Record<Tab, boolean>>({
    resumen: true,
    metricas: false,
    evaluaciones: false,
    nutricion: false,
  });

  function selectTab(next: Tab) {
    setVisited((v) => ({ ...v, [next]: true }));
    setTab(next);
  }

  const panels: Record<Tab, React.ReactNode> = { resumen, metricas, evaluaciones, nutricion };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 text-sm">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => selectTab(t)}
            className={`min-h-[44px] min-w-[44px] flex-1 cursor-pointer touch-manipulation rounded-full text-center font-display tracking-widest uppercase transition-colors ${
              tab === t
                ? "bg-[#e8001c] text-white shadow-[0_0_12px_rgba(232,0,28,0.4)]"
                : "bg-white/5 text-[#888888]"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {(Object.keys(TAB_LABELS) as Tab[]).map(
        (t) =>
          visited[t] && (
            <div key={t} className={tab === t ? "flex flex-col gap-6" : "hidden"}>
              {panels[t]}
            </div>
          )
      )}
    </div>
  );
}
