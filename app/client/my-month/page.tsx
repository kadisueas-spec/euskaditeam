import { Lock } from "lucide-react";
import { MyMonthUnlocked } from "@/components/client/my-month-unlocked";
import { FadeIn } from "@/components/motion/fade-in";
import {
  getMyMonthProgress,
  getMyMonthUnlockedData,
} from "@/lib/supabase/my-month";

export default async function MyMonthPage() {
  const progress = await getMyMonthProgress();

  if (!progress || !progress.goal) {
    return (
      <div>
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          Mi Mes
        </h1>
        <p className="mt-2 text-sm text-[#888888]">
          No se encontraron datos del mes.
        </p>
      </div>
    );
  }

  if (progress.isUnlocked) {
    const unlockedData = await getMyMonthUnlockedData();
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
          Mi Mes
        </h1>
        {unlockedData ? (
          <MyMonthUnlocked data={unlockedData} />
        ) : (
          <p className="text-sm text-[#888888]">
            No se encontraron datos del mes.
          </p>
        )}
      </div>
    );
  }

  const {
    goal,
    trainedDays,
    plannedDays,
    streak,
    totalDaysInMonth,
    trainedDates,
    daysUntilUnlock,
  } = progress;
  const percent =
    plannedDays > 0
      ? Math.min(100, Math.round((trainedDays / plannedDays) * 100))
      : 0;
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const trainedSet = new Set(trainedDates);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl tracking-wide text-[#f5f5f5] uppercase">
        Mi Mes
      </h1>

      <div className="grid grid-cols-2 gap-4">
        <FadeIn delay={0}>
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
            <p className="text-sm text-[#888888]">Días entrenados</p>
            <p className="mt-1 font-display text-4xl text-[#e8001c]">
              {trainedDays}
              <span className="text-lg text-[#888888]">/{plannedDays}</span>
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
            <p className="text-sm text-[#888888]">Racha actual</p>
            <p className="mt-1 font-display text-4xl text-[#e8001c]">
              {streak}
              <span className="text-lg text-[#888888]">
                {" "}
                día{streak === 1 ? "" : "s"}
              </span>
            </p>
          </div>
        </FadeIn>
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#e8001c] transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-right text-xs text-[#888888]">
          {percent}% del plan
        </p>
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="mb-3 text-sm font-medium text-white">Días del mes</p>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: totalDaysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const dateStr = `${monthPrefix}-${String(dayNum).padStart(2, "0")}`;
            const trained = trainedSet.has(dateStr);
            return (
              <span
                key={dayNum}
                title={dateStr}
                className={`flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                  trained
                    ? "bg-[#e8001c] text-white shadow-[0_0_8px_rgba(232,0,28,0.5)]"
                    : "bg-white/10 text-[#888888]"
                }`}
              >
                {dayNum}
              </span>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="mb-2 text-sm font-medium text-white">
          Tu objetivo del mes
        </p>
        <p className="text-sm text-[#888888]">{goal.mainGoal}</p>
        {goal.improveNote && (
          <p className="mt-2 text-sm text-[#888888]">
            Mejorar: {goal.improveNote}
          </p>
        )}
      </div>

      <FadeIn delay={0.1}>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#e8001c]/30 bg-[#111111] p-6 text-center">
          <span className="glow-pulse flex size-14 items-center justify-center rounded-full bg-[#e8001c]/15">
            <Lock className="size-7 text-[#e8001c]" />
          </span>
          <p className="font-display text-3xl tracking-wide text-[#f5f5f5]">
            {daysUntilUnlock === 0
              ? "SE DESBLOQUEA HOY"
              : `${daysUntilUnlock} DÍA${daysUntilUnlock === 1 ? "" : "S"} PARA DESBLOQUEAR`}
          </p>
          <p className="text-sm text-white">
            Al terminar el mes vas a ver acá si llegaste a tu objetivo. Cada
            sesión cuenta — ¡seguí así!
          </p>
          <p className="text-xs font-medium text-[#888888]">— Luis Mineur</p>
        </div>
      </FadeIn>
    </div>
  );
}
