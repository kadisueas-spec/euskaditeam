"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { deleteRoutine } from "./actions";
import type { RoutineListItem as RoutineListItemType } from "@/lib/supabase/routines";

const CONFIRM_TEXT =
  "Esta acción eliminará la rutina y todos sus días y ejercicios programados. Los entrenamientos ya registrados por el cliente no se eliminan. ¿Confirmás?";

const ACTIVE_CLIENT_WARNING =
  "Esta rutina está actualmente asignada a un cliente activo.";

export function RoutineListItem({ routine }: { routine: RoutineListItemType }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRoutine(routine.id);
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
        <p className="font-medium text-white">{routine.name}</p>
        {routine.isActive && (
          <p className="flex items-center gap-2 text-sm font-medium text-amber-400">
            <TriangleAlert className="size-4 shrink-0" />
            {ACTIVE_CLIENT_WARNING}
          </p>
        )}
        <p className="text-sm text-white">{CONFIRM_TEXT}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="min-h-[44px] min-w-[44px] flex-1 cursor-pointer touch-manipulation"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            className="min-h-[44px] min-w-[44px] flex-1 cursor-pointer touch-manipulation bg-[#e8001c] hover:bg-[#b8001a]"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
            {pending ? "Eliminando..." : "Eliminar rutina"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[#1e1e1e] bg-[#111111] transition-colors duration-200 hover:border-[#e8001c]">
      <Link
        href={`/coach/routines/${routine.id}`}
        className="flex flex-1 items-center justify-between gap-3 p-4"
      >
        <div>
          <p className="font-medium text-white">{routine.name}</p>
          <p className="text-sm text-[#888888]">
            {routine.clientName ?? "Sin cliente"}
          </p>
        </div>
        <Badge variant={routine.isActive ? "default" : "secondary"}>
          {routine.isActive ? "Activa" : "Archivada"}
        </Badge>
      </Link>
      <button
        type="button"
        aria-label="Eliminar rutina"
        onClick={() => setConfirming(true)}
        className="mr-3 flex size-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full text-[#e8001c] active:bg-[#e8001c]/10"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
