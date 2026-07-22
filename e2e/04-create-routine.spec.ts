import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { newRoutineName } from "./fixtures/test-data";

// Requiere que el coach de prueba tenga al cliente de prueba dedicado
// "E2E Test Client" en su lista (ver scratch-create-test-client.mjs de
// cuando se armó) y al menos un ejercicio en su biblioteca. Se elige ese
// cliente por NOMBRE a propósito — nunca "el primero de la lista", que
// podría ser un cliente real del coach.
test("coach: crea una rutina de 3 pasos y aparece en la lista", async ({ page }) => {
  await loginAs(page, "coach");
  const routineName = newRoutineName();

  // waitUntil: "networkidle" — sin esto, en dev (Turbopack compilando la
  // ruta al vuelo) los fill() de abajo pueden correr ANTES de que React
  // termine de hidratar el form; al hidratar, React reconcilia los inputs
  // con su estado inicial (vacío) y pisa lo que ya se había tipeado. Mismo
  // problema de fondo que en 06-daily-weight.spec.ts.
  await page.goto("/coach/routines/new", { waitUntil: "networkidle" });

  // Paso 1 — estos campos sí tienen <Label htmlFor> conectado.
  await page.getByLabel("Nombre").fill(routineName);
  await page.getByLabel("Objetivo").fill("Hipertrofia");
  await page.getByLabel("Cliente").selectOption({ label: "E2E Test Client" });
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 2 — un solo día alcanza para probar el flujo.
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 3 — agrega un ejercicio. El selector de grupo muscular/ejercicio
  // NO tiene <label htmlFor> (ver routine-wizard.tsx), así que se ubican
  // por posición: son los dos únicos <select> de este paso al agregar un
  // solo ejercicio.
  await page.getByRole("button", { name: "Agregar ejercicio" }).click();
  const comboboxes = page.getByRole("combobox");
  await comboboxes.nth(0).selectOption({ index: 1 }); // grupo muscular
  await comboboxes.nth(1).selectOption({ index: 1 }); // ejercicio filtrado por ese grupo
  await page.locator('input[type="number"]').first().fill("4"); // series

  await page.getByRole("button", { name: "Crear rutina" }).click();

  // createRoutine redirige a /coach/routines/{id}, no a la lista.
  await expect(page).toHaveURL(/\/coach\/routines\/[a-f0-9-]+$/, { timeout: 15_000 });

  await page.goto("/coach/routines");
  await expect(page.getByText(routineName)).toBeVisible();
});
