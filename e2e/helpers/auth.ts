import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export type TestRole = "coach" | "client";

// Credenciales de prueba SIEMPRE desde variables de entorno (.env.test) —
// nunca hardcodeadas acá. Si falta alguna, falla temprano y con un mensaje
// claro en vez de un timeout genérico más adelante en el test.
function credentialsFor(role: TestRole): { email: string; password: string } {
  const email =
    role === "coach" ? process.env.TEST_COACH_EMAIL : process.env.TEST_CLIENT_EMAIL;
  const password =
    role === "coach" ? process.env.TEST_COACH_PASSWORD : process.env.TEST_CLIENT_PASSWORD;

  if (!email || !password) {
    throw new Error(
      `Faltan credenciales de prueba para "${role}" — completá TEST_${role.toUpperCase()}_EMAIL / ` +
        `TEST_${role.toUpperCase()}_PASSWORD en .env.test.`
    );
  }
  return { email, password };
}

// Inicia sesión vía el form real de /login (nunca inyectando tokens/cookies
// a mano) y espera la redirección al panel correspondiente, para que los
// tests que llaman a este helper arranquen siempre desde un estado
// conocido y ya autenticado.
export async function loginAs(page: Page, role: TestRole): Promise<void> {
  const { email, password } = credentialsFor(role);

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  const expectedPath = role === "coach" ? "/coach/dashboard" : "/client/my-routine";
  await expect(page).toHaveURL(new RegExp(`${expectedPath}$`), { timeout: 15_000 });

  if (role === "client") {
    await dismissMonthlyGoalModal(page);
  }
}

// Modal obligatorio de "Objetivo del mes" (Fase 4.5, ver CLAUDE.md) — sale
// una sola vez en el primer login del mes de cada cliente, superpuesto
// sobre /client/my-routine (no es una ruta aparte), y bloquea todo lo demás
// hasta completarlo. Un cliente de prueba que nunca entró antes SIEMPRE lo
// ve la primera vez que se loguea en un mes calendario — así que loginAs
// lo completa automáticamente si aparece, para que el resto del test no
// dependa de si este es el primer login del mes o no.
async function dismissMonthlyGoalModal(page: Page): Promise<void> {
  const heading = page.getByRole("heading", { name: "Nuevo mes · Nuevo objetivo" });
  const appeared = await heading.isVisible({ timeout: 3_000 }).catch(() => false);
  if (!appeared) return;

  await page.getByLabel("Objetivo principal del mes").fill("Test E2E");
  await page.getByLabel("Tu peso corporal actual (kg)").fill("70");
  // El radio "3" ya viene marcado por defecto — no hace falta tocarlo.
  await page
    .getByLabel("¿Qué querés mejorar respecto al mes pasado?")
    .fill("Test E2E");
  await page.getByRole("button", { name: "Empezar el mes" }).click();
  await expect(heading).not.toBeVisible({ timeout: 10_000 });
}
