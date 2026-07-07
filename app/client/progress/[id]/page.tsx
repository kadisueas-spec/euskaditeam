import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { getWorkoutLogDetail } from "@/lib/supabase/workout-history";
import { formatDate } from "@/lib/utils/format-date";
import { EditableSetRow } from "./editable-set-row";

export default async function WorkoutLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const log = await getWorkoutLogDetail(id);

  if (!log) notFound();

  const setsByExercise = new Map<string, typeof log.sets>();
  for (const set of log.sets) {
    const list = setsByExercise.get(set.exerciseName) ?? [];
    list.push(set);
    setsByExercise.set(set.exerciseName, list);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          {log.dayName ?? "Entrenamiento"}
        </h1>
        <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
        <p className="text-sm text-[#888888]">{formatDate(log.workoutDate)}</p>
        {log.energyLevel != null && (
          <p className="mt-1 text-sm text-[#888888]">
            Energía: {log.energyLevel}/5
          </p>
        )}
      </div>

      {log.clientNotes && (
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardContent className="p-4 text-sm text-[#888888]">
            {log.clientNotes}
          </CardContent>
        </Card>
      )}

      {setsByExercise.size === 0 ? (
        <p className="text-sm text-[#888888]">No se registraron series.</p>
      ) : (
        Array.from(setsByExercise.entries()).map(([exerciseName, sets], i) => (
          <FadeIn key={exerciseName} delay={Math.min(i * 0.05, 0.3)}>
            <Card className="border-[#1e1e1e] bg-[#111111]">
              <CardHeader>
                <CardTitle className="text-base text-white">
                  {exerciseName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {sets.map((set) => (
                    <EditableSetRow key={set.id} set={set} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          </FadeIn>
        ))
      )}
    </div>
  );
}
