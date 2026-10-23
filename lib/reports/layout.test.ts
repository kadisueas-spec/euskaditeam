import { test } from "node:test";
import assert from "node:assert/strict";
import { arrangeCards, clientCards, parseCardLayout } from "@/lib/reports/layout";
import { kindForRange, previousPeriodOf, rangeShortcuts, validateRange } from "@/lib/reports/periods";
import type { ReportCard } from "@/lib/reports/types";

const cards: ReportCard[] = [
  { type: "opening", key: "opening", theme: "red", words: ["Tu", "semana"] },
  { type: "improvement", key: "improvement", theme: "black", kicker: "", exercise: "Prensa", value: "+3", unit: "reps", detail: "", more: [] },
  { type: "volume", key: "volume", on: false, theme: "card", kicker: "", percent: -25, previous: { label: "", volumeKg: 1, sessions: 1 }, current: { label: "", volumeKg: 1, sessions: 1 } },
  { type: "focus", key: "focus", theme: "black", word: "4 días" },
  { type: "exercise", key: "exercise:prensa", on: false, theme: "light", exercise: "Prensa", headline: "+10", detail: "", points: [] },
  { type: "closing", key: "closing", theme: "oxblood", words: [], coachName: "Luis", coachAvatarUrl: null },
  { type: "share", key: "share", theme: "black", monthLabel: "", words: [], clientName: "", stats: [] },
];
const keys = (cs: ReportCard[]) => cs.map((c) => c.key);

test("sin elecciones: las opcionales quedan apagadas", () => {
  assert.deepEqual(keys(clientCards(cards, null)), ["opening", "improvement", "focus", "closing", "share"]);
});

test("el coach prende el volumen (aunque bajó) y un gráfico, y apaga una", () => {
  const layout = { order: [], enabled: { volume: true, "exercise:prensa": true, focus: false } };
  assert.deepEqual(keys(clientCards(cards, layout)), ["opening", "improvement", "volume", "exercise:prensa", "closing", "share"]);
});

test("reordenar: portada, cierre e imagen quedan fijas", () => {
  const layout = {
    order: ["focus", "volume", "improvement", "closing", "opening"],
    enabled: { volume: true, closing: false, opening: false },
  };
  assert.deepEqual(keys(clientCards(cards, layout)), ["opening", "focus", "volume", "improvement", "closing", "share"]);
  const arranged = arrangeCards(cards, layout);
  assert.equal(arranged.find((a) => a.key === "closing")?.fixed, true);
});

test("tarjetas nuevas al regenerar quedan después de las ordenadas", () => {
  const layout = { order: ["focus", "improvement"], enabled: {} };
  assert.deepEqual(keys(clientCards(cards, layout)), ["opening", "focus", "improvement", "closing", "share"]);
});

test("borradores viejos sin clave siguen funcionando", () => {
  const legacy = cards.map((c) => ({ ...c, key: undefined }) as ReportCard);
  assert.equal(clientCards(legacy, null).length, 5);
});

test("la nota del coach nunca se cuela en el catálogo", () => {
  const withNote: ReportCard[] = [...cards, { type: "coach-note", theme: "oxblood", text: "x", coachName: "L", coachAvatarUrl: null }];
  assert.equal(arrangeCards(withNote, null).some((a) => a.card.type === "coach-note"), false);
});

test("valida lo que llega de la bandeja", () => {
  assert.deepEqual(parseCardLayout({ order: ["a"], enabled: { a: true } }), { order: ["a"], enabled: { a: true } });
  assert.equal(parseCardLayout({ order: "a", enabled: {} }), null);
  assert.equal(parseCardLayout({ order: [], enabled: { a: "si" } }), null);
  assert.equal(parseCardLayout(null), null);
});

test("tipo según el rango", () => {
  assert.equal(kindForRange("2026-09-01", "2026-09-30"), "monthly");
  assert.equal(kindForRange("2026-10-12", "2026-10-16"), "weekly");
  assert.equal(kindForRange("2026-10-12", "2026-10-18"), "custom");
  assert.equal(kindForRange("2026-11-03", "2026-11-17"), "custom");
  assert.equal(kindForRange("2026-02-01", "2026-02-28"), "monthly");
});

test("validación del rango", () => {
  assert.equal(validateRange("2026-11-03", "2026-11-17", "2026-11-20"), null);
  assert.ok(validateRange("2026-11-17", "2026-11-03", "2026-11-20"));
  assert.ok(validateRange("2026-11-03", "2026-11-25", "2026-11-20"));
  assert.ok(validateRange("2026-01-01", "2026-06-01", "2026-11-20"));
  assert.ok(validateRange("2026-02-30", "2026-03-02", "2026-11-20"));
});

test("período anterior de igual duración", () => {
  assert.deepEqual(previousPeriodOf("2026-11-03", "2026-11-17"), { start: "2026-10-19", end: "2026-11-02" });
});

test("atajos", () => {
  // Jueves 22/10
  assert.deepEqual(rangeShortcuts("2026-10-22").map((r) => [r.label, r.start, r.end]), [
    ["Esta semana", "2026-10-19", "2026-10-22"],
    ["Semana pasada", "2026-10-12", "2026-10-18"],
    ["Mes pasado", "2026-09-01", "2026-09-30"],
    ["Últimos 30 días", "2026-09-23", "2026-10-22"],
  ]);
});
