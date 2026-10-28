"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WarmupTypeSelector } from "@/components/coach/warmup-type-selector";
import { sanitizeDecimalInput } from "@/lib/utils/decimal-input";
import { CARDIO_SCALE_LABELS } from "@/lib/constants/tracking";
import type { TrackingFields } from "@/lib/constants/tracking";
import type { WarmupType } from "@/app/coach/routines/actions";

// Campos de prescripción de un ejercicio en el wizard y el editor de
// rutinas (oct-2026): cambian según el tipo de registro del ejercicio
// elegido. Peso + reps sigue igual que siempre; peso corporal sin
// calentamiento; isométrico en segundos; cardio en minutos (una serie, sin
// descanso ni RIR). "Por lado" viene del catálogo: se aclara acá, no se
// carga. Se renderiza DENTRO de la grilla del ejercicio (grid-cols-2
// sm:grid-cols-6), por eso devuelve celdas sueltas.

export type PrescriptionValues = {
  sets: string;
  repsMin: string;
  repsMax: string;
  rir: string;
  restSeconds: string;
  weightIncrement: string;
  warmupType: WarmupType;
  warmupFixedWeight: string;
  // Opcionales: los borradores guardados antes de los tipos no los tienen
  secondsMin?: string;
  secondsMax?: string;
  minutesTarget?: string;
  intensityTarget?: string;
};

function NumberCell({
  label,
  value,
  onChange,
  decimal,
  placeholder,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  decimal?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={decimal ? "text" : "number"}
        inputMode={decimal ? "decimal" : "numeric"}
        min={decimal ? undefined : 0}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(decimal ? sanitizeDecimalInput(e.target.value) : e.target.value)}
      />
    </div>
  );
}

export function PrescriptionFields({
  tracking,
  values,
  onChange,
  groupId,
  isFirstOfDay,
}: {
  tracking: TrackingFields;
  values: PrescriptionValues;
  onChange: (patch: Partial<PrescriptionValues>) => void;
  groupId: string;
  isFirstOfDay: boolean;
}) {
  const type = tracking.trackingType;
  const side = tracking.perSide ? " por lado" : "";

  const sets = <NumberCell label="Series" value={values.sets} onChange={(sets) => onChange({ sets })} />;
  const rest = (
    <NumberCell
      label="Descanso (min)"
      decimal
      placeholder="1.5"
      value={values.restSeconds}
      onChange={(restSeconds) => onChange({ restSeconds })}
    />
  );
  const sideNote = tracking.perSide && (
    <p className="col-span-2 text-xs text-[#888888] sm:col-span-6">
      Por lado: lo que se anote es de un lado; el volumen cuenta los dos.
    </p>
  );

  if (type === "check") {
    return (
      <p className="col-span-2 text-xs text-[#888888] sm:col-span-6">
        Este ejercicio solo se marca como hecho: no lleva series, reps ni tiempo.
      </p>
    );
  }

  if (type === "cardio") {
    return (
      <>
        <NumberCell
          label="Minutos"
          value={values.minutesTarget}
          placeholder="20"
          onChange={(minutesTarget) => onChange({ minutesTarget })}
        />
        <NumberCell
          label={`Intensidad (${tracking.cardioScale === "effort" ? "1 a 10" : "nivel"})`}
          decimal
          value={values.intensityTarget}
          placeholder="opcional"
          onChange={(intensityTarget) => onChange({ intensityTarget })}
        />
        <p className="col-span-2 self-end text-xs text-[#888888] sm:col-span-4">
          Cardio: una sola serie, sin descanso ni RIR. {CARDIO_SCALE_LABELS[tracking.cardioScale ?? "level"]}.
        </p>
      </>
    );
  }

  if (type === "time") {
    return (
      <>
        {sets}
        <NumberCell
          label={`Seg. mín${side}`}
          value={values.secondsMin}
          placeholder="30"
          onChange={(secondsMin) => onChange({ secondsMin })}
        />
        <NumberCell
          label={`Seg. máx${side}`}
          value={values.secondsMax}
          placeholder="45"
          onChange={(secondsMax) => onChange({ secondsMax })}
        />
        {rest}
        <NumberCell
          label="Paso de lastre (kg)"
          decimal
          placeholder="2.5"
          value={values.weightIncrement}
          onChange={(weightIncrement) => onChange({ weightIncrement })}
        />
        {sideNote}
      </>
    );
  }

  // Peso + reps y peso corporal (con o sin asistencia)
  const bodyweight = type === "bodyweight_reps";
  const incrementLabel = !bodyweight
    ? "Incremento (kg)"
    : tracking.assistanceUnit === "kg"
      ? "Paso de ayuda (kg)"
      : "Paso de lastre (kg)";
  return (
    <>
      {sets}
      <NumberCell label={`Reps mín${side}`} value={values.repsMin} onChange={(repsMin) => onChange({ repsMin })} />
      <NumberCell label={`Reps máx${side}`} value={values.repsMax} onChange={(repsMax) => onChange({ repsMax })} />
      <NumberCell label={bodyweight ? "RIR (opcional)" : "RIR"} value={values.rir} onChange={(rir) => onChange({ rir })} />
      {rest}
      {/* Banda: el paso es siempre un nivel, no hay nada que cargar */}
      {tracking.assistanceUnit !== "band" && (
        <NumberCell
          label={incrementLabel}
          decimal
          placeholder="2.5"
          value={values.weightIncrement}
          onChange={(weightIncrement) => onChange({ weightIncrement })}
        />
      )}
      {sideNote}
      {!bodyweight && (
        <div className="col-span-2 sm:col-span-6">
          <WarmupTypeSelector
            groupId={groupId}
            value={values.warmupType}
            fixedWeightKg={values.warmupFixedWeight}
            onChange={(warmupType) => onChange({ warmupType })}
            onFixedWeightChange={(warmupFixedWeight) => onChange({ warmupFixedWeight })}
            isFirstOfDay={isFirstOfDay}
          />
        </div>
      )}
    </>
  );
}
