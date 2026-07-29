"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { compressImage } from "@/lib/utils/compress-image";
import {
  deleteProgressPhoto,
  dismissProgressPhotoReminder,
  uploadProgressPhoto,
} from "@/app/client/progress/photos-actions";
import type { PhotoCategory, ProgressPhoto } from "@/lib/supabase/progress-photos";
import type { EvaluationDetail } from "@/lib/supabase/anthropometrics";
import { formatDate } from "@/lib/utils/format-date";
import { PhotoComparisonView } from "./photo-comparison-view";
import { PhotoViewer } from "./photo-viewer";

const CATEGORY_LABEL: Record<PhotoCategory, string> = {
  front: "Frente",
  side: "Perfil",
  back: "Espalda",
};

// Fotos de progreso corporal (jul-2026) — galería + comparación, junto a
// las evaluaciones antropométricas en la pestaña "Mi Cuerpo". El input de
// archivo no fuerza `capture`: así el selector nativo del teléfono ofrece
// tanto "Tomar foto" como "Elegir de la galería", que es justo el pedido
// ("desde la galería o con la cámara") sin forzar uno de los dos.
export function ProgressPhotosSection({
  photos: initialPhotos,
  evaluations,
  showReminder,
}: {
  photos: ProgressPhoto[];
  evaluations: EvaluationDetail[];
  showReminder: boolean;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [category, setCategory] = useState<PhotoCategory | "">("");
  const [reminderHidden, setReminderHidden] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewingPhoto, setViewingPhoto] = useState<ProgressPhoto | null>(null);
  const [comparing, setComparing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressed, "photo.jpg");
      if (category) formData.append("category", category);

      const result = await uploadProgressPhoto(formData);
      if ("error" in result) {
        setUploadError(result.error);
        return;
      }

      // Optimista: mostramos la versión comprimida local ya mismo, sin
      // esperar a que revalidatePath vuelva a traer la lista del servidor
      // con la URL firmada real.
      setPhotos((prev) => [
        {
          id: `pending-${crypto.randomUUID()}`,
          takenAt: new Date().toISOString().slice(0, 10),
          category: category || null,
          photoUrl: URL.createObjectURL(compressed),
        },
        ...prev,
      ]);
      setReminderHidden(true);
    } catch (err) {
      console.error("upload progress photo error:", err);
      setUploadError("No se pudo subir la foto. Probá de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  function handleDismissReminder() {
    setReminderHidden(true);
    startTransition(() => {
      dismissProgressPhotoReminder();
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // reemplaza la selección más vieja
      return [...prev, id];
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteProgressPhoto(id);
      if ("error" in result) {
        setUploadError(result.error);
        setDeletingId(null);
        return;
      }
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      setViewingPhoto(null);
      setDeletingId(null);
    });
  }

  const comparisonPhotos = selectedIds
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is ProgressPhoto => !!p)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt)) as ProgressPhoto[];

  return (
    <div className="flex flex-col gap-4">
      {showReminder && !reminderHidden && (
        <div className="flex items-start gap-2 rounded-lg border border-[#e8001c]/40 bg-[#e8001c]/10 p-3 text-sm text-white">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#e8001c]" />
          <div className="flex flex-1 flex-col gap-2">
            <p>Recordá subir tus fotos de chequeo para que tu progreso quede registrado</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[36px] w-fit items-center gap-1.5 rounded-full bg-[#e8001c] px-3 text-sm font-medium text-white active:bg-[#b8001a]"
            >
              <Camera className="size-3.5" />
              Subir foto
            </button>
          </div>
          <button
            type="button"
            onClick={handleDismissReminder}
            aria-label="Descartar aviso"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#888888] active:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

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

      {comparing ? (
        <p className="text-sm text-[#888888]">
          Elegí dos fotos para comparar ({selectedIds.length}/2).
        </p>
      ) : (
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
            {uploading ? "Subiendo..." : "Agregar foto"}
          </Button>
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        </div>
      )}

      {photos.length === 0 ? (
        <p className="text-sm text-[#888888]">Todavía no subiste ninguna foto de progreso.</p>
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
          onClose={() => {
            setComparing(false);
            setSelectedIds([]);
          }}
        />
      )}

      {viewingPhoto && (
        <PhotoViewer
          photo={viewingPhoto}
          onClose={() => setViewingPhoto(null)}
          onDelete={() => handleDelete(viewingPhoto.id)}
          deleting={pending && deletingId === viewingPhoto.id}
        />
      )}
    </div>
  );
}
