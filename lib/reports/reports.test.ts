import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWeeklyReport } from "@/lib/reports/build-weekly";
import { buildMonthlyReport } from "@/lib/reports/build-monthly";
import { PhrasePicker } from "@/lib/reports/phrases";
import { personalBests } from "@/lib/reports/records";
import type { ReportInput } from "@/lib/reports/input";
import type { ReportCard } from "@/lib/reports/types";

// Datos reales de entrenamiento anonimizados (los de las hojas aprobadas).
const fx = JSON.parse(readFileSync(new URL("./__fixtures__/sample-client.json", import.meta.url), "utf8"));

function input(kind: "weekly" | "monthly", over: Partial<ReportInput> = {}): ReportInput {
  const weekly = kind === "weekly";
  return {
    kind,
    periodStart: weekly ? "2026-10-12" : "2026-09-01",
    periodEnd: weekly ? "2026-10-16" : "2026-09-30",
    client: {
      id: "client-1",
      firstName: "Sofía",
      fullName: "Sofía Prueba",
      goal: null,
      accessActivatedAt: "2026-07-13T03:00:00Z",
      hideWeight: false,
    },
    coach: { name: "Luis Mineur", avatarUrl: null },
    routine: fx.routine,
    sessions: fx.sessions.filter((s: { date: string }) => s.date <= (weekly ? "2026-10-16" : "2026-09-30")),
    bestSets: fx.bestSets.filter((s: { date: string }) => s.date <= (weekly ? "2026-10-16" : "2026-09-30")),
    weights: fx.weights.filter((w: { date: string }) => w.date <= (weekly ? "2026-10-16" : "2026-09-30")),
    evaluations: [],
    lastPhotoDate: null,
    nutritionPlanName: null,
    monthGoal: fx.monthGoal,
    monthReviewSummary: null,
    phraseHistory: new Map(),
    ...over,
  };
}

function card<T extends ReportCard["type"]>(cards: ReportCard[], type: T): Extract<ReportCard, { type: T }> {
  const c = cards.find((x) => x.type === type);
  assert.ok(c, `falta la tarjeta ${type}`);
  return c as Extract<ReportCard, { type: T }>;
}

test("semanal: 7 mejores marcas contra la mejor marca histórica", () => {
  const i = input("weekly");
  const pbs = personalBests(i.bestSets, i.periodStart, i.periodEnd);
  assert.equal(pbs.length, 7);
  assert.equal(pbs[0].exerciseName, "Prensa pendular");
  // Hack squat 90×10 es récord por reps (ya había hecho 90×8), no "+10 kg".
  const hack = pbs.find((p) => p.exerciseName === "Hack squat en máquina")!;
  assert.equal(hack.type, "reps");
  assert.equal(hack.delta, 2);
  // Puente de glúteos 160×15 RIR 3 iguala la mejor marca: no es récord.
  assert.equal(pbs.find((p) => p.exerciseName === "Puente de glúteos en máquina"), undefined);
});

test("semanal: tarjetas como en la hoja aprobada", () => {
  const r = buildWeeklyReport(input("weekly"));
  assert.deepEqual(r.cards.map((c) => c.type), ["opening", "improvement", "adherence", "weight", "focus"]);

  // 3+ récords: festeja aunque la asistencia fue 3 de 4.
  assert.equal(r.cards[0].phrase, "Excelente el trabajo de esta semana! Orgulloso del progreso que estás teniendo👏🏻👏🏻");

  const imp = card(r.cards, "improvement");
  assert.equal(imp.value, "+3");
  assert.equal(imp.unit, "reps");
  assert.equal(imp.detail, "220 kg × 13 — antes 220 kg × 10");
  assert.equal(imp.more.length, 6);
  assert.deepEqual(imp.more.find((m) => m.exercise.startsWith("Crunch")), {
    exercise: "Crunch en polea alta",
    value: "75 × 12",
    diff: "RIR 3 (antes 2)",
  });

  const adh = card(r.cards, "adherence");
  assert.equal(adh.done, 3);
  assert.equal(adh.planned, 4);
  assert.deepEqual(adh.days.map((d) => d.dayName), ["Pierna completa", "Espalda + Hombros", null, "Pierna completa 2", null]);

  // Cambio semanal chico (86,7 → 86,5): el titular es la tendencia.
  const w = card(r.cards, "weight");
  assert.equal(w.kicker, "Tu peso desde agosto");
  assert.equal(w.headline, "−2,8");
  assert.equal(w.fromTo, "89,3 kg → 86,5 kg");
  assert.equal(w.phrase, "86,5 kg esta semana, 2,8 menos que en agosto. Seguimos así 👏🏻");

  const focus = card(r.cards, "focus");
  assert.equal(focus.word, "4 días");
  assert.equal(focus.phrase, "La próxima semana vamos por los 4 días. Organizate desde el lunes 🫡");

  assert.deepEqual(r.notices, [
    "La rutina de Sofía terminó el 12/09",
    "Sofía no hace el día Brazos desde el 5/09",
  ]);
});

test("mensual: tarjetas como en la hoja aprobada", () => {
  const r = buildMonthlyReport(input("monthly"));
  assert.deepEqual(r.cards.map((c) => c.type), [
    "opening",
    "count",
    "records",
    "improvement",
    "weight",
    "goal",
    "closing",
    "share",
  ]);

  const count = card(r.cards, "count");
  assert.equal(count.value, 12);
  assert.equal(count.detail, "12 de 17 planificados · 180 series · 116.059 kg movidos");
  // 71 % de asistencia pero 12 récords: frase que celebra.
  assert.equal(count.phrase, "Excelente el trabajo de este mes! Orgulloso del progreso que estás teniendo👏🏻👏🏻");

  const records = card(r.cards, "records");
  assert.equal(records.value, 12);
  assert.equal(records.list.length, 11);
  assert.equal(records.list.some((x) => x.exercise === "Prensa pendular"), false);
  assert.deepEqual(records.list.find((x) => x.exercise.startsWith("Puente")), {
    exercise: "Puente de glúteos en máquina",
    value: "160 × 15",
    diff: "RIR 3 (antes 1)",
  });

  const imp = card(r.cards, "improvement");
  assert.equal(imp.exercise, "Prensa pendular");
  assert.equal(imp.value, "+10");
  assert.equal(imp.unit, "kg");

  const w = card(r.cards, "weight");
  assert.equal(w.headline, "−1,3");
  assert.equal(w.fromTo, "88,8 kg → 87,6 kg");
  assert.equal(w.phrase, "Bajaste 1,3 kg. Se está notando el trabajo 👏🏻");

  const goal = card(r.cards, "goal");
  assert.deepEqual(goal.evidence, [
    "Fuerza: 12 mejores marcas en el mes",
    "Glúteos: puente de glúteos en máquina 160 × 15, ahora con RIR 3 (antes 1)",
    "Peso: 1,3 kg menos de promedio",
  ]);
  assert.equal(goal.phrase, "Vamos por buen camino con lo que te propusiste. Seguimos 🫡");

  // Volumen bajó y no hay medición de grasa: avisos privados, no tarjetas.
  assert.ok(r.notices.includes("Volumen −25 % vs agosto: 12 entrenamientos contra 17"));
  assert.ok(r.notices.includes("Grasa: sin medición este mes"));

  const share = card(r.cards, "share");
  assert.deepEqual(share.stats.map((s) => s.value), ["12", "12", "116.059"]);
});

test("ninguna frase se repite dentro de un reporte", () => {
  for (const r of [buildWeeklyReport(input("weekly")), buildMonthlyReport(input("monthly"))]) {
    assert.equal(new Set(r.phraseKeys).size, r.phraseKeys.length);
    const texts = r.cards.map((c) => c.phrase).filter(Boolean);
    assert.equal(new Set(texts).size, texts.length);
  }
});

test("el mismo remate prioritario no se repite dentro de un reporte", () => {
  for (const r of [buildWeeklyReport(input("weekly")), buildMonthlyReport(input("monthly"))]) {
    const echoes = r.cards.filter((c) => c.phrase?.toLowerCase().includes("todo el esfuerzo vale la pena"));
    assert.ok(echoes.length <= 1, echoes.map((c) => c.phrase).join(" / "));
  }
});

test("no repite una frase enviada en los últimos 28 días", () => {
  const first = buildMonthlyReport(input("monthly"));
  const history = new Map(first.phraseKeys.map((k) => [k, Date.now()]));
  const again = buildMonthlyReport(input("monthly", { phraseHistory: history }));
  const closing = card(again.cards, "closing");
  const firstClosing = card(first.cards, "closing");
  assert.notEqual(closing.phraseKey, firstClosing.phraseKey);
});

test("sin variantes libres: usa la enviada hace más tiempo", () => {
  const history = new Map([
    ["focus.keep.1", 2000],
  ]);
  const p = new PhrasePicker("x", "weekly", history);
  assert.equal(p.pick("focus.keep")?.key, "focus.keep.1");
});

test("No mostrar peso en reportes: sin tarjeta de peso ni línea de peso", () => {
  const i = input("monthly");
  const r = buildMonthlyReport({ ...i, client: { ...i.client, hideWeight: true } });
  assert.equal(r.cards.some((c) => c.type === "weight"), false);
  assert.equal(card(r.cards, "goal").evidence.some((e) => e.startsWith("Peso")), false);
  const w = buildWeeklyReport({ ...input("weekly"), client: { ...i.client, hideWeight: true } });
  assert.equal(w.cards.some((c) => c.type === "weight"), false);
});

test("peso sin objetivo de bajar: dato sin festejo", () => {
  const r = buildMonthlyReport(input("monthly", { monthGoal: { mainGoal: "Ganar fuerza", weightKg: null } }));
  const w = card(r.cards, "weight");
  assert.equal(w.headline, "87,6");
  assert.equal(w.phrase, undefined);
});

test("semana sin entrenamientos: apertura amable y aviso al coach", () => {
  const i = input("weekly");
  const r = buildWeeklyReport({ ...i, sessions: i.sessions.filter((s) => s.date < "2026-10-12") });
  assert.equal(r.cards[0].phraseKey?.startsWith("opening.none"), true);
  assert.ok(r.notices[0].startsWith("Sin entrenamientos esta semana"));
});
