"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExerciseVideo } from "@/components/client/exercise-video";
import type { MyRoutineDay } from "@/lib/supabase/client-routine";
import { savePendingWorkout } from "@/lib/offline/workout-store";
import { finishWorkout, type FinishWorkoutInput } from "./actions";

type CommittedSet = { weight: string; reps: string; rir: string };

export function WorkoutLogger({ day }: { day: MyRoutineDay }) {
  const router = useRouter();
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [phase, setPhase] = useState<"logging" | "summary">("logging");
  const [setsByExercise, setSetsByExercise] = useState<
    Record<string, CommittedSet[]>
  >(() => Object.fromEntries(day.exercises.map((ex) => [ex.id, []])));
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState("");
  const [energyLevel, setEnergyLevel] = useState(3);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const exercise = day.exercises[exerciseIndex];
  const isLastExercise = exerciseIndex === day.exercises.length - 1;
  const currentSets = setsByExercise[exercise?.id ?? ""] ?? [];

  function addSet() {
    if (!weight && !reps) {
      setError("Ingresá al menos peso o reps.");
      return;
    }
    setError(null);
    setSetsByExercise((prev) => ({
      ...prev,
      [exercise.id]: [...(prev[exercise.id] ?? []), { weight, reps, rir }],
    }));
    setWeight("");
    setReps("");
    setRir("");
    // Feedback háptico al completar una serie (no todos los navegadores
    // soportan Vibration API, sobre todo iOS Safari; falla en silencio).
    navigator.vibrate?.(50);
  }

  function goNext() {
    if (isLastExercise) {
      setPhase("summary");
    } else {
      setExerciseIndex((i) => i + 1);
      setWeight("");
      setReps("");
      setRir("");
    }
  }

  function goBackExercise() {
    if (exerciseIndex > 0) {
      setExerciseIndex((i) => i - 1);
      setWeight("");
      setReps("");
      setRir("");
    }
  }

  function handleFinish() {
    setError(null);
    startTransition(async () => {
      const payload: FinishWorkoutInput = {
        dayId: day.id,
        exercises: day.exercises.map((ex) => ({
          routineExerciseId: ex.id,
          sets: (setsByExercise[ex.id] ?? []).map((s) => ({
            weightKg: s.weight ? Number(s.weight) : null,
            reps: s.reps ? Number(s.reps) : null,
            rir: s.rir ? Number(s.rir) : null,
          })),
        })),
        energyLevel,
        notes,
      };

      // Sin conexión: guardamos en IndexedDB y sincronizamos más tarde
      // (ver components/client/sync-banner.tsx) en vez de perder la sesión.
      if (!navigator.onLine) {
        await savePendingWorkout(payload);
        router.push("/client/progress");
        return;
      }

      try {
        const result = await finishWorkout(payload);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        router.push("/client/progress");
      } catch {
        // navigator.onLine decía que sí pero el fetch falló igual
        // (conexión inestable): no perdemos el entrenamiento.
        await savePendingWorkout(payload);
        router.push("/client/progress");
      }
    });
  }

  if (phase === "summary") {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          Resumen del entrenamiento
        </h1>
        <p className="text-sm text-[#888888]">{day.name} — completado</p>

        <div className="flex flex-col gap-2">
          <Label>¿Cómo te sentiste? (nivel de energía)</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setEnergyLevel(level)}
                className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg text-lg font-semibold transition-transform active:scale-90 ${
                  energyLevel === level
                    ? "bg-[#e8001c] text-white shadow-[0_0_16px_rgba(232,0,28,0.4)]"
                    : "bg-white/5 text-[#888888]"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="session-notes">Notas de la sesión</Label>
          <Textarea
            id="session-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="¿Cómo te fue? Algo para contarle a tu coach..."
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={handleFinish}
          disabled={pending}
          className="min-h-[52px] w-full text-base"
        >
          {pending ? "Guardando..." : "Finalizar entrenamiento"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#888888]">
          Ejercicio {exerciseIndex + 1} de {day.exercises.length}
        </p>
        <p className="text-sm text-[#888888]">{day.name}</p>
      </div>

      <div>
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          {exercise.exerciseName}
        </h1>
        <p className="text-sm text-[#888888]">
          Objetivo: {exercise.sets} series
          {exercise.repsMin || exercise.repsMax
            ? ` · ${exercise.repsMin ?? "?"}-${exercise.repsMax ?? "?"} reps`
            : ""}
          {exercise.rirTarget != null ? ` · RIR ${exercise.rirTarget}` : ""}
        </p>
        {exercise.coachNotes && (
          <p className="mt-1 text-sm text-[#888888] italic">
            &ldquo;{exercise.coachNotes}&rdquo;
          </p>
        )}
      </div>

      <ExerciseVideo videoId={exercise.videoId} />

      {currentSets.length > 0 && (
        <div className="flex flex-col gap-2">
          {currentSets.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
            >
              <span className="text-[#888888]">Serie {i + 1}</span>
              <span className="font-mono text-white">
                {s.weight || "-"} kg · {s.reps || "-"} reps
                {s.rir ? ` · RIR ${s.rir}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-[#1e1e1e] bg-[#111111] py-6">
        <p className="font-display text-8xl leading-none text-[#e8001c]">
          {currentSets.length + 1}
        </p>
        <p className="font-display text-lg tracking-widest text-[#888888] uppercase">
          Serie {currentSets.length + 1} de {exercise.sets}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Peso (kg)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="h-[72px] text-center text-2xl font-bold"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Reps</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="h-[72px] text-center text-2xl font-bold"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">RIR</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={5}
            value={rir}
            onChange={(e) => setRir(e.target.value)}
            className="h-[72px] text-center text-2xl font-bold"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={addSet}
        className="min-h-[56px] w-full font-display text-xl tracking-widest uppercase"
      >
        Completar serie
      </Button>

      <div className="mt-2 flex gap-3">
        {exerciseIndex > 0 && (
          <Button
            variant="outline"
            onClick={goBackExercise}
            className="min-h-[52px] flex-1 text-base"
          >
            Anterior
          </Button>
        )}
        <Button onClick={goNext} className="min-h-[52px] flex-1 text-base">
          {isLastExercise ? "Terminar ejercicios" : "Siguiente ejercicio"}
        </Button>
      </div>
    </div>
  );
}
