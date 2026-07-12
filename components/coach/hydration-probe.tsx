"use client";

import { useEffect, useState } from "react";

// DIAGNÓSTICO TEMPORAL (jul-2026) — sacar apenas tengamos la respuesta.
// Ver conversación: en /coach/clients/[id] ningún botón reacciona al
// toque en el iPhone del coach, ni siquiera un alert() puesto directo en
// el onClick. Esta sonda es independiente de todo lo demás: si el
// indicador de arriba nunca pasa a verde, el JS de React no está
// corriendo en absoluto en esa pantalla (no es un bug de un botón
// puntual). Si el contador no sube al tocar, el toque no está llegando
// ni siquiera a un <button> nuevo, sin nada alrededor.
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
        fontSize: 14,
        fontFamily: "sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
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
  );
}
