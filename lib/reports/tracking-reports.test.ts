import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summarizeSessions } from "@/lib/reports/load-input";
import { buildWeeklyReport } from "@/lib/reports/build-weekly";
import { buildMonthlyReport } from "@/lib/reports/build-monthly";
import { cardioSection } from "@/lib/reports/sections";
import { PhrasePicker } from "@/lib/reports/phrases";
import { cardLabel, clientCards } from "@/lib/reports/layout";
import type { ReportInput, SessionSummary } from "@/lib/reports/input";
import type { ReportCard } from "@/lib/reports/types";

// Tipos de registro en los reportes (oct-2026): volumen según el tipo y la
// tarjeta "Minutos de cardio".

const fx = JSON.parse(readFileSync(new URL("./__fixtures__/sample-client.json", import.meta.url), "utf8"));

type Ex = { tracking_type: string; per_side: boolean; assistance_unit: string | null; cardio_scale: string | null };
const ex = (id: string, name: string, t: Partial<Ex> = {}) => ({
  exercise_id: id,
  exercises: {
    name,
    muscle_group: null,
    tracking_type: "weight_reps",
    per_side: false,
    assistance_unit: null,
    cardio_scale: null,
    ...t,
  },
});
const setRow = (
  re: ReturnType<typeof ex>,
  p: { weight_kg?: number | null; reps_completed?: number | null; duration_seconds?: number | null }
) => ({
  weight_kg: p.weight_kg ?? null,
  reps_completed: p.reps_completed ?? null,
  rir_actual: null,
  duration_seconds: p.duration_seconds ?? null,
  routine_exercises: re,
});

test("volumen de la sesión: por lado × 2, lastre sí, asistido, isométrico y cardio no", () => {
  const { sessions } = summarizeSessions([
    {
      id: "s1",
      workout_date: "2026-10-20",
      is_completed: true,
      routine_day_id: null,
      routine_days: null,
      workout_set_logs: [
        setRow(ex("bulg", "Sentadilla búlgara", { per_side: true }), { weight_kg: 20, reps_completed: 10 }), // 400
        setRow(ex("press", "Press banca"), { weight_kg: 60, reps_completed: 10 }), // 600
        setRow(ex("dom", "Dominadas (pull-ups)", { tracking_type: "bodyweight_reps" }), { weight_kg: 5, reps_completed: 8 }), // 40
        setRow(ex("asist", "Dominadas asistidas", { tracking_type: "bodyweight_reps", assistance_unit: "kg" }), {
          weight_kg: null,
          reps_completed: 8,
        }),
        setRow(ex("plancha", "Plancha lateral", { tracking_type: "time", per_side: true }), { duration_seconds: 30 }),
        setRow(ex("esc", "Escaladora", { tracking_type: "cardio", cardio_scale: "level" }), { duration_seconds: 900 }),
      ],
    },
  ]);
  const [s] = sessions;
  assert.equal(s.volumeKg, 1040);
  assert.equal(s.setCount, 6);
  assert.equal(s.isometricSeconds, 60);
  assert.deepEqual(s.cardio, [{ exerciseId: "esc", exerciseName: "Escaladora", seconds: 900 }]);
});

const session = (date: string, cardio: { id: string; name: string; seconds: number }[]): SessionSummary => ({
  date,
  dayId: null,
  dayName: null,
  setCount: 1,
  volumeKg: 0,
  cardio: cardio.map((c) => ({ exerciseId: c.id, exerciseName: c.name, seconds: c.seconds })),
});

test("tarjeta de cardio: minutos, contra el período anterior y por ejercicio", () => {
  const picker = new PhrasePicker("x", "weekly");
  const card = cardioSection({
    current: [session("2026-10-20", [{ id: "esc", name: "Escaladora", seconds: 900 }]), session("2026-10-22", [{ id: "bici", name: "Bicicleta", seconds: 1200 }])],
    previous: [session("2026-10-13", [{ id: "esc", name: "Escaladora", seconds: 600 }])],
    versus: "la semana pasada",
    picker,
  });
  assert.ok(card && card.type === "cardio");
  assert.deepEqual([card.minutes, card.previousMinutes], [35, 10]);
  assert.deepEqual(card.exercises, [
    { name: "Bicicleta", minutes: 20 },
    { name: "Escaladora", minutes: 15 },
  ]);
  assert.match(card.phraseKey ?? "", /^cardio\.up\./);
  assert.equal(cardLabel(card), "Minutos de cardio · 35");
});

test("sin cardio en el período: no hay tarjeta", () => {
  assert.equal(cardioSection({ current: [session("2026-10-20", [])], previous: [], versus: "x", picker: new PhrasePicker("y", "weekly") }), null);
});

function baseInput(kind: "weekly" | "monthly"): ReportInput {
  const weekly = kind === "weekly";
  const end = weekly ? "2026-10-16" : "2026-09-30";
  return {
    kind,
    periodStart: weekly ? "2026-10-12" : "2026-09-01",
    periodEnd: end,
    client: { id: "c", firstName: "Sofía", fullName: "Sofía Prueba", goal: null, accessActivatedAt: null, hideWeight: false },
    coach: { name: "Luis Mineur", avatarUrl: null },
    routine: fx.routine,
    sessions: fx.sessions.filter((s: { date: string }) => s.date <= end),
    bestSets: fx.bestSets.filter((s: { date: string }) => s.date <= end),
    weights: [],
    evaluations: [],
    lastPhotoDate: null,
    nutritionPlanName: null,
    monthGoal: null,
    monthReviewSummary: null,
    phraseHistory: new Map(),
  };
}

const find = (cards: ReportCard[]) => cards.find((c) => c.type === "cardio");

test("reportes: la tarjeta de cardio aparece prendida solo si hubo cardio", () => {
  // Sin cardio (fixture de siempre): no aparece
  assert.equal(find(buildWeeklyReport(baseInput("weekly")).cards), undefined);
  // Con cardio en la semana: aparece y va al cliente sin tocar nada
  const i = baseInput("weekly");
  const withCardio = { ...i, sessions: [...i.sessions, session("2026-10-14", [{ id: "esc", name: "Escaladora", seconds: 1200 }])] };
  const weekly = buildWeeklyReport(withCardio);
  assert.ok(find(weekly.cards));
  assert.ok(find(clientCards(weekly.cards, null)));
  const m = baseInput("monthly");
  const monthly = buildMonthlyReport({ ...m, sessions: [...m.sessions, session("2026-09-10", [{ id: "esc", name: "Escaladora", seconds: 600 }])] });
  assert.equal((find(monthly.cards) as Extract<ReportCard, { type: "cardio" }>).minutes, 10);
});
