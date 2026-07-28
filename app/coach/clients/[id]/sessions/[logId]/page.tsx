import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getWorkoutLogDetailForCoach } from "@/lib/supabase/workout-history";
import { formatFriendlyDate } from "@/lib/utils/format-date";

// B2 (jul-2026): el coach necesita ver exactamente lo mismo que el
// cliente en su historial — qué ejercicios/series planificados quedaron
// sin completar — para detectar patrones (máquinas ocupadas, dolor,
// ejercicios que siempre evita). Solo lectura: la edición sigue siendo
// del cliente, ver app/client/progress/[id].
export default async function CoachSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; logId: string }>;
}) {
  const { id: clientId, logId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const log = await getWorkoutLogDetailForCoach(user.id, clientId, logId);
  if (!log) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Link
        href={`/coach/clients/${clientId}`}
        className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-white"
      >
        <ArrowLeft className="size-4" />
        Volver al cliente
      </Link>

      <div>
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          {log.dayName ?? "Entrenamiento"}
        </h1>
        <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
        <p className="text-sm text-[#888888]">{formatFriendlyDate(log.workoutDate)}</p>
        {log.energyLevel != null && (
          <p className="mt-1 text-sm text-[#888888]">Energía: {log.energyLevel}/5</p>
        )}
      </div>

      {log.clientNotes && (
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardContent className="p-4 text-sm text-[#888888]">{log.clientNotes}</CardContent>
        </Card>
      )}

      {log.exercises.length === 0 ? (
        <p className="text-sm text-[#888888]">No hay ejercicios planificados para este día.</p>
      ) : (
        log.exercises.map((ex) => (
          <Card key={ex.routineExerciseId} className="border-[#1e1e1e] bg-[#111111]">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base text-white">{ex.exerciseName}</CardTitle>
              {!ex.fullyCompleted && (
                <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-400 uppercase">
                  Sin completar
                </span>
              )}
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {ex.sets.map((slot) => (
                  <li
                    key={slot.id ?? `${ex.routineExerciseId}-${slot.setNumber}`}
                    className={`flex min-h-[44px] items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      slot.completed
                        ? "bg-white/5"
                        : "border border-dashed border-[#333333]"
                    }`}
                  >
                    <span className={slot.completed ? "text-[#888888]" : "text-[#666666]"}>
                      Serie {slot.setNumber}
                      {!slot.completed && (
                        <span className="ml-2 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] tracking-wide text-[#888888] uppercase">
                          Sin completar
                        </span>
                      )}
                    </span>
                    <span
                      className={`font-mono ${slot.completed ? "text-white" : "text-[#666666]"}`}
                    >
                      {slot.completed ? slot.weightKg ?? "-" : "—"} kg ·{" "}
                      {slot.completed ? slot.repsCompleted ?? "-" : "—"} reps
                      {slot.completed && slot.rirActual != null ? ` · RIR ${slot.rirActual}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
