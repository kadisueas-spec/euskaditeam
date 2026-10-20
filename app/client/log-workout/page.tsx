import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getInProgressWorkoutDayId,
  getMyActiveRoutine,
} from "@/lib/supabase/client-routine";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { WorkoutLogger } from "./workout-logger";

// Push de fin de descanso (oct-2026): scheduleRestEndPush espera hasta el
// final del descanso dentro de after() — la función serverless tiene que
// poder vivir lo que dura el descanso más largo que se avisa (ver
// REST_PUSH_MAX_DELAY_MS en rest-push-actions.ts).
export const maxDuration = 300;

export default async function LogWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day: dayId } = await searchParams;

  if (!dayId) {
    // El bottom nav linkea a esta página sin ?day= — si hay un
    // entrenamiento de hoy sin terminar, resolvemos directo a ese día en
    // vez de mostrar la pantalla vacía de "elegí un día" (ver comentario
    // en getInProgressWorkoutDayId).
    const inProgressDayId = await getInProgressWorkoutDayId();
    if (inProgressDayId) {
      redirect(`/client/log-workout?day=${inProgressDayId}`);
    }

    return (
      <div>
        <h1 className="text-xl font-semibold">Entrenar</h1>
        <p className="mt-2 text-sm text-[#888888]">
          Elegí un día desde{" "}
          <Link href="/client/my-routine" className="text-[#e8001c] underline">
            Mi Rutina
          </Link>{" "}
          para empezar a entrenar.
        </p>
      </div>
    );
  }

  // Una sola lectura de la rutina activa: el día a entrenar y la marca del
  // recorrido de bienvenida (parte Entrenar) salen de la misma consulta.
  const routine = await getMyActiveRoutine();
  const day = routine?.days.find((d) => d.id === dayId) ?? null;

  if (!day) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Entrenar</h1>
        <p className="mt-2 text-sm text-[#888888]">No se encontró ese día.</p>
      </div>
    );
  }

  if (day.exercises.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold">{day.name}</h1>
        <p className="mt-2 text-sm text-[#888888]">
          Este día no tiene ejercicios todavía.
        </p>
      </div>
    );
  }

  const client = await getCurrentClientRecord();
  const restTimerPrefs = client
    ? {
        enabled: client.restTimerEnabled,
        sound: client.restTimerSoundEnabled,
        vibration: client.restTimerVibrationEnabled,
      }
    : undefined;

  return (
    <WorkoutLogger
      day={day}
      restTimerPrefs={restTimerPrefs}
      workoutTour={routine && !routine.tourWorkoutSeenAt ? { routineId: routine.id } : null}
    />
  );
}
