"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MonthlyReviewFormData } from "@/lib/supabase/monthly-review";
import { saveMonthlyReview, type MonthlyReviewFormState } from "./actions";

export function MonthlyReviewForm({
  clientId,
  data,
}: {
  clientId: string;
  data: MonthlyReviewFormData;
}) {
  const action = saveMonthlyReview.bind(null, clientId);
  const [state, formAction, pending] = useActionState<
    MonthlyReviewFormState,
    FormData
  >(action, undefined);

  return (
    <div className="flex flex-col gap-4">
      {data.clientGoal ? (
        <div className="rounded-lg bg-white/5 p-3 text-sm text-[#888888]">
          <p className="font-medium text-white">Objetivo del cliente:</p>
          <p className="mt-1">{data.clientGoal.mainGoal}</p>
          {data.clientGoal.improveNote && (
            <p className="mt-1 text-[#888888]">
              Quería mejorar: {data.clientGoal.improveNote}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-[#888888]">
          El cliente todavía no cargó su objetivo de este mes.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="summary">Resumen del mes</Label>
          <Textarea
            id="summary"
            name="summary"
            rows={3}
            defaultValue={data.review?.summary ?? ""}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="next_month_goals">Objetivos para el mes siguiente</Label>
          <Textarea
            id="next_month_goals"
            name="next_month_goals"
            rows={2}
            defaultValue={data.review?.nextMonthGoals ?? ""}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="plan_adjustments">Ajustes al plan</Label>
          <Textarea
            id="plan_adjustments"
            name="plan_adjustments"
            rows={2}
            defaultValue={data.review?.planAdjustments ?? ""}
          />
        </div>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <Button type="submit" disabled={pending} className="w-fit">
          {pending
            ? "Guardando..."
            : data.review?.completedAt
              ? "Actualizar cierre de mes"
              : "Guardar cierre de mes"}
        </Button>

        {data.review?.completedAt && (
          <p className="text-xs text-[#888888]">
            Completado el{" "}
            {new Intl.DateTimeFormat("es-AR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(new Date(data.review.completedAt))}
          </p>
        )}
      </form>
    </div>
  );
}
