import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkoutLogger } from "@/app/client/log-workout/workout-logger";
import { getPreviousSetsForExercises } from "@/app/client/log-workout/actions";
import {
  getInProgressTrainingDayId,
  getTrainingDayForLogging,
} from "@/lib/supabase/coach-training";
import {
  addTrainingSet,
  finishTrainingWorkout,
  getOrCreateInProgressTrainingWorkout,
  updateTrainingSet,
} from "./actions";

const TRAINING_ACTIONS = {
  getOrCreateInProgressWorkout: getOrCreateInProgressTrainingWorkout,
  // No hace falta una variante coach-scoped: esta función no filtra por
  // client_id explícito, se apoya 100% en RLS (ver comentario en
  // app/client/log-workout/actions.ts).
  getPreviousSetsForExercises,
  addSet: addTrainingSet,
  updateSet: updateTrainingSet,
  finishWorkout: finishTrainingWorkout,
};

export default async function CoachLogWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day: dayId } = await searchParams;

  if (!dayId) {
    const inProgressDayId = await getInProgressTrainingDayId();
    if (inProgressDayId) {
      redirect(`/coach/my-training/log-workout?day=${inProgressDayId}`);
    }

    return (
      <div>
        <h1 className="text-xl font-semibold">Entrenar</h1>
        <p className="mt-2 text-sm text-[#888888]">
          Elegí un día desde{" "}
          <Link href="/coach/my-training" className="text-[#e8001c] underline">
            Mi Entrenamiento
          </Link>{" "}
          para empezar.
        </p>
      </div>
    );
  }

  const day = await getTrainingDayForLogging(dayId);

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
        <p className="mt-2 text-sm text-[#888888]">Este día no tiene ejercicios todavía.</p>
      </div>
    );
  }

  return <WorkoutLogger day={day} actions={TRAINING_ACTIONS} enableOfflineSync={false} />;
}
