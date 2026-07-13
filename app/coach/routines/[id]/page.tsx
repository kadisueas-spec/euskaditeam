import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { getRoutineDetail } from "@/lib/supabase/routines";
import { formatRestTime } from "@/lib/utils/format-rest";
import { formatDate } from "@/lib/utils/format-date";
import { DeleteRoutineButton } from "./delete-routine-button";

function repsLabel(min: number | null, max: number | null) {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min}-${max} reps`;
  return `${min ?? max} reps`;
}

export default async function RoutineDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string }>;
}) {
  const { id } = await params;
  const { warning } = await searchParams;
  const routine = await getRoutineDetail(id);

  if (!routine) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {warning && (
        <p className="rounded-lg bg-amber-400/10 p-3 text-sm text-amber-300">
          {warning}
        </p>
      )}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
            {routine.name}
          </h1>
          <Badge variant={routine.isActive ? "default" : "secondary"}>
            {routine.isActive ? "Activa" : "Archivada"}
          </Badge>
          <Link
            href={`/coach/routines/${routine.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm", className: "ml-auto" })}
          >
            <Pencil className="size-4" /> Editar
          </Link>
        </div>
        <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
        <p className="text-sm text-[#888888]">
          {routine.clientName ?? "Sin cliente"}
        </p>
        {routine.objective && (
          <p className="mt-1 text-sm text-[#888888]">
            Objetivo: {routine.objective}
          </p>
        )}
        {routine.endsAt && (
          <p className="mt-1 text-sm text-[#888888]">
            Mesociclo: {routine.startsAt && `${formatDate(routine.startsAt)} — `}
            {formatDate(routine.endsAt)}
          </p>
        )}
        {routine.description && (
          <p className="mt-1 text-sm text-[#888888]">{routine.description}</p>
        )}
      </div>

      {routine.days.map((day, dayIndex) => (
        <FadeIn key={day.id} delay={Math.min(dayIndex * 0.06, 0.4)}>
          <Card className="border-[#1e1e1e] bg-[#111111]">
            <CardHeader>
              <CardTitle className="text-xl text-white">{day.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {day.exercises.length === 0 ? (
                <p className="text-sm text-[#888888]">Sin ejercicios.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {day.exercises.map((ex, exIndex) => (
                    <li key={ex.id} className="flex gap-3 rounded-lg bg-white/5 p-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e8001c] font-display text-sm text-white">
                        {exIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">
                          {ex.exerciseName}
                        </p>
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
                        {ex.notes && (
                          <p className="mt-1.5 text-sm text-[#888888]">
                            {ex.notes}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      ))}

      <FadeIn delay={Math.min(routine.days.length * 0.06, 0.4) + 0.1}>
        <DeleteRoutineButton routineId={routine.id} isActive={routine.isActive} />
      </FadeIn>
    </div>
  );
}
