"use client";

import { useEffect, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { MyMonthUnlocked } from "./my-month-unlocked";
import type { MyMonthUnlocked as MyMonthUnlockedData } from "@/lib/supabase/my-month";

function monthStorageKey() {
  return `mimes-unlock-seen-${new Date().toISOString().slice(0, 7)}`;
}

// Bloque 2 (jul-2026): la primera vez que el cliente ve el mes desbloqueado
// (una sola vez por mes, vía localStorage), muestra el candado abriéndose
// antes de revelar el contenido. El swap Lock -> LockOpen es por estado
// (no por opacity animada), así con prefers-reduced-motion activado se ve
// igual de claro, solo sin el shake/pop — nunca se queda "roto" a mitad de
// camino (ver DESIGN.md).
export function MonthUnlockReveal({ data }: { data: MyMonthUnlockedData }) {
  const [stage, setStage] = useState<"checking" | "revealing" | "done">(
    "checking"
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = monthStorageKey();
    if (localStorage.getItem(key)) {
      setStage("done");
      return;
    }
    setStage("revealing");
    const openTimer = setTimeout(() => setOpen(true), 600);
    const doneTimer = setTimeout(() => {
      localStorage.setItem(key, "1");
      setStage("done");
    }, 2400);
    return () => {
      clearTimeout(openTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  function skip() {
    localStorage.setItem(monthStorageKey(), "1");
    setStage("done");
  }

  if (stage === "checking") return null;

  if (stage === "revealing") {
    return (
      <button
        type="button"
        onClick={skip}
        aria-label="Omitir animación y ver el resumen del mes"
        className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-4 text-center"
      >
        {open ? (
          <LockOpen className="animate-lock-pop size-16 text-[#e8001c]" />
        ) : (
          <Lock className="animate-lock-shake size-16 text-[#e8001c]" />
        )}
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
            Terminaste el mes.
          </h2>
          <p className="text-sm text-[#888888]">
            Ahora viene la verdad, vamos a descubrirlo.
          </p>
        </div>
      </button>
    );
  }

  return <MyMonthUnlocked data={data} />;
}
