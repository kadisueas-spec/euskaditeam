"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyPlus, Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { deleteRoutine } from "./actions";
import { TEMPLATE_CONFIRM_TEXT } from "./[id]/delete-routine-button";
import type { TemplateListItem as TemplateListItemType } from "@/lib/supabase/routine-templates";

// Plantillas (oct-2026): fila de la pestaña Plantillas. "Usar" abre el
// wizard con la plantilla precargada (?from=), "Editar" reusa el editor de
// rutinas (renombrar = cambiar el Nombre ahí), eliminar con confirmación
// inline de dos pasos, mismo patrón que RoutineListItem. Una plantilla
// nunca tiene entrenamientos registrados, así que deleteRoutine no tiene
// nada que desvincular.
export function TemplateListItem({ template }: { template: TemplateListItemType }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRoutine(template.id);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e8001c]/40 bg-[#e8001c]/5 p-4">
        <p className="font-medium text-white">{template.name}</p>
        <p className="text-sm text-white">{TEMPLATE_CONFIRM_TEXT}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="min-h-[44px] flex-1 cursor-pointer touch-manipulation"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            className="min-h-[44px] flex-1 cursor-pointer touch-manipulation bg-[#e8001c] hover:bg-[#b8001a]"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
            {pending ? "Eliminando..." : "Eliminar plantilla"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4 transition-colors duration-200 hover:border-[#e8001c] sm:flex-row sm:items-center">
      <Link href={`/coach/routines/${template.id}`} className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{template.name}</p>
        <p className="text-sm text-[#888888]">
          {template.dayCount} {template.dayCount === 1 ? "día" : "días"} ·{" "}
          {template.exerciseCount}{" "}
          {template.exerciseCount === 1 ? "ejercicio" : "ejercicios"}
          {template.objective ? ` · ${template.objective}` : ""}
        </p>
      </Link>
      <div className="flex items-center gap-2">
        <Link
          href={`/coach/routines/new?from=${template.id}`}
          className={buttonVariants({ size: "sm", className: "h-10" })}
        >
          <CopyPlus className="size-4" /> Usar
        </Link>
        <Link
          href={`/coach/routines/${template.id}/edit`}
          aria-label="Editar plantilla"
          className={buttonVariants({ variant: "outline", size: "sm", className: "h-10" })}
        >
          <Pencil className="size-4" />
        </Link>
        <button
          type="button"
          aria-label="Eliminar plantilla"
          onClick={() => setConfirming(true)}
          className="flex size-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full text-[#e8001c] active:bg-[#e8001c]/10"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
