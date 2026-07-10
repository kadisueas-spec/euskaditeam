import Link from "next/link";
import { Dumbbell, Video } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { MUSCLE_GROUPS, getExercisesList } from "@/lib/supabase/exercises";
import { getYouTubeThumbnailUrl } from "@/lib/constants/youtube";
import { cn } from "@/lib/utils";

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ muscle_group?: string }>;
}) {
  const { muscle_group: muscleGroup } = await searchParams;
  const exercises = await getExercisesList(muscleGroup);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
            Ejercicios
          </h1>
          <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
        </div>
        <Link
          href="/coach/exercises/new"
          className={buttonVariants({ variant: "default" })}
        >
          + Nuevo ejercicio
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/coach/exercises"
          className={cn(
            "rounded-full px-3 py-1.5 text-sm",
            !muscleGroup
              ? "bg-[#e8001c] text-white"
              : "bg-white/5 text-[#888888] hover:bg-white/10"
          )}
        >
          Todos
        </Link>
        {MUSCLE_GROUPS.map((group) => (
          <Link
            key={group}
            href={`/coach/exercises?muscle_group=${encodeURIComponent(group)}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm",
              muscleGroup === group
                ? "bg-[#e8001c] text-white"
                : "bg-white/5 text-[#888888] hover:bg-white/10"
            )}
          >
            {group}
          </Link>
        ))}
      </div>

      {exercises.length === 0 ? (
        <p className="text-sm text-[#888888]">
          No hay ejercicios{muscleGroup ? ` en ${muscleGroup}` : ""} todavía.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((exercise, i) => (
            <FadeIn key={exercise.id} delay={Math.min(i * 0.04, 0.4)}>
              <Link href={`/coach/exercises/${exercise.id}/edit`}>
                <Card className="h-full border-[#1e1e1e] bg-[#111111]">
                  <CardContent className="flex flex-col gap-3">
                    <div className="relative flex aspect-video items-center justify-center rounded-lg bg-white/5">
                      {exercise.videoId ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getYouTubeThumbnailUrl(exercise.videoId)}
                            alt={exercise.name}
                            className="size-full rounded-lg object-cover"
                          />
                          <span
                            className="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/70 text-white"
                            title="Tiene video demostrativo"
                          >
                            <Video className="size-3.5" />
                          </span>
                        </>
                      ) : (
                        <Dumbbell className="size-8 text-[#888888]" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{exercise.name}</p>
                      <p className="text-xs text-[#888888]">
                        {exercise.equipment ?? "Sin equipo especificado"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {exercise.isGlobal && (
                        <Badge className="w-fit border-[#e8001c]/40 bg-[#e8001c]/15 text-[#e8001c]">
                          Base Euskadi
                        </Badge>
                      )}
                      {exercise.muscleGroup && (
                        <Badge variant="secondary" className="w-fit">
                          {exercise.muscleGroup}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
