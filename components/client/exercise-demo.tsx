"use client";

import { useState } from "react";
import { ExerciseVideo } from "@/components/client/exercise-video";

// Demostración del ejercicio en la pantalla de Entrenar (oct-2026).
// Prioridad: GIF animado de ExerciseDB (gif_url, copiado al bucket
// "exercise-gifs") → video de YouTube → nada. A diferencia de
// ExerciseVideo solo, acá no se muestra el placeholder "Video demostrativo
// próximamente": en medio del entrenamiento ocupa lugar sin aportar.
//
// El GIF es una silueta negra: va sobre fondo claro (#F5F5F5) para que se
// lea contra el fondo oscuro de la app. Si el GIF no carga (sin conexión,
// archivo borrado), cae al video si hay, o desaparece.
export function ExerciseDemo({
  gifUrl,
  videoId,
  exerciseName,
}: {
  gifUrl: string | null;
  videoId: string | null;
  exerciseName: string;
}) {
  const [gifFailed, setGifFailed] = useState(false);

  if (gifUrl && !gifFailed) {
    return (
      <div className="flex h-[220px] w-full items-center justify-center overflow-hidden rounded-lg bg-[#F5F5F5]">
        {/* <img> y no next/image: es un GIF animado ya optimizado, servido
            desde Supabase Storage — next/image no lo reprocesa y exigiría
            configurar remotePatterns para ese dominio. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gifUrl}
          alt={`Demostración: ${exerciseName}`}
          className="h-full w-auto max-w-full object-contain"
          decoding="async"
          onError={() => setGifFailed(true)}
        />
      </div>
    );
  }

  if (videoId) return <ExerciseVideo videoId={videoId} />;

  return null;
}
