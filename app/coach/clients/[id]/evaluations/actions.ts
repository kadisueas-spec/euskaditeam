"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPushToClient } from "@/lib/push/send-push";
import {
  NEW_EVALUATION_PUSH_BODY,
  NEW_EVALUATION_PUSH_TITLE,
} from "@/lib/constants/push-copy";
import {
  calculateEvaluation,
  type Protocol,
  type Sex,
  type SkinfoldType,
} from "@/lib/anthropometrics/formulas";
import type { PerimeterType } from "@/lib/anthropometrics/constants";

function calculateAge(birthDate: string, atDate: string): number {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const at = new Date(`${atDate}T00:00:00Z`);
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    at.getUTCMonth() > birth.getUTCMonth() ||
    (at.getUTCMonth() === birth.getUTCMonth() &&
      at.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age--;
  return age;
}

export type CreateEvaluationInput = {
  clientId: string;
  evaluationDate: string;
  weightKg: number;
  heightCm: number;
  sex: Sex;
  birthDate: string;
  protocol: Protocol;
  perimeters: Partial<Record<PerimeterType, number>>;
  skinfolds: Partial<Record<SkinfoldType, number>>;
  coachNotes: string;
};

export type CreateEvaluationResult = { success: true; id: string } | { error: string };

export async function createEvaluation(
  input: CreateEvaluationInput
): Promise<CreateEvaluationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, sex, birth_date, coach_id")
    .eq("id", input.clientId)
    .eq("coach_id", user.id)
    .maybeSingle();

  // Antes esto no chequeaba `clientError` — un error real de Postgres (ej.
  // columna inexistente por una migración no corrida) hacía que `client`
  // quedara null y se mostrara "Cliente no encontrado", un mensaje
  // engañoso que no daba ninguna pista del problema real.
  if (clientError) {
    console.error("createEvaluation client lookup error:", clientError);
    return { error: "No se pudo verificar el cliente. Revisá la consola del servidor." };
  }
  if (!client) return { error: "Cliente no encontrado." };

  // Sexo y fecha de nacimiento se piden una sola vez y se arrastran — si
  // cambiaron (o no estaban cargados), se actualizan acá.
  if (client.sex !== input.sex || client.birth_date !== input.birthDate) {
    await supabase
      .from("clients")
      .update({ sex: input.sex, birth_date: input.birthDate })
      .eq("id", input.clientId);
  }

  const age = calculateAge(input.birthDate, input.evaluationDate);

  const calculated = calculateEvaluation({
    protocol: input.protocol,
    sex: input.sex,
    age,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    waistCm: input.perimeters.waist ?? null,
    hipCm: input.perimeters.hip ?? null,
    skinfolds: input.skinfolds,
  });

  // ISAK8 no da % grasa (es esperado, ver formulas.ts) — para el resto de
  // los protocolos, null acá significa que faltó algún pliegue requerido.
  if (input.protocol !== "ISAK8" && calculated.bodyFatPercentage == null) {
    return {
      error:
        "Faltan pliegues para calcular este protocolo. Revisá que estén todos completos.",
    };
  }

  const { data: evaluation, error: insertError } = await supabase
    .from("anthropometric_evaluations")
    .insert({
      client_id: input.clientId,
      coach_id: user.id,
      evaluation_date: input.evaluationDate,
      weight_kg: input.weightKg,
      height_cm: input.heightCm,
      protocol: input.protocol,
      body_fat_percentage: calculated.bodyFatPercentage,
      fat_mass_kg: calculated.fatMassKg,
      muscle_mass_kg: calculated.muscleMassKg,
      bmi: calculated.bmi,
      waist_hip_ratio: calculated.waistHipRatio,
      coach_notes: input.coachNotes.trim() || null,
    })
    .select("id")
    .single();

  if (insertError || !evaluation) {
    console.error("createEvaluation insert error:", insertError);
    return { error: "No se pudo guardar la evaluación." };
  }

  const measurementRows = [
    ...Object.entries(input.perimeters),
    ...Object.entries(input.skinfolds),
  ]
    .filter(([, value]) => value != null)
    .map(([measurement_type, value]) => ({
      evaluation_id: evaluation.id,
      measurement_type,
      value,
    }));

  if (measurementRows.length > 0) {
    const { error: measurementsError } = await supabase
      .from("body_measurements")
      .insert(measurementRows);

    if (measurementsError) {
      console.error("createEvaluation measurements insert error:", measurementsError);
      return { error: "Se guardó la evaluación pero no las mediciones. Revisá con soporte." };
    }
  }

  revalidatePath(`/coach/clients/${input.clientId}`);

  sendPushToClient(input.clientId, {
    title: NEW_EVALUATION_PUSH_TITLE,
    body: NEW_EVALUATION_PUSH_BODY,
    url: "/client/progress?tab=cuerpo",
  }).catch((error) => {
    console.error("createEvaluation push error:", error);
  });

  return { success: true, id: evaluation.id };
}
