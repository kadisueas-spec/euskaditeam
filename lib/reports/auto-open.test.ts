import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTO_OPEN_MAX_PER_REPORT, pickAutoOpenReport, type AutoOpenCandidate } from "@/lib/reports/auto-open";

const r = (p: Partial<AutoOpenCandidate> & { id: string }): AutoOpenCandidate => ({
  sentAt: "2026-10-25T13:00:00Z",
  openedAt: null,
  autoOpenCount: 0,
  autoOpenLastAt: null,
  ...p,
});
const today = "2026-10-28";

test("un reporte enviado sin abrir se abre solo", () => {
  assert.equal(pickAutoOpenReport({ reports: [r({ id: "a" })], today, workoutInProgress: false }), "a");
});

test("ya abierto (pasó de la portada): no se abre solo", () => {
  assert.equal(pickAutoOpenReport({ reports: [r({ id: "a", openedAt: "2026-10-26T12:00:00Z" })], today, workoutInProgress: false }), null);
});

test("máximo 1 vez por día, con la fecha de Paraguay", () => {
  // Hoy a las 10 de Paraguay: ya se mostró hoy
  assert.equal(
    pickAutoOpenReport({ reports: [r({ id: "a", autoOpenCount: 1, autoOpenLastAt: "2026-10-28T13:00:00Z" })], today, workoutInProgress: false }),
    null
  );
  // Ayer 22:30 de Paraguay = hoy 01:30 UTC: es de ayer, vuelve a aparecer
  assert.equal(
    pickAutoOpenReport({ reports: [r({ id: "a", autoOpenCount: 1, autoOpenLastAt: "2026-10-28T01:30:00Z" })], today, workoutInProgress: false }),
    "a"
  );
});

test("máximo 3 veces por reporte", () => {
  assert.equal(
    pickAutoOpenReport({
      reports: [r({ id: "a", autoOpenCount: AUTO_OPEN_MAX_PER_REPORT, autoOpenLastAt: "2026-10-20T13:00:00Z" })],
      today,
      workoutInProgress: false,
    }),
    null
  );
  assert.equal(
    pickAutoOpenReport({ reports: [r({ id: "a", autoOpenCount: 2, autoOpenLastAt: "2026-10-20T13:00:00Z" })], today, workoutInProgress: false }),
    "a"
  );
});

test("con entrenamiento en curso no se abre", () => {
  assert.equal(pickAutoOpenReport({ reports: [r({ id: "a" })], today, workoutInProgress: true }), null);
});

test("más de uno sin abrir: el más reciente (y si ese ya no puede, el siguiente)", () => {
  const older = r({ id: "semana", sentAt: "2026-10-18T13:00:00Z" });
  const newer = r({ id: "mes", sentAt: "2026-10-25T13:00:00Z" });
  assert.equal(pickAutoOpenReport({ reports: [older, newer], today, workoutInProgress: false }), "mes");
  assert.equal(
    pickAutoOpenReport({ reports: [older, { ...newer, autoOpenCount: 3 }], today, workoutInProgress: false }),
    "semana"
  );
});
