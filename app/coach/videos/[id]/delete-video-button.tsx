"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Toast } from "@/components/ui/toast";
import { deleteVideo } from "../actions";

export function DeleteVideoButton({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteVideo(videoId);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setDeleted(true);
      setTimeout(() => router.push("/coach/videos"), 1200);
    });
  }

  if (deleted) {
    return <Toast type="success" message="Video eliminado correctamente" />;
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e8001c]/40 bg-[#e8001c]/5 p-4">
        <p className="text-sm text-white">
          Esta acción elimina el video para siempre, incluidas sus asignaciones. ¿Confirmás?
        </p>
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
            {pending ? "Eliminando..." : "Eliminar video"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      className="min-h-[44px] w-fit cursor-pointer touch-manipulation border-[#e8001c]/40 text-[#e8001c] hover:bg-[#e8001c]/10"
      onClick={() => setConfirming(true)}
    >
      <TriangleAlert className="size-4" />
      Eliminar video
      <Trash2 className="size-4" />
    </Button>
  );
}
