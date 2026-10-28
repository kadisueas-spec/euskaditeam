import { test } from "node:test";
import assert from "node:assert/strict";
import {
  exercisePayloadFromValues,
  missingPrescription,
  prescriptionChips,
  prescriptionLine,
  type Prescription,
} from "@/lib/utils/prescription";
import { DEFAULT_TRACKING, type TrackingFields } from "@/lib/constants/tracking";
import { minutesInputToSeconds } from "@/lib/utils/rest-time";

const p = (x: Partial<Prescription>): Prescription => ({
  sets: 3,
  repsMin: null,
  repsMax: null,
  rirTarget: null,
  secondsMin: null,
  secondsMax: null,
  minutesTarget: null,
  intensityTarget: null,
  ...x,
});
const t = (x: Partial<TrackingFields>): TrackingFields => ({ ...DEFAULT_TRACKING, ...x });

test("texto de la prescripción por tipo", () => {
  assert.equal(prescriptionLine(p({ repsMin: 8, repsMax: 10, rirTarget: 2 }), t({})), "3 × 8–10 · RIR 2");
  assert.equal(prescriptionLine(p({ repsMin: 10, repsMax: 10 }), t({ perSide: true })), "3 × 10 por lado");
  assert.equal(prescriptionLine(p({ secondsMin: 30, secondsMax: 45 }), t({ trackingType: "time" })), "3 × 30–45 s");
  assert.equal(
    prescriptionLine(p({ sets: 1, minutesTarget: 20, intensityTarget: 8 }), t({ trackingType: "cardio", cardioScale: "level" })),
    "20 min · nivel 8"
  );
  assert.equal(
    prescriptionLine(p({ repsMin: 6, repsMax: 8 }), t({ trackingType: "bodyweight_reps", assistanceUnit: "kg" })),
    "3 × 6–8 · asistida"
  );
});

test("pastillas de Mi Rutina", () => {
  assert.deepEqual(prescriptionChips(p({ repsMin: 8, repsMax: 10, rirTarget: 2 }), t({})), ["3 series", "8–10 reps", "RIR 2"]);
  assert.deepEqual(prescriptionChips(p({ secondsMin: 30, secondsMax: 30 }), t({ trackingType: "time", perSide: true })), [
    "3 series",
    "30 s por lado",
  ]);
  assert.deepEqual(prescriptionChips(p({ minutesTarget: 20 }), t({ trackingType: "cardio", cardioScale: "effort" })), ["20 min"]);
});

const values = {
  sets: "3",
  repsMin: "8",
  repsMax: "10",
  rir: "0",
  restSeconds: "1.5",
  weightIncrement: "2.5",
  warmupType: "percentage_with_kg" as const,
  warmupFixedWeight: "",
  secondsMin: "30",
  secondsMax: "45",
  minutesTarget: "20",
  intensityTarget: "8",
};

test("lo que se guarda: peso + reps igual que antes (y RIR 0 ya no se pierde)", () => {
  const out = exercisePayloadFromValues(values, t({}), minutesInputToSeconds);
  assert.deepEqual(
    [out.sets, out.repsMin, out.repsMax, out.rir, out.restSeconds, out.warmupType, out.secondsMin, out.minutesTarget],
    [3, 8, 10, 0, 90, "percentage_with_kg", null, null]
  );
});

test("lo que se guarda: isométrico en segundos, cardio en minutos, sin campos de otro tipo", () => {
  const time = exercisePayloadFromValues(values, t({ trackingType: "time" }), minutesInputToSeconds);
  assert.deepEqual([time.secondsMin, time.secondsMax, time.repsMin, time.rir, time.warmupType], [30, 45, null, null, "none"]);
  const cardio = exercisePayloadFromValues(values, t({ trackingType: "cardio", cardioScale: "level" }), minutesInputToSeconds);
  assert.deepEqual(
    [cardio.sets, cardio.minutesTarget, cardio.intensityTarget, cardio.restSeconds, cardio.repsMin, cardio.warmupType],
    [1, 20, 8, null, null, "none"]
  );
  const bw = exercisePayloadFromValues(values, t({ trackingType: "bodyweight_reps" }), minutesInputToSeconds);
  assert.equal(bw.warmupType, "none");
});

test("validación: cardio no pide series", () => {
  const empty = { ...values, sets: "" };
  assert.equal(missingPrescription(empty, t({})), "series");
  assert.equal(missingPrescription(empty, t({ trackingType: "cardio" })), null);
});
