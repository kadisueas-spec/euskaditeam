import { test, expect } from "@playwright/test";

// DOS diferencias importantes respecto al pedido original, documentadas acá
// porque cambian lo que este test puede verificar:
//
// 1. Los códigos de invitación son de un solo uso (se marcan como
//    "usados" al registrarse — ver claim_invite_code en
//    lib/supabase/invite-codes.ts). Este test consume TEST_INVITE_CODE la
//    primera vez que corre; si se vuelve a correr con el mismo código, va
//    a fallar con "Código de invitación inválido" — no es un bug de la
//    app, hay que generar un código nuevo antes de cada corrida (o dejar
//    uno dedicado exclusivamente a este test si el flujo de negocio lo
//    permite).
// 2. register-form.tsx NO redirige al perfil tras un registro exitoso —
//    Supabase Auth pide confirmar el email primero, así que la UI muestra
//    un mensaje inline ("Cuenta creada. Revisá tu email...") en la misma
//    página. Este test verifica ese mensaje real, no una redirección.
test("registro con código de invitación válido muestra la confirmación", async ({ page }) => {
  const inviteCode = process.env.TEST_INVITE_CODE;
  if (!inviteCode) {
    throw new Error("Falta TEST_INVITE_CODE en .env.test — generá un código de invitación nuevo (de un solo uso) antes de correr este test.");
  }

  const email = `e2e-test-${Date.now()}@example.com`;

  await page.goto("/register", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Nombre completo").fill("E2E Test User");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill("Test1234!");
  await page.getByPlaceholder("Código de invitación").fill(inviteCode);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page.getByText(/Cuenta creada\. Revis[aá] tu email/)).toBeVisible({
    timeout: 15_000,
  });
});
