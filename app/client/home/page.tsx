import {
  Camera,
  ClipboardList,
  PlayCircle,
  Ruler,
  Salad,
  TrendingUp,
} from "lucide-react";
import { ClientGreeting } from "@/components/client/client-greeting";
import { NextWorkoutCard } from "@/components/client/next-workout-card";
import { PlanCard } from "@/components/client/plan-card";
import { RoutineWelcomeBanner } from "@/components/client/routine-welcome-banner";
import { FadeIn } from "@/components/motion/fade-in";
import { getClientHomeData } from "@/lib/supabase/client-home";
import { randomMotivationalPhrase } from "@/lib/constants/motivational-phrases";
import { formatFriendlyDate } from "@/lib/utils/format-date";

export default async function ClientHomePage() {
  const data = await getClientHomeData();
  const motivationalPhrase = randomMotivationalPhrase();

  if (!data) return null;

  const daysSinceEvalLabel =
    data.daysSinceLastEvaluation == null ? "—" : String(data.daysSinceLastEvaluation);

  return (
    <div className="flex flex-col gap-4">
      <FadeIn>
        <ClientGreeting name={data.firstName} />
        <p className="mt-2 text-xl leading-snug font-medium text-[#f5f5f5] italic">
          &ldquo;{motivationalPhrase}&rdquo;
        </p>
      </FadeIn>

      {data.hasRoutine && (
        <FadeIn>
          <NextWorkoutCard
            trainedToday={data.trainedToday}
            todaySummary={data.todaySummary}
            suggestedDay={data.suggestedDay}
            completedCount={data.completedThisWeek}
            plannedCount={data.plannedThisWeek}
          />
        </FadeIn>
      )}

      <FadeIn delay={0.05}>
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/5 p-3">
          <div className="text-center">
            <p className="font-display text-2xl text-[#e8001c]">{data.dailyStreak}</p>
            <p className="text-[10px] tracking-wide text-[#888888] uppercase">
              Días de racha
            </p>
          </div>
          <div className="border-x border-[#1e1e1e] text-center">
            <p className="font-display text-2xl text-[#e8001c]">
              {data.adherencePercent}%
            </p>
            <p className="text-[10px] tracking-wide text-[#888888] uppercase">
              Adherencia
            </p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl text-[#e8001c]">{daysSinceEvalLabel}</p>
            <p className="text-[10px] tracking-wide text-[#888888] uppercase">
              Días s/ evaluación
            </p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1} className="flex flex-col gap-2">
        <PlanCard
          href="/client/my-routine"
          icon={ClipboardList}
          label="Mi Rutina"
          detail={
            data.routineCard
              ? `${data.routineCard.mesocicloNombre ?? "Rutina activa"} · ${data.routineCard.daysPerWeek} días por semana`
              : "Tu coach está preparando tu rutina"
          }
          hasData={!!data.routineCard}
        />
        <PlanCard
          href="/client/progress?tab=nutricion"
          icon={Salad}
          label="Nutrición"
          detail={
            data.nutritionCard
              ? `Plan de ${data.nutritionCard.monthLabel} disponible`
              : "Tu coach está preparando tu plan"
          }
          hasData={!!data.nutritionCard}
        />
        <PlanCard
          href="/client/progress?tab=cuerpo"
          icon={Ruler}
          label="Mi Cuerpo"
          detail={
            data.bodyCard
              ? data.bodyCard.bodyFatPercentage != null
                ? `${data.bodyCard.bodyFatPercentage}% de grasa · medido el ${formatFriendlyDate(data.bodyCard.evaluationDate)}`
                : `Última medición el ${formatFriendlyDate(data.bodyCard.evaluationDate)}`
              : "Tu primera evaluación está por venir"
          }
          hasData={!!data.bodyCard}
        />
        <PlanCard
          href="/client/progress?tab=cuerpo"
          icon={Camera}
          label="Fotos de Progreso"
          detail={
            data.photosCard
              ? `${data.photosCard.count} foto${data.photosCard.count === 1 ? "" : "s"} · última hace ${data.photosCard.daysSinceLast} día${data.photosCard.daysSinceLast === 1 ? "" : "s"}`
              : "Subí tu primera foto de chequeo"
          }
          hasData={!!data.photosCard}
        />
        <PlanCard
          href="/client/videos"
          icon={PlayCircle}
          label="Videos"
          detail={
            data.videosCard.totalCount === 0
              ? "Tu coach está preparando material para vos"
              : data.videosCard.unseenCount > 0
                ? `${data.videosCard.unseenCount} video${data.videosCard.unseenCount === 1 ? "" : "s"} nuevo${data.videosCard.unseenCount === 1 ? "" : "s"}`
                : `${data.videosCard.totalCount} video${data.videosCard.totalCount === 1 ? "" : "s"} disponible${data.videosCard.totalCount === 1 ? "" : "s"}`
          }
          hasData={data.videosCard.totalCount > 0}
        />
        <PlanCard
          href="/client/progress"
          icon={TrendingUp}
          label="Mi Progreso"
          detail={
            data.progressCard.completedWorkoutsCount > 0
              ? `${data.progressCard.completedWorkoutsCount} entrenamiento${data.progressCard.completedWorkoutsCount === 1 ? "" : "s"} completado${data.progressCard.completedWorkoutsCount === 1 ? "" : "s"}`
              : "Completá tu primer entrenamiento para ver tu progreso"
          }
          hasData={data.progressCard.completedWorkoutsCount > 0}
        />
      </FadeIn>

      {data.welcomeBanner && (
        <RoutineWelcomeBanner
          routineId={data.welcomeBanner.routineId}
          firstName={data.firstName}
          sex={data.sex}
          routineName={data.welcomeBanner.routineName}
          mesocicloNombre={data.welcomeBanner.mesocicloNombre}
          daysPerWeek={data.welcomeBanner.daysPerWeek}
          isFirstRoutine={data.welcomeBanner.isFirstRoutine}
        />
      )}
    </div>
  );
}
