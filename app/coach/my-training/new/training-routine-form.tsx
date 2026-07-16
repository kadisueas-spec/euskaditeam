"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { FadeIn } from "@/components/motion/fade-in";
import { sanitizeDecimalInput } from "@/lib/utils/decimal-input";
import type { ExerciseOption } from "@/lib/supabase/routines";
import { createTrainingRoutine } from "../actions";

type ExerciseRow = {
  key: string;
  exerciseId: string;
  muscleGroup: string;
  sets: string;
  repsMin: string;
  repsMax: string;
  rir: string;
  restMinutes: string;
};

type DayRow = {
  key: string;
  name: string;
  exercises: ExerciseRow[];
};

function newExerciseRow(): ExerciseRow {
  return {
    key: crypto.randomUUID(),
    exerciseId: "",
    muscleGroup: "",
    sets: "3",
    repsMin: "",
    repsMax: "",
    rir: "",
    restMinutes: "",
  };
}

function newDayRow(index: number): DayRow {
  return { key: crypto.randomUUID(), name: `Día ${index}`, exercises: [] };
}

// Mismo selector encadenado (grupo muscular -> ejercicio) que ya usa el
// creador de rutinas de clientes, pero en una sola página — es para uso
// personal del coach, no hace falta el wizard de 3 pasos.
export function TrainingRoutineForm({ exercises }: { exercises: ExerciseOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const muscleGroups = Array.from(
    new Set(exercises.map((e) => e.muscleGroup).filter((g): g is string => !!g))
  ).sort((a, b) => a.localeCompare(b));

  const [name, setName] = useState("");
  const [days, setDays] = useState<DayRow[]>([newDayRow(1)]);

  function addDay() {
    setDays((prev) => [...prev, newDayRow(prev.length + 1)]);
  }

  function removeDay(key: string) {
    setDays((prev) => prev.filter((d) => d.key !== key));
  }

  function updateDayName(key: string, value: string) {
    setDays((prev) => prev.map((d) => (d.key === key ? { ...d, name: value } : d)));
  }

  function addExercise(dayKey: string) {
    setDays((prev) =>
      prev.map((d) =>
        d.key === dayKey ? { ...d, exercises: [...d.exercises, newExerciseRow()] } : d
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

  function updateExercise(dayKey: string, exerciseKey: string, patch: Partial<ExerciseRow>) {
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
    if (days.length === 0) return setError("Agregá al menos un día.");
    for (const day of days) {
      for (const ex of day.exercises) {
        if (!ex.exerciseId) return setError(`Elegí un ejercicio en "${day.name}".`);
        if (!ex.sets) return setError(`Falta "series" en un ejercicio de "${day.name}".`);
      }
    }
    setError(null);

    startTransition(async () => {
      const result = await createTrainingRoutine({
        name,
        days: days.map((d) => ({
          name: d.name,
          exercises: d.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: Number(e.sets),
            repsMin: e.repsMin ? Number(e.repsMin) : null,
            repsMax: e.repsMax ? Number(e.repsMax) : null,
            rir: e.rir ? Number(e.rir) : null,
            restMinutes: e.restMinutes,
            notes: null,
          })),
        })),
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      router.push("/coach/my-training");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="routine-name">Nombre de la rutina</Label>
        <Input
          id="routine-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mi mesociclo actual"
          className="h-11"
        />
      </div>

      {days.map((day) => (
        <FadeIn key={day.key} className="rounded-2xl border border-[#1e1e1e] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Input
              value={day.name}
              onChange={(e) => updateDayName(day.key, e.target.value)}
              className="h-11 flex-1"
            />
            {days.length > 1 && (
              <button
                type="button"
                onClick={() => removeDay(day.key)}
                aria-label="Eliminar día"
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-[#888888] active:bg-white/10"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {day.exercises.map((ex) => (
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
                      updateExercise(day.key, ex.key, { exerciseId: e.target.value })
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
                    onChange={(e) => updateExercise(day.key, ex.key, { sets: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Reps mín</Label>
                  <Input
                    type="number"
                    min={0}
                    value={ex.repsMin}
                    onChange={(e) =>
                      updateExercise(day.key, ex.key, { repsMin: e.target.value })
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
                      updateExercise(day.key, ex.key, { repsMax: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">RIR</Label>
                  <Input
                    type="number"
                    min={0}
                    value={ex.rir}
                    onChange={(e) => updateExercise(day.key, ex.key, { rir: e.target.value })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <Label className="text-xs">Descanso (min)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="1.5"
                    value={ex.restMinutes}
                    onChange={(e) =>
                      updateExercise(day.key, ex.key, {
                        restMinutes: sanitizeDecimalInput(e.target.value),
                      })
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeExercise(day.key, ex.key)}
                  aria-label="Eliminar ejercicio"
                  className="flex size-9 items-center justify-center self-end rounded-md text-[#888888] active:bg-white/10"
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
        </FadeIn>
      ))}

      <Button variant="outline" onClick={addDay} className="w-fit">
        <Plus className="size-4" /> Agregar día
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleSubmit} disabled={pending} className="min-h-[52px] w-full text-base">
        {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
        {pending ? "Creando..." : "Crear mi rutina"}
      </Button>
    </div>
  );
}
