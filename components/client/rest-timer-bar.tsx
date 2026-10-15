"use client";

import { useEffect, useRef, useState } from "react";
import { formatRestTime } from "@/lib/utils/format-rest";
import {
  clearStoredRestTimer,
  readStoredRestTimer,
  writeStoredRestTimer,
} from "@/lib/utils/rest-timer-storage";

// Timbre vía Web Audio API — nada de archivo externo. Usa el AudioContext
// ya desbloqueado por un toque previo del cliente (ver workoutLogger —
// Safari iOS lo exige, si se crea el contexto recién acá sin gesto previo
// no suena). En iOS el audio se suspende con la app en segundo plano: eso
// es del sistema, no se resuelve desde una PWA — para ese caso está la push
// de fin de descanso (app/client/log-workout/rest-push-actions.ts).
//
// Oct-2026: los dos beeps cortos (ago-2026) seguían sin escucharse en el
// gimnasio. Ahora es un timbre tipo teléfono de ~2,4 s: dos "rrring" de
// 1,1 s con 0,2 s de pausa, cada uno con dos ondas cuadradas a 1000 y 1200
// Hz (agudo y penetrante; la mezcla de dos tonos es lo que suena a
// campanilla) moduladas en amplitud a 20 Hz (el "trino" del timbre). Va a
// ganancia máxima a través de un compresor, para subir el volumen
// percibido sin distorsionar al sumar las dos ondas.
const RING_FREQUENCIES = [1000, 1200];
const RING_BURST_SECONDS = 1.1;
const RING_GAP_SECONDS = 0.2;
const RING_TRILL_HZ = 20;

function playRingBurst(ctx: AudioContext, output: AudioNode, start: number) {
  const end = start + RING_BURST_SECONDS;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(1, start + 0.01);
  envelope.gain.setValueAtTime(1, end - 0.03);
  envelope.gain.linearRampToValueAtTime(0, end);
  envelope.connect(output);

  // Trino: una onda cuadrada lenta mueve la ganancia entre 0 y 1.
  const trill = ctx.createGain();
  trill.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = RING_TRILL_HZ;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.5;
  lfo.connect(lfoDepth);
  lfoDepth.connect(trill.gain);
  trill.connect(envelope);
  lfo.start(start);
  lfo.stop(end);

  for (const frequency of RING_FREQUENCIES) {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = frequency;
    osc.connect(trill);
    osc.start(start);
    osc.stop(end);
  }
}

function playRing(ctx: AudioContext) {
  // iOS puede dejar el contexto "suspended" tras un rato sin sonar.
  if (ctx.state === "suspended") void ctx.resume();

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 0;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.1;
  compressor.connect(ctx.destination);

  const now = ctx.currentTime;
  playRingBurst(ctx, compressor, now);
  playRingBurst(ctx, compressor, now + RING_BURST_SECONDS + RING_GAP_SECONDS);
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
  onEndsAtChange,
  onZeroWhileVisible,
}: {
  workoutLogId: string;
  routineExerciseId: string;
  restSeconds: number;
  instanceId: string;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  audioCtxRef: React.RefObject<AudioContext | null>;
  onHide: () => void;
  // Push de fin de descanso (oct-2026): se avisa cada vez que cambia la
  // hora de fin (al arrancar, al volver a la pantalla y con −15s/+15s) para
  // reprogramar el aviso, y al llegar a 0:00 con la app abierta para
  // cancelarlo (ya sonó el timbre, no hace falta la push).
  onEndsAtChange?: (endsAt: number) => void;
  onZeroWhileVisible?: () => void;
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

  // Ref para no reprogramar la push si el padre pasa una función nueva en
  // cada render — solo importa cuando cambia endsAt.
  const onEndsAtChangeRef = useRef(onEndsAtChange);
  useEffect(() => {
    onEndsAtChangeRef.current = onEndsAtChange;
  }, [onEndsAtChange]);
  useEffect(() => {
    onEndsAtChangeRef.current?.(endsAt);
  }, [endsAt]);

  // Al llegar a 0: vibración + timbre UNA sola vez (zeroFiredRef evita
  // repetirlo en cada tick de acá en más, y se rearma si el cliente suma
  // tiempo con +15s y vuelve a bajar a 0).
  useEffect(() => {
    if (remaining > 0) {
      zeroFiredRef.current = false;
      return;
    }
    if (zeroFiredRef.current) return;
    zeroFiredRef.current = true;

    if (document.visibilityState === "visible") onZeroWhileVisible?.();

    // navigator.vibrate NO existe en Safari iOS — llamar sin chequear
    // rompió esta misma pantalla antes (ver comentario en workout-logger),
    // por eso el optional chaining acá también.
    // Ago-2026: patrón viejo (un solo pulso corto) apenas se sentía en el
    // bolsillo/muñeca en el gimnasio — ahora son 3 pulsos más largos y
    // repetidos, ~650ms en total en vez de ~220ms.
    if (vibrationEnabled) navigator.vibrate?.([150, 100, 150, 100, 150]);

    if (soundEnabled && audioCtxRef.current) {
      try {
        playRing(audioCtxRef.current);
      } catch (err) {
        console.error("rest timer ring error:", err);
      }
    }
  }, [remaining, soundEnabled, vibrationEnabled, audioCtxRef, onZeroWhileVisible]);

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

  // Oct-2026: antes era una barra fija abajo (sobre la nav) que tapaba
  // "Anterior" / "Siguiente ejercicio". Ahora va arriba de todo, pegada
  // (sticky) al borde superior del área con scroll: ocupa su propio lugar
  // en el flujo, así que nunca tapa ningún botón, y queda visible aunque el
  // cliente scrollee hacia abajo.
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-[#1e1e1e] bg-[#111111] px-4 pt-3">
      <div
        className={`mx-auto flex max-w-md flex-col gap-2 pb-3 ${isZero ? "glow-pulse" : ""}`}
      >
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
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#e8001c] transition-[width] duration-200 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
