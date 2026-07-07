import { notFound } from "next/navigation";
import { getExercisesForSelect, getRoutineDetail } from "@/lib/supabase/routines";
import { RoutineEditor } from "./routine-editor";

export default async function EditRoutinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [routine, exercises] = await Promise.all([
    getRoutineDetail(id),
    getExercisesForSelect(),
  ]);

  if (!routine) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          Editar rutina
        </h1>
        <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
        <p className="text-sm text-[#888888]">{routine.clientName ?? "Sin cliente"}</p>
      </div>
      <RoutineEditor routine={routine} exercises={exercises} />
    </div>
  );
}
