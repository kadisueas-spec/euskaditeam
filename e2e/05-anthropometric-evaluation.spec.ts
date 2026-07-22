import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { fieldAfterLabel } from "./helpers/fields";
import { DW4_SAMPLE } from "./fixtures/test-data";
// Se importa la fórmula real de la app como "oráculo" del valor esperado,
// en vez de hardcodear un % ya calculado a mano — así el test compara
// contra la MISMA lógica que usa la UI (import directo, sin duplicar la
// fórmula acá) y no puede quedar desincronizado si la fórmula cambia.
import { calculateDW4 } from "../lib/anthropometrics/formulas";

// Usa el cliente de prueba dedicado "E2E Test Client" por nombre a
// propósito — nunca "el primero de la lista", que podría ser un cliente
// real del coach (ver comentario equivalente en 04-create-routine.spec.ts).
test("coach: nueva evaluación DW4 calcula el % de grasa correctamente", async ({ page }) => {
  await loginAs(page, "coach");

  await page.goto("/coach/clients", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "E2E Test Client" }).click();

  await page.getByRole("button", { name: "Evaluaciones" }).click();
  await page.getByRole("link", { name: "Nueva evaluación" }).click();
  // Timeout largo a propósito — ver comentario equivalente en
  // 03-workout-flow.spec.ts (Turbopack compila la ruta recién al pedirla).
  await expect(page).toHaveURL(/\/evaluations\/new$/, { timeout: 20_000 });

  // Paso 1 — ningún campo tiene <label htmlFor> conectado (ver
  // evaluation-wizard.tsx), así que se ubican por el texto del label.
  await fieldAfterLabel(page, "Peso (kg)").fill(DW4_SAMPLE.weightKg);
  await fieldAfterLabel(page, "Altura (cm)").fill(DW4_SAMPLE.heightCm);
  await fieldAfterLabel(page, "Sexo").selectOption(DW4_SAMPLE.sex);
  await fieldAfterLabel(page, "Fecha de nacimiento").fill(DW4_SAMPLE.birthDate);
  await fieldAfterLabel(page, "Protocolo").selectOption(DW4_SAMPLE.protocol);
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 2 — perímetros, todos opcionales para DW4. Se deja vacío.
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 3 — pliegues cutáneos requeridos por DW4.
  await fieldAfterLabel(page, "Bíceps").fill(DW4_SAMPLE.skinfoldsMm.biceps);
  await fieldAfterLabel(page, "Tríceps").fill(DW4_SAMPLE.skinfoldsMm.triceps);
  await fieldAfterLabel(page, "Subescapular").fill(DW4_SAMPLE.skinfoldsMm.subscapular);
  await fieldAfterLabel(page, "Suprailíaco").fill(DW4_SAMPLE.skinfoldsMm.suprailiac);
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 4 — preview con el % de grasa ya calculado, antes de guardar.
  const age = (() => {
    const birth = new Date(`${DW4_SAMPLE.birthDate}T00:00:00Z`);
    const at = new Date(`${DW4_SAMPLE.evaluationDate}T00:00:00Z`);
    let a = at.getUTCFullYear() - birth.getUTCFullYear();
    const hadBirthday =
      at.getUTCMonth() > birth.getUTCMonth() ||
      (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() >= birth.getUTCDate());
    if (!hadBirthday) a--;
    return a;
  })();

  const expectedBodyFat = calculateDW4(
    {
      biceps: Number(DW4_SAMPLE.skinfoldsMm.biceps),
      triceps: Number(DW4_SAMPLE.skinfoldsMm.triceps),
      subscapular: Number(DW4_SAMPLE.skinfoldsMm.subscapular),
      suprailiac: Number(DW4_SAMPLE.skinfoldsMm.suprailiac),
    },
    age,
    DW4_SAMPLE.sex
  );
  expect(expectedBodyFat).not.toBeNull();

  await expect(
    page.getByText(`${expectedBodyFat!.toFixed(1)}%`, { exact: true })
  ).toBeVisible();
});
