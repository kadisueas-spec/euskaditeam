import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyPeriodToGenerate, nextSundayAt, weeklyPeriodToGenerate } from "@/lib/reports/schedule";

// Horas de Paraguay (UTC-3): 07:00 PYT = 10:00 UTC.
test("semanal: sábado desde las 7 de Paraguay, lunes a viernes", () => {
  assert.equal(weeklyPeriodToGenerate(new Date("2026-10-17T09:59:00Z")), null); // sáb 06:59
  assert.deepEqual(weeklyPeriodToGenerate(new Date("2026-10-17T10:05:00Z")), {
    start: "2026-10-12",
    end: "2026-10-16",
  });
  // Domingo de respaldo
  assert.deepEqual(weeklyPeriodToGenerate(new Date("2026-10-18T15:00:00Z")), {
    start: "2026-10-12",
    end: "2026-10-16",
  });
  assert.equal(weeklyPeriodToGenerate(new Date("2026-10-19T15:00:00Z")), null); // lunes
  // Viernes 23:30 de Paraguay ya es sábado en UTC: todavía no
  assert.equal(weeklyPeriodToGenerate(new Date("2026-10-17T02:30:00Z")), null);
});

test("mensual: día 1 desde las 7 de Paraguay, el mes anterior", () => {
  assert.equal(monthlyPeriodToGenerate(new Date("2026-10-01T09:00:00Z")), null); // 06:00 PYT
  assert.deepEqual(monthlyPeriodToGenerate(new Date("2026-10-01T10:05:00Z")), {
    start: "2026-09-01",
    end: "2026-09-30",
  });
  assert.deepEqual(monthlyPeriodToGenerate(new Date("2026-01-02T12:00:00Z")), {
    start: "2025-12-01",
    end: "2025-12-31",
  });
  assert.equal(monthlyPeriodToGenerate(new Date("2026-10-04T12:00:00Z")), null);
  // 30/09 a las 22hs de Paraguay = 01/10 01:00 UTC: todavía es septiembre
  assert.equal(monthlyPeriodToGenerate(new Date("2026-10-01T01:00:00Z")), null);
});

test("programar para el domingo a la hora del coach", () => {
  // Sábado 17/10 → domingo 18/10 10:00 PYT = 13:00 UTC
  assert.equal(nextSundayAt(10, new Date("2026-10-17T15:00:00Z")).toISOString(), "2026-10-18T13:00:00.000Z");
  // Domingo 09:00 PYT, hora 10 → hoy
  assert.equal(nextSundayAt(10, new Date("2026-10-18T12:00:00Z")).toISOString(), "2026-10-18T13:00:00.000Z");
  // Domingo 11:00 PYT, hora 10 ya pasó → el siguiente
  assert.equal(nextSundayAt(10, new Date("2026-10-18T14:00:00Z")).toISOString(), "2026-10-25T13:00:00.000Z");
});
