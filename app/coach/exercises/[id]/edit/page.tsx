import { notFound } from "next/navigation";
import { FadeIn } from "@/components/motion/fade-in";
import { getExerciseDetail } from "@/lib/supabase/exercises";
import { ExerciseForm } from "../../exercise-form";
import { updateExercise } from "../../actions";

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exercise = await getExerciseDetail(id);

  if (!exercise) notFound();

  return (
    <FadeIn className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          {exercise.isGlobal ? "Ver ejercicio" : "Editar ejercicio"}
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>
      <ExerciseForm
        action={updateExercise.bind(null, id)}
        initialData={exercise}
      />
    </FadeIn>
  );
}
