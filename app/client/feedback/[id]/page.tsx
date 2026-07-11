import { notFound } from "next/navigation";
import { FadeIn } from "@/components/motion/fade-in";
import { FEEDBACK_TYPE_LABEL, FEEDBACK_TYPE_ICON } from "@/lib/constants/feedback";
import { getFeedbackDetail } from "@/lib/supabase/feedback";
import { formatFriendlyDate } from "@/lib/utils/format-date";
import { MarkReadOnMount } from "./mark-read-on-mount";

export default async function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const feedback = await getFeedbackDetail(id);

  if (!feedback) notFound();

  const Icon = FEEDBACK_TYPE_ICON[feedback.type];

  return (
    <FadeIn className="flex flex-col gap-4">
      <MarkReadOnMount id={feedback.id} alreadyRead={feedback.isRead} />
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e8001c] text-white shadow-[0_0_16px_rgba(232,0,28,0.4)]">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
            {FEEDBACK_TYPE_LABEL[feedback.type]}
          </p>
          <span className="text-sm text-[#888888]">
            {formatFriendlyDate(feedback.createdAt)}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="text-base text-white">{feedback.message}</p>
      </div>

      {(feedback.workoutDate || feedback.exerciseName) && (
        <div className="flex flex-col gap-1 rounded-2xl bg-white/5 p-4 text-sm text-[#888888]">
          {feedback.workoutDate && <p>Sesión: {formatFriendlyDate(feedback.workoutDate)}</p>}
          {feedback.exerciseName && <p>Ejercicio: {feedback.exerciseName}</p>}
        </div>
      )}
    </FadeIn>
  );
}
