import { FeedbackInboxList } from "@/components/client/feedback-inbox-list";
import { getMyFeedback } from "@/lib/supabase/feedback";

export default async function FeedbackInboxPage() {
  const feedback = await getMyFeedback();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          Feedback
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>

      {feedback.length === 0 ? (
        <p className="text-sm text-[#888888]">
          Todavía no recibiste feedback de tu coach.
        </p>
      ) : (
        <FeedbackInboxList feedback={feedback} />
      )}
    </div>
  );
}
