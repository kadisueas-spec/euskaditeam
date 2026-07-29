"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Camera } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PhotoComparisonView } from "@/components/client/photo-comparison-view";
import type { PhotoCategory, ProgressPhoto } from "@/lib/supabase/progress-photos";
import type { EvaluationDetail } from "@/lib/supabase/anthropometrics";
import { formatDate } from "@/lib/utils/format-date";

const CATEGORY_LABEL: Record<PhotoCategory, string> = {
  front: "Frente",
  side: "Perfil",
  back: "Espalda",
};

// Vista de solo lectura para el coach — mismas fotos que sube el cliente
// desde /client/progress, sin botón de subir ni de eliminar (eso es
// exclusivo del cliente, dueño de sus propias fotos).
export function ClientProgressPhotos({
  photos,
  evaluations,
}: {
  photos: ProgressPhoto[];
  evaluations: EvaluationDetail[];
}) {
  const [viewingPhoto, setViewingPhoto] = useState<ProgressPhoto | null>(null);
  const [comparing, setComparing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (photos.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title="Este cliente todavía no subió fotos de progreso."
        className="py-4"
      />
    );
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  const comparisonPhotos = selectedIds
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is ProgressPhoto => !!p)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Fotos de progreso</p>
        {photos.length >= 2 && (
          <button
            type="button"
            onClick={() => {
              setComparing((c) => !c);
              setSelectedIds([]);
            }}
            className="flex min-h-[44px] items-center rounded-full bg-white/5 px-3 text-sm font-medium text-[#e8001c] active:bg-white/10"
          >
            {comparing ? "Cancelar" : "Comparar"}
          </button>
        )}
      </div>

      {comparing && (
        <p className="text-sm text-[#888888]">
          Elegí dos fotos para comparar ({selectedIds.length}/2).
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => {
          const selectedIndex = selectedIds.indexOf(photo.id);
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => (comparing ? toggleSelect(photo.id) : setViewingPhoto(photo))}
              className="relative aspect-square overflow-hidden rounded-xl bg-white/5"
            >
              {photo.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.photoUrl} alt="" className="size-full object-cover" />
              )}
              {selectedIndex !== -1 && (
                <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-[#e8001c] text-xs font-bold text-white">
                  {selectedIndex + 1}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-3 pb-1 text-left text-[10px] text-white">
                {formatDate(photo.takenAt)}
              </span>
            </button>
          );
        })}
      </div>

      {comparisonPhotos.length === 2 && (
        <PhotoComparisonView
          photos={[comparisonPhotos[0], comparisonPhotos[1]]}
          evaluations={evaluations}
          onClose={() => {
            setComparing(false);
            setSelectedIds([]);
          }}
        />
      )}

      {viewingPhoto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">{formatDate(viewingPhoto.takenAt)}</p>
              {viewingPhoto.category && (
                <p className="text-xs text-[#888888]">{CATEGORY_LABEL[viewingPhoto.category]}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setViewingPhoto(null)}
              aria-label="Cerrar"
              className="flex size-11 items-center justify-center rounded-full text-white active:bg-white/10"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden px-2">
            {viewingPhoto.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewingPhoto.photoUrl}
                alt=""
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
