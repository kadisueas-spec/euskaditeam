"use client";

import { useEffect, useState } from "react";
import { updateRestTimerPrefs, type RestTimerPrefsPatch } from "@/app/client/profile/actions";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex min-h-[44px] items-center justify-between gap-3 py-1.5 ${disabled ? "opacity-50" : ""}`}
    >
      <span className="flex flex-col">
        <span className="text-sm text-white">{label}</span>
        {description && <span className="text-xs text-[#888888]">{description}</span>}
      </span>
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="pointer-events-none absolute inset-0 rounded-full bg-white/15 transition-colors peer-checked:bg-[#e8001c]" />
        <span className="pointer-events-none absolute left-0.5 size-6 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

// Preferencias del temporizador de descanso (jul-2026) — se guardan en
// clients (updateRestTimerPrefs), no localStorage, para persistir entre
// dispositivos. "Vibración" solo se muestra si el dispositivo la soporta
// (chequeado en el cliente, ver useEffect — navigator no existe en SSR).
export function RestTimerSettings({
  initialEnabled,
  initialSound,
  initialVibration,
}: {
  initialEnabled: boolean;
  initialSound: boolean;
  initialVibration: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [sound, setSound] = useState(initialSound);
  const [vibration, setVibration] = useState(initialVibration);
  const [vibrationSupported, setVibrationSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVibrationSupported(typeof navigator !== "undefined" && "vibrate" in navigator);
  }, []);

  async function save(patch: RestTimerPrefsPatch) {
    setError(null);
    const result = await updateRestTimerPrefs(patch);
    if ("error" in result) setError(result.error);
  }

  return (
    <div className="flex flex-col divide-y divide-[#1e1e1e]">
      <ToggleRow
        label="Temporizador de descanso automático"
        description="Cuenta regresiva al completar cada serie"
        checked={enabled}
        onChange={(v) => {
          setEnabled(v);
          save({ restTimerEnabled: v });
        }}
      />
      <ToggleRow
        label="Sonido al terminar el descanso"
        checked={sound}
        disabled={!enabled}
        onChange={(v) => {
          setSound(v);
          save({ restTimerSoundEnabled: v });
        }}
      />
      {vibrationSupported && (
        <ToggleRow
          label="Vibración"
          checked={vibration}
          disabled={!enabled}
          onChange={(v) => {
            setVibration(v);
            save({ restTimerVibrationEnabled: v });
          }}
        />
      )}
      {error && <p className="pt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
