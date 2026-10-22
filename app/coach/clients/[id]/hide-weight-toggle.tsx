"use client";

import { useState, useTransition } from "react";
import { setHideWeightInReports } from "./actions";

// Interruptor "No mostrar peso en reportes" (oct-2026): oculta la tarjeta de
// peso y la línea de peso del objetivo en los reportes de este cliente.
export function HideWeightToggle({ clientId, initial }: { clientId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <label className="mt-2 flex min-h-[44px] items-center justify-between gap-3 border-t border-[#1e1e1e] pt-3 text-[#f5f5f5]">
      <span>No mostrar peso en reportes</span>
      <input
        type="checkbox"
        className="size-5 accent-[#e8001c]"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          setError(null);
          start(async () => {
            const r = await setHideWeightInReports(clientId, next);
            if (r.error) {
              setOn(!next);
              setError(r.error);
            }
          });
        }}
      />
      {error && <span role="alert" className="text-sm text-[#e8001c]">{error}</span>}
    </label>
  );
}
