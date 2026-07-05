import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/motion/fade-in";
import { FEEDBACK_TYPE_LABEL, FEEDBACK_TYPE_ICON } from "@/lib/constants/feedback";
import { getMyFeedback } from "@/lib/supabase/feedback";
import { formatDate } from "@/lib/utils/format-date";

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
        <ul className="flex flex-col gap-2">
          {feedback.map((f, i) => {
            const Icon = FEEDBACK_TYPE_ICON[f.type];
            return (
              <FadeIn
                key={f.id}
                delay={Math.min(i * 0.04, 0.3)}
                className="block"
              >
                <li>
                  <Link
                    href={`/client/feedback/${f.id}`}
                    className={`flex min-h-[44px] items-start gap-3 rounded-2xl border p-4 active:bg-white/5 ${
                      f.isRead
                        ? "border-[#1e1e1e] bg-[#111111]"
                        : "border-[#e8001c]/40 bg-[#e8001c]/10"
                    }`}
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                        f.isRead
                          ? "bg-white/5 text-[#888888]"
                          : "bg-[#e8001c] text-white shadow-[0_0_12px_rgba(232,0,28,0.4)]"
                      }`}
                    >
                      <Icon className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">
                          {FEEDBACK_TYPE_LABEL[f.type]}
                        </Badge>
                        <span className="shrink-0 text-xs text-[#888888]">
                          {formatDate(f.createdAt)}
                        </span>
                      </div>
                      <p
                        className={`mt-1 line-clamp-2 text-sm ${
                          f.isRead ? "text-[#888888]" : "text-white"
                        }`}
                      >
                        {f.message}
                      </p>
                    </div>
                  </Link>
                </li>
              </FadeIn>
            );
          })}
        </ul>
      )}
    </div>
  );
}
