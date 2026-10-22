import { test } from "node:test";
import assert from "node:assert/strict";
import { plannedDaysInRange } from "@/lib/utils/planned-days";

const base = { accessActivatedAt: null, routineAssignedAt: null };

test("mes completo: reparto proporcional, sin redondear semanas para arriba", () => {
  // Septiembre, rutina de 4 días: 4 × 30 / 7 = 17,1 → 17 (antes 5 semanas = 20)
  assert.equal(plannedDaysInRange({ ...base, rangeStart: "2026-09-01", rangeEnd: "2026-09-30", plannedPerWeek: 4 }), 17);
  // Octubre: 4 × 31 / 7 = 17,7 → 18 (antes 20)
  assert.equal(plannedDaysInRange({ ...base, rangeStart: "2026-10-01", rangeEnd: "2026-10-31", plannedPerWeek: 4 }), 18);
  // Febrero no bisiesto: exactamente 4 semanas
  assert.equal(plannedDaysInRange({ ...base, rangeStart: "2026-02-01", rangeEnd: "2026-02-28", plannedPerWeek: 3 }), 12);
});

test("una semana exacta da los días de la rutina", () => {
  assert.equal(plannedDaysInRange({ ...base, rangeStart: "2026-10-12", rangeEnd: "2026-10-18", plannedPerWeek: 5 }), 5);
});

test("mes en curso: cuenta hasta hoy", () => {
  // 1 al 22 de octubre: 4 × 22 / 7 = 12,6 → 13 (antes 4 semanas = 16)
  assert.equal(plannedDaysInRange({ ...base, rangeStart: "2026-10-01", rangeEnd: "2026-10-22", plannedPerWeek: 4 }), 13);
});

test("arranca en la activación de acceso, en fecha de Paraguay", () => {
  // Activación 06/07 a las 22hs de Paraguay = 07/07 01:00 UTC → cuenta desde el 06/07
  const r = plannedDaysInRange({
    rangeStart: "2026-07-01",
    rangeEnd: "2026-07-31",
    plannedPerWeek: 4,
    accessActivatedAt: "2026-07-07T01:00:00Z",
    routineAssignedAt: null,
  });
  assert.equal(r, Math.round((4 * 26) / 7)); // 06 al 31 = 26 días → 15
});

test("arranca en la asignación de la rutina si es posterior a la activación", () => {
  const r = plannedDaysInRange({
    rangeStart: "2026-09-01",
    rangeEnd: "2026-09-30",
    plannedPerWeek: 4,
    accessActivatedAt: "2026-07-13T03:00:00Z",
    routineAssignedAt: "2026-09-16",
  });
  assert.equal(r, Math.round((4 * 15) / 7)); // 16 al 30 = 15 días → 9
});

test("activación posterior al rango o rutina sin días: 0", () => {
  assert.equal(
    plannedDaysInRange({ rangeStart: "2026-08-01", rangeEnd: "2026-08-31", plannedPerWeek: 4, accessActivatedAt: "2026-09-29T21:43:26Z", routineAssignedAt: null }),
    0
  );
  assert.equal(plannedDaysInRange({ ...base, rangeStart: "2026-09-01", rangeEnd: "2026-09-30", plannedPerWeek: 0 }), 0);
});
