"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { WeeklyCelebration } from "@/components/client/weekly-celebration";
import type { WeeklyCelebrationSummary } from "@/app/client/log-workout/actions";
import type { WorkoutLogDetail } from "@/lib/supabase/workout-history";
import { PersonalRecordBadge, SetSlotRow } from "./set-slot-row";

// B2 (jul-2026): client component porque el badge de récord y la
// celebración semanal necesitan estado — page.tsx queda server component
// (fetch de getWorkoutLogDetail) y le pasa el log ya resuelto acá.
export function HistoryDetail({
  log,
  editable,
}: {
  log: WorkoutLogDetail;
  editable: boolean;
}) {
  const [recordSetIds, setRecordSetIds] = useState<Set<string>>(new Set());
  const [weeklyCelebration, setWeeklyCelebration] = useState<WeeklyCelebrationSummary | null>(null);

  return (
    <>
      {log.exercises.length === 0 ? (
        <p className="text-sm text-[#888888]">No hay ejercicios planificados para este día.</p>
      ) : (
        log.exercises.map((ex, i) => (
          <FadeIn key={ex.routineExerciseId} delay={Math.min(i * 0.05, 0.3)}>
            <Card className="border-[#1e1e1e] bg-[#111111]">
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
                    <div key={slot.id ?? `${ex.routineExerciseId}-${slot.setNumber}`}>
                      <SetSlotRow
                        slot={slot}
                        workoutLogId={log.id}
                        routineExerciseId={ex.routineExerciseId}
                        editable={editable}
                        onPersonalRecord={(setId) =>
                          setRecordSetIds((prev) => new Set(prev).add(setId))
                        }
                        onWeeklyCelebration={setWeeklyCelebration}
                      />
                      {slot.id && recordSetIds.has(slot.id) && (
                        <div className="mt-1">
                          <PersonalRecordBadge />
                        </div>
                      )}
                    </div>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </FadeIn>
        ))
      )}

      {weeklyCelebration && (
        <WeeklyCelebration summary={weeklyCelebration} onClose={() => setWeeklyCelebration(null)} />
      )}
    </>
  );
}
