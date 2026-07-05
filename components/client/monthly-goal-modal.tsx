"use client";

import Image from "next/image";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import {
  createMonthlyGoal,
  type MonthlyGoalFormState,
} from "@/app/client/actions";

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// Label flotante: sube y se pone roja cuando el campo tiene foco o contenido
// (:placeholder-shown se dispara con placeholder=" ", no vacío).
function FloatingInput({
  id,
  name,
  label,
  type = "text",
  ...rest
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "placeholder">) {
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={type}
        placeholder=" "
        className="peer h-14 w-full rounded-lg border border-white/20 bg-white/10 px-3 pt-4 text-base text-white outline-none focus:border-[#e8001c]"
        {...rest}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-1 left-3 text-xs text-[#888888] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1 peer-focus:text-xs peer-focus:text-[#e8001c]"
      >
        {label}
      </label>
    </div>
  );
}

function FloatingTextarea({
  id,
  name,
  label,
  ...rest
}: {
  id: string;
  name: string;
  label: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "name" | "placeholder">) {
  return (
    <div className="relative">
      <textarea
        id={id}
        name={name}
        placeholder=" "
        className="peer w-full resize-none rounded-lg border border-white/20 bg-white/10 px-3 pt-5 pb-2 text-base text-white outline-none focus:border-[#e8001c]"
        {...rest}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-1 left-3 text-xs text-[#888888] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1 peer-focus:text-xs peer-focus:text-[#e8001c]"
      >
        {label}
      </label>
    </div>
  );
}

export function MonthlyGoalModal() {
  const [state, formAction, pending] = useActionState<
    MonthlyGoalFormState,
    FormData
  >(createMonthlyGoal, undefined);
  const monthName = MONTH_NAMES[new Date().getMonth()];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#080808]/95 backdrop-blur-xl">
      <FadeIn className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-6 px-5 py-10">
        <div className="text-center">
          <div className="relative mx-auto flex w-fit items-center justify-center">
            <div className="absolute size-20 rounded-full bg-[#e8001c]/25 blur-2xl" />
            <Image
              src="/brand/euskadi-logo.png"
              alt=""
              width={56}
              height={56}
              className="relative"
            />
          </div>
          <h1 className="mt-3 font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
            Nuevo mes · Nuevo objetivo
          </h1>
          <p className="mt-2 text-sm text-[#888888]">
            ¡Arrancamos {monthName}! Definí tu objetivo del mes para seguir
            usando la app. Te toma un minuto.
          </p>
        </div>

        <form
          action={formAction}
          className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
        >
          <FloatingTextarea
            id="main_goal"
            name="main_goal"
            label="Objetivo principal del mes"
            rows={2}
            required
          />

          <FloatingInput
            id="weight_kg"
            name="weight_kg"
            label="Tu peso corporal actual (kg)"
            type="number"
            step="0.1"
            inputMode="decimal"
            required
          />

          <div className="flex flex-col gap-2">
            <p className="text-sm text-white">
              ¿Cómo arrancás el mes? (energía y motivación)
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <div key={level} className="flex-1">
                  <input
                    type="radio"
                    id={`motivation-${level}`}
                    name="motivation_level"
                    value={level}
                    className="peer sr-only"
                    required
                    defaultChecked={level === 3}
                  />
                  <label
                    htmlFor={`motivation-${level}`}
                    className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg bg-white/10 text-lg font-semibold text-[#888888] transition-transform active:scale-90 peer-checked:bg-white peer-checked:text-[#e8001c] peer-checked:shadow-[0_0_16px_rgba(232,0,28,0.35)]"
                  >
                    {level}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <FloatingTextarea
            id="improve_note"
            name="improve_note"
            label="¿Qué querés mejorar respecto al mes pasado?"
            rows={2}
          />

          {state?.error && (
            <p className="rounded-lg bg-white/10 p-2 text-sm text-white">
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            variant="outline"
            disabled={pending}
            className="min-h-[48px] w-full border-transparent bg-white text-base font-semibold text-[#e8001c] hover:bg-white/90"
          >
            {pending ? "Guardando..." : "Empezar el mes"}
          </Button>
        </form>
      </FadeIn>
    </div>
  );
}
