"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ExerciseVideo } from "@/components/client/exercise-video";
import type { MyRoutineDay } from "@/lib/supabase/client-routine";
import { savePendingSet } from "@/lib/offline/workout-store";
import { isNetworkError } from "@/lib/utils/is-network-error";
import {
  addSet,
  finishWorkout,
  getOrCreateInProgressWorkout,
  getPreviousSetsForExercises,
  updateSet,
  type PreviousSetValue,
  type WorkoutSummary,
} from "./actions";

type CommittedSet = {
  id: string;
  weight: string;
  reps: string;
  rir: string;
  pending?: boolean;
  isPersonalRecord?: boolean;
};

// Bloque 2: confeti sutil rojo/blanco para la pantalla de celebración —
// posiciones y demoras fijas (no Math.random en cada render) para que sea
// siempre la misma coreografía, CSS puro.
const CONFETTI_PIECES = [
  { left: "8%", delay: "0s", color: "#e8001c" },
  { left: "18%", delay: "0.15s", color: "#f5f5f5" },
  { left: "28%", delay: "0.05s", color: "#e8001c" },
  { left: "40%", delay: "0.25s", color: "#f5f5f5" },
  { left: "52%", delay: "0.1s", color: "#e8001c" },
  { left: "64%", delay: "0.3s", color: "#f5f5f5" },
  { left: "76%", delay: "0.2s", color: "#e8001c" },
  { left: "88%", delay: "0.35s", color: "#f5f5f5" },
  { left: "34%", delay: "0.4s", color: "#e8001c" },
  { left: "58%", delay: "0.05s", color: "#f5f5f5" },
];

function keyFor(exerciseId: string, setNumber: number) {
  return `${exerciseId}-${setNumber}`;
}

// Estilo tipo "autocompletado de Chrome": fondo cálido suave, claramente
// distinto del valor confirmado, para dejar en claro que es una sugerencia
// editable (lo que se cargó la vez anterior), no un dato ya confirmado.
const SUGGESTED_CLASS = "border-amber-400/50 bg-amber-400/10 text-amber-200";

export function WorkoutLogger({ day }: { day: MyRoutineDay }) {
  const router = useRouter();
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [phase, setPhase] = useState<"logging" | "summary" | "celebration">(
    "logging"
  );
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutSummary | null>(
    null
  );
  const [setsByExercise, setSetsByExercise] = useState<
    Record<string, CommittedSet[]>
  >(() => Object.fromEntries(day.exercises.map((ex) => [ex.id, []])));
  const [previousByKey, setPreviousByKey] = useState<
    Map<string, PreviousSetValue>
  >(new Map());
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState("");
  const [suggested, setSuggested] = useState({
    weight: false,
    reps: false,
    rir: false,
  });
  const [energyLevel, setEnergyLevel] = useState(3);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    weight: "",
    reps: "",
    rir: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // A1: al montar, encontrar (o crear) el entrenamiento en curso en el
  // servidor y reconstruir exactamente dónde había quedado el cliente —
  // sobrevive a cerrar la app por completo, porque la fuente de verdad es
  // el servidor, no el estado de React.
  //
  // CAUSA RAÍZ del cuelgue en "Iniciar entrenamiento" (encontrada jul-2026):
  // este efecto no tenía try/catch alrededor del Promise.all. Si CUALQUIERA
  // de los dos Server Actions rechaza en vez de resolver (una falla de red
  // real, no un error de validación — eso ya vuelve como {error} y sí se
  // manejaba) la promesa del IIFE async queda rechazada sin manejar,
  // "initializing" nunca pasa a false, y la pantalla queda en el skeleton
  // para siempre — sin mensaje, sin botón, sin forma de salir salvo cerrar
  // la app. Confirmado reproduciendo el mismo patrón aislado en el
  // navegador: un unhandledrejection deja "initializing" trabado. Ahora se
  // atrapa el rechazo, se muestra un error claro con reintentar (mismo
  // criterio de red que error-state.tsx del Bloque 1), y retryToken permite
  // reintentar sin recargar la página.
  useEffect(() => {
    let cancelled = false;
    setInitError(null);
    (async () => {
      try {
        const [workoutResult, previous] = await Promise.all([
          getOrCreateInProgressWorkout(day.id),
          getPreviousSetsForExercises(day.exercises.map((ex) => ex.id)),
        ]);
        if (cancelled) return;

        setPreviousByKey(
          new Map(
            previous.map((p) => [keyFor(p.routineExerciseId, p.setNumber), p])
          )
        );

        if ("error" in workoutResult) {
          setInitError(workoutResult.error);
          setInitializing(false);
          return;
        }

        setWorkoutLogId(workoutResult.workoutLogId);

        const grouped: Record<string, CommittedSet[]> = Object.fromEntries(
          day.exercises.map((ex) => [ex.id, []])
        );
        for (const s of workoutResult.loggedSets) {
          const list = grouped[s.routineExerciseId] ?? [];
          list.push({
            id: s.id,
            weight: s.weightKg != null ? String(s.weightKg) : "",
            reps: s.reps != null ? String(s.reps) : "",
            rir: s.rir != null ? String(s.rir) : "",
          });
          grouped[s.routineExerciseId] = list;
        }
        setSetsByExercise(grouped);

        const resumeIndex = day.exercises.findIndex(
          (ex) => (grouped[ex.id]?.length ?? 0) < ex.sets
        );
        if (resumeIndex === -1) {
          setPhase("summary");
        } else {
          setExerciseIndex(resumeIndex);
        }
        setInitializing(false);
      } catch (err) {
        if (cancelled) return;
        console.error("WorkoutLogger init error:", err);
        setInitError(
          isNetworkError(err)
            ? "Sin conexión. Revisá tu red y reintentá."
            : "No se pudo cargar el entrenamiento. Reintentá."
        );
        // OJO: "initializing" queda en true a propósito acá — el render
        // chequea initError ANTES que initializing (ver más abajo), así que
        // esto no reactiva el skeleton. Si se pusiera en false, caería al
        // branch de contenido real con workoutLogId todavía null.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.id, retryToken]);

  const exercise = day.exercises[exerciseIndex];
  const isLastExercise = exerciseIndex === day.exercises.length - 1;
  const currentSets = setsByExercise[exercise?.id ?? ""] ?? [];
  const nextSetNumber = currentSets.length + 1;

  // A5: cada vez que cambia el ejercicio o la serie a cargar, precargar la
  // sugerencia de la vez anterior (si existe) en los campos. Se ajusta
  // durante el render (no en un efecto) comparando contra la última clave
  // vista, siguiendo el patrón recomendado de React para "resetear estado
  // cuando cambia un input" sin el render extra de un efecto.
  const resumeKey = exercise ? keyFor(exercise.id, nextSetNumber) : "";
  const [seenResumeKey, setSeenResumeKey] = useState(resumeKey);
  if (resumeKey !== seenResumeKey && exercise) {
    setSeenResumeKey(resumeKey);
    const prev = previousByKey.get(resumeKey);
    setWeight(prev?.weightKg != null ? String(prev.weightKg) : "");
    setReps(prev?.reps != null ? String(prev.reps) : "");
    setRir(prev?.rir != null ? String(prev.rir) : "");
    setSuggested({
      weight: prev?.weightKg != null,
      reps: prev?.reps != null,
      rir: prev?.rir != null,
    });
    setError(null);
  }

  function goNext() {
    if (isLastExercise) {
      setPhase("summary");
    } else {
      setExerciseIndex((i) => i + 1);
    }
  }

  function goBackExercise() {
    if (exerciseIndex > 0) {
      setExerciseIndex((i) => i - 1);
    }
  }

  async function handleCompleteSet() {
    if (!weight && !reps) {
      setError("Ingresá al menos peso o reps.");
      return;
    }
    if (!workoutLogId) {
      setError("Todavía no se pudo iniciar el entrenamiento. Probá de nuevo.");
      return;
    }
    setError(null);

    const setNumber = nextSetNumber;
    const input = {
      workoutLogId,
      routineExerciseId: exercise.id,
      setNumber,
      weightKg: weight ? Number(weight) : null,
      reps: reps ? Number(reps) : null,
      rir: rir ? Number(rir) : null,
    };

    navigator.vibrate?.(50);

    // Optimistic UI: se agrega y se avanza al instante; el guardado real
    // corre en paralelo.
    const tempId = `pending-${crypto.randomUUID()}`;
    setSetsByExercise((prevState) => ({
      ...prevState,
      [exercise.id]: [
        ...(prevState[exercise.id] ?? []),
        { id: tempId, weight, reps, rir, pending: true },
      ],
    }));

    // A2: si esta era la última serie programada del ejercicio, pasar al
    // siguiente en vez de permitir cargar una serie extra.
    if (setNumber >= exercise.sets) {
      goNext();
    }

    try {
      const result = await addSet(input);
      if (!("success" in result)) throw new Error(result.error);
      if (result.isPersonalRecord) navigator.vibrate?.([40, 60, 40]);
      setSetsByExercise((prevState) => ({
        ...prevState,
        [exercise.id]: (prevState[exercise.id] ?? []).map((s) =>
          s.id === tempId
            ? {
                ...s,
                id: result.id,
                pending: false,
                isPersonalRecord: result.isPersonalRecord,
              }
            : s
        ),
      }));
    } catch {
      // Sin conexión: se guarda localmente y se sincroniza solo al
      // reconectar (ver components/client/sync-banner.tsx), sin perder el
      // progreso cargado.
      await savePendingSet(input);
    }
  }

  function startEditingSet(set: CommittedSet) {
    if (set.pending) return;
    setEditingSetId(set.id);
    setEditValues({ weight: set.weight, reps: set.reps, rir: set.rir });
  }

  async function saveEditedSet() {
    if (!editingSetId) return;
    setSavingEdit(true);
    const result = await updateSet(editingSetId, {
      weightKg: editValues.weight ? Number(editValues.weight) : null,
      reps: editValues.reps ? Number(editValues.reps) : null,
      rir: editValues.rir ? Number(editValues.rir) : null,
    });
    setSavingEdit(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSetsByExercise((prevState) => ({
      ...prevState,
      [exercise.id]: (prevState[exercise.id] ?? []).map((s) =>
        s.id === editingSetId
          ? {
              ...s,
              weight: editValues.weight,
              reps: editValues.reps,
              rir: editValues.rir,
            }
          : s
      ),
    }));
    setEditingSetId(null);
  }

  function handleFinish() {
    if (!workoutLogId) return;
    setError(null);
    startTransition(async () => {
      // Mismo patrón que el cuelgue de "Iniciar entrenamiento": sin este
      // try/catch, un rechazo de red acá dejaba el botón trabado en
      // "Guardando..." para siempre (useTransition no resetea "pending"
      // solo si la transición nunca actualiza estado).
      try {
        const result = await finishWorkout({ workoutLogId, energyLevel, notes });
        if ("error" in result) {
          setError(result.error);
          return;
        }
        navigator.vibrate?.([30, 40, 30, 40, 60]);
        setWorkoutSummary(result.summary);
        setPhase("celebration");
      } catch (err) {
        console.error("finishWorkout error:", err);
        setError(
          isNetworkError(err)
            ? "Sin conexión. Revisá tu red y reintentá."
            : "No se pudo finalizar el entrenamiento. Reintentá."
        );
      }
    });
  }

  if (initializing) {
    if (initError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-sm text-[#888888]">{initError}</p>
          <Button
            onClick={() => {
              setInitializing(true);
              setInitError(null);
              setRetryToken((t) => t + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        <div className="h-9 w-48 animate-pulse rounded-md bg-white/5" />
        <div className="h-64 w-full animate-pulse rounded-2xl bg-white/5" />
        <div className="h-14 w-full animate-pulse rounded-lg bg-white/5" />
      </div>
    );
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
          {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
          {pending ? "Guardando..." : "Finalizar entrenamiento"}
        </Button>
      </div>
    );
  }

  if (phase === "celebration" && workoutSummary) {
    return (
      <div className="relative flex min-h-[70vh] flex-col items-center justify-center gap-6 overflow-hidden px-2 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden">
          {CONFETTI_PIECES.map((c, i) => (
            <span
              key={i}
              className="animate-confetti-fall absolute top-0 size-2 rounded-sm"
              style={{
                left: c.left,
                backgroundColor: c.color,
                animationDelay: c.delay,
              }}
            />
          ))}
        </div>

        <span className="animate-celebrate-check glow-pulse flex size-24 items-center justify-center rounded-full bg-[#e8001c]/15">
          <Check className="size-12 text-[#e8001c]" strokeWidth={3} />
        </span>

        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
            ¡Sesión completada!
          </h1>
          <p className="text-sm text-[#888888]">Eso es constancia.</p>
        </div>

        <div className="grid w-full max-w-xs grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-3">
            <p className="font-display text-3xl text-[#e8001c]">
              {workoutSummary.totalSets}
            </p>
            <p className="text-xs text-[#888888] uppercase">Series</p>
          </div>
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-3">
            <p className="font-display text-3xl text-[#e8001c]">
              {workoutSummary.totalVolume.toLocaleString("es-AR")}
            </p>
            <p className="text-xs text-[#888888] uppercase">Kg volumen</p>
          </div>
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-3">
            <p className="font-display text-3xl text-[#e8001c]">
              {workoutSummary.durationMinutes}
            </p>
            <p className="text-xs text-[#888888] uppercase">Minutos</p>
          </div>
        </div>

        <Button
          onClick={() => router.push("/client/progress")}
          className="min-h-[52px] w-full max-w-xs text-base"
        >
          Continuar
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
          {currentSets.map((s, i) =>
            editingSetId === s.id ? (
              <div
                key={s.id}
                className="flex flex-col gap-2 rounded-lg border border-[#e8001c]/40 bg-[#e8001c]/5 p-3"
              >
                <p className="text-xs font-semibold text-[#e8001c] uppercase">
                  Editando serie {i + 1}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={editValues.weight}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, weight: e.target.value }))
                    }
                    placeholder="Kg"
                    className="h-11 text-center"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={editValues.reps}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, reps: e.target.value }))
                    }
                    placeholder="Reps"
                    className="h-11 text-center"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={editValues.rir}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, rir: e.target.value }))
                    }
                    placeholder="RIR"
                    className="h-11 text-center"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-10 flex-1"
                    onClick={() => setEditingSetId(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="h-10 flex-1"
                    onClick={saveEditedSet}
                    disabled={savingEdit}
                  >
                    {savingEdit && <Spinner size="sm" className="border-white/30 border-t-white" />}
                    {savingEdit ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            ) : (
              <div key={s.id} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => startEditingSet(s)}
                  className="flex min-h-[44px] items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm text-left transition-transform active:scale-[0.98]"
                >
                  <span className="flex items-center gap-1.5 text-[#888888]">
                    <span className="animate-check-pop flex size-4 shrink-0 items-center justify-center rounded-full bg-[#e8001c]">
                      <Check className="size-3 text-white" strokeWidth={3} />
                    </span>
                    Serie {i + 1}
                    {s.pending && (
                      <span className="text-[10px] text-amber-400">
                        (guardando...)
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 font-mono text-white">
                    {s.weight || "-"} kg · {s.reps || "-"} reps
                    {s.rir ? ` · RIR ${s.rir}` : ""}
                    <Pencil className="size-3.5 text-[#888888]" />
                  </span>
                </button>
                {s.isPersonalRecord && (
                  <span className="animate-pr-pop glow-pulse ml-1 flex w-fit items-center gap-1 rounded-full bg-[#e8001c]/15 px-2.5 py-1 text-xs font-semibold text-[#e8001c]">
                    <Trophy className="size-3.5" />
                    ¡Nuevo récord! 🏆
                  </span>
                )}
              </div>
            )
          )}
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-[#1e1e1e] bg-[#111111] py-6">
        <p className="font-display text-4xl tracking-widest text-[#e8001c] uppercase">
          Serie {nextSetNumber}
        </p>
        <p className="text-sm text-[#888888]">
          {nextSetNumber}/{exercise.sets}
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
            onChange={(e) => {
              setWeight(e.target.value);
              setSuggested((s) => ({ ...s, weight: false }));
            }}
            className={`h-[72px] text-center text-2xl font-bold ${suggested.weight ? SUGGESTED_CLASS : ""}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Reps</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => {
              setReps(e.target.value);
              setSuggested((s) => ({ ...s, reps: false }));
            }}
            className={`h-[72px] text-center text-2xl font-bold ${suggested.reps ? SUGGESTED_CLASS : ""}`}
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
            onChange={(e) => {
              setRir(e.target.value);
              setSuggested((s) => ({ ...s, rir: false }));
            }}
            className={`h-[72px] text-center text-2xl font-bold ${suggested.rir ? SUGGESTED_CLASS : ""}`}
          />
        </div>
      </div>
      {(suggested.weight || suggested.reps || suggested.rir) && (
        <p className="-mt-2 flex items-center gap-1 text-xs text-amber-400">
          <Check className="size-3" /> Sugerido según tu última vez — podés
          editarlo
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleCompleteSet}
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
        <Button
          variant="outline"
          onClick={goNext}
          className="min-h-[52px] flex-1 text-base"
        >
          {isLastExercise ? "Terminar ejercicios" : "Siguiente ejercicio"}
        </Button>
      </div>
    </div>
  );
}
