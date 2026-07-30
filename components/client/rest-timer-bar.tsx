"use client";

import { useEffect, useRef, useState } from "react";
import { formatRestTime } from "@/lib/utils/format-rest";
import {
  clearStoredRestTimer,
  readStoredRestTimer,
  writeStoredRestTimer,
} from "@/lib/utils/rest-timer-storage";

// Beep vía Web Audio API — nada de archivo externo. Tono simple con
// ataque/decay rápidos (envelope de ganancia) en vez de un "click" seco.
// Usa el AudioContext ya desbloqueado por un toque previo del cliente (ver
// workoutLogger — Safari iOS lo exige, si se crea el contexto recién acá
// sin gesto previo no suena). Respeta el modo silencioso del dispositivo
// por comportamiento default de Web Audio API en iOS (no hace falta código
// extra: eso rompería si el propio navegador no lo respetara ya).
//
// Ago-2026: apenas se escuchaba en el gimnasio (ruido ambiente + música) —
// volumen pico subido de 0.35 a 0.75 (cerca del techo antes de distorsión)
// y DOS beeps cortos en vez de uno solo (más perceptible que un tono único
// más largo, mismo patrón que una alarma de horno).
function playSingleBeep(ctx: AudioContext, startTime: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.75, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + 0.24);
}

function playBeep(ctx: AudioContext) {
  const now = ctx.currentTime;
  playSingleBeep(ctx, now);
  playSingleBeep(ctx, now + 0.28);
}

export function RestTimerBar({
  workoutLogId,
  routineExerciseId,
  restSeconds,
  instanceId,
  soundEnabled,
  vibrationEnabled,
  audioCtxRef,
  onHide,
}: {
  workoutLogId: string;
  routineExerciseId: string;
  restSeconds: number;
  instanceId: string;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  audioCtxRef: React.RefObject<AudioContext | null>;
  onHide: () => void;
}) {
  // Al montar: si hay un temporizador guardado de la MISMA instancia (el
  // cliente navegó afuera y volvió, o cerró la app y volvió a entrar),
  // reusa su endsAt real en vez de arrancar de cero — así el tiempo
  // restante mostrado es el correcto, no un contador reiniciado. Si es una
  // instancia nueva (se completó una serie nueva), pisa lo guardado.
  const [endsAt, setEndsAt] = useState<number>(() => {
    const stored = readStoredRestTimer(workoutLogId);
    if (stored && stored.instanceId === instanceId) return stored.endsAt;
    const fresh = Date.now() + restSeconds * 1000;
    writeStoredRestTimer(workoutLogId, { instanceId, routineExerciseId, endsAt: fresh });
    return fresh;
  });

  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round((endsAt - Date.now()) / 1000))
  );
  const zeroFiredRef = useRef(false);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  // Al llegar a 0: vibración + beep UNA sola vez (zeroFiredRef evita
  // repetirlo en cada tick de acá en más, y se rearma si el cliente suma
  // tiempo con +15s y vuelve a bajar a 0).
  useEffect(() => {
    if (remaining > 0) {
      zeroFiredRef.current = false;
      return;
    }
    if (zeroFiredRef.current) return;
    zeroFiredRef.current = true;

    // navigator.vibrate NO existe en Safari iOS — llamar sin chequear
    // rompió esta misma pantalla antes (ver comentario en workout-logger),
    // por eso el optional chaining acá también.
    // Ago-2026: patrón viejo (un solo pulso corto) apenas se sentía en el
    // bolsillo/muñeca en el gimnasio — ahora son 3 pulsos más largos y
    // repetidos, ~650ms en total en vez de ~220ms.
    if (vibrationEnabled) navigator.vibrate?.([150, 100, 150, 100, 150]);

    if (soundEnabled && audioCtxRef.current) {
      try {
        playBeep(audioCtxRef.current);
      } catch (err) {
        console.error("rest timer beep error:", err);
      }
    }
  }, [remaining, soundEnabled, vibrationEnabled, audioCtxRef]);

  function adjust(deltaSeconds: number) {
    setEndsAt((prev) => {
      const next = Math.max(Date.now(), prev + deltaSeconds * 1000);
      writeStoredRestTimer(workoutLogId, { instanceId, routineExerciseId, endsAt: next });
      return next;
    });
  }

  function skip() {
    clearStoredRestTimer(workoutLogId);
    onHide();
  }

  const pct = Math.max(0, Math.min(100, (remaining / restSeconds) * 100));
  const isZero = remaining === 0;

  return (
    <div
      className="fixed inset-x-0 z-30 border-t border-[#1e1e1e] bg-[#111111] px-4 pt-3"
      style={{ bottom: "calc(50px + min(env(safe-area-inset-bottom), 10px))" }}
    >
      <div
        className={`mx-auto flex max-w-md flex-col gap-2 pb-3 ${isZero ? "glow-pulse" : ""}`}
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#e8001c] transition-[width] duration-200 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p
            className={`font-display text-4xl tabular-nums text-[#e8001c] ${isZero ? "animate-pulse" : ""}`}
          >
            {formatRestTime(remaining)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjust(-15)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-white/5 text-sm font-semibold text-white transition-transform active:scale-90"
            >
              −15s
            </button>
            <button
              type="button"
              onClick={() => adjust(15)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-white/5 text-sm font-semibold text-white transition-transform active:scale-90"
            >
              +15s
            </button>
            <button
              type="button"
              onClick={skip}
              className="flex min-h-[44px] items-center justify-center rounded-lg bg-white/5 px-3 text-sm font-semibold text-[#888888] transition-transform active:scale-90"
            >
              Saltear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
