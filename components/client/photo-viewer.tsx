"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
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
// de un solo toque). El consentimiento de uso público ya no vive acá
// (ago-2026: pasó de ser por foto a una sola decisión en /client/profile,
// ver components/client/photos-consent-modal.tsx).
export function PhotoViewer({
  photo,
  onClose,
  onDelete,
  deleting,
}: {
  photo: ProgressPhoto;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

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

      <div className="p-4">
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
