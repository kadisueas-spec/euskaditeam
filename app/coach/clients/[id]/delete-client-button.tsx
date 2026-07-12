"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Toast } from "@/components/ui/toast";
import { deleteClient } from "./actions";

const CONFIRM_TEXT =
  "Esta acción eliminará todos los datos de este cliente incluyendo su historial de entrenamientos y no se puede deshacer. ¿Confirmas?";

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteClient(clientId, new FormData());
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setDeleted(true);
      setTimeout(() => router.push("/coach/clients"), 1200);
    });
  }

  if (deleted) {
    return <Toast type="success" message="Cliente eliminado correctamente" />;
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e8001c]/40 bg-[#e8001c]/5 p-4">
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
            {pending ? "Eliminando..." : "Eliminar cliente"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      className="min-h-[44px] w-full cursor-pointer touch-manipulation border-[#e8001c]/40 text-[#e8001c] hover:bg-[#e8001c]/10"
      onClick={() => {
        // DIAGNÓSTICO TEMPORAL (jul-2026) — ver client-detail-tabs.tsx.
        alert("Eliminar cliente: click");
        setConfirming(true);
      }}
    >
      <TriangleAlert className="size-4" />
      Eliminar cliente
      <Trash2 className="size-4" />
    </Button>
  );
}
