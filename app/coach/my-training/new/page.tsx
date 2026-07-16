import { getExercisesForSelect } from "@/lib/supabase/routines";
import { FadeIn } from "@/components/motion/fade-in";
import { TrainingRoutineForm } from "./training-routine-form";

export default async function NewTrainingRoutinePage() {
  const exercises = await getExercisesForSelect();

  return (
    <FadeIn className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          Mi rutina
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
        <p className="text-sm text-[#888888]">Armá tu propia rutina de entrenamiento.</p>
      </div>
      <TrainingRoutineForm exercises={exercises} />
    </FadeIn>
  );
}
