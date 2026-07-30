"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Pencil, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ExerciseVideo } from "@/components/client/exercise-video";
import { RecordCelebrationBanner } from "@/components/client/record-celebration-banner";
import { RestTimerBar } from "@/components/client/rest-timer-bar";
import { WarmupBanner } from "@/components/client/warmup-banner";
import { WeeklyCelebration } from "@/components/client/weekly-celebration";
import type { MyRoutineDay } from "@/lib/supabase/client-routine";
import { savePendingSet } from "@/lib/offline/workout-store";
import { isNetworkError } from "@/lib/utils/is-network-error";
import { parseDecimalInput, sanitizeDecimalInput } from "@/lib/utils/decimal-input";
import { clearStoredRestTimer, readStoredRestTimer } from "@/lib/utils/rest-timer-storage";
import {
  detectWeeklyRecord,
  recordSummaryLine,
  recordSummaryMessage,
  summarizeSessionRecords,
  type SessionRecord,
} from "@/lib/utils/session-records";
import {
  addSet as defaultAddSet,
  finishWorkout as defaultFinishWorkout,
  getOrCreateInProgressWorkout as defaultGetOrCreateInProgressWorkout,
  getWorkoutSuggestions as defaultGetWorkoutSuggestions,
  updateSet as defaultUpdateSet,
  type AddSetInput,
  type AddSetResult,
  type FinishWorkoutInput,
  type FinishWorkoutResult,
  type InProgressWorkout,
  type PlannedSetCount,
  type UpdateSetInput,
  type WeeklyCelebrationSummary,
  type WorkoutSuggestion,
  type WorkoutSummary,
} from "./actions";

// Inyectable por props (jul-2026): el coach reusa este mismo componente
// para su propio entrenamiento (ver app/coach/my-training), con acciones
// que filtran por coach_id en vez de client_id. Los defaults reproducen
// exactamente el comportamiento de siempre — el call site del cliente no
// pasa `actions`, así que no cambia en nada.
export type WorkoutLoggerActions = {
  getOrCreateInProgressWorkout: (
    dayId: string,
    plannedSets?: PlannedSetCount[]
  ) => Promise<InProgressWorkout | { error: string }>;
  getWorkoutSuggestions: (
    routineExerciseIds: string[]
  ) => Promise<Record<string, WorkoutSuggestion>>;
  addSet: (input: AddSetInput) => Promise<AddSetResult>;
  updateSet: (
    setId: string,
    patch: UpdateSetInput
  ) => Promise<{ success: true } | { error: string }>;
  finishWorkout: (input: FinishWorkoutInput) => Promise<FinishWorkoutResult>;
};

const DEFAULT_ACTIONS: WorkoutLoggerActions = {
  getOrCreateInProgressWorkout: defaultGetOrCreateInProgressWorkout,
  getWorkoutSuggestions: defaultGetWorkoutSuggestions,
  addSet: defaultAddSet,
  updateSet: defaultUpdateSet,
  finishWorkout: defaultFinishWorkout,
};

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

// Estilo tipo "autocompletado de Chrome": fondo cálido suave, claramente
// distinto del valor confirmado, para dejar en claro que es una sugerencia
// editable (lo que se cargó la vez anterior), no un dato ya confirmado.
const SUGGESTED_CLASS = "border-amber-400/50 bg-amber-400/10 text-amber-200";

// Temporizador de descanso (jul-2026) — defaults "todo activado" para que
// el coach (que reusa este mismo componente en /coach/my-training sin
// pantalla de preferencias propia) tenga el mismo comportamiento de
// siempre sin necesitar plomería extra.
const DEFAULT_REST_TIMER_PREFS = { enabled: true, sound: true, vibration: true };

function repsRangeLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min}-${max}`;
  return String(min ?? max);
}

export function WorkoutLogger({
  day,
  actions = DEFAULT_ACTIONS,
  enableOfflineSync = true,
  restTimerPrefs = DEFAULT_REST_TIMER_PREFS,
}: {
  day: MyRoutineDay;
  actions?: WorkoutLoggerActions;
  enableOfflineSync?: boolean;
  restTimerPrefs?: { enabled: boolean; sound: boolean; vibration: boolean };
}) {
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
  // Celebración semanal (jul-2026): llega junto con el resultado de
  // finishWorkout si esta sesión completó todos los días planificados de
  // la semana. Se muestra recién al tocar "Continuar" en la celebración
  // de sesión normal (showWeeklyCelebration), nunca antes.
  const [weeklyCelebration, setWeeklyCelebration] =
    useState<WeeklyCelebrationSummary | null>(null);
  const [showWeeklyCelebration, setShowWeeklyCelebration] = useState(false);
  const [setsByExercise, setSetsByExercise] = useState<
    Record<string, CommittedSet[]>
  >(() => Object.fromEntries(day.exercises.map((ex) => [ex.id, []])));
  const [suggestions, setSuggestions] = useState<Record<string, WorkoutSuggestion>>({});
  // Banner de calentamiento (ago-2026): espera a que lleguen las
  // sugerencias antes de decidir si se muestra, para no arrancar en el
  // fallback de porcentaje y "corregirse" un instante después a kilos
  // calculados cuando sí hay dato — ver showWarmupBanner más abajo.
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [warmupBannerDismissed, setWarmupBannerDismissed] = useState(false);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState("");
  const [suggested, setSuggested] = useState({
    weight: false,
    reps: false,
    rir: false,
  });
  const [suggestionCase, setSuggestionCase] = useState<
    WorkoutSuggestion["progressionCase"]
  >(null);
  // Bug jul-2026: cuántas semanas atrás es la referencia de la sugerencia
  // (1 = semana pasada, 2+ = un dato viejo que hay que aclarar).
  const [suggestionWeeksAgo, setSuggestionWeeksAgo] = useState<number | null>(null);
  // Sistema de celebración de récords (jul-2026): sessionRecords acumula
  // TODOS los récords de la sesión (para el resumen de Momento 2 al
  // finalizar); celebrationQueue es la cola de banners de Momento 1
  // pendientes de mostrar (uno a la vez, ver RecordCelebrationBanner).
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
  const [celebrationQueue, setCelebrationQueue] = useState<SessionRecord[]>([]);
  const [energyLevel, setEnergyLevel] = useState(3);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Bug jul-2026: una clienta tocó "Finalizar entrenamiento" con un
  // ejercicio salteado (máquina ocupada) y no tuvo forma de volver ni de
  // corregirlo después. confirmingFinish arma la misma confirmación
  // inline que ya usa DeleteClientButton en vez de un modal nuevo.
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    weight: "",
    reps: "",
    rir: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  // Temporizador de descanso (jul-2026): instanceId nuevo en cada serie
  // completada, así RestTimerBar sabe si tiene que arrancar de cero o
  // reusar lo guardado en localStorage (misma instancia = el cliente
  // navegó afuera y volvió, o cerró la app — ver rest-timer-bar.tsx).
  const [restTimer, setRestTimer] = useState<{
    routineExerciseId: string;
    restSeconds: number;
    instanceId: string;
  } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

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
        const plannedSets: PlannedSetCount[] = day.exercises.map((ex) => ({
          routineExerciseId: ex.id,
          sets: ex.sets,
        }));
        const workoutResult = await actions.getOrCreateInProgressWorkout(day.id, plannedSets);
        if (cancelled) return;

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

          // Temporizador de descanso: si el cliente cerró la app o navegó
          // afuera con un descanso en curso, retomarlo acá — solo si sigue
          // en el MISMO ejercicio en el que se guardó (si el servidor lo
          // reubica en otro, el guardado quedó obsoleto y se descarta).
          if (restTimerPrefs.enabled) {
            const stored = readStoredRestTimer(workoutResult.workoutLogId);
            const resumedExercise = day.exercises[resumeIndex];
            if (stored && stored.routineExerciseId === resumedExercise.id) {
              setRestTimer({
                routineExerciseId: stored.routineExerciseId,
                restSeconds: resumedExercise.restSeconds ?? 0,
                instanceId: stored.instanceId,
              });
            } else if (stored) {
              clearStoredRestTimer(workoutResult.workoutLogId);
            }
          }
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

  // A5 — reescrito desde cero (jul-2026, 3er intento, arquitectura nueva a
  // pedido): las sugerencias ahora se fetchean en SU PROPIO efecto,
  // desacoplado por completo del efecto de arriba (que resuelve el
  // workout en curso) — antes viajaban juntas en el mismo Promise.all, así
  // que una tardaba lo que tardara la más lenta de las dos. Server action
  // dedicada (getWorkoutSuggestions en actions.ts): para cada ejercicio de
  // la rutina, busca el récord (mayor peso, empate -> más reps) de la
  // semana calendario anterior (lunes a domingo), no de "la última sesión"
  // como antes. Se descarta por completo la lógica vieja de
  // resumeKey/seenResumeKey.
  useEffect(() => {
    let cancelled = false;
    actions.getWorkoutSuggestions(day.exercises.map((ex) => ex.id)).then((result) => {
      if (!cancelled) {
        setSuggestions(result);
        setSuggestionsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Temporizador de descanso — sonido: Safari iOS exige que el
  // AudioContext se CREE (no solo se use) dentro de un gesto real del
  // usuario, o queda mudo para siempre. Por eso no se crea al montar el
  // componente — se crea recién en el primer toque acá adentro, con un
  // listener que se saca solo apenas dispara una vez.
  useEffect(() => {
    function unlockAudio() {
      if (!audioCtxRef.current) {
        const AudioContextCtor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextCtor) {
          try {
            audioCtxRef.current = new AudioContextCtor();
          } catch (err) {
            console.error("AudioContext init error:", err);
          }
        }
      } else {
        audioCtxRef.current.resume?.().catch(() => {});
      }
    }
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => document.removeEventListener("pointerdown", unlockAudio);
  }, []);

  const exercise = day.exercises[exerciseIndex];
  const isLastExercise = exerciseIndex === day.exercises.length - 1;
  const currentSets = setsByExercise[exercise?.id ?? ""] ?? [];
  const nextSetNumber = currentSets.length + 1;
  // Banner de calentamiento (ago-2026): solo para el primer ejercicio del
  // día, antes de cargar su primera serie, y solo si el coach le configuró
  // un tipo de calentamiento a ese ejercicio puntual.
  const showWarmupBanner =
    !initializing &&
    suggestionsLoaded &&
    !warmupBannerDismissed &&
    exerciseIndex === 0 &&
    currentSets.length === 0 &&
    !!exercise &&
    exercise.warmupType !== "none";
  // Bug jul-2026: cuántos ejercicios tienen menos series cargadas que las
  // planificadas — la base para la confirmación antes de finalizar.
  const incompleteExerciseCount = day.exercises.filter(
    (ex) => (setsByExercise[ex.id]?.length ?? 0) < ex.sets
  ).length;

  // Aplica la sugerencia a los campos editables cuando cambia el ejercicio,
  // el número de serie, O cuando "suggestions" termina de cargar — las tres
  // cosas están en el array de dependencias, así que este efecto se
  // reejecuta apenas llegan los datos reales aunque el ejercicio/serie no
  // hayan cambiado (a diferencia de comparar una key manual, que solo
  // reacciona a cambios de ejercicio/serie y nunca a que lleguen los
  // datos). "index === 0" del pedido original equivale a nextSetNumber===1
  // acá (todavía no hay ninguna serie cargada para este ejercicio).
  useEffect(() => {
    if (!exercise) return;
    const prev = nextSetNumber === 1 ? suggestions[exercise.id] : undefined;
    const nextWeight = prev?.weight != null ? String(prev.weight) : "";
    const nextReps = prev?.reps != null ? String(prev.reps) : "";
    const nextRir = prev?.rir != null ? String(prev.rir) : "";
    setWeight(nextWeight);
    setReps(nextReps);
    setRir(nextRir);
    setSuggested({
      weight: prev?.weight != null,
      reps: prev?.reps != null,
      rir: prev?.rir != null,
    });
    setSuggestionCase(prev?.progressionCase ?? null);
    setSuggestionWeeksAgo(prev?.weeksAgo ?? null);
    setError(null);
  }, [exercise?.id, nextSetNumber, suggestions]);

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

  // Temporizador de descanso: se llama SOLO desde la navegación manual
  // entre ejercicios (botones "Anterior"/"Siguiente ejercicio"), nunca
  // desde el avance automático que hace handleCompleteSet al completar la
  // última serie de un ejercicio — ese avance no debe cortar un descanso
  // que recién arrancó, el cliente igual necesita descansar antes de la
  // primera serie del ejercicio siguiente.
  function clearRestTimer() {
    if (workoutLogId) clearStoredRestTimer(workoutLogId);
    setRestTimer(null);
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
      weightKg: parseDecimalInput(weight),
      reps: reps ? Number(reps) : null,
      rir: rir ? Number(rir) : null,
    };

    // Récord vs la semana pasada (no vs el récord all-time del badge por
    // serie, que es un concepto aparte — ver checkPersonalRecord en
    // actions.ts, sin tocar). Se compara contra previousRecord, ya
    // disponible en "suggestions" desde que se cargó el ejercicio, así que
    // no hace falta ninguna consulta extra ni esperar la respuesta del
    // servidor.
    const previousRecord = suggestions[exercise.id]?.previousRecord ?? null;
    const weeklyRecord = detectWeeklyRecord(previousRecord, {
      weight: input.weightKg,
      reps: input.reps,
      rir: input.rir,
    });
    if (weeklyRecord && input.weightKg != null) {
      const record: SessionRecord = {
        id: crypto.randomUUID(),
        exerciseId: exercise.id,
        exerciseName: exercise.exerciseName,
        weight: input.weightKg,
        reps: input.reps,
        rir: input.rir,
        ...weeklyRecord,
      };
      setSessionRecords((prev) => [...prev, record]);
      setCelebrationQueue((prev) => [...prev, record]);
    }

    navigator.vibrate?.(50);

    // Temporizador de descanso: arranca con el rest_seconds del ejercicio
    // que se acaba de completar (no del que venga después). Si no tiene
    // descanso configurado (0 o null) o el cliente lo desactivó en su
    // perfil, no arranca — instanceId nuevo en cada serie para que
    // RestTimerBar sepa que es un período de descanso distinto y no algo
    // para resumir desde localStorage.
    if (restTimerPrefs.enabled && exercise.restSeconds && exercise.restSeconds > 0) {
      setRestTimer({
        routineExerciseId: exercise.id,
        restSeconds: exercise.restSeconds,
        instanceId: crypto.randomUUID(),
      });
    } else {
      clearRestTimer();
    }

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
      const result = await actions.addSet(input);
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
      if (enableOfflineSync) {
        // Sin conexión: se guarda localmente y se sincroniza solo al
        // reconectar (ver components/client/sync-banner.tsx), sin perder
        // el progreso cargado.
        await savePendingSet(input);
      } else {
        // El coach (entrenamiento propio) no tiene sync offline — se saca
        // la serie optimista en vez de dejarla como "guardando..." para
        // siempre, y se avisa para que reintente.
        setSetsByExercise((prevState) => ({
          ...prevState,
          [exercise.id]: (prevState[exercise.id] ?? []).filter((s) => s.id !== tempId),
        }));
        setError("No se pudo guardar la serie. Revisá tu conexión y reintentá.");
      }
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
    const result = await actions.updateSet(editingSetId, {
      weightKg: parseDecimalInput(editValues.weight),
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

  // Bug jul-2026: tocar "Finalizar" con ejercicios incompletos ya no
  // finaliza directo — si falta algo, arma la confirmación inline (mismo
  // patrón que DeleteClientButton) en vez de disparar handleFinish.
  function requestFinish() {
    if (incompleteExerciseCount > 0) {
      setConfirmingFinish(true);
      return;
    }
    handleFinish();
  }

  // Bug jul-2026: desde el resumen (energía + notas) no había forma de
  // volver a completar un ejercicio salteado. jumpToFirstIncomplete=true
  // (desde "Seguir entrenando" en la confirmación) lleva directo al primer
  // ejercicio con series pendientes en vez de dejar al cliente en el
  // último ejercicio a ubicarse solo.
  function goBackToLogging(jumpToFirstIncomplete: boolean) {
    if (jumpToFirstIncomplete) {
      const idx = day.exercises.findIndex(
        (ex) => (setsByExercise[ex.id]?.length ?? 0) < ex.sets
      );
      if (idx !== -1) setExerciseIndex(idx);
    }
    setConfirmingFinish(false);
    setPhase("logging");
  }

  function handleFinish() {
    if (!workoutLogId) return;
    setError(null);
    setConfirmingFinish(false);
    clearRestTimer();
    startTransition(async () => {
      // Mismo patrón que el cuelgue de "Iniciar entrenamiento": sin este
      // try/catch, un rechazo de red acá dejaba el botón trabado en
      // "Guardando..." para siempre (useTransition no resetea "pending"
      // solo si la transición nunca actualiza estado).
      try {
        const result = await actions.finishWorkout({ workoutLogId, energyLevel, notes });
        if ("error" in result) {
          setError(result.error);
          return;
        }
        navigator.vibrate?.([30, 40, 30, 40, 60]);
        setWorkoutSummary(result.summary);
        setWeeklyCelebration(result.weeklyCelebration ?? null);
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

  // Momento 1 del sistema de celebración de récords: un banner a la vez,
  // se renderiza como último hijo de la pantalla que corresponda (es
  // position:fixed, así que no depende de dónde quede en el árbol) — así
  // sobrevive a los distintos "phase" sin duplicar lógica de cola en cada
  // return.
  const activeRecordCelebration = celebrationQueue[0] ?? null;
  const recordBanner = activeRecordCelebration ? (
    <RecordCelebrationBanner
      record={activeRecordCelebration}
      onDismiss={() => setCelebrationQueue((q) => q.slice(1))}
    />
  ) : null;
  const sessionSummaryRecords = summarizeSessionRecords(sessionRecords);

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goBackToLogging(false)}
            aria-label="Volver al entrenamiento"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#888888] transition-transform active:scale-90"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
            Resumen del entrenamiento
          </h1>
        </div>
        <p className="text-sm text-[#888888]">
          {day.name} — {incompleteExerciseCount > 0 ? "sin completar" : "completado"}
        </p>
        {incompleteExerciseCount > 0 && (
          <p className="-mt-3 text-sm text-amber-400">
            Te falta{incompleteExerciseCount === 1 ? "n series de 1 ejercicio" : `n series de ${incompleteExerciseCount} ejercicios`}.
          </p>
        )}

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

        {confirmingFinish ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4">
            <p className="text-sm text-white">
              Te queda{incompleteExerciseCount === 1 ? "" : "n"}{" "}
              {incompleteExerciseCount === 1
                ? "1 ejercicio sin completar"
                : `${incompleteExerciseCount} ejercicios sin completar`}
              . ¿Finalizar igual?
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="min-h-[44px] flex-1 text-sm"
                onClick={() => goBackToLogging(true)}
                disabled={pending}
              >
                Seguir entrenando
              </Button>
              <Button
                className="min-h-[44px] flex-1 text-sm"
                onClick={handleFinish}
                disabled={pending}
              >
                {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
                {pending ? "Guardando..." : "Finalizar"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={requestFinish}
            disabled={pending}
            className="min-h-[52px] w-full text-base"
          >
            {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
            {pending ? "Guardando..." : "Finalizar entrenamiento"}
          </Button>
        )}
        {recordBanner}
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

        {sessionSummaryRecords.length > 0 && (
          <div className="flex w-full max-w-xs flex-col gap-2 rounded-2xl border border-[#e8001c]/30 bg-[#111111] p-4 text-left">
            <p className="font-display text-xl tracking-wide text-[#e8001c] uppercase">
              Tus récords de hoy
            </p>
            <ul className="flex flex-col gap-1.5">
              {sessionSummaryRecords.map((record) => (
                <li key={record.id} className="flex items-center gap-2 text-sm text-[#f5f5f5]">
                  <Trophy className="size-3.5 shrink-0 text-[#e8001c]" />
                  {recordSummaryLine(record)}
                </li>
              ))}
            </ul>
            <p className="text-xs text-[#888888]">
              {recordSummaryMessage(sessionSummaryRecords.length)}
            </p>
          </div>
        )}

        <Button
          onClick={() =>
            weeklyCelebration
              ? setShowWeeklyCelebration(true)
              : router.push("/client/progress")
          }
          className="min-h-[52px] w-full max-w-xs text-base"
        >
          Continuar
        </Button>
        {recordBanner}
        {showWeeklyCelebration && weeklyCelebration && (
          <WeeklyCelebration
            summary={weeklyCelebration}
            onClose={() => router.push("/client/my-routine")}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${restTimer ? "pb-24" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#888888]">
          Ejercicio {exerciseIndex + 1} de {day.exercises.length}
        </p>
        <p className="text-sm text-[#888888]">{day.name}</p>
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          {exercise.exerciseName}
        </h1>

        {/* Bloque de lectura rápida (ago-2026): antes era una sola línea de
            texto chico ("Objetivo: 3 series · 8-10 reps · RIR 3"), ilegible
            con el teléfono apoyado a media distancia mientras se entrena.
            Mismo tratamiento "número protagonista" que el resto de la app
            (Bebas Neue grande + label chico debajo) — se lee de un vistazo. */}
        <div className="flex gap-2">
          {[
            { label: "Series", value: String(exercise.sets) },
            ...(repsRangeLabel(exercise.repsMin, exercise.repsMax)
              ? [{ label: "Reps", value: repsRangeLabel(exercise.repsMin, exercise.repsMax)! }]
              : []),
            ...(exercise.rirTarget != null
              ? [{ label: "RIR", value: String(exercise.rirTarget) }]
              : []),
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-1 flex-col items-center rounded-xl bg-white/5 py-2.5"
            >
              <p className="font-display text-4xl leading-none text-[#e8001c]">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-medium tracking-wide text-[#888888] uppercase">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {exercise.coachNotes && (
          <p className="text-sm text-[#888888] italic">
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
                    type="text"
                    inputMode="decimal"
                    value={editValues.weight}
                    onChange={(e) =>
                      setEditValues((v) => ({
                        ...v,
                        weight: sanitizeDecimalInput(e.target.value),
                      }))
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
            type="text"
            inputMode="decimal"
            value={weight}
            onChange={(e) => {
              setWeight(sanitizeDecimalInput(e.target.value));
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
          <Check className="size-3" />
          {suggestionWeeksAgo != null && suggestionWeeksAgo >= 2
            ? // Bug jul-2026: dato de referencia no fresco (2+ semanas) — hay
              // que avisar explícitamente para que no se lea como "esta
              // semana", sea cual sea el progressionCase.
              `Tu última vez con este ejercicio, hace ${suggestionWeeksAgo} semanas — podés editarlo`
            : suggestionCase === "weight_increase"
              ? "Subiste el peso esta semana 💪 podés editarlo"
              : suggestionCase === "reps_increase"
                ? "Una rep más que la semana pasada 🎯 podés editarlo"
                : "Sugerido según tu última vez — podés editarlo"}
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
            onClick={() => {
              clearRestTimer();
              goBackExercise();
            }}
            className="min-h-[52px] flex-1 text-base"
          >
            Anterior
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            clearRestTimer();
            goNext();
          }}
          className="min-h-[52px] flex-1 text-base"
        >
          {isLastExercise ? "Terminar ejercicios" : "Siguiente ejercicio"}
        </Button>
      </div>
      {recordBanner}
      {phase === "logging" && restTimer && workoutLogId && (
        <RestTimerBar
          key={restTimer.instanceId}
          workoutLogId={workoutLogId}
          routineExerciseId={restTimer.routineExerciseId}
          restSeconds={restTimer.restSeconds}
          instanceId={restTimer.instanceId}
          soundEnabled={restTimerPrefs.sound}
          vibrationEnabled={restTimerPrefs.vibration}
          audioCtxRef={audioCtxRef}
          onHide={clearRestTimer}
        />
      )}
      {showWarmupBanner && (
        <WarmupBanner
          exerciseName={exercise.exerciseName}
          warmupType={exercise.warmupType}
          warmupFixedWeightKg={exercise.warmupFixedWeightKg}
          suggestedWeightKg={suggestions[exercise.id]?.weight ?? null}
          onClose={() => setWarmupBannerDismissed(true)}
        />
      )}
    </div>
  );
}
