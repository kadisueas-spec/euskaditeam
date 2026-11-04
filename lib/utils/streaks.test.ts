import { test } from "node:test";
import assert from "node:assert/strict";
import { bestDailyStreak, computeStreaks, recentTrainedDays } from "@/lib/utils/streaks";
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

// --- Mejor racha y últimos 7 días (nov-2026, tarjeta de racha de Inicio) ---

test("mejor racha: el pico de una racha cortada, aunque la actual sea menor", () => {
  // Plan de 1 día por semana. Semanas del 7/9, 14/9 y 21/9 cumplidas; la del
  // 28/9 falla (sin sesiones); vuelve desde el 5/10.
  const dates = ["2026-10-14", "2026-10-07", "2026-09-23", "2026-09-16", "2026-09-09"];
  const now = new Date("2026-10-15T12:00:00Z");
  const { dailyStreak } = computeStreaks(dates, 1, now);
  const best = bestDailyStreak(dates, 1, now);
  // Antes del corte: del domingo 6/9 al domingo 4/10 (la semana fallida
  // recién cierra ese día) = 28 días
  assert.equal(best, 28);
  assert.ok(best > dailyStreak);
});

test("mejor racha: si nunca se cortó, es la actual", () => {
  const dates = trainedDates(sessions).reverse();
  assert.equal(bestDailyStreak(dates, 2, today), computeStreaks(dates, 2, today).dailyStreak);
  assert.equal(bestDailyStreak([], 2, today), 0);
});

test("últimos 7 días: del más viejo a hoy, con los entrenados marcados", () => {
  const days = recentTrainedDays(["2026-10-19", "2026-10-15", "2026-10-01"], today);
  assert.equal(days.length, 7);
  assert.equal(days[0].date, "2026-10-15");
  assert.equal(days[6].date, "2026-10-21");
  assert.deepEqual(
    days.map((d) => d.trained),
    [true, false, false, false, true, false, false]
  );
});
