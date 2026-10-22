import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreaks } from "@/lib/utils/streaks";
import { trainedDates } from "@/lib/utils/training-sessions";
import type { TrainingSessionRow } from "@/lib/utils/training-sessions";

const row = (date: string, isCompleted: boolean, sets: number): TrainingSessionRow => ({
  workout_date: date,
  is_completed: isCompleted,
  workout_set_logs: [{ count: sets }],
});

// Rutina de 2 días por semana, hoy miércoles 21/10.
const sessions = [
  row("2026-10-05", true, 16),
  row("2026-10-08", true, 13),
  row("2026-10-12", true, 16),
  row("2026-10-15", true, 13),
  row("2026-10-19", true, 16),
  row("2026-10-20", false, 0), // abrió Entrenar y no cargó nada
];
const today = new Date("2026-10-21T12:00:00Z");

test("una sesión vacía no completa la semana en curso", () => {
  const { weeklyStreak } = computeStreaks([...trainedDates(sessions)].reverse(), 2, today);
  // Semanas del 05/10 y del 12/10 completas; la del 19/10 tiene 1 de 2.
  assert.equal(weeklyStreak, 2);
});

test("contando la sesión vacía, la semana en curso se completaba (el bug)", () => {
  const allDatesDesc = Array.from(new Set(sessions.map((s) => s.workout_date))).reverse();
  assert.equal(computeStreaks(allDatesDesc, 2, today).weeklyStreak, 3);
});

test("racha de días: cuenta desde el domingo anterior a la primera semana con datos", () => {
  const { dailyStreak } = computeStreaks([...trainedDates(sessions)].reverse(), 2, today);
  assert.equal(dailyStreak, 17); // 04/10 → 21/10
});

test("sin sesiones válidas: rachas en 0", () => {
  assert.deepEqual(computeStreaks(trainedDates([row("2026-10-20", false, 0)]), 2, today), {
    dailyStreak: 0,
    weeklyStreak: 0,
  });
});
