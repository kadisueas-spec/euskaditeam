import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EDITED_PHRASE_MAX,
  arrangeCards,
  cardBasis,
  clientCards,
  editedNeedingReview,
  layoutAfterRegenerate,
  parseCardLayout,
} from "@/lib/reports/layout";
import type { CardLayout } from "@/lib/reports/layout";
import type { ReportCard } from "@/lib/reports/types";

// Textos editados por el coach en el borrador (oct-2026).

const improvement: ReportCard = {
  type: "improvement",
  key: "improvement",
  theme: "black",
  kicker: "Tu mejor avance",
  exercise: "Prensa",
  value: "+3",
  unit: "reps",
  detail: "220 kg × 13 — antes 220 kg × 10",
  more: [],
  phrase: "Tres reps más con el mismo peso",
  phraseKey: "improvement.reps.2",
};
const cards: ReportCard[] = [
  { type: "opening", key: "opening", theme: "red", words: ["Tu", "semana"], phrase: "Sofía, así fue tu semana", phraseKey: "opening.complete.1" },
  improvement,
  { type: "streak", key: "streak", theme: "black", value: 4, unit: "semanas", detail: "4 semanas seguidas" },
  { type: "closing", key: "closing", theme: "oxblood", words: [], coachName: "Luis", coachAvatarUrl: null, phrase: "A seguir", phraseKey: "closing.1" },
  { type: "share", key: "share", theme: "black", monthLabel: "", words: [], clientName: "", stats: [] },
];

function edited(phrase: string, card: ReportCard = improvement) {
  return { phrase, basis: cardBasis(card) };
}

test("el texto editado reemplaza solo la frase: números y detalle quedan", () => {
  const layout: CardLayout = { order: [], enabled: {}, texts: { improvement: edited("¡Qué semana en prensa, Sofía!") } };
  const card = clientCards(cards, layout).find((c) => c.key === "improvement");
  assert.ok(card && card.type === "improvement");
  assert.equal(card.phrase, "¡Qué semana en prensa, Sofía!");
  assert.equal(card.value, "+3");
  assert.equal(card.detail, "220 kg × 13 — antes 220 kg × 10");
  const item = arrangeCards(cards, layout).find((a) => a.key === "improvement")!;
  assert.equal(item.edited, true);
  assert.equal(item.needsReview, false);
  assert.equal(item.original.phrase, "Tres reps más con el mismo peso");
});

test("una frase editada no tiene clave del banco: no cuenta para los 28 días", () => {
  const layout: CardLayout = { order: [], enabled: {}, texts: { improvement: edited("Mi texto") } };
  const sent = clientCards(cards, layout);
  const phraseKeys = sent.map((c) => c.phraseKey).filter(Boolean);
  assert.deepEqual(phraseKeys, ["opening.complete.1", "closing.1"]);
});

test("portada y cierre (fijas) también se editan; racha e imagen no", () => {
  const layout: CardLayout = {
    order: [],
    enabled: {},
    texts: {
      opening: edited("Portada mía", cards[0]),
      closing: edited("Cierre mío", cards[3]),
      streak: edited("Racha inventada", cards[2]),
      share: edited("Imagen", cards[4]),
    },
  };
  const out = clientCards(cards, layout);
  assert.equal(out.find((c) => c.key === "opening")?.phrase, "Portada mía");
  assert.equal(out.find((c) => c.key === "closing")?.phrase, "Cierre mío");
  assert.equal(out.find((c) => c.key === "streak")?.phrase, undefined);
  assert.equal(out.find((c) => c.key === "share")?.phrase, undefined);
  assert.equal(arrangeCards(cards, layout).find((a) => a.key === "streak")?.edited, false);
});

test("si al regenerar cambió el número, la tarjeta queda para revisar (y el texto se conserva)", () => {
  const layout: CardLayout = { order: [], enabled: {}, texts: { improvement: edited("Subiste 3 reps") } };
  const regenerated = cards.map((c) =>
    c.type === "improvement" ? { ...c, value: "+2", detail: "220 kg × 12 — antes 220 kg × 10", phrase: "Otra frase" } : c
  );
  const item = arrangeCards(regenerated, layout).find((a) => a.key === "improvement")!;
  assert.equal(item.needsReview, true);
  assert.equal(item.card.phrase, "Subiste 3 reps");
  assert.deepEqual(editedNeedingReview(regenerated, layout), ["Mejor avance · Prensa"]);
  // Solo cambió la frase del banco (los datos son iguales): no hay nada que revisar
  const samePhraseChange = cards.map((c) => (c.type === "improvement" ? { ...c, phrase: "Otra", phraseKey: "x.1" } : c));
  assert.deepEqual(editedNeedingReview(samePhraseChange, layout), []);
});

test("conservar o descartar los textos al regenerar", () => {
  const layout: CardLayout = { order: ["improvement"], enabled: { streak: false }, texts: { improvement: edited("Mío") } };
  assert.deepEqual(layoutAfterRegenerate(layout, true), layout);
  assert.deepEqual(layoutAfterRegenerate(layout, false), { order: ["improvement"], enabled: { streak: false } });
  assert.equal(layoutAfterRegenerate(null, false), null);
  // Descartados: vuelve la frase original
  const back = clientCards(cards, layoutAfterRegenerate(layout, false));
  assert.equal(back.find((c) => c.key === "improvement")?.phrase, "Tres reps más con el mismo peso");
});

test("validación: solo frase y huella; recorta, limita el largo y vacío = original", () => {
  const parsed = parseCardLayout({
    order: [],
    enabled: {},
    texts: {
      improvement: { phrase: "  Hola  ", basis: "b", value: "+99" },
      count: { phrase: "x".repeat(EDITED_PHRASE_MAX + 50), basis: "b" },
      focus: { phrase: "   ", basis: "b" },
    },
  });
  assert.ok(parsed);
  assert.deepEqual(parsed.texts?.improvement, { phrase: "Hola", basis: "b" }); // sin "value"
  assert.equal(parsed.texts?.count.phrase.length, EDITED_PHRASE_MAX);
  assert.equal(parsed.texts?.focus, undefined);
  assert.equal(parseCardLayout({ order: [], enabled: {}, texts: { a: { phrase: 3, basis: "b" } } }), null);
  assert.equal(parseCardLayout({ order: [], enabled: {}, texts: ["x"] }), null);
  // Layouts guardados antes de esta función siguen valiendo
  assert.deepEqual(parseCardLayout({ order: ["a"], enabled: { a: true } }), { order: ["a"], enabled: { a: true } });
});

test("un texto editado nunca agrega datos a la tarjeta", () => {
  const sneaky = parseCardLayout({ order: [], enabled: {}, texts: { improvement: { phrase: "Hola", basis: "b", value: "+99", detail: "falso" } } });
  const card = clientCards(cards, sneaky).find((c) => c.key === "improvement");
  assert.ok(card && card.type === "improvement");
  assert.equal(card.value, "+3");
  assert.equal(card.detail, "220 kg × 13 — antes 220 kg × 10");
});
