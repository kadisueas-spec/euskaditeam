"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { FadeIn } from "@/components/motion/fade-in";
import { PlannedMetricsPanel } from "@/components/coach/planned-metrics-panel";
import type { ClientOption, ExerciseOption } from "@/lib/supabase/routines";
import { createRoutine } from "../actions";

type ExerciseRow = {
  key: string;
  exerciseId: string;
  sets: string;
  repsMin: string;
  repsMax: string;
  rir: string;
  restSeconds: string;
  notes: string;
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
    sets: "",
    repsMin: "",
    repsMax: "",
    rir: "",
    restSeconds: "",
    notes: "",
  };
}

function newDayRow(index: number): DayRow {
  return { key: crypto.randomUUID(), name: `Día ${index}`, exercises: [] };
}

export function RoutineWizard({
  clients,
  exercises,
}: {
  clients: ClientOption[];
  exercises: ExerciseOption[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [clientId, setClientId] = useState("");
  const [durationWeeks, setDurationWeeks] = useState("4");
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState<DayRow[]>([]);

  function goToStep2() {
    if (!name.trim()) return setError("El nombre es obligatorio.");
    if (!clientId) return setError("Selecciona un cliente.");
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
          ? { ...d, exercises: [...d.exercises, newExerciseRow()] }
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
      const result = await createRoutine({
        name,
        description,
        objective,
        clientId,
        durationWeeks: Number(durationWeeks) || 4,
        startsAt,
        days: days.map((d) => ({
          name: d.name,
          exercises: d.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: Number(e.sets),
            repsMin: e.repsMin ? Number(e.repsMin) : null,
            repsMax: e.repsMax ? Number(e.repsMax) : null,
            rir: e.rir ? Number(e.rir) : null,
            restSeconds: e.restSeconds ? Number(e.restSeconds) : null,
            notes: e.notes || null,
          })),
        })),
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      router.push(`/coach/routines/${result.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
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
            <Label htmlFor="routine-client">Cliente</Label>
            <NativeSelect
              id="routine-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="" disabled>
                Selecciona un cliente
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
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
                {day.exercises.map((ex) => (
                  <div
                    key={ex.key}
                    className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-3 sm:grid-cols-6"
                  >
                    <div className="col-span-2 sm:col-span-2">
                      <Label className="text-xs">Ejercicio</Label>
                      <NativeSelect
                        value={ex.exerciseId}
                        onChange={(e) =>
                          updateExercise(day.key, ex.key, {
                            exerciseId: e.target.value,
                          })
                        }
                      >
                        <option value="" disabled>
                          Elegir
                        </option>
                        {exercises.map((opt) => (
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
                          updateExercise(day.key, ex.key, { sets: e.target.value })
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
                          updateExercise(day.key, ex.key, {
                            repsMin: e.target.value,
                          })
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
                          updateExercise(day.key, ex.key, {
                            repsMax: e.target.value,
                          })
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
                          updateExercise(day.key, ex.key, { rir: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Descanso (seg)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={ex.restSeconds}
                        onChange={(e) =>
                          updateExercise(day.key, ex.key, {
                            restSeconds: e.target.value,
                          })
                        }
                      />
                    </div>
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
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} disabled={pending}>
              Atrás
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
              {pending ? "Creando..." : "Crear rutina"}
            </Button>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
