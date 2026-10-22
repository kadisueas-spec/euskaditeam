import { test } from "node:test";
import assert from "node:assert/strict";
import { decideGenerateNow } from "@/lib/reports/generate-now";

test("sin reporte del período: se crea", () => {
  assert.deepEqual(decideGenerateNow(null, false), { action: "create" });
});

test("enviado: nunca se toca, ni confirmando", () => {
  assert.deepEqual(decideGenerateNow("sent", false), { action: "blocked-sent" });
  assert.deepEqual(decideGenerateNow("sent", true), { action: "blocked-sent" });
});

test("borrador, programado o descartado: pregunta antes", () => {
  for (const s of ["draft", "scheduled", "discarded"] as const) {
    assert.deepEqual(decideGenerateNow(s, false), { action: "ask", status: s });
  }
});

test("con confirmación: regenera (el descartado vuelve a borrador)", () => {
  assert.deepEqual(decideGenerateNow("draft", true), { action: "regenerate", restoreFromDiscarded: false });
  assert.deepEqual(decideGenerateNow("scheduled", true), { action: "regenerate", restoreFromDiscarded: false });
  assert.deepEqual(decideGenerateNow("discarded", true), { action: "regenerate", restoreFromDiscarded: true });
});
