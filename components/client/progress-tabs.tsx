"use client";

import { useState } from "react";

// Mismo patrón que ClientDetailTabs (coach) — paneles que recién se montan
// la primera vez que se visitan, para que los charts de Recharts midan
// bien desde el arranque (ver comentario largo en client-detail-tabs.tsx).
//
// Genérico desde oct-2026: antes tenía las 4 pestañas de Progreso fijas;
// al separar Mi Cuerpo como sección propia de la nav, la usan las dos
// pantallas con su propio set de pestañas.
export type ProgressTab = {
  key: string;
  label: string;
  content: React.ReactNode;
};

export function ProgressTabs({
  tabs,
  initialTab,
}: {
  tabs: ProgressTab[];
  // Deep link desde una push notification (ej. "Nueva evaluación
  // disponible" -> ?tab=cuerpo) — sin esto, el link siempre abría en la
  // primera pestaña y el cliente tenía que tocar de nuevo para ver lo que
  // la notificación anunciaba.
  initialTab?: string;
}) {
  const startTab = tabs.some((t) => t.key === initialTab) ? initialTab! : tabs[0].key;
  const [tab, setTab] = useState(startTab);
  const [visited, setVisited] = useState<Record<string, boolean>>({ [startTab]: true });

  function selectTab(next: string) {
    setVisited((v) => ({ ...v, [next]: true }));
    setTab(next);
  }

  return (
    <div className="flex flex-col gap-6">
      {tabs.length > 1 && (
        <div className="flex gap-2 text-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              className={`min-h-[44px] min-w-[44px] flex-1 cursor-pointer touch-manipulation rounded-full text-center font-display tracking-widest uppercase transition-colors ${
                tab === t.key
                  ? "bg-[#e8001c] text-white shadow-[0_0_12px_rgba(232,0,28,0.4)]"
                  : "bg-white/5 text-[#888888]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tabs.map(
        (t) =>
          visited[t.key] && (
            <div key={t.key} className={tab === t.key ? "flex flex-col gap-6" : "hidden"}>
              {t.content}
            </div>
          )
      )}
    </div>
  );
}
