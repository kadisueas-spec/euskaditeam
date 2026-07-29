import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { getWorkoutLogDetail } from "@/lib/supabase/workout-history";
import { formatFriendlyDate } from "@/lib/utils/format-date";
import { EDIT_WINDOW_DAYS, isWithinEditWindow } from "@/lib/utils/edit-window";
import { DeleteWorkoutLogButton } from "./delete-workout-log-button";
import { HistoryDetail } from "./history-detail";

export default async function WorkoutLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const log = await getWorkoutLogDetail(id);

  if (!log) notFound();

  const editable = isWithinEditWindow(log.workoutDate);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
            {log.dayName ?? "Entrenamiento"}
          </h1>
          <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
          <p className="text-sm text-[#888888]">{formatFriendlyDate(log.workoutDate)}</p>
          {log.energyLevel != null && (
            <p className="mt-1 text-sm text-[#888888]">
              Energía: {log.energyLevel}/5
            </p>
          )}
        </div>
        {editable && <DeleteWorkoutLogButton workoutLogId={log.id} />}
      </div>

      {log.clientNotes && (
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardContent className="p-4 text-sm text-[#888888]">
            {log.clientNotes}
          </CardContent>
        </Card>
      )}

      {!editable && (
        <p className="text-xs text-[#666666]">
          Esta sesión tiene más de {EDIT_WINDOW_DAYS} días — ya no se puede editar.
        </p>
      )}

      <HistoryDetail log={log} editable={editable} />
    </div>
  );
}
