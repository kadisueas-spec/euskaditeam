"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  addSetToPastLog,
  deleteSet,
  updateSet,
  type EditPastSessionResult,
  type WeeklyCelebrationSummary,
} from "@/app/client/log-workout/actions";
import { parseDecimalInput, sanitizeDecimalInput } from "@/lib/utils/decimal-input";
import type { WorkoutLogSetSlot } from "@/lib/supabase/workout-history";
import type { TrackingFields } from "@/lib/constants/tracking";
import { formatSet } from "@/lib/utils/set-format";
import { SetFields, fieldsFromSaved, numOrNull, payloadFromFields } from "@/components/client/set-fields";

// B2 (jul-2026): reemplaza a EditableSetRow — ahora cada fila es un SLOT
// planificado, completado o no. Si no está completado y la sesión sigue
// dentro de la ventana de edición, se puede cargar ahí mismo (mismo botón
// "Completar serie" que ya existe en el entrenamiento en vivo, no una UI
// nueva). Si está completado, se puede corregir o borrar. Fuera de la
// ventana de 7 días: solo lectura, sin ningún control táctil.
export function SetSlotRow({
  slot,
  workoutLogId,
  routineExerciseId,
  tracking,
  editable,
  onPersonalRecord,
  onWeeklyCelebration,
  onSetCompleted,
  onSetRemoved,
}: {
  slot: WorkoutLogSetSlot;
  workoutLogId: string;
  routineExerciseId: string;
  // Tipo de registro del ejercicio (oct-2026): qué campos se cargan y cómo
  // se lee la serie.
  tracking: TrackingFields;
  editable: boolean;
  onPersonalRecord: (setId: string) => void;
  onWeeklyCelebration: (summary: WeeklyCelebrationSummary) => void;
  // Problema 1 (jul-2026): HistoryDetail necesita saber cuándo una serie
  // pasa a completada (o se borra) para poder ofrecer "Finalizar
  // entrenamiento" en cuanto no quede ninguna serie pendiente.
  onSetCompleted?: (routineExerciseId: string) => void;
  onSetRemoved?: (routineExerciseId: string) => void;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(slot.completed);
  const savedOf = (s: WorkoutLogSetSlot) => ({
    weightKg: s.weightKg,
    reps: s.repsCompleted,
    rir: s.rirActual,
    durationSeconds: s.durationSeconds,
    distanceKm: s.distanceKm,
    intensity: s.intensity,
    assistance: s.assistance,
  });
  const [values, setValues] = useState(() => fieldsFromSaved(tracking, savedOf(slot)));
  const isWeightReps = tracking.trackingType === "weight_reps";
  const [setId, setSetId] = useState(slot.id);
  const [removed, setRemoved] = useState(false);

  function startEditing() {
    setValues(fieldsFromSaved(tracking, savedOf(slot)));
    setError(null);
    setMode("edit");
  }

  function handleResult(result: EditPastSessionResult) {
    if ("error" in result) {
      setError(result.error);
      return false;
    }
    setSetId(result.id);
    setCompleted(true);
    if (result.isPersonalRecord) onPersonalRecord(result.id);
    if (result.weeklyCelebration) onWeeklyCelebration(result.weeklyCelebration);
    onSetCompleted?.(routineExerciseId);
    return true;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const patch = isWeightReps
        ? {
            weightKg: parseDecimalInput(values.weight),
            reps: values.reps ? Number(values.reps) : null,
            rir: values.rir ? Number(values.rir) : null,
          }
        : payloadFromFields(tracking, values);
      if (completed && setId) {
        const result = await updateSet(setId, patch);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        if (result.isPersonalRecord) onPersonalRecord(setId);
      } else {
        const ok = handleResult(
          await addSetToPastLog({
            workoutLogId,
            routineExerciseId,
            setNumber: slot.setNumber,
            ...patch,
          })
        );
        if (!ok) return;
      }
      setMode("view");
    } catch {
      setError("Sin conexión. Revisá tu red y reintentá.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!setId) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteSet(setId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setRemoved(true);
      onSetRemoved?.(routineExerciseId);
    } catch {
      setError("Sin conexión. Revisá tu red y reintentá.");
    } finally {
      setDeleting(false);
    }
  }

  if (removed) return null;

  if (mode === "edit") {
    return (
      <li className="flex flex-col gap-2 rounded-lg border border-[#e8001c]/40 bg-[#e8001c]/5 p-3">
        <p className="text-xs font-semibold text-[#e8001c] uppercase">
          {completed ? "Editando" : "Completar"} serie {slot.setNumber}
        </p>
        {!isWeightReps ? (
          <SetFields
            tracking={tracking}
            values={values}
            size="sm"
            onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
          />
        ) : (
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={values.weight}
            onChange={(e) => setValues((v) => ({ ...v, weight: sanitizeDecimalInput(e.target.value) }))}
            placeholder="Kg"
            className="h-11 text-center"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={values.reps}
            onChange={(e) => setValues((v) => ({ ...v, reps: e.target.value }))}
            placeholder="Reps"
            className="h-11 text-center"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={values.rir}
            onChange={(e) => setValues((v) => ({ ...v, rir: e.target.value }))}
            placeholder="RIR"
            className="h-11 text-center"
          />
        </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-10 flex-1"
            onClick={() => setMode("view")}
            disabled={saving || deleting}
          >
            Cancelar
          </Button>
          {completed && (
            <Button
              variant="outline"
              className="h-10 flex-1 border-[#e8001c]/40 text-[#e8001c]"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? <Spinner size="sm" /> : <Trash2 className="size-4" />}
              {deleting ? "Borrando..." : "Borrar"}
            </Button>
          )}
          <Button className="h-10 flex-1" onClick={handleSave} disabled={saving || deleting}>
            {saving && <Spinner size="sm" className="border-white/30 border-t-white" />}
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </li>
    );
  }

  if (!completed) {
    return (
      <li>
        <button
          type="button"
          onClick={editable ? startEditing : undefined}
          disabled={!editable}
          className={`flex min-h-[44px] w-full items-center justify-between rounded-lg border border-dashed border-[#333333] bg-transparent px-3 py-2 text-sm text-left ${
            editable ? "transition-transform active:scale-[0.98]" : "opacity-70"
          }`}
        >
          <span className="flex items-center gap-1.5 text-[#666666]">
            Serie {slot.setNumber}
            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] tracking-wide text-[#888888] uppercase">
              Sin completar
            </span>
          </span>
          <span className="flex items-center gap-2 font-mono text-[#666666]">
            {isWeightReps ? "— kg · — reps" : "—"}
            {editable && <Plus className="size-3.5 text-[#e8001c]" />}
          </span>
        </button>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={editable ? startEditing : undefined}
        disabled={!editable}
        className={`flex min-h-[44px] w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm text-left ${
          editable ? "transition-transform active:scale-[0.98]" : ""
        }`}
      >
        <span className="text-[#888888]">Serie {slot.setNumber}</span>
        <span className="flex items-center gap-2 font-mono text-white">
          {formatSet(tracking, {
            weight: numOrNull(values.weight),
            reps: numOrNull(values.reps),
            rir: numOrNull(values.rir),
            seconds:
              tracking.trackingType === "cardio"
                ? numOrNull(values.minutes) != null
                  ? Math.round(numOrNull(values.minutes)! * 60)
                  : null
                : numOrNull(values.seconds),
            distanceKm: numOrNull(values.distance),
            intensity: numOrNull(values.intensity),
            assistance: numOrNull(values.assistance),
          })}
          {editable && <Pencil className="size-3.5 text-[#888888]" />}
        </span>
      </button>
    </li>
  );
}

export function PersonalRecordBadge() {
  return (
    <span className="ml-1 flex w-fit items-center gap-1 rounded-full bg-[#e8001c]/15 px-2.5 py-1 text-xs font-semibold text-[#e8001c]">
      <Trophy className="size-3.5" />
      ¡Nuevo récord! 🏆
    </span>
  );
}
