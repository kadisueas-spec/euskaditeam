"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { extendMesociclo } from "@/app/coach/routines/actions";

// Sistema de mesociclos (jul-2026): a diferencia de crear una rutina nueva,
// esto NO archiva la rutina actual ni crea ninguna — solo cambia ends_at
// (la fecha de fin planificada del mesociclo vigente). "Sin fecha de fin"
// manda null (indefinido).
export function ExtendMesocicloButton({
  routineId,
  currentEndsAt,
}: {
  routineId: string;
  currentEndsAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [endsAt, setEndsAt] = useState(currentEndsAt ?? "");
  const [indefinite, setIndefinite] = useState(currentEndsAt == null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (!indefinite && !endsAt) {
      setError("Elegí una fecha o marcá \"Sin fecha de fin\".");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await extendMesociclo(routineId, indefinite ? null : endsAt);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-fit"
      >
        <CalendarClock className="size-4" />
        Extender mesociclo
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#1e1e1e] p-3">
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={indefinite}
          onChange={(e) => setIndefinite(e.target.checked)}
          className="size-4"
        />
        Sin fecha de fin (indefinido)
      </label>
      {!indefinite && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="mesociclo-ends-at" className="text-xs">
            Nueva fecha de fin
          </Label>
          <Input
            id="mesociclo-ends-at"
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={pending}>
          {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
          {pending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
