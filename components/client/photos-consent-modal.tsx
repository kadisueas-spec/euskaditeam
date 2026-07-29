"use client";

import { useState } from "react";
import { setPhotosPublicUseAuthorization } from "@/app/client/profile/actions";
import { FadeIn } from "@/components/motion/fade-in";
import { Spinner } from "@/components/ui/spinner";

// Consentimiento único de uso público de fotos (ago-2026) — se muestra una
// sola vez, la primera vez que el cliente entra a "Mi Cuerpo" (el panel
// recién se monta cuando se visita esa pestaña, ver progress-tabs.tsx, así
// que no hace falta lógica extra acá para "primera vez que entra"). Sin
// botón de cerrar a propósito: tiene que elegir Sí o No, ninguna
// preseleccionada.
export function PhotosConsentModal({ onAnswered }: { onAnswered: () => void }) {
  const [pending, setPending] = useState<"yes" | "no" | null>(null);

  async function handleAnswer(authorized: boolean) {
    setPending(authorized ? "yes" : "no");
    const result = await setPhotosPublicUseAuthorization(authorized);
    setPending(null);
    if (!("error" in result)) onAnswered();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080808]/95 px-5 backdrop-blur-xl">
      <FadeIn className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <p className="text-lg text-white">
          Estas fotos pueden publicarse como logros tuyos y del trabajo que hacemos juntos.
          ¿Estás de acuerdo?
        </p>
        <p className="mt-3 text-sm text-[#888888]">
          Podés cambiar de opinión cuando quieras desde tu perfil.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => handleAnswer(false)}
            disabled={pending !== null}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 text-base font-medium text-white active:bg-white/5 disabled:opacity-60"
          >
            {pending === "no" && <Spinner size="sm" className="border-white/30 border-t-white" />}
            No
          </button>
          <button
            type="button"
            onClick={() => handleAnswer(true)}
            disabled={pending !== null}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-[#e8001c] text-base font-medium text-white active:bg-[#b8001a] disabled:opacity-60"
          >
            {pending === "yes" && <Spinner size="sm" className="border-white/30 border-t-white" />}
            Sí
          </button>
        </div>
      </FadeIn>
    </div>
  );
}
