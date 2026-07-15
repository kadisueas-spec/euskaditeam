"use client";

import { useActionState, useState, useTransition } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { NutritionPlan } from "@/lib/supabase/nutrition";
import { formatDate } from "@/lib/utils/format-date";
import { deleteNutritionPlan, uploadNutritionPlan } from "./nutrition/actions";

function UploadForm({ clientId }: { clientId: string }) {
  const action = uploadNutritionPlan.bind(null, clientId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
      <p className="text-sm font-medium text-white">Subir plan de alimentación</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="plan-name">Nombre del plan</Label>
        <Input
          id="plan-name"
          name="name"
          placeholder="Plan cutting semana 1-4"
          required
          className="h-11"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="valid-from">Vigencia desde</Label>
          <Input id="valid-from" name="valid_from" type="date" className="h-11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="valid-until">Vigencia hasta</Label>
          <Input id="valid-until" name="valid_until" type="date" className="h-11" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="plan-file">Archivo PDF</Label>
        <input
          id="plan-file"
          name="file"
          type="file"
          accept="application/pdf"
          required
          className="min-h-[44px] w-full cursor-pointer rounded-lg border border-[#1e1e1e] bg-transparent text-sm text-white file:mr-3 file:min-h-[44px] file:cursor-pointer file:touch-manipulation file:rounded-lg file:border-0 file:bg-[#e8001c] file:px-3 file:text-sm file:font-medium file:text-white"
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="min-h-[44px] w-fit">
        {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
        <Upload className="size-4" />
        {pending ? "Subiendo..." : "Subir plan"}
      </Button>
    </form>
  );
}

function PlanRow({ clientId, plan }: { clientId: string; plan: NutritionPlan }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteNutritionPlan(clientId, plan.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDeleted(true);
    });
  }

  if (deleted) return null;

  return (
    <li className="flex flex-col gap-1 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="size-4 shrink-0 text-[#e8001c]" />
          <div>
            <p className="font-medium text-white">{plan.name}</p>
            {(plan.validFrom || plan.validUntil) && (
              <p className="text-xs text-[#888888]">
                {plan.validFrom ? formatDate(plan.validFrom) : "?"} —{" "}
                {plan.validUntil ? formatDate(plan.validUntil) : "?"}
              </p>
            )}
          </div>
        </div>
        <Badge variant={plan.status === "active" ? "default" : "secondary"}>
          {plan.status === "active" ? "Activo" : "Archivado"}
        </Badge>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="mt-2 flex gap-2">
        {plan.downloadUrl && (
          <a
            href={plan.downloadUrl}
            download={plan.fileName}
            className="flex min-h-[40px] flex-1 items-center justify-center rounded-lg bg-white/5 px-3 text-sm font-medium text-white active:bg-white/10"
          >
            Descargar
          </a>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-label="Eliminar plan"
          className="flex min-h-[40px] min-w-[40px] cursor-pointer touch-manipulation items-center justify-center rounded-lg text-[#888888] active:bg-white/10 active:text-[#e8001c]"
        >
          {pending ? <Spinner size="sm" /> : <Trash2 className="size-4" />}
        </button>
      </div>
    </li>
  );
}

export function NutritionTab({
  clientId,
  plans,
}: {
  clientId: string;
  plans: NutritionPlan[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <UploadForm clientId={clientId} />

      {plans.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Todavía no subiste ningún plan de alimentación."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {plans.map((plan) => (
            <PlanRow key={plan.id} clientId={clientId} plan={plan} />
          ))}
        </ul>
      )}
    </div>
  );
}
