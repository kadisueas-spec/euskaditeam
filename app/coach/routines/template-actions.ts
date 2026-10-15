"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRoutineDetail } from "@/lib/supabase/routines";
import { insertRoutineDays } from "@/lib/supabase/routine-tree";

import type { CreateRoutineInput } from "./actions";

export type CreateTemplateInput = Omit<
  CreateRoutineInput,
  "clientId" | "mesocicloNombre" | "startsAt"
>;

export type CreateTemplateResult = { success: true; id: string } | { error: string };

// Plantillas (oct-2026): "Guardar como plantilla" al final del wizard. Sin
// cliente, sin mesociclo ni fechas — duration_weeks se guarda como
// sugerencia para cuando se use. Sin push (no hay cliente a quien avisar).
export async function createTemplate(
  input: CreateTemplateInput
): Promise<CreateTemplateResult> {
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };
  if (input.days.length === 0) return { error: "Agrega al menos un día." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: template, error: templateError } = await supabase
    .from("routines")
    .insert({
      coach_id: user.id,
      client_id: null,
      is_template: true,
      is_active: false,
      name: input.name.trim(),
      description: input.description.trim() || null,
      objective: input.objective.trim() || null,
      duration_weeks: input.durationWeeks > 0 ? input.durationWeeks : 4,
    })
    .select("id")
    .single();

  if (templateError || !template) {
    console.error("createTemplate insert error:", templateError);
    return { error: "No se pudo crear la plantilla." };
  }

  const daysError = await insertRoutineDays(supabase, template.id, input.days);
  if (daysError) {
    await supabase.from("routines").delete().eq("id", template.id).eq("coach_id", user.id);
    return { error: daysError };
  }

  revalidatePath("/coach/routines");

  return { success: true, id: template.id };
}

export type CopyRoutineAsTemplateResult = { success: true; id: string } | { error: string };

// Plantillas (oct-2026): "Guardar como plantilla" desde la Rutina activa de
// un cliente. Copia la rutina entera (días + ejercicios con series, reps,
// RIR, descanso, notas, incremento y calentamiento) a una fila nueva con
// is_template = true, sin cliente ni fechas — el CHECK
// routines_template_shape lo exige a nivel base. La rutina original no se
// toca. Si la copia falla a mitad de camino se borra la plantilla parcial
// (los días/ejercicios caen en cascada), así no queda una plantilla rota.
export async function copyRoutineAsTemplate(
  routineId: string
): Promise<CopyRoutineAsTemplateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const source = await getRoutineDetail(routineId);
  if (!source) return { error: "No se encontró la rutina." };

  const { data: template, error: templateError } = await supabase
    .from("routines")
    .insert({
      coach_id: user.id,
      client_id: null,
      is_template: true,
      is_active: false,
      name: `${source.name} (plantilla)`,
      description: source.description,
      objective: source.objective,
      mesociclo_nombre: null,
      duration_weeks: source.durationWeeks,
      starts_at: null,
      ends_at: null,
    })
    .select("id")
    .single();

  if (templateError || !template) {
    console.error("copyRoutineAsTemplate insert error:", templateError);
    return { error: "No se pudo crear la plantilla." };
  }

  // Ejercicios borrados de la biblioteca quedan con exercise_id null
  // (ON DELETE SET NULL) — no tiene sentido copiarlos a la plantilla.
  const daysError = await insertRoutineDays(
    supabase,
    template.id,
    source.days.map((d) => ({
      name: d.name,
      exercises: d.exercises
        .filter((ex) => ex.exerciseId)
        .map((ex) => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets,
          repsMin: ex.repsMin,
          repsMax: ex.repsMax,
          rir: ex.rirTarget,
          restSeconds: ex.restSeconds,
          notes: ex.notes,
          weightIncrement: ex.weightIncrement,
          warmupType: ex.warmupType,
          warmupFixedWeightKg: ex.warmupFixedWeightKg,
        })),
    }))
  );

  if (daysError) {
    await supabase.from("routines").delete().eq("id", template.id).eq("coach_id", user.id);
    return { error: daysError };
  }

  revalidatePath("/coach/routines");

  return { success: true, id: template.id };
}
