"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { deleteWorkoutLog } from "@/app/client/log-workout/actions";

const CONFIRM_TEXT = "Se van a eliminar todas las series de este entrenamiento. ¿Confirmás?";

// Problema 2 (jul-2026): antes solo el coach podía borrar una sesión —
// si el cliente abría una por error, le quedaba en el historial para
// siempre. Mismo patrón inline de confirmación que DeleteClientButton.
export function DeleteWorkoutLogButton({ workoutLogId }: { workoutLogId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteWorkoutLog(workoutLogId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push("/client/progress");
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e8001c]/40 bg-[#e8001c]/5 p-4">
        <p className="text-sm text-white">{CONFIRM_TEXT}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="min-h-[44px] flex-1"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            className="min-h-[44px] flex-1 bg-[#e8001c] hover:bg-[#b8001a]"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
            {pending ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Eliminar entrenamiento"
      className="flex size-11 items-center justify-center rounded-lg text-[#888888] transition-transform active:scale-90 active:bg-[#e8001c]/15 active:text-[#e8001c]"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
