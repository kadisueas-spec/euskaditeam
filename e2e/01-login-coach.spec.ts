import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test("coach: login redirige al dashboard y muestra su nombre", async ({ page }) => {
  await loginAs(page, "coach");

  await expect(page).toHaveURL(/\/coach\/dashboard$/);
  // page.tsx renderiza <h1>Bienvenido, {firstName}</h1> — no hardcodeamos
  // el nombre exacto (depende de qué cuenta esté en TEST_COACH_EMAIL), solo
  // confirmamos que el saludo con el nombre está ahí.
  await expect(page.getByRole("heading", { name: /^Bienvenido, / })).toBeVisible();
});
