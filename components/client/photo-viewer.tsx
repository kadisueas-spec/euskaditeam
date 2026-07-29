"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { setPhotoPublicUseAuthorization } from "@/app/client/progress/photos-actions";
import type { PhotoCategory, ProgressPhoto } from "@/lib/supabase/progress-photos";
import { formatDate } from "@/lib/utils/format-date";

const CATEGORY_LABEL: Record<PhotoCategory, string> = {
  front: "Frente",
  side: "Perfil",
  back: "Espalda",
};

const UPLOADER_LABEL = {
  client: "Subida por vos",
  coach: "Subida por tu coach",
};

// Vista de una foto en grande, con confirmación inline antes de borrar —
// mismo patrón que DeleteClientButton/DeleteWorkoutLogButton (nunca borrar
// de un solo toque).
export function PhotoViewer({
  photo,
  onClose,
  onDelete,
  deleting,
  onAuthorizationChange,
}: {
  photo: ProgressPhoto;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
  onAuthorizationChange: (authorized: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [authorized, setAuthorized] = useState(photo.publicUseAuthorized);
  const [savingAuth, setSavingAuth] = useState(false);

  async function handleAuthorizationToggle(checked: boolean) {
    setAuthorized(checked);
    setSavingAuth(true);
    const result = await setPhotoPublicUseAuthorization(photo.id, checked);
    setSavingAuth(false);
    if ("error" in result) {
      setAuthorized(!checked); // revertir si falló
      return;
    }
    onAuthorizationChange(checked);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-medium text-white">{formatDate(photo.takenAt)}</p>
          <p className="text-xs text-[#888888]">
            {photo.category && `${CATEGORY_LABEL[photo.category]} · `}
            {UPLOADER_LABEL[photo.uploadedBy]}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex size-11 items-center justify-center rounded-full text-white active:bg-white/10"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden px-2">
        {photo.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.photoUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        )}
      </div>

      <div className="flex flex-col gap-4 p-4">
        <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] px-4 py-2">
          <span className="flex flex-col pr-2">
            <span className="text-sm text-white">
              ¿Autorizás a que tu coach use esta foto para mostrar resultados?
            </span>
            <span className="text-xs text-[#888888]">
              {authorized ? "Autorizada" : "No autorizada"} — podés cambiarlo cuando quieras.
            </span>
          </span>
          <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
            <input
              type="checkbox"
              checked={authorized}
              disabled={savingAuth}
              onChange={(e) => handleAuthorizationToggle(e.target.checked)}
              className="peer sr-only"
            />
            <span className="pointer-events-none absolute inset-0 rounded-full bg-white/15 transition-colors peer-checked:bg-[#e8001c]" />
            <span className="pointer-events-none absolute left-0.5 size-6 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
          </span>
        </label>

        {confirming ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-[#e8001c]/40 bg-[#e8001c]/5 p-4">
            <p className="text-sm text-white">¿Eliminar esta foto? No se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white active:bg-white/5 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-[#e8001c] text-sm font-medium text-white active:bg-[#b8001a] disabled:opacity-60"
              >
                {deleting && <Spinner size="sm" className="border-white/30 border-t-white" />}
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-[#e8001c]/40 text-sm font-medium text-[#e8001c] active:bg-[#e8001c]/10"
          >
            <Trash2 className="size-4" />
            Eliminar foto
          </button>
        )}
      </div>
    </div>
  );
}
