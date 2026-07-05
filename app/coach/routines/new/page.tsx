import { getClientsForSelect, getExercisesForSelect } from "@/lib/supabase/routines";
import { FadeIn } from "@/components/motion/fade-in";
import { RoutineWizard } from "./routine-wizard";

export default async function NewRoutinePage() {
  const [clients, exercises] = await Promise.all([
    getClientsForSelect(),
    getExercisesForSelect(),
  ]);

  return (
    <FadeIn className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          Nueva rutina
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>
      <RoutineWizard clients={clients} exercises={exercises} />
    </FadeIn>
  );
}
