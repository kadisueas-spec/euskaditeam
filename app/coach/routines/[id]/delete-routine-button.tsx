"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Toast } from "@/components/ui/toast";
import { deleteRoutine } from "../actions";

const CONFIRM_TEXT =
  "Esta acción eliminará la rutina y todos sus días y ejercicios programados. Los entrenamientos ya registrados por el cliente no se eliminan. ¿Confirmás?";

const ACTIVE_CLIENT_WARNING =
  "Esta rutina está actualmente asignada a un cliente activo.";

export function DeleteRoutineButton({
  routineId,
  isActive,
}: {
  routineId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRoutine(routineId);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setDeleted(true);
      setTimeout(() => router.push("/coach/routines"), 1200);
    });
  }

  if (deleted) {
    return <Toast type="success" message="Rutina eliminada correctamente" />;
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e8001c]/40 bg-[#e8001c]/5 p-4">
        {isActive && (
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
    <Button
      variant="outline"
      className="min-h-[44px] w-full cursor-pointer touch-manipulation border-[#e8001c]/40 text-[#e8001c] hover:bg-[#e8001c]/10"
      onClick={() => setConfirming(true)}
    >
      <TriangleAlert className="size-4" />
      Eliminar rutina
      <Trash2 className="size-4" />
    </Button>
  );
}
