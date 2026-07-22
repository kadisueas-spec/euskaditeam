import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { WEIGHT_LOG_SAMPLE_KG } from "./fixtures/test-data";

// NOTA: el pedido original decía "Progreso → Mi Cuerpo", pero en la app
// real esa pestaña ("cuerpo") muestra las evaluaciones antropométricas que
// carga el coach (solo lectura para el cliente) — el registro de peso
// diario que puede cargar el cliente vive en la pestaña "Mi Peso" (key
// "peso", ver components/client/progress-tabs.tsx). Este test usa la
// pestaña correcta.
test("cliente: registra su peso del día y aparece en el gráfico", async ({ page }) => {
  await loginAs(page, "client");
  await page.goto("/client/progress?tab=peso");
  await page.waitForLoadState("networkidle");

  // Si ya se registró peso hoy, el botón dice "Editar" en vez de
  // "Registrar mi peso de hoy" — se maneja cualquiera de los dos casos.
  const registerButton = page.getByRole("button", { name: "Registrar mi peso de hoy" });
  const editButton = page.getByRole("button", { name: "Editar" });
  const cancelButton = page.getByRole("button", { name: "Cancelar" });

  // Reintenta el click una vez si no entró en modo edición — se vio un
  // caso donde el click quedaba "activo" (foco) sin que React todavía
  // hubiera terminado de hidratar el botón, así que no pasaba nada.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (await registerButton.isVisible().catch(() => false)) {
      await registerButton.click();
    } else {
      await editButton.first().click();
    }
    if (await cancelButton.isVisible({ timeout: 3_000 }).catch(() => false)) break;
  }
  await expect(cancelButton).toBeVisible();

  // NO por placeholder ("68,5") — si ya existe un registro de hoy (por
  // ejemplo, de una corrida anterior de este mismo test en el mismo día),
  // el input ya viene con un valor real y el placeholder no se ve más.
  await page.locator('input[inputmode="decimal"]').first().fill(WEIGHT_LOG_SAMPLE_KG);
  await page.getByRole("button", { name: "Guardar" }).click();

  // El botón queda "Guardando..." (disabled) mientras el server action
  // corre — hay que esperar a que desaparezca antes de mirar el resultado,
  // si no la siguiente aserción corre en medio del guardado.
  await expect(page.getByRole("button", { name: "Guardando..." })).toHaveCount(0, {
    timeout: 15_000,
  });

  // Tras guardar, la tarjeta de "Peso de hoy" muestra el valor (con punto,
  // no coma — se guarda parseado) y el chart "Evolución de peso" aparece
  // porque logs.length ya no es 0.
  await expect(page.getByText("Peso de hoy")).toBeVisible();
  await expect(page.getByText("Evolución de peso")).toBeVisible();
});
