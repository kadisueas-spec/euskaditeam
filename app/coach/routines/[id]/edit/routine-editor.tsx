"use client";

import { useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronDown, GripVertical, Plus, Save, Trash2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { FadeIn } from "@/components/motion/fade-in";
import { PlannedMetricsPanel } from "@/components/coach/planned-metrics-panel";
import { WarmupTypeSelector } from "@/components/coach/warmup-type-selector";
import type { ExerciseOption, RoutineDetail, WarmupType } from "@/lib/supabase/routines";
import { sanitizeDecimalInput } from "@/lib/utils/decimal-input";
import { minutesInputToSeconds, secondsToMinutesInput } from "@/lib/utils/rest-time";
import { updateRoutine } from "../../actions";
import { todayInParaguay } from "@/lib/utils/today";

type ExerciseRow = {
  key: string;
  id?: string;
  exerciseId: string;
  // Solo UI: qué grupo muscular está eligiendo en el paso 1 del selector
  // encadenado. No se guarda en la base.
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
};

type DayRow = {
  key: string;
  id?: string;
  name: string;
  exercises: ExerciseRow[];
};

// Mismo criterio que el wizard: el primer ejercicio de un día nuevo arranca
// con calentamiento activo por defecto.
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
  };
}

function newDayRow(index: number): DayRow {
  return { key: crypto.randomUUID(), name: `Día ${index}`, exercises: [] };
}

function daysFromRoutine(
  routine: RoutineDetail,
  exercises: ExerciseOption[]
): DayRow[] {
  return routine.days.map((d) => ({
    key: d.id,
    id: d.id,
    name: d.name,
    exercises: d.exercises.map((ex) => ({
      key: ex.id,
      id: ex.id,
      exerciseId: ex.exerciseId,
      muscleGroup:
        exercises.find((opt) => opt.id === ex.exerciseId)?.muscleGroup ?? "",
      sets: String(ex.sets),
      repsMin: ex.repsMin != null ? String(ex.repsMin) : "",
      repsMax: ex.repsMax != null ? String(ex.repsMax) : "",
      rir: ex.rirTarget != null ? String(ex.rirTarget) : "",
      restSeconds: secondsToMinutesInput(ex.restSeconds),
      notes: ex.notes ?? "",
      weightIncrement: String(ex.weightIncrement),
      warmupType: ex.warmupType,
      warmupFixedWeight: ex.warmupFixedWeightKg != null ? String(ex.warmupFixedWeightKg) : "",
    })),
  }));
}

export function RoutineEditor({
  routine,
  exercises,
}: {
  routine: RoutineDetail;
  exercises: ExerciseOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(routine.name);
  const [description, setDescription] = useState(routine.description ?? "");
  const [objective, setObjective] = useState(routine.objective ?? "");
  const [mesocicloNombre, setMesocicloNombre] = useState(routine.mesocicloNombre ?? "");
  const [durationWeeks, setDurationWeeks] = useState(
    routine.durationWeeks != null ? String(routine.durationWeeks) : "4"
  );
  const [startsAt, setStartsAt] = useState(
    routine.startsAt ?? todayInParaguay()
  );
  const [days, setDays] = useState<DayRow[]>(() =>
    daysFromRoutine(routine, exercises)
  );

  // Días minimizables (oct-2026): solo visual, no se guarda. Arranca con el
  // primer día abierto y el resto colapsados, para no scrollear hasta el
  // Día 4. Un día nuevo se agrega abierto.
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    () => new Set(days[0] ? [days[0].key] : [])
  );

  function toggleDay(key: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Drag & drop (oct-2026, @dnd-kit): días entre sí, ejercicios dentro de
  // un día y entre días. Siempre desde el ícono de agarre (touch-action:
  // none) — así el resto de la tarjeta scrollea normal con el dedo. Mouse y
  // touch por separado (no PointerSensor, que en iOS compite con el scroll):
  // en touch, un toque corto sostenido (120ms) arranca el arrastre.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [activeDrag, setActiveDrag] = useState<
    { type: "day"; key: string } | { type: "exercise"; key: string } | null
  >(null);
  const [overDayKey, setOverDayKey] = useState<string | null>(null);

  function dayKeyOfExercise(exKey: string, list = days): string | null {
    return list.find((d) => d.exercises.some((e) => e.key === exKey))?.key ?? null;
  }

  // Un día arrastrado solo choca con días; un ejercicio prefiere el
  // ejercicio bajo el dedo y, si no hay, el día (para soltarlo en un día
  // colapsado o vacío).
  const collisionDetection: CollisionDetection = (args) => {
    const byType = (type: "day" | "exercise") =>
      args.droppableContainers.filter((c) => c.data.current?.type === type);
    if (args.active.data.current?.type === "day") {
      return closestCenter({ ...args, droppableContainers: byType("day") });
    }
    const overExercise = pointerWithin({ ...args, droppableContainers: byType("exercise") });
    if (overExercise.length > 0) return overExercise;
    const overDay = pointerWithin({ ...args, droppableContainers: byType("day") });
    if (overDay.length > 0) return overDay;
    return closestCenter({ ...args, droppableContainers: byType("exercise") });
  };

  function handleDragStart({ active }: DragStartEvent) {
    const type = active.data.current?.type;
    if (type === "day" || type === "exercise") {
      setActiveDrag({ type, key: String(active.data.current?.key) });
    }
  }

  // Ejercicio sobre OTRO día abierto: se mueve en vivo (el resto se acomoda
  // mientras arrastra). Sobre un día colapsado no se mueve hasta soltar.
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || active.data.current?.type !== "exercise") {
      setOverDayKey(null);
      return;
    }
    const exKey = String(active.data.current?.key);
    const overType = over.data.current?.type;
    const toDayKey =
      overType === "day"
        ? String(over.data.current?.key)
        : dayKeyOfExercise(String(over.data.current?.key));
    setOverDayKey(toDayKey);
    const fromDayKey = dayKeyOfExercise(exKey);
    if (!toDayKey || !fromDayKey || toDayKey === fromDayKey) return;
    if (!expandedDays.has(toDayKey)) return;

    setDays((prev) => {
      const from = prev.find((d) => d.key === fromDayKey);
      const moving = from?.exercises.find((e) => e.key === exKey);
      if (!from || !moving) return prev;
      return prev.map((d) => {
        if (d.key === fromDayKey) {
          return { ...d, exercises: d.exercises.filter((e) => e.key !== exKey) };
        }
        if (d.key === toDayKey) {
          const overIndex =
            overType === "exercise"
              ? d.exercises.findIndex((e) => e.key === String(over.data.current?.key))
              : -1;
          const exercisesCopy = [...d.exercises];
          exercisesCopy.splice(overIndex >= 0 ? overIndex : exercisesCopy.length, 0, moving);
          return { ...d, exercises: exercisesCopy };
        }
        return d;
      });
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDrag(null);
    setOverDayKey(null);
    if (!over) return;
    const activeType = active.data.current?.type;
    const activeKey = String(active.data.current?.key);
    const overType = over.data.current?.type;
    const overKey = String(over.data.current?.key);

    if (activeType === "day" && overType === "day" && activeKey !== overKey) {
      setDays((prev) =>
        arrayMove(
          prev,
          prev.findIndex((d) => d.key === activeKey),
          prev.findIndex((d) => d.key === overKey)
        )
      );
      return;
    }

    if (activeType !== "exercise") return;
    const fromDayKey = dayKeyOfExercise(activeKey);
    if (!fromDayKey) return;

    // Soltado sobre un día (colapsado o vacío) distinto: va al final.
    if (overType === "day" && overKey !== fromDayKey) {
      setDays((prev) => {
        const moving = prev
          .find((d) => d.key === fromDayKey)
          ?.exercises.find((e) => e.key === activeKey);
        if (!moving) return prev;
        return prev.map((d) =>
          d.key === fromDayKey
            ? { ...d, exercises: d.exercises.filter((e) => e.key !== activeKey) }
            : d.key === overKey
              ? { ...d, exercises: [...d.exercises, moving] }
              : d
        );
      });
      return;
    }

    // Reordenar dentro del mismo día.
    if (overType === "exercise" && dayKeyOfExercise(overKey) === fromDayKey) {
      setDays((prev) =>
        prev.map((d) => {
          if (d.key !== fromDayKey) return d;
          const from = d.exercises.findIndex((e) => e.key === activeKey);
          const to = d.exercises.findIndex((e) => e.key === overKey);
          if (from < 0 || to < 0 || from === to) return d;
          return { ...d, exercises: arrayMove(d.exercises, from, to) };
        })
      );
    }
  }

  const activeDay =
    activeDrag?.type === "day" ? days.find((d) => d.key === activeDrag.key) : undefined;
  const activeExercise =
    activeDrag?.type === "exercise"
      ? days.flatMap((d) => d.exercises).find((e) => e.key === activeDrag.key)
      : undefined;

  // Selector encadenado (paso 6): grupo muscular primero, después el
  // ejercicio filtrado por ese grupo.
  const muscleGroups = Array.from(
    new Set(exercises.map((e) => e.muscleGroup).filter((g): g is string => !!g))
  ).sort((a, b) => a.localeCompare(b));

  function addDay() {
    const day = newDayRow(days.length + 1);
    setDays((prev) => [...prev, day]);
    setExpandedDays((prev) => new Set(prev).add(day.key));
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

  function handleSubmit() {
    if (!name.trim()) return setError("El nombre es obligatorio.");
    if (!routine.isTemplate && !mesocicloNombre.trim())
      return setError("El nombre del mesociclo es obligatorio.");
    if (days.length === 0) return setError("Agrega al menos un día.");
    if (days.some((d) => !d.name.trim()))
      return setError("Todos los días necesitan un nombre.");
    for (const day of days) {
      for (const ex of day.exercises) {
        if (!ex.exerciseId) {
          setError(`Elige un ejercicio en "${day.name}".`);
          return;
        }
        if (!ex.sets) {
          setError(`Falta "series" en un ejercicio de "${day.name}".`);
          return;
        }
      }
    }
    setError(null);

    startTransition(async () => {
      const result = await updateRoutine(routine.id, {
        name,
        description,
        objective,
        mesocicloNombre,
        durationWeeks: Number(durationWeeks) || 4,
        startsAt,
        days: days.map((d) => ({
          id: d.id,
          name: d.name,
          exercises: d.exercises.map((e) => ({
            id: e.id,
            exerciseId: e.exerciseId,
            sets: Number(e.sets),
            repsMin: e.repsMin ? Number(e.repsMin) : null,
            repsMax: e.repsMax ? Number(e.repsMax) : null,
            rir: e.rir ? Number(e.rir) : null,
            restSeconds: minutesInputToSeconds(e.restSeconds),
            notes: e.notes || null,
            weightIncrement: Number(e.weightIncrement) || 2.5,
            warmupType: e.warmupType,
            warmupFixedWeightKg:
              e.warmupType === "fixed_weight" && e.warmupFixedWeight
                ? Number(e.warmupFixedWeight)
                : null,
          })),
        })),
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      const target = `/coach/routines/${routine.id}`;
      router.push(
        result.warning ? `${target}?warning=${encodeURIComponent(result.warning)}` : target
      );
    });
  }

  // Campos de un ejercicio (selector encadenado, series/reps/RIR, descanso,
  // incremento, calentamiento, notas) — mismos que antes del drag & drop.
  function renderExerciseFields(dayKey: string, ex: ExerciseRow, exIndex: number) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <div className="col-span-2 sm:col-span-3">
          <Label className="text-xs">Grupo muscular</Label>
          <NativeSelect
            value={ex.muscleGroup}
            onChange={(e) =>
              updateExercise(dayKey, ex.key, {
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
              updateExercise(dayKey, ex.key, {
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
        <div>
          <Label className="text-xs">Series</Label>
          <Input
            type="number"
            min={1}
            value={ex.sets}
            onChange={(e) =>
              updateExercise(dayKey, ex.key, { sets: e.target.value })
            }
          />
        </div>
        <div>
          <Label className="text-xs">Reps mín</Label>
          <Input
            type="number"
            min={0}
            value={ex.repsMin}
            onChange={(e) =>
              updateExercise(dayKey, ex.key, { repsMin: e.target.value })
            }
          />
        </div>
        <div>
          <Label className="text-xs">Reps máx</Label>
          <Input
            type="number"
            min={0}
            value={ex.repsMax}
            onChange={(e) =>
              updateExercise(dayKey, ex.key, { repsMax: e.target.value })
            }
          />
        </div>
        <div>
          <Label className="text-xs">RIR</Label>
          <Input
            type="number"
            min={0}
            value={ex.rir}
            onChange={(e) =>
              updateExercise(dayKey, ex.key, { rir: e.target.value })
            }
          />
        </div>
        <div>
          <Label className="text-xs">Descanso (min)</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="1.5"
            value={ex.restSeconds}
            onChange={(e) =>
              updateExercise(dayKey, ex.key, {
                restSeconds: sanitizeDecimalInput(e.target.value),
              })
            }
          />
        </div>
        <div>
          <Label className="text-xs">Incremento (kg)</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="2.5"
            value={ex.weightIncrement}
            onChange={(e) =>
              updateExercise(dayKey, ex.key, {
                weightIncrement: sanitizeDecimalInput(e.target.value),
              })
            }
          />
        </div>
        <div className="col-span-2 sm:col-span-6">
          <WarmupTypeSelector
            groupId={ex.key}
            value={ex.warmupType}
            fixedWeightKg={ex.warmupFixedWeight}
            onChange={(warmupType) =>
              updateExercise(dayKey, ex.key, { warmupType })
            }
            onFixedWeightChange={(warmupFixedWeight) =>
              updateExercise(dayKey, ex.key, { warmupFixedWeight })
            }
            isFirstOfDay={exIndex === 0}
          />
        </div>
        <div className="col-span-2 sm:col-span-5">
          <Label className="text-xs">Notas</Label>
          <Input
            value={ex.notes}
            onChange={(e) =>
              updateExercise(dayKey, ex.key, { notes: e.target.value })
            }
          />
        </div>
        <button
          type="button"
          onClick={() => removeExercise(dayKey, ex.key)}
          aria-label="Eliminar ejercicio"
          className="flex size-8 items-center justify-center self-end rounded-md text-[#888888] transition-transform active:scale-90 hover:bg-white/10 hover:text-white"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Guardar también arriba (oct-2026): barra pegada al borde superior
          del área con scroll, visible sin bajar hasta el final. */}
      <div className="sticky top-0 z-30 -mx-6 flex flex-col gap-1 border-b border-[#1e1e1e] bg-[#080808]/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-[#888888]">
            {routine.isTemplate ? "Editando plantilla" : "Editando rutina"} ·{" "}
            <span className="text-[#f5f5f5]">{name || routine.name}</span>
          </p>
          <Button onClick={handleSubmit} disabled={pending} className="shrink-0">
            {pending ? (
              <Spinner size="sm" className="border-white/30 border-t-white" />
            ) : (
              <Save className="size-4" />
            )}
            {pending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
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
        {/* Plantillas (oct-2026): sin mesociclo ni fecha de inicio — eso se
            define al usarla para un cliente. La duración queda como sugerencia. */}
        {!routine.isTemplate && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="routine-mesociclo">Nombre del mesociclo</Label>
            <Input
              id="routine-mesociclo"
              value={mesocicloNombre}
              onChange={(e) => setMesocicloNombre(e.target.value)}
              placeholder="Ej: Mesociclo 1 - Hipertrofia"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="routine-duration">
              {routine.isTemplate ? "Duración sugerida (semanas)" : "Duración (semanas)"}
            </Label>
            <Input
              id="routine-duration"
              type="number"
              min={1}
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(e.target.value)}
            />
          </div>
          {!routine.isTemplate && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="routine-starts-at">Fecha de inicio</Label>
              <Input
                id="routine-starts-at"
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
          )}
        </div>
      </FadeIn>

      <FadeIn className="flex flex-col gap-6">
        <PlannedMetricsPanel days={days} exercises={exercises} />
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveDrag(null);
            setOverDayKey(null);
          }}
        >
          <SortableContext
            items={days.map((d) => `day:${d.key}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
              {days.map((day, index) => {
                const expanded = expandedDays.has(day.key);
                return (
                  <SortableDay
                    key={day.key}
                    dayKey={day.key}
                    highlight={
                      activeDrag?.type === "exercise" &&
                      overDayKey === day.key &&
                      dayKeyOfExercise(activeDrag.key) !== day.key
                    }
                  >
                    {({ handleProps }) => (
                      <>
                        {/* Encabezado: tocarlo colapsa/expande; el nombre,
                            el agarre y el tacho no. */}
                        <div
                          role="button"
                          tabIndex={0}
                          aria-expanded={expanded}
                          onClick={() => toggleDay(day.key)}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleDay(day.key);
                            }
                          }}
                          className="flex cursor-pointer items-center gap-2 p-3 select-none"
                        >
                          <DragHandle label={`Mover ${day.name}`} {...handleProps} />
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8001c] font-display text-sm text-white">
                            {index + 1}
                          </span>
                          <Input
                            value={day.name}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateDayName(day.key, e.target.value)}
                            className="min-w-0 flex-1"
                          />
                          {!expanded && (
                            <span className="hidden shrink-0 text-xs text-[#888888] sm:inline">
                              {day.exercises.length}{" "}
                              {day.exercises.length === 1 ? "ejercicio" : "ejercicios"}
                            </span>
                          )}
                          <ChevronDown
                            aria-hidden
                            className={`size-5 shrink-0 text-[#888888] transition-transform duration-200 ${
                              expanded ? "rotate-180" : ""
                            }`}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeDay(day.key);
                            }}
                            aria-label="Eliminar día"
                            className="flex size-9 shrink-0 items-center justify-center rounded-md text-[#888888] transition-transform active:scale-90 hover:bg-white/10 hover:text-white"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        {!expanded && (
                          <p className="-mt-1 px-3 pb-3 pl-[58px] text-xs text-[#888888] sm:hidden">
                            {day.exercises.length}{" "}
                            {day.exercises.length === 1 ? "ejercicio" : "ejercicios"}
                          </p>
                        )}

                        {expanded && (
                          <div className="flex flex-col gap-3 px-3 pb-4">
                            <SortableContext
                              items={day.exercises.map((ex) => `ex:${ex.key}`)}
                              strategy={verticalListSortingStrategy}
                            >
                              {day.exercises.map((ex, exIndex) => (
                                <SortableExercise key={ex.key} exKey={ex.key}>
                                  {({ handleProps: exHandleProps }) => (
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2">
                                        <DragHandle
                                          label="Mover ejercicio"
                                          {...exHandleProps}
                                        />
                                        <span className="truncate text-sm font-medium text-white">
                                          {exercises.find((o) => o.id === ex.exerciseId)?.name ??
                                            "Ejercicio nuevo"}
                                        </span>
                                      </div>
                                      {renderExerciseFields(day.key, ex, exIndex)}
                                    </div>
                                  )}
                                </SortableExercise>
                              ))}
                            </SortableContext>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addExercise(day.key)}
                              className="w-fit"
                            >
                              <Plus className="size-4" /> Agregar ejercicio
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </SortableDay>
                );
              })}
            </div>
          </SortableContext>

          {/* Vista previa que sigue al dedo. Portal a body: los FadeIn de
              arriba dejan un transform aplicado, y un position:fixed adentro
              de un ancestro con transform se ubica mal. Solo se monta
              mientras se arrastra (nunca en el render del servidor). */}
          {activeDrag &&
            createPortal(
              <DragOverlay dropAnimation={null}>
                {activeDay ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-[#e8001c] bg-[#111111] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
                    <GripVertical className="size-5 text-[#e8001c]" />
                    <span className="font-display text-xl tracking-wide text-white uppercase">
                      {activeDay.name}
                    </span>
                    <span className="ml-auto text-xs text-[#888888]">
                      {activeDay.exercises.length}{" "}
                      {activeDay.exercises.length === 1 ? "ejercicio" : "ejercicios"}
                    </span>
                  </div>
                ) : activeExercise ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-[#e8001c] bg-[#1a1a1a] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
                    <GripVertical className="size-5 text-[#e8001c]" />
                    <span className="text-sm font-medium text-white">
                      {exercises.find((o) => o.id === activeExercise.exerciseId)?.name ??
                        "Ejercicio nuevo"}
                    </span>
                    {activeExercise.sets && (
                      <span className="ml-auto text-xs text-[#888888]">
                        {activeExercise.sets} series
                      </span>
                    )}
                  </div>
                ) : null}
              </DragOverlay>,
              document.body
            )}
        </DndContext>

        <Button variant="outline" onClick={addDay} className="w-fit">
          <Plus className="size-4" /> Agregar día
        </Button>
      </FadeIn>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => router.push(`/coach/routines/${routine.id}`)}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
          {pending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}

type HandleProps = {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
};

// Ícono de agarre: el único lugar desde donde se arrastra. touch-action:
// none para que el navegador no lo tome como scroll en iPhone; el resto de
// la tarjeta scrollea normal. 44x44 (estándar Apple para el dedo).
function DragHandle({
  label,
  attributes,
  listeners,
  setActivatorNodeRef,
}: HandleProps & { label: string }) {
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-[#888888] transition-colors active:cursor-grabbing active:bg-white/10 active:text-[#e8001c]"
    >
      <GripVertical className="size-5" />
    </button>
  );
}

function SortableDay({
  dayKey,
  highlight,
  children,
}: {
  dayKey: string;
  // Un ejercicio arrastrado está sobre este día (se suelta al final).
  highlight: boolean;
  children: (args: { handleProps: HandleProps }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: `day:${dayKey}`, data: { type: "day", key: dayKey } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`rounded-2xl border bg-[#0d0d0d] transition-colors ${
        isDragging
          ? "border-dashed border-[#e8001c]/50 opacity-40"
          : highlight
            ? "border-[#e8001c] shadow-[0_0_18px_rgba(232,0,28,0.35)]"
            : "border-[#1e1e1e]"
      }`}
    >
      {children({ handleProps: { attributes, listeners, setActivatorNodeRef } })}
    </div>
  );
}

function SortableExercise({
  exKey,
  children,
}: {
  exKey: string;
  children: (args: { handleProps: HandleProps }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: `ex:${exKey}`, data: { type: "exercise", key: exKey } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`rounded-2xl p-3 ${
        isDragging ? "border border-dashed border-[#e8001c]/50 bg-white/[0.02] opacity-40" : "bg-white/5"
      }`}
    >
      {children({ handleProps: { attributes, listeners, setActivatorNodeRef } })}
    </div>
  );
}
