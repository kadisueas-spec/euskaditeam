"use client";

import { useState } from "react";

// Mismo patrón que ClientDetailTabs (coach) — paneles que recién se montan
// la primera vez que se visitan, para que los charts de Recharts midan
// bien desde el arranque (ver comentario largo en client-detail-tabs.tsx).
type Tab = "entrenamiento" | "cuerpo" | "nutricion";

const TAB_LABELS: Record<Tab, string> = {
  entrenamiento: "Entrenamiento",
  cuerpo: "Mi Cuerpo",
  nutricion: "Nutrición",
};

export function ProgressTabs({
  entrenamiento,
  cuerpo,
  nutricion,
}: {
  entrenamiento: React.ReactNode;
  cuerpo: React.ReactNode;
  nutricion: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("entrenamiento");
  const [visited, setVisited] = useState<Record<Tab, boolean>>({
    entrenamiento: true,
    cuerpo: false,
    nutricion: false,
  });

  function selectTab(next: Tab) {
    setVisited((v) => ({ ...v, [next]: true }));
    setTab(next);
  }

  const panels: Record<Tab, React.ReactNode> = { entrenamiento, cuerpo, nutricion };

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
