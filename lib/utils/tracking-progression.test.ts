import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isBetterTrackingSet,
  suggestFirstTrackingSet,
  suggestNextTrackingSet,
  type TrackingSet,
  type TrackingTargets,
} from "@/lib/utils/tracking-progression";
import type { TrackingFields } from "@/lib/constants/tracking";

const BW: TrackingFields = { trackingType: "bodyweight_reps", perSide: false, assistanceUnit: null, cardioScale: null };
const ASSIST: TrackingFields = { ...BW, assistanceUnit: "kg" };
const BAND: TrackingFields = { ...BW, assistanceUnit: "band" };
const TIME: TrackingFields = { trackingType: "time", perSide: false, assistanceUnit: null, cardioScale: null };
const CARDIO: TrackingFields = { trackingType: "cardio", perSide: false, assistanceUnit: null, cardioScale: "level" };
const EFFORT: TrackingFields = { ...CARDIO, cardioScale: "effort" };

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
const targets = (p: Partial<TrackingTargets> = {}): TrackingTargets => ({
  repsMin: 10,
  repsMax: 15,
  rirTarget: null,
  secondsMin: null,
  secondsMax: null,
  minutesTarget: null,
  intensityTarget: null,
  weightIncrement: 2.5,
  ...p,
});

// --- Peso corporal ---

test("peso corporal, serie 1: una rep más hasta el tope", () => {
  const s = suggestFirstTrackingSet(BW, set({ reps: 12 }), targets())!;
  assert.equal(s.trackingCase, "bw_more_reps");
  assert.equal(s.set.reps, 13);
  assert.equal(s.set.weight, null);
});

test("peso corporal, serie 1: en el tope sin lastre → tope + variante más difícil", () => {
  const s = suggestFirstTrackingSet(BW, set({ reps: 15 }), targets())!;
  assert.equal(s.trackingCase, "bw_top");
  assert.equal(s.set.reps, 15);
});

test("peso corporal, serie 1: en el tope con lastre → más lastre y reps al mínimo", () => {
  const s = suggestFirstTrackingSet(BW, set({ reps: 15, weight: 2.5 }), targets())!;
  assert.equal(s.trackingCase, "bw_add_load");
  assert.deepEqual([s.set.reps, s.set.weight], [10, 5]);
});

test("peso corporal, serie 2+: en rango → una rep menos; se pasó → tope o lastre", () => {
  assert.equal(suggestNextTrackingSet(BW, set({ reps: 12 }), targets())!.set.reps, 11);
  const over = suggestNextTrackingSet(BW, set({ reps: 17 }), targets())!;
  assert.deepEqual([over.trackingCase, over.set.reps], ["bw_top", 15]);
  const overLoaded = suggestNextTrackingSet(BW, set({ reps: 17, weight: 5 }), targets())!;
  assert.deepEqual([overLoaded.trackingCase, overLoaded.set.weight, overLoaded.set.reps], ["bw_add_load", 7.5, 10]);
});

test("peso corporal, serie 2+: debajo del rango → baja el lastre o mantiene", () => {
  const lower = suggestNextTrackingSet(BW, set({ reps: 9, weight: 5 }), targets())!;
  assert.deepEqual([lower.trackingCase, lower.set.weight, lower.set.reps], ["bw_less_load", 2.5, 15]);
  const noLoad = suggestNextTrackingSet(BW, set({ reps: 8 }), targets())!;
  assert.deepEqual([noLoad.trackingCase, noLoad.set.reps], ["bw_hold", 8]);
  // El último paso de lastre deja sin lastre (null), no 0 kg
  assert.equal(suggestNextTrackingSet(BW, set({ reps: 9, weight: 2.5 }), targets())!.set.weight, null);
});

test("peso corporal: RIR objetivo y resto sobrante", () => {
  const t = targets({ rirTarget: 2 });
  // En el tope con más resto que el objetivo: también "te sobró"
  assert.equal(suggestNextTrackingSet(BW, set({ reps: 15, rir: 4, weight: 5 }), t)!.trackingCase, "bw_add_load");
  assert.equal(suggestNextTrackingSet(BW, set({ reps: 15, rir: 2, weight: 5 }), t)!.trackingCase, "bw_one_less");
  assert.equal(suggestNextTrackingSet(BW, set({ reps: 12 }), t)!.set.rir, 2);
});

// --- Asistido: menos ayuda es mejor ---

test("asistido, serie 1: en el tope baja la ayuda", () => {
  const s = suggestFirstTrackingSet(ASSIST, set({ reps: 15, assistance: 25 }), targets())!;
  assert.deepEqual([s.trackingCase, s.set.assistance, s.set.reps], ["assist_less", 22.5, 10]);
  const mid = suggestFirstTrackingSet(ASSIST, set({ reps: 11, assistance: 25 }), targets())!;
  assert.deepEqual([mid.set.assistance, mid.set.reps], [25, 12]);
});

test("asistido, serie 2+: se pasó → menos ayuda; no llegó → más ayuda; en rango → una rep menos", () => {
  const less = suggestNextTrackingSet(ASSIST, set({ reps: 16, assistance: 20 }), targets())!;
  assert.deepEqual([less.trackingCase, less.set.assistance], ["assist_less", 17.5]);
  const more = suggestNextTrackingSet(ASSIST, set({ reps: 8, assistance: 20 }), targets())!;
  assert.deepEqual([more.trackingCase, more.set.assistance, more.set.reps], ["assist_more", 22.5, 15]);
  const same = suggestNextTrackingSet(ASSIST, set({ reps: 12, assistance: 20 }), targets())!;
  assert.deepEqual([same.trackingCase, same.set.assistance, same.set.reps], ["bw_one_less", 20, 11]);
  // Nunca ayuda negativa
  assert.equal(suggestNextTrackingSet(ASSIST, set({ reps: 16, assistance: 1 }), targets())!.set.assistance, 0);
});

test("banda: el paso es un nivel", () => {
  assert.equal(suggestNextTrackingSet(BAND, set({ reps: 16, assistance: 3 }), targets())!.set.assistance, 2);
});

test("mejor serie: asistido = menos ayuda; peso corporal = más lastre, después reps", () => {
  assert.equal(isBetterTrackingSet(ASSIST, set({ reps: 8, assistance: 15 }), set({ reps: 12, assistance: 20 })), true);
  assert.equal(isBetterTrackingSet(ASSIST, set({ reps: 12, assistance: 20 }), set({ reps: 10, assistance: 20 })), true);
  assert.equal(isBetterTrackingSet(BW, set({ reps: 8, weight: 5 }), set({ reps: 15 })), true);
  assert.equal(isBetterTrackingSet(BW, set({ reps: 15 }), set({ reps: 12 })), true);
  assert.equal(isBetterTrackingSet(TIME, set({ seconds: 50 }), set({ seconds: 45 })), true);
  assert.equal(isBetterTrackingSet(CARDIO, set({ seconds: 600, intensity: 8 }), set({ seconds: 1200, intensity: 6 })), true);
});

// --- Isométrico ---

test("isométrico, serie 1: +5 s hasta el máximo; en el máximo, lastre o variante", () => {
  const t = targets({ secondsMin: 30, secondsMax: 45 });
  assert.equal(suggestFirstTrackingSet(TIME, set({ seconds: 30 }), t)!.set.seconds, 35);
  assert.equal(suggestFirstTrackingSet(TIME, set({ seconds: 43 }), t)!.set.seconds, 45);
  const top = suggestFirstTrackingSet(TIME, set({ seconds: 45 }), t)!;
  assert.deepEqual([top.trackingCase, top.set.seconds], ["time_top", 45]);
  // Sin rango: +5 s siempre
  assert.equal(suggestFirstTrackingSet(TIME, set({ seconds: 60 }), targets())!.set.seconds, 65);
});

test("isométrico, serie 2+: repite; si quedó corto, apunta al mínimo", () => {
  const t = targets({ secondsMin: 30, secondsMax: 45 });
  assert.deepEqual(suggestNextTrackingSet(TIME, set({ seconds: 40, weight: 5 }), t)!.set, set({ seconds: 40, weight: 5 }));
  const short = suggestNextTrackingSet(TIME, set({ seconds: 20 }), t)!;
  assert.deepEqual([short.trackingCase, short.set.seconds], ["time_aim_min", 30]);
});

// --- Cardio ---

test("cardio: más minutos hasta el objetivo, después +1 nivel", () => {
  const t = targets({ minutesTarget: 20 });
  const more = suggestFirstTrackingSet(CARDIO, set({ seconds: 15 * 60, intensity: 6 }), t)!;
  assert.deepEqual([more.trackingCase, more.set.seconds, more.set.intensity], ["cardio_more_minutes", 17 * 60, 6]);
  assert.equal(suggestFirstTrackingSet(CARDIO, set({ seconds: 19 * 60 }), t)!.set.seconds, 20 * 60);
  const level = suggestFirstTrackingSet(CARDIO, set({ seconds: 20 * 60, intensity: 6 }), t)!;
  assert.deepEqual([level.trackingCase, level.set.seconds, level.set.intensity], ["cardio_more_intensity", 20 * 60, 7]);
});

test("cardio por esfuerzo: no sube la intensidad sola", () => {
  const s = suggestFirstTrackingSet(EFFORT, set({ seconds: 20 * 60, intensity: 7 }), targets({ minutesTarget: 20 }))!;
  assert.deepEqual([s.trackingCase, s.set.intensity], ["cardio_hold", 7]);
});

test("cardio: sin sugerencia de serie a serie (es una sola serie)", () => {
  assert.equal(suggestNextTrackingSet(CARDIO, set({ seconds: 600 }), targets()), null);
});

test("sin dato anterior: sin sugerencia", () => {
  assert.equal(suggestFirstTrackingSet(BW, set({}), targets()), null);
  assert.equal(suggestFirstTrackingSet(TIME, set({}), targets()), null);
  assert.equal(suggestNextTrackingSet(BW, set({ reps: 0 }), targets()), null);
});
