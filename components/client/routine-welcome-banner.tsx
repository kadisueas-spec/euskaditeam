"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FadeIn } from "@/components/motion/fade-in";
import { dismissWelcomeBanner } from "@/app/client/my-routine/actions";

const GREETING: Record<"male" | "female" | "neutral", string> = {
  male: "Bienvenido",
  female: "Bienvenida",
  neutral: "Bienvenido/a",
};

// Banner de bienvenida de rutina (ago-2026) — una sola vez por rutina
// (marca guardada en la base, ver dismissWelcomeBanner), tanto la primera
// vez que el cliente entra a Mi Rutina como cada vez que el coach le
// asigna una rutina nueva. Sin botón de cerrar ni tap-afuera a propósito
// (mismo criterio que MonthlyGoalModal): tiene que leer el mensaje y tocar
// "Empecemos".
export function RoutineWelcomeBanner({
  routineId,
  firstName,
  sex,
  routineName,
  mesocicloNombre,
  daysPerWeek,
  isFirstRoutine,
}: {
  routineId: string;
  firstName: string;
  sex: "male" | "female" | null;
  routineName: string;
  mesocicloNombre: string | null;
  daysPerWeek: number;
  isFirstRoutine: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [hidden, setHidden] = useState(false);
  const greeting = GREETING[sex ?? "neutral"];

  async function handleStart() {
    setPending(true);
    const result = await dismissWelcomeBanner(routineId);
    setPending(false);
    // Se oculta de forma optimista incluso si el guardado falla — no tiene
    // sentido dejar al cliente trabado en el banner por un error de red; la
    // marca simplemente quedaría pendiente para el próximo intento (o el
    // banner podría reaparecer en otra sesión, que es un fallback aceptable
    // frente a bloquear el uso de la app).
    if ("error" in result) console.error("dismissWelcomeBanner error:", result.error);
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#080808]/95 px-5 text-center backdrop-blur-xl"
    >
      <FadeIn className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
            ¡{greeting}{firstName ? `, ${firstName}` : ""}!
          </h1>
          <div className="mx-auto h-0.5 w-10 bg-[#e8001c]" />
        </div>

        <div className="flex w-full flex-col gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-5">
          <div>
            <p className="text-xs tracking-wide text-[#888888] uppercase">Tu rutina</p>
            <p className="font-display text-2xl text-[#e8001c] uppercase">{routineName}</p>
            {mesocicloNombre && <p className="text-sm text-[#888888]">{mesocicloNombre}</p>}
          </div>
          <div className="h-px bg-[#1e1e1e]" />
          <div>
            <p className="text-xs tracking-wide text-[#888888] uppercase">
              Días de entrenamiento
            </p>
            <p className="font-display text-2xl text-white">
              {daysPerWeek} por semana
            </p>
          </div>
        </div>

        <p className="text-base text-[#f5f5f5]">
          {isFirstRoutine
            ? "Acá arranca tu proceso. Yo armé este plan para vos y voy a estar viendo cada sesión que completes."
            : "Nueva etapa. Este bloque va a exigirte un poco más — para eso trabajaste el anterior."}
        </p>

        <Button
          onClick={handleStart}
          disabled={pending}
          className="min-h-[52px] w-full text-base"
        >
          {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
          {pending ? "Un momento..." : "Empecemos"}
        </Button>
      </FadeIn>
    </div>
  );
}
