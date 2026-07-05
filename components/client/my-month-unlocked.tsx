import { MessageCircle, Trophy } from "lucide-react";
import type { MyMonthUnlocked as MyMonthUnlockedData } from "@/lib/supabase/my-month";

export function MyMonthUnlocked({ data }: { data: MyMonthUnlockedData }) {
  const {
    goal,
    currentWeightKg,
    adherencePercent,
    totalVolume,
    topExercises,
    previousMonth,
    coachReview,
  } = data;

  const weightDiff =
    currentWeightKg != null && goal.weightKg != null
      ? Math.round((currentWeightKg - goal.weightKg) * 10) / 10
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-[#e8001c]/40 bg-[#e8001c]/10 p-4 text-center">
        <Trophy className="mx-auto size-8 text-[#e8001c]" />
        <p className="mt-2 font-semibold text-white">¡Mes completado!</p>
      </div>

      <div className="rounded-lg border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="text-sm font-medium text-white">Tu objetivo</p>
        <p className="mt-1 text-sm text-[#888888]">{goal.mainGoal}</p>
        {weightDiff != null && (
          <p className="mt-2 text-sm text-[#888888]">
            Peso inicial: {goal.weightKg} kg → actual: {currentWeightKg} kg (
            {weightDiff > 0 ? "+" : ""}
            {weightDiff} kg)
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-xs text-[#888888]">Adherencia final</p>
          <p className="text-2xl font-semibold text-white">
            {adherencePercent}%
          </p>
        </div>
        <div className="rounded-lg border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="text-xs text-[#888888]">Volumen total</p>
          <p className="text-2xl font-semibold text-white">
            {totalVolume.toLocaleString("es-AR")} kg
          </p>
        </div>
      </div>

      {topExercises.length > 0 && (
        <div className="rounded-lg border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="mb-2 text-sm font-medium text-white">
            Evolución de cargas
          </p>
          <ul className="flex flex-col gap-2">
            {topExercises.map((ex) => (
              <li
                key={ex.exerciseName}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-[#888888]">{ex.exerciseName}</span>
                <span className="text-white">
                  {ex.firstWeight ?? "-"} kg → {ex.lastWeight ?? "-"} kg
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {previousMonth && (
        <div className="rounded-lg border border-[#1e1e1e] bg-[#111111] p-4">
          <p className="mb-2 text-sm font-medium text-white">
            Vs. mes anterior
          </p>
          <p className="text-sm text-[#888888]">
            Volumen: {totalVolume.toLocaleString("es-AR")} kg (mes pasado:{" "}
            {previousMonth.volume.toLocaleString("es-AR")} kg)
          </p>
          <p className="text-sm text-[#888888]">
            Días entrenados este mes vs. mes pasado: {previousMonth.trainedDays}
          </p>
        </div>
      )}

      <div className="rounded-lg border border-[#1e1e1e] bg-[#111111] p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
          <MessageCircle className="size-4 text-[#e8001c]" />
          Mensaje de tu coach
        </p>
        {coachReview?.completedAt ? (
          <div className="flex flex-col gap-2 text-sm text-[#888888]">
            {coachReview.summary && <p>{coachReview.summary}</p>}
            {coachReview.nextMonthGoals && (
              <p className="text-[#888888]">
                Objetivos del próximo mes: {coachReview.nextMonthGoals}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#888888]">
            Tu coach todavía no dejó su resumen del mes.
          </p>
        )}
      </div>
    </div>
  );
}
