import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldSetAccessActivatedAt } from "@/lib/utils/access-activation";

test("primera activación (columna vacía): se escribe", () => {
  assert.equal(shouldSetAccessActivatedAt({ access_activated_at: null }), true);
});

test("renovación o reactivación (ya tiene fecha): no se pisa", () => {
  // Caso Luz: renovada horas después de que daily-checks la pasara a inactive
  assert.equal(shouldSetAccessActivatedAt({ access_activated_at: "2026-07-13T03:00:00Z" }), false);
});

test("cliente inexistente: no se escribe", () => {
  assert.equal(shouldSetAccessActivatedAt(null), false);
});
