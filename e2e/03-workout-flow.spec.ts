import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { fieldAfterLabel } from "./helpers/fields";
import { WORKOUT_SET_SAMPLE } from "./fixtures/test-data";

// Requiere que TEST_CLIENT_EMAIL tenga una rutina activa con al menos un
// ejercicio en el primer día. Completa UNA serie del primer ejercicio y
// termina el entrenamiento — no completa todas las series de todos los
// ejercicios (no hace falta para probar el flujo end-to-end).
test("cliente: flujo completo de entrenamiento hasta la celebración", async ({ page }) => {
  await loginAs(page, "client");

  // Cada día es un <details>/<summary> colapsado — hay que expandirlo antes
  // de que "Iniciar entrenamiento" quede clickeable.
  await page.locator("details summary").first().click();
  await page.getByRole("link", { name: "Iniciar entrenamiento" }).first().click();
  // Timeout largo a propósito: en dev, Turbopack compila cada ruta recién
  // la primera vez que se pide — la primera visita a /client/log-workout
  // puede tardar bastante más que el timeout default.
  await expect(page).toHaveURL(/\/client\/log-workout/, { timeout: 20_000 });

  // Primer ejercicio: el título es un <h1> con el nombre del ejercicio —
  // esperamos a que termine el skeleton inicial (initializing) viendo que
  // aparece "Serie 1" en vez del shimmer.
  await expect(page.getByText("Serie 1", { exact: true })).toBeVisible({ timeout: 15_000 });

  // Sugerencia de récord anterior — condicional, no todos los clientes de
  // prueba van a tener historial. Solo se deja constancia, no se hace
  // fallar el test si no hay sugerencia.
  const weightInput = fieldAfterLabel(page, "Peso (kg)");
  const hasSuggestion = (await weightInput.inputValue()) !== "";
  test.info().annotations.push({
    type: hasSuggestion ? "sugerencia-aplicada" : "sin-historial-previo",
    description: hasSuggestion
      ? `Se precargó un valor sugerido: "${await weightInput.inputValue()}"`
      : "El campo de peso arrancó vacío (esperado si el cliente de prueba no tiene sesiones anteriores).",
  });

  await weightInput.fill(WORKOUT_SET_SAMPLE.weightKg);
  await fieldAfterLabel(page, "Reps").fill(WORKOUT_SET_SAMPLE.reps);
  await fieldAfterLabel(page, "RIR").fill(WORKOUT_SET_SAMPLE.rir);
  await page.getByRole("button", { name: "Completar serie" }).click();

  // Avanza ejercicios hasta llegar al resumen — "Siguiente ejercicio" en
  // ejercicios intermedios, "Terminar ejercicios" en el último.
  for (let i = 0; i < 20; i++) {
    const nextButton = page.getByRole("button", { name: "Siguiente ejercicio" });
    const finishButton = page.getByRole("button", { name: "Terminar ejercicios" });
    if (await finishButton.isVisible().catch(() => false)) {
      await finishButton.click();
      break;
    }
    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click();
      continue;
    }
    break;
  }

  await expect(page.getByRole("heading", { name: "Resumen del entrenamiento" })).toBeVisible();
  await page.getByRole("button", { name: "Finalizar entrenamiento" }).click();

  await expect(page.getByRole("heading", { name: "¡Sesión completada!" })).toBeVisible({
    timeout: 15_000,
  });
});
