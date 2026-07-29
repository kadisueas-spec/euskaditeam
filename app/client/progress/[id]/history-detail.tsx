"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FadeIn } from "@/components/motion/fade-in";
import { WeeklyCelebration } from "@/components/client/weekly-celebration";
import { finishPastLog } from "@/app/client/log-workout/actions";
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

  // Problema 1 (jul-2026): completar todas las series desde acá nunca
  // marcaba la sesión como finalizada — ahora HistoryDetail rastrea cuántas
  // series de cada ejercicio están completas (arrancando de lo que ya
  // había en el servidor, sumando/restando en vivo con lo que reportan los
  // SetSlotRow hijos) para poder ofrecer "Finalizar entrenamiento" en
  // cuanto no falte ninguna, sin esperar a recargar la página.
  const [isCompleted, setIsCompleted] = useState(log.isCompleted);
  const [completedCounts, setCompletedCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      log.exercises.map((ex) => [ex.routineExerciseId, ex.sets.filter((s) => s.completed).length])
    )
  );
  const [showFinishForm, setShowFinishForm] = useState(false);
  const [finishEnergyLevel, setFinishEnergyLevel] = useState(3);
  const [finishNotes, setFinishNotes] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const allSetsComplete = log.exercises.every(
    (ex) => (completedCounts[ex.routineExerciseId] ?? 0) >= ex.plannedSets
  );
  // Si ya se le pidió energía/notas una vez (finishWorkout, o un finish
  // anterior desde acá), no se le vuelve a pedir — se mantiene lo que ya
  // había cargado.
  const alreadyAskedEnergy = log.energyLevel != null;

  function handleSetCompleted(routineExerciseId: string) {
    setCompletedCounts((prev) => ({
      ...prev,
      [routineExerciseId]: (prev[routineExerciseId] ?? 0) + 1,
    }));
  }

  function handleSetRemoved(routineExerciseId: string) {
    setCompletedCounts((prev) => ({
      ...prev,
      [routineExerciseId]: Math.max(0, (prev[routineExerciseId] ?? 0) - 1),
    }));
  }

  async function runFinish(energyLevel?: number, notes?: string) {
    setFinishing(true);
    setFinishError(null);
    try {
      const result = await finishPastLog(log.id, energyLevel, notes);
      if ("error" in result) {
        setFinishError(result.error);
        return;
      }
      setIsCompleted(true);
      setShowFinishForm(false);
      if (result.weeklyCelebration) setWeeklyCelebration(result.weeklyCelebration);
    } catch {
      setFinishError("Sin conexión. Revisá tu red y reintentá.");
    } finally {
      setFinishing(false);
    }
  }

  function handleFinishClick() {
    if (alreadyAskedEnergy) {
      runFinish();
    } else {
      setFinishError(null);
      setShowFinishForm(true);
    }
  }

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
                        editable={editable && !isCompleted}
                        onPersonalRecord={(setId) =>
                          setRecordSetIds((prev) => new Set(prev).add(setId))
                        }
                        onWeeklyCelebration={setWeeklyCelebration}
                        onSetCompleted={handleSetCompleted}
                        onSetRemoved={handleSetRemoved}
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

      {editable && !isCompleted && (
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="flex items-center gap-2 text-sm text-white">
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#888888] uppercase">
                En curso
              </span>
              {allSetsComplete
                ? "Completaste todas las series. ¿Finalizamos el entrenamiento?"
                : "Todavía quedan series sin completar."}
            </p>

            {showFinishForm ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label>¿Cómo te sentiste? (nivel de energía)</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFinishEnergyLevel(level)}
                        className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg text-lg font-semibold transition-transform active:scale-90 ${
                          finishEnergyLevel === level
                            ? "bg-[#e8001c] text-white shadow-[0_0_16px_rgba(232,0,28,0.4)]"
                            : "bg-white/5 text-[#888888]"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="finish-notes">Notas de la sesión</Label>
                  <Textarea
                    id="finish-notes"
                    value={finishNotes}
                    onChange={(e) => setFinishNotes(e.target.value)}
                    rows={3}
                    placeholder="¿Cómo te fue? Algo para contarle a tu coach..."
                  />
                </div>
                {finishError && <p className="text-sm text-destructive">{finishError}</p>}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="min-h-[44px] flex-1 text-sm"
                    onClick={() => setShowFinishForm(false)}
                    disabled={finishing}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="min-h-[44px] flex-1 text-sm"
                    onClick={() => runFinish(finishEnergyLevel, finishNotes)}
                    disabled={finishing}
                  >
                    {finishing && <Spinner size="sm" className="border-white/30 border-t-white" />}
                    {finishing ? "Guardando..." : "Finalizar"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {finishError && <p className="text-sm text-destructive">{finishError}</p>}
                <Button
                  onClick={handleFinishClick}
                  disabled={finishing}
                  className="min-h-[48px] w-full text-sm"
                >
                  {finishing ? (
                    <Spinner size="sm" className="border-white/30 border-t-white" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {finishing ? "Guardando..." : "Finalizar entrenamiento"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {weeklyCelebration && (
        <WeeklyCelebration summary={weeklyCelebration} onClose={() => setWeeklyCelebration(null)} />
      )}
    </>
  );
}
