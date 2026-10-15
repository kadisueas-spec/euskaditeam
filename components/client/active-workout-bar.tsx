"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { fetchActiveWorkoutSession } from "@/app/client/actions";
import type { ActiveWorkoutSession } from "@/lib/supabase/client-routine";

// Barra fija "Entrenamiento en curso" (oct-2026): Entrenar salió de la
// bottom nav, así que si el cliente sale de la pantalla de registro a
// mitad de sesión (a mirar un video, su progreso, etc.) esta barra es el
// camino de vuelta, desde cualquier pantalla. Se oculta dentro de la
// propia pantalla de Entrenar.
//
// `initial` lo calcula el layout en el servidor (sin parpadeo en la
// primera carga), pero el layout no se vuelve a renderizar al navegar, así
// que en cada cambio de ruta se vuelve a pedir — cubre arrancar una sesión
// (entrar a Entrenar y salir) y terminarla (finishWorkout navega afuera).
export function ActiveWorkoutBar({ initial }: { initial: ActiveWorkoutSession | null }) {
  const pathname = usePathname();
  const [session, setSession] = useState(initial);
  const onWorkoutScreen = pathname.startsWith("/client/log-workout");

  useEffect(() => {
    if (onWorkoutScreen) return;
    let cancelled = false;
    fetchActiveWorkoutSession()
      .then((next) => {
        if (!cancelled) setSession(next);
      })
      .catch(() => {
        // Sin conexión: se mantiene el último dato conocido en vez de
        // esconder la barra (la sesión sigue abierta en el servidor).
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, onWorkoutScreen]);

  if (!session || onWorkoutScreen) return null;

  return (
    <Link
      href={`/client/log-workout?day=${session.dayId}`}
      className="flex min-h-[52px] shrink-0 items-center gap-3 border-t border-[#e8001c]/40 bg-[#111111] px-4 active:bg-white/5"
    >
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#e8001c] opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2.5 rounded-full bg-[#e8001c]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold tracking-widest text-[#e8001c] uppercase">
          Entrenamiento en curso
        </span>
        <span className="block truncate text-sm font-medium text-[#f5f5f5]">
          {session.dayName ?? "Tu sesión de hoy"}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-[#e8001c]">
        Continuar
        <ChevronRight className="size-4" />
      </span>
    </Link>
  );
}
