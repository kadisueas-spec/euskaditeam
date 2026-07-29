"use client";

import { Download, X } from "lucide-react";
import type { ProgressPhoto } from "@/lib/supabase/progress-photos";
import type { EvaluationDetail } from "@/lib/supabase/anthropometrics";
import { formatDate } from "@/lib/utils/format-date";

// Cuánto puede distar (en días) una evaluación antropométrica de la fecha
// de la foto para considerarse "cercana" y mostrarse debajo — más allá de
// esto, el dato ya no describe bien ese momento y confundiría más de lo
// que ayuda.
const NEARBY_EVALUATION_DAYS = 14;

function closestEvaluation(
  evaluations: EvaluationDetail[],
  dateStr: string
): EvaluationDetail | null {
  const target = new Date(`${dateStr}T00:00:00Z`).getTime();
  let best: { evaluation: EvaluationDetail; diffDays: number } | null = null;
  for (const ev of evaluations) {
    const evTime = new Date(`${ev.evaluationDate}T00:00:00Z`).getTime();
    const diffDays = Math.abs(evTime - target) / 86400000;
    if (!best || diffDays < best.diffDays) best = { evaluation: ev, diffDays };
  }
  return best && best.diffDays <= NEARBY_EVALUATION_DAYS ? best.evaluation : null;
}

function PhotoCard({
  photo,
  evaluation,
  coachView,
}: {
  photo: ProgressPhoto;
  evaluation: EvaluationDetail | null;
  coachView: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-white/5">
        {photo.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.photoUrl} alt="" className="size-full object-cover" />
        )}
      </div>
      <p className="text-center text-sm font-medium text-white">{formatDate(photo.takenAt)}</p>
      {/* Esto es lo que diferencia esto de una galería común: la foto
          acompañada del dato medido, no solo la imagen. */}
      {evaluation ? (
        <div className="flex flex-col items-center gap-0.5">
          <p className="font-display text-2xl text-[#e8001c]">{evaluation.weightKg} kg</p>
          {evaluation.bodyFatPercentage != null && (
            <p className="text-xs text-[#888888]">
              {evaluation.bodyFatPercentage.toFixed(1)}% grasa
            </p>
          )}
        </div>
      ) : (
        <p className="text-center text-xs text-[#666666]">Sin evaluación cercana</p>
      )}
      {coachView && photo.photoUrl && (
        <a
          href={photo.photoUrl}
          download={`foto-progreso-${photo.takenAt}.jpg`}
          className="flex min-h-[36px] items-center justify-center gap-1.5 rounded-full bg-white/5 text-xs font-medium text-[#e8001c] active:bg-white/10"
        >
          <Download className="size-3.5" />
          Descargar
        </a>
      )}
    </div>
  );
}

export function PhotoComparisonView({
  photos,
  evaluations,
  onClose,
  coachView = false,
}: {
  photos: [ProgressPhoto, ProgressPhoto];
  evaluations: EvaluationDetail[];
  onClose: () => void;
  // Vista del coach (client-progress-photos.tsx): agrega descarga a cada
  // tarjeta. El cliente comparando sus propias fotos no la necesita.
  coachView?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium text-white">Comparación</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex size-11 items-center justify-center rounded-full text-white active:bg-white/10"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="flex flex-1 items-start gap-3 overflow-y-auto px-4 pb-6">
        <PhotoCard
          photo={photos[0]}
          evaluation={closestEvaluation(evaluations, photos[0].takenAt)}
          coachView={coachView}
        />
        <PhotoCard
          photo={photos[1]}
          evaluation={closestEvaluation(evaluations, photos[1].takenAt)}
          coachView={coachView}
        />
      </div>
    </div>
  );
}
