import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// Requiere que TEST_CLIENT_EMAIL tenga una rutina activa asignada por el
// coach — si no tiene, la página muestra el estado vacío en vez del día y
// este test falla en el último assert (esperado: significa que la cuenta
// de prueba no está armada como el test necesita, no que la app esté rota).
test("cliente: login redirige a Mi Rutina y muestra su rutina", async ({ page }) => {
  await loginAs(page, "client");

  await expect(page).toHaveURL(/\/client\/my-routine$/);
  // El saludo varía según la hora del día (ver client-greeting.tsx), así
  // que no se afirma el texto exacto — solo que el saludo cargó.
  await expect(page.locator("p", { hasText: /^(Sos de las pocas|Buenos días|Buenas tardes|Buenas noches)/ })).toBeVisible();

  // Cada día es un <details>/<summary> colapsado — el link "Iniciar
  // entrenamiento" recién queda visible/accesible después de expandirlo.
  await page.locator("details summary").first().click();
  await expect(page.getByRole("link", { name: "Iniciar entrenamiento" }).first()).toBeVisible();
});
