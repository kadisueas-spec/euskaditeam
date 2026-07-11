import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FEEDBACK_TYPE_LABEL, FEEDBACK_TYPE_ICON } from "@/lib/constants/feedback";
import { formatDate } from "@/lib/utils/format-date";
import type { FeedbackItem } from "@/lib/supabase/feedback";

export function FeedbackList({ items }: { items: FeedbackItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Todavía no le dejaste feedback a este cliente."
        className="py-4"
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((f) => {
        const Icon = FEEDBACK_TYPE_ICON[f.type];
        return (
          <li key={f.id} className="flex gap-3 rounded-lg bg-white/5 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8001c]/15 text-[#e8001c]">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">{FEEDBACK_TYPE_LABEL[f.type]}</Badge>
                <span className="text-xs text-[#888888]">
                  {formatDate(f.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#888888]">{f.message}</p>
              {(f.workoutDate || f.exerciseName) && (
                <p className="mt-1 text-xs text-[#888888]">
                  {f.workoutDate ? `Sesión: ${formatDate(f.workoutDate)}` : ""}
                  {f.workoutDate && f.exerciseName ? " · " : ""}
                  {f.exerciseName ? `Ejercicio: ${f.exerciseName}` : ""}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
