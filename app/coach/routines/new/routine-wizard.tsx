"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkCheck, BookmarkPlus, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { FadeIn } from "@/components/motion/fade-in";
import { PlannedMetricsPanel } from "@/components/coach/planned-metrics-panel";
import { PrescriptionFields } from "@/components/coach/prescription-fields";
import { DEFAULT_TRACKING } from "@/lib/constants/tracking";
import { exercisePayloadFromValues, missingPrescription } from "@/lib/utils/prescription";
import type { ClientOption, ExerciseOption, RoutineDetail } from "@/lib/supabase/routines";
import { minutesInputToSeconds, secondsToMinutesInput } from "@/lib/utils/rest-time";
import { createRoutine, type RoutineDayInput, type WarmupType } from "../actions";
import { createTemplate } from "../template-actions";
import type { TemplateListItem } from "@/lib/supabase/routine-templates";
import { todayInParaguay } from "@/lib/utils/today";
import {
  clearRoutineDraft,
  readRoutineDraft,
  writeRoutineDraft,
} from "@/lib/utils/routine-draft-storage";

type ExerciseRow = {
  key: string;
  exerciseId: string;
  // Solo UI: qué grupo muscular está eligiendo en el paso 1 del selector
  // encadenado. No se guarda en la base — el grupo real del ejercicio ya
  // vive en exercises.muscle_group, esto es nada más para filtrar el
  // segundo dropdown.
  muscleGroup: string;
  sets: string;
  repsMin: string;
  repsMax: string;
  rir: string;
  restSeconds: string;
  notes: string;
  weightIncrement: string;
  warmupType: WarmupType;
  warmupFixedWeight: string;
  // Tipos de registro (oct-2026). Opcionales: los borradores guardados
  // antes no los tienen.
  secondsMin?: string;
  secondsMax?: string;
  minutesTarget?: string;
  intensityTarget?: string;
};

type DayRow = {
  key: string;
  name: string;
  exercises: ExerciseRow[];
};

// Banner de calentamiento (ago-2026): solo el primer ejercicio del día
// arranca con calentamiento activo por defecto — el coach lo puede cambiar
// después, no es una restricción, solo el default más útil (es el único
// ejercicio para el que el banner llega a mostrarse).
function newExerciseRow(isFirstOfDay: boolean): ExerciseRow {
  return {
    key: crypto.randomUUID(),
    exerciseId: "",
    muscleGroup: "",
    sets: "",
    repsMin: "",
    repsMax: "",
    rir: "",
    restSeconds: "",
    notes: "",
    weightIncrement: "2.5",
    warmupType: isFirstOfDay ? "percentage_with_kg" : "none",
    warmupFixedWeight: "",
    secondsMin: "",
    secondsMax: "",
    minutesTarget: "",
    intensityTarget: "",
  };
}

function newDayRow(index: number): DayRow {
  return { key: crypto.randomUUID(), name: `Día ${index}`, exercises: [] };
}

// Copiar rutina / plantillas (oct-2026): carga los días y ejercicios de una
// rutina existente en el estado del wizard — solo se LEE la rutina de
// origen, al crear se inserta una fila nueva con createRoutine, así que
// cualquier cambio acá no la toca. Ejercicios borrados de la biblioteca
// (exercise_id null por ON DELETE SET NULL) se saltean y se cuentan para
// avisarle al coach.
function daysFromSource(
  source: RoutineDetail,
  exercises: ExerciseOption[]
): { days: DayRow[]; skipped: number } {
  let skipped = 0;
  const days = source.days.map((d) => ({
    key: crypto.randomUUID(),
    name: d.name,
    exercises: d.exercises
      .filter((ex) => {
        const exists = !!ex.exerciseId && exercises.some((opt) => opt.id === ex.exerciseId);
        if (!exists) skipped++;
        return exists;
      })
      .map((ex) => ({
        key: crypto.randomUUID(),
        exerciseId: ex.exerciseId,
        muscleGroup: exercises.find((opt) => opt.id === ex.exerciseId)?.muscleGroup ?? "",
        sets: String(ex.sets),
        repsMin: ex.repsMin != null ? String(ex.repsMin) : "",
        repsMax: ex.repsMax != null ? String(ex.repsMax) : "",
        rir: ex.rirTarget != null ? String(ex.rirTarget) : "",
        restSeconds: secondsToMinutesInput(ex.restSeconds),
        notes: ex.notes ?? "",
        weightIncrement: String(ex.weightIncrement),
        warmupType: ex.warmupType,
        warmupFixedWeight:
          ex.warmupFixedWeightKg != null ? String(ex.warmupFixedWeightKg) : "",
        secondsMin: ex.secondsMin != null ? String(ex.secondsMin) : "",
        secondsMax: ex.secondsMax != null ? String(ex.secondsMax) : "",
        minutesTarget: ex.minutesTarget != null ? String(ex.minutesTarget) : "",
        intensityTarget: ex.intensityTarget != null ? String(ex.intensityTarget) : "",
      })),
  }));
  return { days, skipped };
}

// Autoguardado (oct-2026): todo el estado editable del wizard — paso 1,
// días y ejercicios con su configuración completa (DayRow ya la tiene).
// `version` para poder descartar borradores de un formato viejo si algún
// día cambia la forma de DayRow.
type WizardDraft = {
  version: 1;
  savedAt: number;
  step: 1 | 2 | 3;
  name: string;
  description: string;
  objective: string;
  clientId: string;
  mesocicloNombre: string;
  durationWeeks: string;
  startsAt: string;
  days: DayRow[];
};

function parseDraft(value: unknown): WizardDraft | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Partial<WizardDraft>;
  if (d.version !== 1 || !Array.isArray(d.days) || typeof d.name !== "string") return null;
  return d as WizardDraft;
}

// Un wizard recién abierto (vacío, o con un día vacío) no cuenta como
// borrador — si no, abrir y cerrar "Nueva rutina" dejaría un aviso de
// borrador sin nada adentro.
function draftHasContent(d: Omit<WizardDraft, "version" | "savedAt" | "step">): boolean {
  return (
    d.name.trim() !== "" ||
    d.description.trim() !== "" ||
    d.objective.trim() !== "" ||
    d.mesocicloNombre.trim() !== "" ||
    d.days.length > 1 ||
    d.days.some((day) => day.exercises.length > 0)
  );
}

const DRAFT_SAVE_DEBOUNCE_MS = 400;

export function RoutineWizard({
  coachId,
  clients,
  exercises,
  initialClientId = "",
  source = null,
  templates = [],
}: {
  coachId: string;
  clients: ClientOption[];
  exercises: ExerciseOption[];
  initialClientId?: string;
  source?: RoutineDetail | null;
  templates?: TemplateListItem[];
}) {
  const router = useRouter();
  // Plantillas (oct-2026): paso 0 "¿Desde cero o desde una plantilla?" —
  // solo si hay plantillas y no se llegó ya con una rutina de origen.
  const [step, setStep] = useState<0 | 1 | 2 | 3>(
    !source && templates.length > 0 ? 0 : 1
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Sistema de mesociclos (jul-2026): si el cliente elegido ya tiene una
  // rutina activa, crear la nueva la va a archivar automáticamente
  // (ver createRoutine) — se avisa antes de mandar el submit real, mismo
  // patrón visual que DeleteRoutineButton/DeleteClientButton.
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  // Selector encadenado (paso 6): grupo muscular primero, después el
  // ejercicio filtrado por ese grupo — antes era un solo dropdown con los
  // ~100 ejercicios juntos, difícil de recorrer.
  const muscleGroups = Array.from(
    new Set(exercises.map((e) => e.muscleGroup).filter((g): g is string => !!g))
  ).sort((a, b) => a.localeCompare(b));

  const [initialFromSource] = useState(() =>
    source ? daysFromSource(source, exercises) : { days: [], skipped: 0 }
  );
  // Al usar una plantilla creada con "Guardar como plantilla" se saca el
  // sufijo que le agrega copyRoutineAsTemplate.
  const [name, setName] = useState(
    source ? (source.isTemplate ? source.name.replace(/ \(plantilla\)$/, "") : source.name) : ""
  );
  const [description, setDescription] = useState(source?.description ?? "");
  const [objective, setObjective] = useState(source?.objective ?? "");
  const [clientId, setClientId] = useState(
    clients.some((c) => c.id === initialClientId) ? initialClientId : ""
  );
  const [mesocicloNombre, setMesocicloNombre] = useState(source?.mesocicloNombre ?? "");
  const [durationWeeks, setDurationWeeks] = useState(
    source?.durationWeeks ? String(source.durationWeeks) : "4"
  );
  const [startsAt, setStartsAt] = useState(() => todayInParaguay());
  const [days, setDays] = useState<DayRow[]>(initialFromSource.days);

  // Autoguardado (oct-2026). `draftOffer` = borrador encontrado al abrir,
  // esperando "Continuar"/"Descartar" — mientras el aviso está a la vista
  // NO se autoguarda, para no pisar ese borrador con el wizard nuevo.
  // `draftChecked` evita autoguardar antes de haber mirado si había uno.
  const [draftOffer, setDraftOffer] = useState<WizardDraft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // Una vez guardada la rutina (o cancelado el wizard) ya no se autoguarda,
  // aunque quede un guardado pendiente del debounce.
  const draftClosedRef = useRef(false);

  useEffect(() => {
    // localStorage solo existe en el navegador: se lee después de hidratar
    // (leerlo en el primer render rompería la hidratación del HTML del
    // servidor). setState acá es justamente sincronizar con ese sistema
    // externo.
    const draft = parseDraft(readRoutineDraft(coachId));
    /* eslint-disable react-hooks/set-state-in-effect */
    if (draft && draftHasContent(draft)) setDraftOffer(draft);
    setDraftChecked(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [coachId]);

  useEffect(() => {
    if (!draftChecked || draftOffer || draftClosedRef.current) return;
    const snapshot = {
      name,
      description,
      objective,
      clientId,
      mesocicloNombre,
      durationWeeks,
      startsAt,
      days,
    };
    if (!draftHasContent(snapshot)) return;
    const timer = setTimeout(() => {
      if (draftClosedRef.current) return;
      writeRoutineDraft(coachId, {
        ...snapshot,
        version: 1,
        savedAt: Date.now(),
        step: step === 0 ? 1 : step,
      } satisfies WizardDraft);
    }, DRAFT_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    coachId,
    draftChecked,
    draftOffer,
    step,
    name,
    description,
    objective,
    clientId,
    mesocicloNombre,
    durationWeeks,
    startsAt,
    days,
  ]);

  function continueDraft() {
    if (!draftOffer) return;
    setName(draftOffer.name);
    setDescription(draftOffer.description);
    setObjective(draftOffer.objective);
    setClientId(clients.some((c) => c.id === draftOffer.clientId) ? draftOffer.clientId : "");
    setMesocicloNombre(draftOffer.mesocicloNombre);
    setDurationWeeks(draftOffer.durationWeeks);
    setStartsAt(draftOffer.startsAt || todayInParaguay());
    setDays(draftOffer.days);
    setStep(draftOffer.step);
    setConfirmingArchive(false);
    setError(null);
    setDraftOffer(null);
  }

  function discardDraft() {
    clearRoutineDraft(coachId);
    setDraftOffer(null);
  }

  // Cerrar el borrador para siempre: al guardar con éxito o al cancelar.
  function closeDraft() {
    draftClosedRef.current = true;
    clearRoutineDraft(coachId);
  }

  function cancelWizard() {
    closeDraft();
    router.push("/coach/routines");
  }

  function pickTemplate(templateId: string) {
    router.push(
      `/coach/routines/new?from=${templateId}${clientId ? `&client=${clientId}` : ""}`
    );
  }

  // Cliente y mesociclo se exigen recién al asignar (handleSubmit): para
  // "Guardar como plantilla" no hacen falta.
  function goToStep2() {
    if (!name.trim()) return setError("El nombre es obligatorio.");
    setError(null);
    setDays((prev) => (prev.length === 0 ? [newDayRow(1)] : prev));
    setStep(2);
  }

  function goToStep3() {
    if (days.length === 0) return setError("Agrega al menos un día.");
    if (days.some((d) => !d.name.trim()))
      return setError("Todos los días necesitan un nombre.");
    setError(null);
    setStep(3);
  }

  function addDay() {
    setDays((prev) => [...prev, newDayRow(prev.length + 1)]);
  }

  function removeDay(key: string) {
    setDays((prev) => prev.filter((d) => d.key !== key));
  }

  function updateDayName(key: string, value: string) {
    setDays((prev) =>
      prev.map((d) => (d.key === key ? { ...d, name: value } : d))
    );
  }

  function addExercise(dayKey: string) {
    setDays((prev) =>
      prev.map((d) =>
        d.key === dayKey
          ? { ...d, exercises: [...d.exercises, newExerciseRow(d.exercises.length === 0)] }
          : d
      )
    );
  }

  function removeExercise(dayKey: string, exerciseKey: string) {
    setDays((prev) =>
      prev.map((d) =>
        d.key === dayKey
          ? { ...d, exercises: d.exercises.filter((e) => e.key !== exerciseKey) }
          : d
      )
    );
  }

  // Tipo de registro del ejercicio elegido (sin ejercicio todavía: peso + reps).
  function trackingOf(exerciseId: string) {
    return exercises.find((opt) => opt.id === exerciseId)?.tracking ?? DEFAULT_TRACKING;
  }

  function updateExercise(
    dayKey: string,
    exerciseKey: string,
    patch: Partial<ExerciseRow>
  ) {
    setDays((prev) =>
      prev.map((d) =>
        d.key === dayKey
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.key === exerciseKey ? { ...e, ...patch } : e
              ),
            }
          : d
      )
    );
  }

  function exercisesAreValid(): boolean {
    for (const day of days) {
      for (const ex of day.exercises) {
        if (!ex.exerciseId) {
          setError(`Elige un ejercicio en "${day.name}".`);
          return false;
        }
        const missing = missingPrescription(
          {
            ...ex,
            secondsMin: ex.secondsMin ?? "",
            secondsMax: ex.secondsMax ?? "",
            minutesTarget: ex.minutesTarget ?? "",
            intensityTarget: ex.intensityTarget ?? "",
          },
          trackingOf(ex.exerciseId)
        );
        if (missing) {
          setError(`Falta "${missing}" en un ejercicio de "${day.name}".`);
          return false;
        }
      }
    }
    return true;
  }

  function daysPayload(): RoutineDayInput[] {
    return days.map((d) => ({
      name: d.name,
      exercises: d.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        notes: e.notes || null,
        ...exercisePayloadFromValues(e, trackingOf(e.exerciseId), minutesInputToSeconds),
      })),
    }));
  }

  function handleSaveTemplate() {
    if (!exercisesAreValid()) return;
    setError(null);
    setConfirmingArchive(false);
    startTransition(async () => {
      const result = await createTemplate({
        name,
        description,
        objective,
        durationWeeks: Number(durationWeeks) || 4,
        days: daysPayload(),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      closeDraft();
      router.push(`/coach/routines/${result.id}`);
    });
  }

  function handleSubmit() {
    if (!exercisesAreValid()) return;
    if (!clientId)
      return setError('Elegí un cliente en el Paso 1, o usá "Guardar como plantilla".');
    if (!mesocicloNombre.trim())
      return setError("Completá el nombre del mesociclo en el Paso 1.");
    setError(null);

    // El cliente elegido ya tiene una rutina activa -> createRoutine la va
    // a archivar automáticamente. Se avisa una vez antes de mandar el
    // submit real (mismo patrón que Eliminar rutina/cliente).
    const selectedClient = clients.find((c) => c.id === clientId);
    if (selectedClient?.hasActiveRoutine && !confirmingArchive) {
      setConfirmingArchive(true);
      return;
    }

    startTransition(async () => {
      const result = await createRoutine({
        name,
        description,
        objective,
        clientId,
        mesocicloNombre,
        durationWeeks: Number(durationWeeks) || 4,
        startsAt,
        days: daysPayload(),
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      closeDraft();
      router.push(`/coach/routines/${result.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {draftOffer && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-[#f5f5f5]">
            Tenés un borrador sin terminar
            {draftOffer.name.trim() ? (
              <>
                {" "}
                (<span className="font-medium">{draftOffer.name.trim()}</span>)
              </>
            ) : null}
            . ¿Continuarlo?
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-10" onClick={discardDraft}>
              Descartar
            </Button>
            <Button size="sm" className="h-10" onClick={continueDraft}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        {confirmingCancel ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[#888888]">¿Descartar lo cargado y salir?</span>
            <Button variant="outline" size="sm" onClick={() => setConfirmingCancel(false)}>
              Seguir editando
            </Button>
            <Button
              size="sm"
              className="bg-[#e8001c] hover:bg-[#b8001a]"
              onClick={cancelWizard}
            >
              Descartar y salir
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-[#888888]"
            onClick={() => setConfirmingCancel(true)}
            disabled={pending}
          >
            Cancelar
          </Button>
        )}
      </div>

      {step === 0 && (
        <FadeIn className="flex flex-col gap-3">
          <p className="text-sm text-[#888888]">¿Cómo querés empezar?</p>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4 text-left transition-colors hover:border-[#e8001c] active:scale-[0.99]"
          >
            <Plus className="size-5 shrink-0 text-[#e8001c]" />
            <span className="font-medium text-white">Desde cero</span>
          </button>
          <p className="mt-2 text-xs font-semibold tracking-wide text-[#888888] uppercase">
            Partir de una plantilla
          </p>
          <ul className="flex flex-col gap-2">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => pickTemplate(t.id)}
                  className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4 text-left transition-colors hover:border-[#e8001c] active:scale-[0.99]"
                >
                  <BookmarkCheck className="size-5 shrink-0 text-[#888888]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">{t.name}</span>
                    <span className="block text-xs text-[#888888]">
                      {t.dayCount} {t.dayCount === 1 ? "día" : "días"} · {t.exerciseCount}{" "}
                      {t.exerciseCount === 1 ? "ejercicio" : "ejercicios"}
                      {t.objective ? ` · ${t.objective}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </FadeIn>
      )}

      {step !== 0 && (
      <div className="flex gap-2 text-sm">
        {[1, 2, 3].map((s) => (
          <span
            key={s}
            className={`flex-1 rounded-full py-1.5 text-center font-display tracking-widest uppercase transition-colors ${
              step === s
                ? "bg-[#e8001c] text-white shadow-[0_0_12px_rgba(232,0,28,0.4)]"
                : "bg-white/5 text-[#888888]"
            }`}
          >
            Paso {s}
          </span>
        ))}
      </div>
      )}

      {source && (
        <div className="flex flex-col gap-1 rounded-2xl border border-[#1e1e1e] bg-white/5 p-3 text-sm">
          <p className="text-[#f5f5f5]">
            {source.isTemplate ? "Usando la plantilla " : "Copiando "}
            <span className="font-medium">{source.name}</span>
            {source.clientName ? ` de ${source.clientName}` : ""} — los cambios no
            modifican {source.isTemplate ? "la plantilla" : "la rutina original"}.
          </p>
          {initialFromSource.skipped > 0 && (
            <p className="flex items-center gap-2 text-amber-400">
              <TriangleAlert className="size-4 shrink-0" />
              {initialFromSource.skipped === 1
                ? "1 ejercicio ya no existe en tu biblioteca y no se copió."
                : `${initialFromSource.skipped} ejercicios ya no existen en tu biblioteca y no se copiaron.`}
            </p>
          )}
        </div>
      )}

      {step === 1 && (
        <FadeIn className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="routine-name">Nombre</Label>
            <Input
              id="routine-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="routine-description">Descripción</Label>
            <Textarea
              id="routine-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="routine-objective">Objetivo</Label>
            <Input
              id="routine-objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Ej: Hipertrofia, fuerza, pérdida de grasa"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="routine-client">
              Cliente{" "}
              <span className="font-normal text-[#888888]">
                (no hace falta si la guardás como plantilla)
              </span>
            </Label>
            <NativeSelect
              id="routine-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Sin cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="routine-mesociclo">Nombre del mesociclo</Label>
            <Input
              id="routine-mesociclo"
              value={mesocicloNombre}
              onChange={(e) => setMesocicloNombre(e.target.value)}
              placeholder="Ej: Mesociclo 1 - Hipertrofia"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="routine-duration">Duración (semanas)</Label>
              <Input
                id="routine-duration"
                type="number"
                min={1}
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="routine-starts-at">Fecha de inicio</Label>
              <Input
                id="routine-starts-at"
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={goToStep2} className="w-fit">
            Siguiente
          </Button>
        </FadeIn>
      )}

      {step === 2 && (
        <FadeIn className="flex flex-col gap-4">
          {days.map((day, index) => (
            <div
              key={day.key}
              className="flex items-center gap-3 rounded-2xl border border-[#1e1e1e] p-3 transition-colors duration-200 hover:border-[#e8001c]"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8001c] font-display text-sm text-white">
                {index + 1}
              </span>
              <Input
                value={day.name}
                onChange={(e) => updateDayName(day.key, e.target.value)}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeDay(day.key)}
                aria-label="Eliminar día"
                className="flex size-8 items-center justify-center rounded-md text-[#888888] transition-transform active:scale-90 hover:bg-white/10 hover:text-white"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" onClick={addDay} className="w-fit">
            <Plus className="size-4" /> Agregar día
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              Atrás
            </Button>
            <Button onClick={goToStep3}>Siguiente</Button>
          </div>
        </FadeIn>
      )}

      {step === 3 && (
        <FadeIn className="flex flex-col gap-6">
          <PlannedMetricsPanel days={days} exercises={exercises} />
          {days.map((day) => (
            <div
              key={day.key}
              className="rounded-2xl border border-[#1e1e1e] p-4"
            >
              <h3 className="mb-3 font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
                {day.name}
              </h3>
              <div className="flex flex-col gap-3">
                {day.exercises.map((ex, exIndex) => (
                  <div
                    key={ex.key}
                    className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-3 sm:grid-cols-6"
                  >
                    <div className="col-span-2 sm:col-span-3">
                      <Label className="text-xs">Grupo muscular</Label>
                      <NativeSelect
                        value={ex.muscleGroup}
                        onChange={(e) =>
                          updateExercise(day.key, ex.key, {
                            muscleGroup: e.target.value,
                            exerciseId: "",
                          })
                        }
                      >
                        <option value="" disabled>
                          Elegir
                        </option>
                        {muscleGroups.map((group) => (
                          <option key={group} value={group}>
                            {group}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <Label className="text-xs">Ejercicio</Label>
                      <NativeSelect
                        value={ex.exerciseId}
                        disabled={!ex.muscleGroup}
                        onChange={(e) =>
                          updateExercise(day.key, ex.key, {
                            exerciseId: e.target.value,
                          })
                        }
                      >
                        <option value="" disabled>
                          Elegir
                        </option>
                        {exercises
                          .filter((opt) => opt.muscleGroup === ex.muscleGroup)
                          .map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                      </NativeSelect>
                    </div>
                    <PrescriptionFields
                      tracking={trackingOf(ex.exerciseId)}
                      values={ex}
                      onChange={(patch) => updateExercise(day.key, ex.key, patch)}
                      groupId={ex.key}
                      isFirstOfDay={exIndex === 0}
                    />
                    <div className="col-span-2 sm:col-span-5">
                      <Label className="text-xs">Notas</Label>
                      <Input
                        value={ex.notes}
                        onChange={(e) =>
                          updateExercise(day.key, ex.key, { notes: e.target.value })
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExercise(day.key, ex.key)}
                      aria-label="Eliminar ejercicio"
                      className="flex size-8 items-center justify-center self-end rounded-md text-[#888888] transition-transform active:scale-90 hover:bg-white/10 hover:text-white"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addExercise(day.key)}
                  className="w-fit"
                >
                  <Plus className="size-4" /> Agregar ejercicio
                </Button>
              </div>
            </div>
          ))}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {confirmingArchive ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#e8001c]/40 bg-[#e8001c]/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-400">
                <TriangleAlert className="size-4 shrink-0" />
                La rutina actual de{" "}
                {clients.find((c) => c.id === clientId)?.name ?? "este cliente"} se
                va a archivar. ¿Confirmás?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmingArchive(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-[#e8001c] hover:bg-[#b8001a]"
                  onClick={handleSubmit}
                  disabled={pending}
                >
                  {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
                  {pending ? "Creando..." : "Confirmar y crear"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setStep(2)} disabled={pending}>
                Atrás
              </Button>
              <Button variant="outline" onClick={handleSaveTemplate} disabled={pending}>
                <BookmarkPlus className="size-4" />
                Guardar como plantilla
              </Button>
              <Button onClick={handleSubmit} disabled={pending}>
                {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
                {pending
                  ? "Guardando..."
                  : clientId
                    ? `Asignar a ${clients.find((c) => c.id === clientId)?.name ?? "cliente"}`
                    : "Crear rutina"}
              </Button>
            </div>
          )}
        </FadeIn>
      )}
    </div>
  );
}
