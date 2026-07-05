import { FadeIn } from "@/components/motion/fade-in";
import { ExerciseForm } from "../exercise-form";
import { createExercise } from "../actions";

export default function NewExercisePage() {
  return (
    <FadeIn className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          Nuevo ejercicio
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>
      <ExerciseForm action={createExercise} />
    </FadeIn>
  );
}
