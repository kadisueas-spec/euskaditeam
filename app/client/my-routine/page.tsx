import Link from "next/link";
import { ChevronDown, Dumbbell, Lightbulb, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientGreeting } from "@/components/client/client-greeting";
import { ExerciseVideo } from "@/components/client/exercise-video";
import { FadeIn } from "@/components/motion/fade-in";
import { getMyActiveRoutine } from "@/lib/supabase/client-routine";
import { getMyFeedback } from "@/lib/supabase/feedback";
import { getClientStats } from "@/lib/supabase/stats";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import { FEEDBACK_TYPE_LABEL } from "@/lib/constants/feedback";
import { formatRestTime } from "@/lib/utils/format-rest";
import { randomMotivationalPhrase } from "@/lib/constants/motivational-phrases";

function repsLabel(min: number | null, max: number | null) {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min}-${max} reps`;
  return `${min ?? max} reps`;
}

export default async function MyRoutinePage() {
  const [routine, feedback, stats, profile] = await Promise.all([
    getMyActiveRoutine(),
    getMyFeedback(),
    getClientStats(),
    getCurrentProfile(),
  ]);
  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const motivationalPhrase = randomMotivationalPhrase();

  const feedbackByExercise = new Map<string, typeof feedback>();
  for (const f of feedback) {
    if (!f.routineExerciseId) continue;
    const list = feedbackByExercise.get(f.routineExerciseId) ?? [];
    list.push(f);
    feedbackByExercise.set(f.routineExerciseId, list);
  }

  if (!routine) {
    return (
      <div className="flex flex-col gap-4">
        <FadeIn>
          <ClientGreeting name={firstName} />
        </FadeIn>
        <EmptyState
          icon={Dumbbell}
          title="Tu coach está preparando algo para vos."
          description="Pronto vas a tener tu rutina."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FadeIn>
        <ClientGreeting name={firstName} />
        <p className="mt-1 text-sm text-[#888888] italic">
          &ldquo;{motivationalPhrase}&rdquo;
        </p>
      </FadeIn>

      <div>
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          {routine.name}
        </h1>
        <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
        {routine.objective && (
          <p className="text-sm text-[#888888]">Objetivo: {routine.objective}</p>
        )}
      </div>

      {stats.dailyStreak > 0 && (
        <FadeIn>
          <p className="rounded-full bg-white/5 px-4 py-2 text-center text-sm font-medium text-[#f5f5f5]">
            Estás en racha hace {stats.dailyStreak} día
            {stats.dailyStreak === 1 ? "" : "s"} 🔥
          </p>
        </FadeIn>
      )}

      {routine.days.map((day, dayIndex) => (
        <FadeIn key={day.id} delay={dayIndex * 0.06}>
          <details className="overflow-hidden rounded-2xl border border-[#1e1e1e] bg-[#111111]">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between p-5 select-none active:bg-white/5 [&::-webkit-details-marker]:hidden">
              <div>
                <p className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
                  {day.name}
                </p>
                <p className="text-sm text-[#888888]">
                  {day.exercises.length} ejercicio
                  {day.exercises.length === 1 ? "" : "s"}
                </p>
              </div>
              <ChevronDown className="size-5 shrink-0 text-[#888888] transition-transform [details[open]_&]:rotate-180" />
            </summary>

            <div className="flex flex-col gap-3 border-t border-[#1e1e1e] p-4">
              {day.exercises.length === 0 ? (
                <p className="text-sm text-[#888888]">Sin ejercicios.</p>
              ) : (
                day.exercises.map((ex, exIndex) => (
                  <div key={ex.id} className="rounded-lg bg-white/5 p-3">
                    <div className="flex items-start gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8001c] font-display text-base text-white shadow-[0_0_12px_rgba(232,0,28,0.4)]">
                        {exIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">{ex.exerciseName}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-[#e8001c]/15 px-2 py-0.5 text-xs font-semibold text-[#e8001c]">
                            {ex.sets} series
                          </span>
                          {repsLabel(ex.repsMin, ex.repsMax) && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-[#f5f5f5]">
                              {repsLabel(ex.repsMin, ex.repsMax)}
                            </span>
                          )}
                          {ex.rirTarget != null && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-[#f5f5f5]">
                              RIR {ex.rirTarget}
                            </span>
                          )}
                          {ex.restSeconds != null && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-[#f5f5f5]">
                              {formatRestTime(ex.restSeconds)} descanso
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <ExerciseVideo videoId={ex.videoId} />
                    </div>
                    {ex.coachNotes && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg bg-[#e8001c]/10 p-2">
                        <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#e8001c]" />
                        <p className="text-sm text-[#888888]">{ex.coachNotes}</p>
                      </div>
                    )}
                    {feedbackByExercise.get(ex.id)?.map((f) => (
                      <div
                        key={f.id}
                        className="mt-2 flex items-start gap-2 rounded-lg bg-white/5 p-2"
                      >
                        <MessageSquare className="mt-0.5 size-4 shrink-0 text-[#888888]" />
                        <div>
                          <Badge variant="secondary" className="mb-1">
                            {FEEDBACK_TYPE_LABEL[f.type]}
                          </Badge>
                          <p className="text-sm text-[#888888]">{f.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}

              <Link
                href={`/client/log-workout?day=${day.id}`}
                className={buttonVariants({
                  variant: "default",
                  className: "mt-1 min-h-[44px] w-full",
                })}
              >
                Iniciar entrenamiento
              </Link>
            </div>
          </details>
        </FadeIn>
      ))}
    </div>
  );
}
