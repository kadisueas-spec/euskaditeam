import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TRACKING, normalizeTracking, trackingFromRow } from "@/lib/constants/tracking";

test("tipo inválido o ausente: peso y reps (el de siempre)", () => {
  assert.deepEqual(normalizeTracking({ trackingType: "x" }), DEFAULT_TRACKING);
  assert.deepEqual(trackingFromRow({}), DEFAULT_TRACKING);
});

test("asistencia solo en peso corporal", () => {
  assert.equal(normalizeTracking({ trackingType: "bodyweight_reps", assistanceUnit: "kg" }).assistanceUnit, "kg");
  assert.equal(normalizeTracking({ trackingType: "bodyweight_reps", assistanceUnit: "band" }).assistanceUnit, "band");
  assert.equal(normalizeTracking({ trackingType: "weight_reps", assistanceUnit: "kg" }).assistanceUnit, null);
  assert.equal(normalizeTracking({ trackingType: "bodyweight_reps", assistanceUnit: "x" }).assistanceUnit, null);
});

test("escala solo en cardio, y cardio siempre con escala", () => {
  assert.equal(normalizeTracking({ trackingType: "cardio" }).cardioScale, "level");
  assert.equal(normalizeTracking({ trackingType: "cardio", cardioScale: "effort" }).cardioScale, "effort");
  assert.equal(normalizeTracking({ trackingType: "time", cardioScale: "effort" }).cardioScale, null);
});

test("por lado: checkbox del formulario; nunca en cardio ni check", () => {
  assert.equal(normalizeTracking({ trackingType: "weight_reps", perSide: "on" }).perSide, true);
  assert.equal(normalizeTracking({ trackingType: "time", perSide: true }).perSide, true);
  assert.equal(normalizeTracking({ trackingType: "weight_reps", perSide: null }).perSide, false);
  assert.equal(normalizeTracking({ trackingType: "cardio", perSide: "on" }).perSide, false);
  assert.equal(normalizeTracking({ trackingType: "check", perSide: "on" }).perSide, false);
});

test("lectura de la fila de la base", () => {
  assert.deepEqual(
    trackingFromRow({ tracking_type: "bodyweight_reps", per_side: false, assistance_unit: "kg", cardio_scale: null }),
    { trackingType: "bodyweight_reps", perSide: false, assistanceUnit: "kg", cardioScale: null }
  );
});
