import { test } from "node:test";
import assert from "node:assert/strict";
import { countsAsWorkSet, setTime, setVolumeKg, trackingOfSetRow } from "@/lib/utils/set-volume";
import { DEFAULT_TRACKING, type TrackingFields } from "@/lib/constants/tracking";

const t = (p: Partial<TrackingFields>): TrackingFields => ({ ...DEFAULT_TRACKING, ...p });

test("peso + reps: peso × reps, × 2 por lado", () => {
  assert.equal(setVolumeKg(t({}), 60, 10), 600);
  // Búlgara 20 kg × 10 por lado = 400 kg
  assert.equal(setVolumeKg(t({ perSide: true }), 20, 10), 400);
  assert.equal(setVolumeKg(t({}), null, 10), 0);
});

test("peso corporal: solo el lastre; asistido no suma", () => {
  assert.equal(setVolumeKg(t({ trackingType: "bodyweight_reps" }), null, 12), 0);
  assert.equal(setVolumeKg(t({ trackingType: "bodyweight_reps" }), 5, 8), 40);
  assert.equal(setVolumeKg(t({ trackingType: "bodyweight_reps", perSide: true }), 10, 10), 200);
  assert.equal(setVolumeKg(t({ trackingType: "bodyweight_reps", assistanceUnit: "kg" }), 20, 8), 0);
});

test("isométrico, cardio y check no suman kilos", () => {
  assert.equal(setVolumeKg(t({ trackingType: "time" }), 10, 1), 0);
  assert.equal(setVolumeKg(t({ trackingType: "cardio" }), 5, 15), 0);
  assert.equal(setVolumeKg(t({ trackingType: "check" }), null, null), 0);
});

test("tiempo: cardio en segundos, isométrico × 2 por lado", () => {
  assert.deepEqual(setTime(t({ trackingType: "cardio" }), 900), { cardioSeconds: 900, isometricSeconds: 0 });
  assert.deepEqual(setTime(t({ trackingType: "time", perSide: true }), 30), { cardioSeconds: 0, isometricSeconds: 60 });
  assert.deepEqual(setTime(t({}), 30), { cardioSeconds: 0, isometricSeconds: 0 });
});

test("check no es serie de trabajo; fila sin ejercicio = peso + reps", () => {
  assert.equal(countsAsWorkSet(t({ trackingType: "check" })), false);
  assert.equal(countsAsWorkSet(t({ trackingType: "time" })), true);
  assert.deepEqual(trackingOfSetRow({ routine_exercises: null }), DEFAULT_TRACKING);
});
