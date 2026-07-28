import { Flame, Trophy } from "lucide-react";
import type { MonthSummaryStreaks } from "@/lib/supabase/month-summary";

export function MonthRecapStreaks({ streaks }: { streaks: MonthSummaryStreaks }) {
  return (
    <div className="flex flex-col gap-4 py-10">
      <p className="text-center font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
        Rachas
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-xs text-[#888888] uppercase">Racha más larga</p>
          <p className="mt-1 font-display text-4xl text-[#e8001c]">
            {streaks.longestDailyStreakInMonth}
            <span className="text-lg text-[#888888]">
              {" "}
              día{streaks.longestDailyStreakInMonth === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-xs text-[#888888] uppercase">Semanas completas</p>
          <p className="mt-1 font-display text-4xl text-[#e8001c]">
            {streaks.completeWeeksCount}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-full bg-white/5 px-4 py-2 text-center text-sm font-medium text-[#f5f5f5]">
        <Flame className="size-4 text-[#e8001c]" />
        Racha semanal actual: {streaks.currentWeeklyStreak} semana
        {streaks.currentWeeklyStreak === 1 ? "" : "s"}
      </div>

      {streaks.isNewStreakRecord && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#e8001c]/40 bg-[#e8001c]/10 p-4">
          <Trophy className="size-6 shrink-0 text-[#e8001c]" />
          <p className="text-sm font-medium text-white">
            Superaste tu récord de racha anterior. 🔥
          </p>
        </div>
      )}
    </div>
  );
}
