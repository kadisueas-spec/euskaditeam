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
