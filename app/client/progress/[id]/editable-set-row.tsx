"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { updateSet } from "@/app/client/log-workout/actions";
import type { WorkoutLogSetDetail } from "@/lib/supabase/workout-history";

// B2: las sesiones ya registradas también son editables, no solo mientras
// el entrenamiento está en curso — reusa el mismo updateSet() de A4, que ya
// solo depende de la RLS de workout_set_logs (el cliente solo puede tocar
// sus propias series, sin importar si la sesión sigue abierta o no).
export function EditableSetRow({ set }: { set: WorkoutLogSetDetail }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState({
    weight: set.weightKg != null ? String(set.weightKg) : "",
    reps: set.repsCompleted != null ? String(set.repsCompleted) : "",
    rir: set.rirActual != null ? String(set.rirActual) : "",
  });
  const [weight, setWeight] = useState(saved.weight);
  const [reps, setReps] = useState(saved.reps);
  const [rir, setRir] = useState(saved.rir);

  function startEditing() {
    setWeight(saved.weight);
    setReps(saved.reps);
    setRir(saved.rir);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateSet(set.id, {
        weightKg: weight ? Number(weight) : null,
        reps: reps ? Number(reps) : null,
        rir: rir ? Number(rir) : null,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSaved({ weight, reps, rir });
      setEditing(false);
    } catch {
      // Mismo bug de fondo que el cuelgue de "Iniciar entrenamiento": sin
      // este catch, un rechazo de red dejaba el botón trabado en
      // "Guardando..." para siempre.
      setError("Sin conexión. Revisá tu red y reintentá.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-lg border border-[#e8001c]/40 bg-[#e8001c]/5 p-3">
        <p className="text-xs font-semibold text-[#e8001c] uppercase">
          Editando serie {set.setNumber}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Kg"
            className="h-11 text-center"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="Reps"
            className="h-11 text-center"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={rir}
            onChange={(e) => setRir(e.target.value)}
            placeholder="RIR"
            className="h-11 text-center"
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-10 flex-1"
            onClick={() => setEditing(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button className="h-10 flex-1" onClick={handleSave} disabled={saving}>
            {saving && <Spinner size="sm" className="border-white/30 border-t-white" />}
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={startEditing}
        className="flex min-h-[44px] w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm text-left transition-transform active:scale-[0.98]"
      >
        <span className="text-[#888888]">Serie {set.setNumber}</span>
        <span className="flex items-center gap-2 font-mono text-white">
          {saved.weight || "-"} kg · {saved.reps || "-"} reps
          {saved.rir ? ` · RIR ${saved.rir}` : ""}
          <Pencil className="size-3.5 text-[#888888]" />
        </span>
      </button>
    </li>
  );
}
