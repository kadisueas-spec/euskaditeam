import { test } from "node:test";
import assert from "node:assert/strict";
import { adherencePercent, countsAsTraining, trainedDates } from "@/lib/utils/training-sessions";
import type { TrainingSessionRow } from "@/lib/utils/training-sessions";
import { plannedDaysInRange } from "@/lib/utils/planned-days";

const row = (date: string, isCompleted: boolean, sets: number): TrainingSessionRow => ({
  workout_date: date,
  is_completed: isCompleted,
  workout_set_logs: [{ count: sets }],
});

test("cuenta solo sesiones finalizadas con al menos 1 serie", () => {
  assert.equal(countsAsTraining({ isCompleted: true, setCount: 16 }), true);
  assert.equal(countsAsTraining({ isCompleted: true, setCount: 0 }), false);
  assert.equal(countsAsTraining({ isCompleted: false, setCount: 5 }), false);
  assert.equal(countsAsTraining({ isCompleted: false, setCount: 0 }), false);
});

test("dos sesiones el mismo día cuentan como un día", () => {
  assert.deepEqual(trainedDates([row("2026-10-05", true, 16), row("2026-10-05", true, 4)]), ["2026-10-05"]);
});

test("Luz, octubre al 22/10: la sesión vacía del 20/10 no cuenta → 7 días, 54 %", () => {
  const octubre = [
    row("2026-10-01", true, 16),
    row("2026-10-05", true, 16),
    row("2026-10-06", true, 16),
    row("2026-10-08", true, 13),
    row("2026-10-12", true, 16),
    row("2026-10-13", true, 16),
    row("2026-10-15", true, 13),
    row("2026-10-20", false, 0), // abrió Entrenar y no cargó nada
  ];
  const trained = trainedDates(octubre).length;
  const planned = plannedDaysInRange({
    rangeStart: "2026-10-01",
    rangeEnd: "2026-10-22",
    plannedPerWeek: 4,
    accessActivatedAt: "2026-07-13T03:00:00Z",
    routineAssignedAt: "2026-07-12",
  });
  assert.equal(trained, 7);
  assert.equal(planned, 13);
  assert.equal(adherencePercent(trained, planned), 54);
});

test("adherencia: tope 100 % y 0 sin días planificados", () => {
  assert.equal(adherencePercent(12, 4), 100);
  assert.equal(adherencePercent(3, 0), 0);
});
