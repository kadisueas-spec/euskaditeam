"use client";

import { useState } from "react";
import { setPhotosPublicUseAuthorization } from "@/app/client/profile/actions";

// Toggle revocable del consentimiento único de uso público de fotos de
// progreso (ago-2026) — misma decisión que responde PhotosConsentModal la
// primera vez, acá se puede cambiar cuando quiera. Sin notificación push
// al cambiarlo (pedido explícito).
export function PhotosConsentToggle({
  initialAuthorized,
}: {
  initialAuthorized: boolean | null;
}) {
  const [authorized, setAuthorized] = useState(initialAuthorized ?? false);
  const [saving, setSaving] = useState(false);

  async function handleChange(checked: boolean) {
    setAuthorized(checked);
    setSaving(true);
    const result = await setPhotosPublicUseAuthorization(checked);
    setSaving(false);
    if ("error" in result) setAuthorized(!checked); // revertir si falló
  }

  return (
    <label className="flex min-h-[44px] items-center justify-between gap-3 py-1.5">
      <span className="flex flex-col pr-2">
        <span className="text-sm text-white">Autorizar uso público de mis fotos</span>
        <span className="text-xs text-[#888888]">
          Le permite a tu coach publicarlas como ejemplo de resultados.
        </span>
      </span>
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input
          type="checkbox"
          checked={authorized}
          disabled={saving}
          onChange={(e) => handleChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="pointer-events-none absolute inset-0 rounded-full bg-white/15 transition-colors peer-checked:bg-[#e8001c]" />
        <span className="pointer-events-none absolute left-0.5 size-6 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
