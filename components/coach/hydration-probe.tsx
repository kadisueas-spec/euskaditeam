"use client";

import { useEffect, useState } from "react";

// DIAGNÓSTICO TEMPORAL (jul-2026) — sacar apenas tengamos la respuesta. Ver
// conversación: después del fix de browserslist, seguimos necesitando
// confirmar (a) si React hidrata en el iPhone del coach ahora, y (b) si
// está viendo este build nuevo o uno cacheado — por eso el sello de
// tiempo, generado en cada build (Date.now() en tiempo de build, no en
// runtime del navegador).
const BUILD_STAMP = new Date().toISOString();

export function HydrationProbe() {
  const [hydrated, setHydrated] = useState(false);
  const [taps, setTaps] = useState(0);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: hydrated ? "#0a8f3c" : "#c0392b",
        color: "white",
        padding: "10px 12px",
        fontSize: 13,
        fontFamily: "sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span>Build: {BUILD_STAMP}</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span>{hydrated ? "JS: FUNCIONA ✓" : "JS: NO CARGÓ TODAVÍA"} · Toques: {taps}</span>
        <button
          type="button"
          onClick={() => setTaps((t) => t + 1)}
          style={{
            background: "white",
            color: "black",
            padding: "8px 14px",
            borderRadius: 8,
            fontWeight: 700,
            border: "none",
          }}
        >
          TOCÁ ACÁ
        </button>
      </div>
    </div>
  );
}
