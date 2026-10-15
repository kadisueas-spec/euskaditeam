"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Copy, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { copyRoutineAsTemplate } from "@/app/coach/routines/template-actions";
import type { ClientOption } from "@/lib/supabase/routines";

// Ficha del cliente (oct-2026): accesos directos desde la tarjeta Rutina
// activa — antes armar una rutina obligaba a ir a Rutinas y elegir al
// cliente del desplegable. "Nueva rutina" y "Copiar a otro cliente" no
// escriben nada: abren el wizard con el cliente (y la rutina de origen)
// precargados, para revisar antes de asignar.
export function RoutineQuickActions({
  clientId,
  routineId,
  otherClients,
}: {
  clientId: string;
  routineId: string | null;
  otherClients: ClientOption[];
}) {
  const router = useRouter();
  const [copying, setCopying] = useState(false);
  const [targetClientId, setTargetClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSaveAsTemplate() {
    if (!routineId) return;
    setError(null);
    startTransition(async () => {
      const result = await copyRoutineAsTemplate(routineId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/coach/routines/${result.id}`);
    });
  }

  function handleCopy() {
    if (!routineId || !targetClientId) return;
    router.push(`/coach/routines/new?from=${routineId}&client=${targetClientId}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/coach/routines/new?client=${clientId}`}
          className={buttonVariants({ size: "sm", className: "h-10" })}
        >
          <Plus className="size-4" />
          Nueva rutina
        </Link>
        {routineId && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => setCopying((v) => !v)}
              disabled={otherClients.length === 0}
            >
              <Copy className="size-4" />
              Copiar a otro cliente
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={handleSaveAsTemplate}
              disabled={pending}
            >
              {pending ? <Spinner size="sm" /> : <BookmarkPlus className="size-4" />}
              {pending ? "Guardando..." : "Guardar como plantilla"}
            </Button>
          </>
        )}
      </div>

      {copying && routineId && (
        <div className="flex flex-col gap-2 rounded-xl border border-[#1e1e1e] p-3 sm:flex-row">
          <NativeSelect
            value={targetClientId}
            onChange={(e) => setTargetClientId(e.target.value)}
            className="flex-1"
            aria-label="Cliente destino"
          >
            <option value="" disabled>
              Elegí el cliente destino
            </option>
            {otherClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.hasActiveRoutine ? " (tiene rutina activa)" : ""}
              </option>
            ))}
          </NativeSelect>
          <Button size="sm" className="h-10" onClick={handleCopy} disabled={!targetClientId}>
            Abrir en el wizard
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
