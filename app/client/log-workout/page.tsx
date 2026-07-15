import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getInProgressWorkoutDayId,
  getRoutineDayForLogging,
} from "@/lib/supabase/client-routine";
import { WorkoutLogger } from "./workout-logger";

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

  const day = await getRoutineDayForLogging(dayId);

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

  return <WorkoutLogger day={day} />;
}
