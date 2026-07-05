"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { MUSCLE_GROUPS } from "@/lib/constants/exercises";
import type { ExerciseDetail } from "@/lib/supabase/exercises";
import type { ExerciseFormState } from "./actions";

type ExerciseFormAction = (
  state: ExerciseFormState,
  formData: FormData
) => Promise<ExerciseFormState>;

export function ExerciseForm({
  action,
  initialData,
}: {
  action: ExerciseFormAction;
  initialData?: ExerciseDetail;
}) {
  const [state, formAction, pending] = useActionState<
    ExerciseFormState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={initialData?.name}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="muscle_group">Grupo muscular</Label>
        <NativeSelect
          id="muscle_group"
          name="muscle_group"
          defaultValue={initialData?.muscleGroup ?? ""}
        >
          <option value="" disabled>
            Seleccioná un grupo muscular
          </option>
          {MUSCLE_GROUPS.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="secondary_muscles">
          Músculos secundarios (separados por coma)
        </Label>
        <Input
          id="secondary_muscles"
          name="secondary_muscles"
          defaultValue={initialData?.secondaryMuscles.join(", ")}
          placeholder="Ej: Deltoides, Core"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="equipment">Equipo</Label>
          <Input
            id="equipment"
            name="equipment"
            defaultValue={initialData?.equipment ?? undefined}
            placeholder="Ej: Barra, Mancuernas"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="movement_pattern">Patrón de movimiento</Label>
          <Input
            id="movement_pattern"
            name="movement_pattern"
            defaultValue={initialData?.movementPattern ?? undefined}
            placeholder="Ej: Empuje horizontal"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={initialData?.description ?? undefined}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="technique_tips">Tips de técnica</Label>
        <Textarea
          id="technique_tips"
          name="technique_tips"
          defaultValue={initialData?.techniqueTips ?? undefined}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="common_mistakes">Errores comunes</Label>
        <Textarea
          id="common_mistakes"
          name="common_mistakes"
          defaultValue={initialData?.commonMistakes ?? undefined}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="video_url">Video demostrativo (YouTube)</Label>
        <Input
          id="video_url"
          name="video_url"
          type="url"
          defaultValue={
            initialData?.videoId
              ? `https://www.youtube.com/watch?v=${initialData.videoId}`
              : undefined
          }
          placeholder="https://www.youtube.com/watch?v=..."
        />
        <p className="text-xs text-[#888888]">
          Pegá el link del video de YouTube (puede ser no listado). El sistema
          extrae el ID automáticamente.
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        <Link
          href="/coach/exercises"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
