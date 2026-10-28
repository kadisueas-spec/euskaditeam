import { test } from "node:test";
import assert from "node:assert/strict";
import { detectTrackingRecord, trackingRecordBanner, trackingRecordDiff } from "@/lib/utils/tracking-records";
import { bestSetByExercise, compareRecordsByImpact, recordSummaryLine, trackingSessionRecord } from "@/lib/utils/session-records";
import type { SetLogWithExerciseRow } from "@/lib/utils/session-records";
import type { TrackingSet } from "@/lib/utils/tracking-progression";
import type { TrackingFields } from "@/lib/constants/tracking";
import { personalBests, recordRow, typedHeadline, type DayBestSet } from "@/lib/reports/records";

const BW: TrackingFields = { trackingType: "bodyweight_reps", perSide: false, assistanceUnit: null, cardioScale: null };
const ASSIST: TrackingFields = { ...BW, assistanceUnit: "kg" };
const BAND: TrackingFields = { ...BW, assistanceUnit: "band" };
const TIME: TrackingFields = { trackingType: "time", perSide: false, assistanceUnit: null, cardioScale: null };
const CARDIO: TrackingFields = { trackingType: "cardio", perSide: false, assistanceUnit: null, cardioScale: "level" };
const CHECK: TrackingFields = { trackingType: "check", perSide: false, assistanceUnit: null, cardioScale: null };

const set = (p: Partial<TrackingSet>): TrackingSet => ({
  weight: null,
  reps: null,
  rir: null,
  seconds: null,
  distanceKm: null,
  intensity: null,
  assistance: null,
  ...p,
});

test("peso corporal: más lastre > más reps con el mismo lastre > más RIR", () => {
  assert.equal(detectTrackingRecord(BW, set({ reps: 12 }), set({ reps: 8, weight: 5 }))?.type, "load");
  assert.deepEqual(detectTrackingRecord(BW, set({ reps: 12 }), set({ reps: 14 })), { type: "reps", previous: 12, current: 14, delta: 2 });
  assert.equal(detectTrackingRecord(BW, set({ reps: 12, rir: 1 }), set({ reps: 12, rir: 3 }))?.type, "rir");
  // Menos lastre no es récord aunque haga más reps
  assert.equal(detectTrackingRecord(BW, set({ reps: 8, weight: 5 }), set({ reps: 15 })), null);
  assert.equal(detectTrackingRecord(BW, set({ reps: 12 }), set({ reps: 12 })), null);
});

test("asistido: menos ayuda es récord; más ayuda nunca", () => {
  const r = detectTrackingRecord(ASSIST, set({ reps: 8, assistance: 25 }), set({ reps: 6, assistance: 20 }))!;
  assert.deepEqual([r.type, r.delta], ["assistance", 5]);
  assert.equal(trackingRecordDiff(ASSIST, r), "−5 kg de ayuda");
  assert.equal(detectTrackingRecord(ASSIST, set({ reps: 8, assistance: 20 }), set({ reps: 12, assistance: 25 })), null);
  assert.equal(detectTrackingRecord(ASSIST, set({ reps: 8, assistance: 20 }), set({ reps: 10, assistance: 20 }))?.type, "reps");
  const band = detectTrackingRecord(BAND, set({ reps: 8, assistance: 3 }), set({ reps: 8, assistance: 2 }))!;
  assert.equal(trackingRecordDiff(BAND, band), "banda 3 → 2");
});

test("isométrico: más lastre > más segundos", () => {
  assert.deepEqual(detectTrackingRecord(TIME, set({ seconds: 40 }), set({ seconds: 50 })), {
    type: "seconds",
    previous: 40,
    current: 50,
    delta: 10,
  });
  assert.equal(detectTrackingRecord(TIME, set({ seconds: 60 }), set({ seconds: 30, weight: 5 }))?.type, "load");
  assert.equal(detectTrackingRecord(TIME, set({ seconds: 40, weight: 5 }), set({ seconds: 60 })), null);
});

test("cardio: más nivel sin bajar minutos > más minutos sin bajar nivel > más distancia", () => {
  const level = detectTrackingRecord(CARDIO, set({ seconds: 1200, intensity: 7 }), set({ seconds: 1200, intensity: 8 }))!;
  assert.deepEqual([level.type, trackingRecordDiff(CARDIO, level)], ["intensity", "nivel 7 → 8"]);
  assert.equal(detectTrackingRecord(CARDIO, set({ seconds: 1200, intensity: 7 }), set({ seconds: 900, intensity: 8 })), null);
  assert.equal(detectTrackingRecord(CARDIO, set({ seconds: 900, intensity: 7 }), set({ seconds: 1200, intensity: 7 }))?.type, "minutes");
  assert.equal(detectTrackingRecord(CARDIO, set({ seconds: 900 }), set({ seconds: 1200 }))?.delta, 5);
  assert.equal(
    detectTrackingRecord(CARDIO, set({ seconds: 1200, distanceKm: 3 }), set({ seconds: 1200, distanceKm: 3.4 }))?.type,
    "distance"
  );
  assert.equal(detectTrackingRecord(CARDIO, set({ seconds: 900, intensity: 8 }), set({ seconds: 1200, intensity: 6 })), null);
});

test("check: nunca es récord", () => {
  assert.equal(detectTrackingRecord(CHECK, set({}), set({})), null);
});

test("récord de sesión: textos del banner y del resumen, y prioridad junto a los de peso", () => {
  const typed = detectTrackingRecord(ASSIST, set({ reps: 8, assistance: 25 }), set({ reps: 8, assistance: 20 }))!;
  const rec = trackingSessionRecord({
    exerciseId: "x",
    exerciseName: "Dominadas asistidas",
    fields: ASSIST,
    record: typed,
    current: set({ reps: 8, assistance: 20 }),
  });
  assert.equal(trackingRecordBanner(ASSIST, typed), "5 kg menos de ayuda que la semana pasada 💪");
  assert.equal(recordSummaryLine(rec), "Dominadas asistidas: −5 kg de ayuda (8 reps · ayuda 20 kg)");
  // Una mejora de ayuda pesa como una de kilos: va antes que un récord de reps
  const reps = trackingSessionRecord({
    exerciseId: "y",
    exerciseName: "Plancha",
    fields: TIME,
    record: detectTrackingRecord(TIME, set({ seconds: 40 }), set({ seconds: 45 }))!,
    current: set({ seconds: 45 }),
  });
  assert.ok(compareRecordsByImpact(rec, reps) < 0);
});

test("mejor serie de la semana con el criterio del tipo (celebración semanal)", () => {
  const row = (p: Partial<SetLogWithExerciseRow>): SetLogWithExerciseRow => ({
    routine_exercise_id: "re1",
    weight_kg: null,
    reps_completed: null,
    rir_actual: null,
    workout_logs: { workout_date: "2026-10-20" },
    routine_exercises: { exercises: { name: "Dominadas asistidas", tracking_type: "bodyweight_reps", assistance_unit: "kg" } },
    ...p,
  });
  const best = bestSetByExercise([row({ reps_completed: 10, assistance: 25 }), row({ reps_completed: 6, assistance: 20 })]);
  assert.equal(best.get("re1")?.assistance, 20);
});

// --- Reportes: contra la mejor marca histórica anterior al período ---

const day = (date: string, p: Partial<DayBestSet>): DayBestSet => ({
  date,
  exerciseId: "plancha",
  exerciseName: "Plancha frontal",
  muscleGroup: "Abdomen/Core",
  weight: null,
  reps: null,
  rir: null,
  tracking: TIME,
  ...p,
});

test("reportes: récord de isométrico contra la mejor marca anterior al período", () => {
  const rows = [
    day("2026-09-01", { seconds: 60 }),
    day("2026-09-20", { seconds: 40 }),
    day("2026-10-05", { seconds: 55 }), // mejor que la anterior inmediata, no que la histórica
  ];
  assert.equal(personalBests(rows, "2026-10-01", "2026-10-31").length, 0);
  const pbs = personalBests([...rows, day("2026-10-12", { seconds: 70 })], "2026-10-01", "2026-10-31");
  assert.equal(pbs.length, 1);
  assert.deepEqual(recordRow(pbs[0]), { exercise: "Plancha frontal", value: "70 s", diff: "+10 s" });
  assert.deepEqual(typedHeadline(pbs[0]), { value: "+10", unit: "s" });
});

test("reportes: asistido con menos ayuda", () => {
  const rows = [
    day("2026-09-10", { exerciseId: "dom", exerciseName: "Dominadas asistidas", tracking: ASSIST, reps: 8, assistance: 25 }),
    day("2026-10-10", { exerciseId: "dom", exerciseName: "Dominadas asistidas", tracking: ASSIST, reps: 8, assistance: 20 }),
  ];
  const [pb] = personalBests(rows, "2026-10-01", "2026-10-31");
  assert.equal(recordRow(pb).diff, "−5 kg de ayuda");
  assert.deepEqual(typedHeadline(pb), { value: "−5", unit: "kg ayuda" });
});
