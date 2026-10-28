"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  ASSISTANCE_LABELS,
  CARDIO_SCALE_LABELS,
  SELECTABLE_TRACKING_TYPES,
  TRACKING_DESCRIPTIONS,
  TRACKING_LABELS,
  normalizeTracking,
} from "@/lib/constants/tracking";
import type { TrackingFields as Tracking, TrackingType } from "@/lib/constants/tracking";

// Tipo de registro del ejercicio (oct-2026): qué se anota en cada serie.
// Lista de opciones con la descripción siempre visible (mismo patrón que
// el selector de calentamiento: radio nativo sr-only + label, el estado
// seleccionado se calcula en JS). "Por lado", asistencia y escala aparecen
// solo donde aplican; el servidor vuelve a normalizar (normalizeTracking).
export function TrackingFields({
  initial,
  disabled,
  existing,
}: {
  initial: Tracking;
  disabled: boolean;
  existing: boolean;
}) {
  const [type, setType] = useState<TrackingType>(initial.trackingType);
  const [perSide, setPerSide] = useState(initial.perSide);
  const [assistance, setAssistance] = useState<string>(initial.assistanceUnit ?? "");
  const [scale, setScale] = useState<string>(initial.cardioScale ?? "level");
  const current = normalizeTracking({ trackingType: type, perSide, assistanceUnit: assistance, cardioScale: scale });
  // Un ejercicio viejo puede tener un tipo que todavía no se elige acá
  // (check): se muestra igual para no perderlo al guardar.
  const options = SELECTABLE_TRACKING_TYPES.includes(initial.trackingType)
    ? SELECTABLE_TRACKING_TYPES
    : [...SELECTABLE_TRACKING_TYPES, initial.trackingType];

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">Tipo de registro</legend>
      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const id = `tracking-${opt}`;
          const selected = type === opt;
          return (
            <div key={opt}>
              <input
                type="radio"
                id={id}
                name="tracking_type"
                value={opt}
                checked={selected}
                onChange={() => setType(opt)}
                className="sr-only"
              />
              <label
                htmlFor={id}
                className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  selected ? "border-[#e8001c] bg-[#e8001c]/10" : "border-[#1e1e1e]"
                }`}
              >
                <span
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-[#e8001c]" : "border-[#555555]"
                  }`}
                >
                  {selected && <span className="size-2 rounded-full bg-[#e8001c]" />}
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">{TRACKING_LABELS[opt]}</span>
                  <span className="block text-xs text-[#888888]">{TRACKING_DESCRIPTIONS[opt]}</span>
                </span>
              </label>
            </div>
          );
        })}
      </div>

      {current.trackingType !== "cardio" && current.trackingType !== "check" && (
        <label className="flex min-h-11 items-start gap-3 rounded-lg border border-[#1e1e1e] p-3 text-sm">
          <input
            type="checkbox"
            name="per_side"
            checked={perSide}
            onChange={(e) => setPerSide(e.target.checked)}
            className="mt-1 size-4 accent-[#e8001c]"
          />
          <span>
            <span className="block font-medium text-white">Por lado</span>
            <span className="block text-xs text-[#888888]">
              Ejercicios unilaterales (búlgara, remo a una mano): las reps o segundos se anotan por lado y el
              volumen cuenta los dos. Se muestra “por lado” junto a la prescripción.
            </span>
          </span>
        </label>
      )}

      {current.trackingType === "bodyweight_reps" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="assistance_unit">Asistencia</Label>
          <NativeSelect
            id="assistance_unit"
            name="assistance_unit"
            value={assistance}
            onChange={(e) => setAssistance(e.target.value)}
          >
            <option value="">Sin asistencia</option>
            <option value="kg">{ASSISTANCE_LABELS.kg}</option>
            <option value="band">{ASSISTANCE_LABELS.band}</option>
          </NativeSelect>
          <p className="text-xs text-[#888888]">
            Para la máquina de dominadas asistidas o las bandas: progresar es bajar la ayuda. En banda, un número
            más alto es una banda que ayuda más.
          </p>
        </div>
      )}

      {current.trackingType === "cardio" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="cardio_scale">Intensidad</Label>
          <NativeSelect
            id="cardio_scale"
            name="cardio_scale"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
          >
            <option value="level">{CARDIO_SCALE_LABELS.level}</option>
            <option value="effort">{CARDIO_SCALE_LABELS.effort}</option>
          </NativeSelect>
        </div>
      )}

      {existing && type !== initial.trackingType && (
        <p className="rounded-lg border border-[#f5c542]/40 bg-[#f5c542]/10 px-3 py-2 text-xs text-[#f5f5f5]">
          Cambiar el tipo no convierte las series que ya se cargaron: se siguen viendo como se anotaron.
        </p>
      )}
    </fieldset>
  );
}
