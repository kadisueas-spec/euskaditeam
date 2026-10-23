import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateOneRepMax, suggestNextSet } from "@/lib/utils/set-progression";

const base = { repsMin: 10, repsMax: 14, rirTarget: 2, weightIncrement: 2.5 };

// --- Casos que no cambian ---

test("caso 1: en rango → mismo peso, una rep menos", () => {
  assert.deepEqual(suggestNextSet({ ...base, weight: 40, reps: 12, rirActual: 2 }), {
    weight: 40,
    reps: 11,
    rir: 2,
    progressionCase: "same_weight_one_less",
  });
});

test("caso 1 en el tope con el RIR objetivo: sigue siendo una rep menos", () => {
  assert.equal(suggestNextSet({ ...base, weight: 40, reps: 14, rirActual: 2 })?.progressionCase, "same_weight_one_less");
  // Sin RIR cargado tampoco se sube
  assert.equal(suggestNextSet({ ...base, weight: 40, reps: 14, rirActual: null })?.progressionCase, "same_weight_one_less");
});

test("caso 2: R − 1 < mínimo → bajar el peso, apuntar al máximo", () => {
  assert.deepEqual(suggestNextSet({ ...base, weight: 40, reps: 10, rirActual: 1 }), {
    weight: 37.5,
    reps: 14,
    rir: 2,
    progressionCase: "lower_weight",
  });
});

test("caso 3: R < mínimo → bajar el peso", () => {
  assert.equal(suggestNextSet({ ...base, weight: 40, reps: 7, rirActual: 0 })?.weight, 37.5);
});

test("bajar: redondeo a 2,5 o al incremento del ejercicio", () => {
  assert.equal(suggestNextSet({ ...base, weight: 41, reps: 9 })?.weight, 37.5); // 41 − 2,5 = 38,5 → 37,5
  assert.equal(suggestNextSet({ ...base, weightIncrement: 1, weight: 22, reps: 9 })?.weight, 21); // no 20
});

test("sin peso para bajar: mismo peso, mismas reps", () => {
  assert.deepEqual(suggestNextSet({ ...base, weight: null, reps: 8 }), {
    weight: null,
    reps: 8,
    rir: 2,
    progressionCase: "bodyweight_hold",
  });
  assert.equal(suggestNextSet({ ...base, weight: 2, reps: 8 })?.progressionCase, "bodyweight_hold");
});

test("sin rango: repite la serie anterior", () => {
  assert.equal(
    suggestNextSet({ weight: 40, reps: 9, repsMin: null, repsMax: null, rirTarget: null, weightIncrement: 2.5 })?.progressionCase,
    "repeat"
  );
});

test("un solo extremo del rango vale como mínimo y máximo", () => {
  assert.equal(
    suggestNextSet({ weight: 40, reps: 8, repsMin: 8, repsMax: null, rirTarget: null, weightIncrement: 2.5 })?.progressionCase,
    "lower_weight"
  );
});

test("reps inválidas: sin sugerencia", () => {
  assert.equal(suggestNextSet({ ...base, weight: 40, reps: 0 }), null);
});

// --- Caso 4 (bug oct-2026): se pasó del rango o le sobró resto → subir ---

test("caso 4: 15 kg × 18 @RIR 3 (rango 10-14, RIR objetivo 2) sube el peso", () => {
  const s = suggestNextSet({ ...base, weight: 15, reps: 18, rirActual: 3 });
  // 1RM ≈ 15 × (1 + 21/30) = 25,5 → para 14 reps @RIR 2: 16,6 → 17,5 kg
  assert.deepEqual(s, { weight: 17.5, reps: 11, rir: 2, progressionCase: "raise_weight" });
});

test("caso 4 con mancuernas de a 1 kg: escalón de 1 kg", () => {
  const s = suggestNextSet({ ...base, weightIncrement: 1, weight: 15, reps: 18, rirActual: 3 });
  assert.deepEqual(s, { weight: 17, reps: 13, rir: 2, progressionCase: "raise_weight" });
});

test("caso 4: usa el RIR real (más resto → más peso)", () => {
  const sinResto = suggestNextSet({ ...base, weight: 50, reps: 16, rirActual: 0 })!;
  const conResto = suggestNextSet({ ...base, weight: 50, reps: 16, rirActual: 4 })!;
  assert.ok(conResto.weight! > sinResto.weight!);
  // Sin RIR cargado se toma solo lo que hizo (sin inventar resto)
  assert.equal(suggestNextSet({ ...base, weight: 50, reps: 16, rirActual: null })!.weight, sinResto.weight);
});

test("caso 4: en el tope con más resto que el objetivo también sube", () => {
  const s = suggestNextSet({ ...base, weight: 40, reps: 14, rirActual: 4 });
  assert.equal(s?.progressionCase, "raise_weight");
  assert.ok(s!.weight! >= 42.5);
});

test("caso 4 sin RIR objetivo: RIR 3+ en el tope sube; RIR 2 no", () => {
  const noTarget = { ...base, rirTarget: null };
  assert.equal(suggestNextSet({ ...noTarget, weight: 40, reps: 14, rirActual: 3 })?.progressionCase, "raise_weight");
  assert.equal(suggestNextSet({ ...noTarget, weight: 40, reps: 14, rirActual: 2 })?.progressionCase, "same_weight_one_less");
});

test("caso 4: sube como mínimo un incremento y cae dentro del rango", () => {
  // Apenas por encima del tope: el cálculo daría el mismo peso
  const s = suggestNextSet({ ...base, weight: 60, reps: 15, rirActual: 0 })!;
  assert.equal(s.weight, 62.5);
  assert.ok(s.reps >= base.repsMin && s.reps <= base.repsMax);
});

test("caso 4 a peso corporal: no hay peso para subir, apunta al máximo", () => {
  assert.deepEqual(suggestNextSet({ ...base, weight: null, reps: 20, rirActual: 3 }), {
    weight: null,
    reps: 14,
    rir: 2,
    progressionCase: "aim_max",
  });
});

test("Epley con RIR", () => {
  assert.equal(estimateOneRepMax(15, 18, 3), 25.5);
});

// --- Los 21 casos originales (oct-2026) ---
// Vivían en un script de prueba fuera del repo cuando se armó la
// progresión (commit 97cfb4f). 18 quedan igual; los 3 del caso 4 viejo
// ("aim_max" con peso: se pasaba del rango y mantenía el peso) ahora suben
// el peso, que es justamente lo que se corrigió.
const orig = { repsMin: 8, repsMax: 12, rirTarget: 2, weightIncrement: 2.5 };
const ORIGINAL_CASES: [string, Parameters<typeof suggestNextSet>[0], ReturnType<typeof suggestNextSet>][] = [
  ["Caso 1: R=10 en rango", { ...orig, weight: 40, reps: 10 }, { weight: 40, reps: 9, rir: 2, progressionCase: "same_weight_one_less" }],
  ["Borde R=min+1 (9) → caso 1", { ...orig, weight: 40, reps: 9 }, { weight: 40, reps: 8, rir: 2, progressionCase: "same_weight_one_less" }],
  ["Borde R=max (12) → caso 1", { ...orig, weight: 40, reps: 12 }, { weight: 40, reps: 11, rir: 2, progressionCase: "same_weight_one_less" }],
  ["Caso 2: R=min (8)", { ...orig, weight: 40, reps: 8 }, { weight: 37.5, reps: 12, rir: 2, progressionCase: "lower_weight" }],
  ["Caso 3: R<min (6)", { ...orig, weight: 40, reps: 6 }, { weight: 37.5, reps: 12, rir: 2, progressionCase: "lower_weight" }],
  // Antes: 40 × 12 "aim_max"
  ["Caso 4: R=max+1 (13) → sube", { ...orig, weight: 40, reps: 13 }, { weight: 42.5, reps: 8, rir: 2, progressionCase: "raise_weight" }],
  ["Redondeo 2,5 abajo: 41 − 2,5 = 38,5 → 37,5", { ...orig, weight: 41, reps: 8 }, { weight: 37.5, reps: 12, rir: 2, progressionCase: "lower_weight" }],
  ["Rec 1: incremento 1 kg, 22 − 1 = 21", { ...orig, weightIncrement: 1, weight: 22, reps: 7 }, { weight: 21, reps: 12, rir: 2, progressionCase: "lower_weight" }],
  ["Rec 1: incremento 5 kg (múltiplo de 2,5)", { ...orig, weightIncrement: 5, weight: 61, reps: 7 }, { weight: 55, reps: 12, rir: 2, progressionCase: "lower_weight" }],
  ["Rec 1: incremento 1,25", { ...orig, weightIncrement: 1.25, weight: 20, reps: 7 }, { weight: 18.75, reps: 12, rir: 2, progressionCase: "lower_weight" }],
  ["Rec 2: caso 1 no redondea P=23", { ...orig, weight: 23, reps: 10 }, { weight: 23, reps: 9, rir: 2, progressionCase: "same_weight_one_less" }],
  // Antes: 23 × 12 "aim_max". Sube un incremento sobre P (23 + 2,5), sin forzar el múltiplo de 2,5.
  ["Rec 2: caso 4 con P=23 → sube", { ...orig, weight: 23, reps: 14 }, { weight: 25.5, reps: 8, rir: 2, progressionCase: "raise_weight" }],
  ["Rec 3: peso corporal null", { ...orig, weight: null, reps: 6 }, { weight: null, reps: 6, rir: 2, progressionCase: "bodyweight_hold" }],
  ["Rec 3: peso 0", { ...orig, weight: 0, reps: 8 }, { weight: 0, reps: 8, rir: 2, progressionCase: "bodyweight_hold" }],
  ["Rec 3: P − inc ≤ 0 (2,5)", { ...orig, weight: 2.5, reps: 5 }, { weight: 2.5, reps: 5, rir: 2, progressionCase: "bodyweight_hold" }],
  ["Rec 3: peso corporal caso 1 sigue normal", { ...orig, weight: null, reps: 10 }, { weight: null, reps: 9, rir: 2, progressionCase: "same_weight_one_less" }],
  ["Rec 4: solo mínimo (10) → min=max=10, R=10", { ...orig, repsMax: null, repsMin: 10, weight: 50, reps: 10 }, { weight: 47.5, reps: 10, rir: 2, progressionCase: "lower_weight" }],
  // Antes: 50 × 10 "aim_max"
  ["Rec 4: solo máximo (10), R=11 → sube", { ...orig, repsMin: null, repsMax: 10, weight: 50, reps: 11 }, { weight: 52.5, reps: 10, rir: 2, progressionCase: "raise_weight" }],
  ["Rec 4: sin rango → repetir", { ...orig, repsMin: null, repsMax: null, weight: 50, reps: 9 }, { weight: 50, reps: 9, rir: 2, progressionCase: "repeat" }],
  ["Rec 5: sin RIR objetivo", { ...orig, rirTarget: null, weight: 40, reps: 10 }, { weight: 40, reps: 9, rir: null, progressionCase: "same_weight_one_less" }],
  ["Reps inválidas → null", { ...orig, weight: 40, reps: 0 }, null],
];

for (const [name, params, expected] of ORIGINAL_CASES) {
  test(`original · ${name}`, () => {
    assert.deepEqual(suggestNextSet(params), expected);
  });
}
