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

  // Los ejercicios globales (coach_id NULL, base compartida Euskadi) son de
  // solo lectura: ni el coach que los creó puede editarlos una vez son
  // globales (ver TAREA 1, jul-2026). RLS ya lo bloquea en el servidor;
  // acá se deshabilita el form para que la UI no prometa algo que el
  // guardado va a rechazar.
  const readOnly = initialData?.isGlobal === true;
  // El elegir "Global" vs "Propio" solo tiene sentido al crear: una vez
  // creado no se puede cambiar de dueño desde la app.
  const isCreating = !initialData;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {readOnly && (
        <div className="rounded-lg border border-[#e8001c]/30 bg-[#e8001c]/10 px-4 py-3 text-sm text-[#e8001c]">
          Este es un ejercicio de la base global Euskadi. No se puede editar
          ni borrar desde la app — es de solo lectura para todos los coaches.
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          required
          disabled={readOnly}
          defaultValue={initialData?.name}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="muscle_group">Grupo muscular</Label>
        <NativeSelect
          id="muscle_group"
          name="muscle_group"
          disabled={readOnly}
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
          disabled={readOnly}
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
            disabled={readOnly}
            defaultValue={initialData?.equipment ?? undefined}
            placeholder="Ej: Barra, Mancuernas"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="movement_pattern">Patrón de movimiento</Label>
          <Input
            id="movement_pattern"
            name="movement_pattern"
            disabled={readOnly}
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
          disabled={readOnly}
          defaultValue={initialData?.description ?? undefined}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="technique_tips">Tips de técnica</Label>
        <Textarea
          id="technique_tips"
          name="technique_tips"
          disabled={readOnly}
          defaultValue={initialData?.techniqueTips ?? undefined}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="common_mistakes">Errores comunes</Label>
        <Textarea
          id="common_mistakes"
          name="common_mistakes"
          disabled={readOnly}
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
          disabled={readOnly}
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

      {isCreating && (
        <div className="flex flex-col gap-2">
          <Label>Visibilidad</Label>
          <div className="flex flex-col gap-2 rounded-lg border border-[#1e1e1e] p-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="visibility"
                value="own"
                defaultChecked
                className="mt-1"
              />
              <span>
                <span className="font-medium">Propio (solo para mí)</span>
                <br />
                <span className="text-xs text-[#888888]">
                  Solo vos lo ves y lo podés editar o borrar.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="visibility"
                value="global"
                className="mt-1"
              />
              <span>
                <span className="font-medium">
                  Global (disponible para todos)
                </span>
                <br />
                <span className="text-xs text-[#888888]">
                  Se suma a la base Euskadi: lo ven todos los coaches y
                  queda de solo lectura (nadie lo puede editar ni borrar
                  desde la app, ni siquiera vos).
                </span>
              </span>
            </label>
          </div>
        </div>
      )}

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-3">
        {!readOnly && (
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
        )}
        <Link
          href="/coach/exercises"
          className={buttonVariants({ variant: "outline" })}
        >
          {readOnly ? "Volver" : "Cancelar"}
        </Link>
      </div>
    </form>
  );
}
