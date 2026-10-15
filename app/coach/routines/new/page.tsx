import {
  getClientsForSelect,
  getExercisesForSelect,
  getRoutineDetail,
} from "@/lib/supabase/routines";
import { getTemplatesList } from "@/lib/supabase/routine-templates";
import { FadeIn } from "@/components/motion/fade-in";
import { RoutineWizard } from "./routine-wizard";

// ?client=<id> preselecciona el cliente (botón "Nueva rutina" de la ficha);
// ?from=<routineId> precarga una rutina existente para copiarla (botón
// "Copiar a otro cliente") — ver RoutineWizard.
export default async function NewRoutinePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; from?: string }>;
}) {
  const { client: initialClientId, from } = await searchParams;
  const [clients, exercises, source, templates] = await Promise.all([
    getClientsForSelect(),
    getExercisesForSelect(),
    from ? getRoutineDetail(from) : Promise.resolve(null),
    getTemplatesList(),
  ]);

  return (
    <FadeIn className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          Nueva rutina
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>
      {/* key: elegir una plantilla en el paso 0 navega a ?from= — sin
          remontar, el wizard conservaría el estado inicial vacío. */}
      <RoutineWizard
        key={from ?? "new"}
        templates={templates}
        clients={clients}
        exercises={exercises}
        initialClientId={initialClientId}
        source={source}
      />
    </FadeIn>
  );
}
