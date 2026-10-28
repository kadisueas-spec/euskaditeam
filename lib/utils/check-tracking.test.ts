import { test } from "node:test";
import assert from "node:assert/strict";
import { SELECTABLE_TRACKING_TYPES, normalizeTracking, type TrackingFields } from "@/lib/constants/tracking";
import { formatSet } from "@/lib/utils/set-format";
import { exercisePayloadFromValues, prescriptionChips, prescriptionLine } from "@/lib/utils/prescription";
import { countsAsWorkSet, setTime, setVolumeKg } from "@/lib/utils/set-volume";
import { detectTrackingRecord } from "@/lib/utils/tracking-records";
import { suggestFirstTrackingSet, suggestNextTrackingSet } from "@/lib/utils/tracking-progression";
import { minutesInputToSeconds } from "@/lib/utils/rest-time";
import { summarizeSessions } from "@/lib/reports/load-input";
import { countsAsTraining } from "@/lib/utils/training-sessions";

// "Solo marcar hecho" (etapa 5, oct-2026): calentamiento, movilidad,
// estiramientos. Cuenta para completar el día; no entra en volumen, series
// de trabajo, récords ni sugerencias.

const CHECK: TrackingFields = { trackingType: "check", perSide: false, assistanceUnit: null, cardioScale: null };
const empty = { weight: null, reps: null, rir: null, seconds: null, distanceKm: null, intensity: null, assistance: null };

test("se puede elegir en el catálogo y nunca es 'por lado'", () => {
  assert.ok(SELECTABLE_TRACKING_TYPES.includes("check"));
  assert.equal(normalizeTracking({ trackingType: "check", perSide: "on" }).perSide, false);
});

test("prescripción: una serie, sin descanso ni calentamiento, 'Marcar hecho'", () => {
  const out = exercisePayloadFromValues(
    {
      sets: "3",
      repsMin: "10",
      repsMax: "12",
      rir: "2",
      restSeconds: "1",
      weightIncrement: "2.5",
      warmupType: "percentage_with_kg",
      warmupFixedWeight: "",
    },
    CHECK,
    minutesInputToSeconds
  );
  assert.deepEqual(
    [out.sets, out.repsMin, out.rir, out.restSeconds, out.warmupType],
    [1, null, null, null, "none"]
  );
  const p = { sets: 1, repsMin: null, repsMax: null, rirTarget: null, secondsMin: null, secondsMax: null, minutesTarget: null, intensityTarget: null };
  assert.equal(prescriptionLine(p, CHECK), "Marcar hecho");
  assert.deepEqual(prescriptionChips(p, CHECK), ["Marcar hecho"]);
});

test("serie: se lee 'Hecho'; no suma volumen ni tiempo ni es serie de trabajo", () => {
  assert.equal(formatSet(CHECK, empty), "Hecho");
  assert.equal(setVolumeKg(CHECK, null, null), 0);
  assert.deepEqual(setTime(CHECK, null), { cardioSeconds: 0, isometricSeconds: 0 });
  assert.equal(countsAsWorkSet(CHECK), false);
});

test("sin récords ni sugerencias", () => {
  assert.equal(detectTrackingRecord(CHECK, empty, empty), null);
  assert.equal(suggestFirstTrackingSet(CHECK, empty, {
    repsMin: null, repsMax: null, rirTarget: null, secondsMin: null, secondsMax: null, minutesTarget: null, intensityTarget: null, weightIncrement: 2.5,
  }), null);
  assert.equal(suggestNextTrackingSet(CHECK, empty, {
    repsMin: null, repsMax: null, rirTarget: null, secondsMin: null, secondsMax: null, minutesTarget: null, intensityTarget: null, weightIncrement: 2.5,
  }), null);
});

test("un día con solo 'hecho' cuenta como entrenado, pero sin series de trabajo ni mejor marca", () => {
  assert.equal(countsAsTraining({ isCompleted: true, setCount: 1 }), true);
  const { sessions, bestSets } = summarizeSessions([
    {
      id: "s1",
      workout_date: "2026-10-20",
      is_completed: true,
      routine_day_id: null,
      routine_days: null,
      workout_set_logs: [
        {
          weight_kg: null,
          reps_completed: null,
          rir_actual: null,
          routine_exercises: {
            exercise_id: "mov",
            exercises: { name: "Movilidad de cadera", muscle_group: null, tracking_type: "check" },
          },
        },
      ],
    },
  ]);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].setCount, 0);
  assert.equal(sessions[0].volumeKg, 0);
  assert.equal(bestSets.length, 0);
});
