"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { compressImage } from "@/lib/utils/compress-image";
import { uploadClientProgressPhoto } from "@/app/coach/clients/[id]/photos-actions";
import { PhotoComparisonView } from "@/components/client/photo-comparison-view";
import type { PhotoCategory, ProgressPhoto } from "@/lib/supabase/progress-photos";
import type { EvaluationDetail } from "@/lib/supabase/anthropometrics";
import { formatDate } from "@/lib/utils/format-date";

const CATEGORY_LABEL: Record<PhotoCategory, string> = {
  front: "Frente",
  side: "Perfil",
  back: "Espalda",
};

// Fotos de progreso del cliente, vistas + gestionadas desde el coach
// (jul-2026): el coach puede subir (ej. en una evaluación presencial) y
// descargar, pero nunca borrar ni tocar el consentimiento de uso público
// — eso sigue siendo exclusivo del cliente (ver
// app/client/progress/photos-actions.ts y el RLS de la migración
// 20260801, que no le da UPDATE/DELETE al coach sobre esta tabla).
export function ClientProgressPhotos({
  clientId,
  photos: initialPhotos,
  evaluations,
}: {
  clientId: string;
  photos: ProgressPhoto[];
  evaluations: EvaluationDetail[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [category, setCategory] = useState<PhotoCategory | "">("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewingPhoto, setViewingPhoto] = useState<ProgressPhoto | null>(null);
  const [comparing, setComparing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressed, "photo.jpg");
      if (category) formData.append("category", category);

      const result = await uploadClientProgressPhoto(clientId, formData);
      if ("error" in result) {
        setUploadError(result.error);
        return;
      }

      setPhotos((prev) => [
        {
          id: `pending-${crypto.randomUUID()}`,
          takenAt: new Date().toISOString().slice(0, 10),
          category: category || null,
          uploadedBy: "coach",
          publicUseAuthorized: false,
          photoUrl: URL.createObjectURL(compressed),
        },
        ...prev,
      ]);
    } catch (err) {
      console.error("upload client progress photo error:", err);
      setUploadError("No se pudo subir la foto. Probá de nuevo.");
    } finally {
      setUploading(false);
    }
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {!comparing && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {(["front", "side", "back"] as PhotoCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory((prev) => (prev === c ? "" : c))}
                className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                  category === c ? "bg-[#e8001c] text-white" : "bg-white/5 text-[#888888]"
                }`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="min-h-[48px] w-full"
          >
            {uploading ? (
              <Spinner size="sm" className="border-white/30 border-t-white" />
            ) : (
              <Camera className="size-4" />
            )}
            {uploading ? "Subiendo..." : "Subir foto"}
          </Button>
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        </div>
      )}

      {comparing && (
        <p className="text-sm text-[#888888]">
          Elegí dos fotos para comparar ({selectedIds.length}/2).
        </p>
      )}

      {photos.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="Este cliente todavía no tiene fotos de progreso."
          className="py-4"
        />
      ) : (
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
                {photo.publicUseAuthorized && (
                  <span className="absolute top-1.5 left-1.5 flex items-center justify-center rounded-full bg-green-500/90 p-1 text-white">
                    <CheckCircle2 className="size-3" />
                  </span>
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
      )}

      {comparisonPhotos.length === 2 && (
        <PhotoComparisonView
          photos={[comparisonPhotos[0], comparisonPhotos[1]]}
          evaluations={evaluations}
          coachView
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
              <p className="flex items-center gap-1 text-xs text-[#888888]">
                {viewingPhoto.category && `${CATEGORY_LABEL[viewingPhoto.category]} · `}
                {viewingPhoto.publicUseAuthorized ? (
                  <span className="flex items-center gap-1 text-green-400">
                    <CheckCircle2 className="size-3" />
                    Autorizada para uso público
                  </span>
                ) : (
                  "No autorizada para uso público"
                )}
              </p>
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
          <div className="flex flex-col gap-2 p-4">
            {!viewingPhoto.publicUseAuthorized && (
              <p className="flex items-center gap-2 rounded-lg border border-[#e8001c]/40 bg-[#e8001c]/10 p-2.5 text-xs text-white">
                <AlertTriangle className="size-4 shrink-0 text-[#e8001c]" />
                Esta foto no está autorizada para uso público.
              </p>
            )}
            {viewingPhoto.photoUrl && (
              <a
                href={viewingPhoto.photoUrl}
                download={`foto-progreso-${viewingPhoto.takenAt}.jpg`}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-white/5 text-sm font-medium text-white active:bg-white/10"
              >
                <Download className="size-4" />
                Descargar
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
