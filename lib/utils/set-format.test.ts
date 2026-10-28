import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, formatSet, type SetValues } from "@/lib/utils/set-format";
import type { TrackingFields } from "@/lib/constants/tracking";

const t = (p: Partial<TrackingFields>): TrackingFields => ({
  trackingType: "weight_reps",
  perSide: false,
  assistanceUnit: null,
  cardioScale: null,
  ...p,
});
const v = (p: Partial<SetValues>): SetValues => ({
  weight: null,
  reps: null,
  rir: null,
  seconds: null,
  distanceKm: null,
  intensity: null,
  assistance: null,
  ...p,
});

test("peso + reps: como siempre, con 'por lado' si corresponde", () => {
  assert.equal(formatSet(t({}), v({ weight: 60, reps: 10, rir: 2 })), "60 kg · 10 reps · RIR 2");
  assert.equal(formatSet(t({ perSide: true }), v({ weight: 20, reps: 10 })), "20 kg · 10 reps por lado");
  assert.equal(formatSet(t({}), v({ weight: 22.5, reps: 8 })), "22,5 kg · 8 reps");
});

test("peso corporal: reps, lastre y RIR opcionales; asistido muestra la ayuda", () => {
  const bw = t({ trackingType: "bodyweight_reps" });
  assert.equal(formatSet(bw, v({ reps: 12 })), "12 reps");
  assert.equal(formatSet(bw, v({ reps: 8, weight: 5, rir: 1 })), "8 reps · +5 kg · RIR 1");
  assert.equal(formatSet(t({ trackingType: "bodyweight_reps", assistanceUnit: "kg" }), v({ reps: 10, assistance: 20 })), "10 reps · ayuda 20 kg");
  assert.equal(formatSet(t({ trackingType: "bodyweight_reps", assistanceUnit: "band" }), v({ reps: 10, assistance: 2 })), "10 reps · banda 2");
});

test("isométrico y cardio", () => {
  assert.equal(formatSet(t({ trackingType: "time", perSide: true }), v({ seconds: 30 })), "30 s por lado");
  assert.equal(formatSet(t({ trackingType: "time" }), v({ seconds: 45, weight: 5 })), "45 s · +5 kg");
  const cardio = t({ trackingType: "cardio", cardioScale: "level" });
  assert.equal(formatSet(cardio, v({ seconds: 900, intensity: 5 })), "15 min · nivel 5");
  assert.equal(formatSet(cardio, v({ seconds: 1200, distanceKm: 3.2 })), "20 min · 3,2 km");
  assert.equal(formatSet(t({ trackingType: "cardio", cardioScale: "effort" }), v({ seconds: 600, intensity: 7 })), "10 min · esfuerzo 7");
});

test("registros anteriores a los tipos: tal cual se anotaron", () => {
  assert.equal(formatSet(t({ trackingType: "time" }), v({ reps: 40 })), "40 reps (registro anterior)");
  assert.equal(formatSet(t({ trackingType: "cardio" }), v({})), "-");
});

test("duración", () => {
  assert.equal(formatDuration(45), "45 s");
  assert.equal(formatDuration(600), "10 min");
  assert.equal(formatDuration(630), "10:30 min");
});
