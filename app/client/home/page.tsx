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
import { PlanList, PlanRow } from "@/components/client/plan-card";
import { HomeStats } from "@/components/client/home-stats";
import { RoutineWelcomeBanner } from "@/components/client/routine-welcome-banner";
import { HomeTour } from "@/components/client/home-tour";
import { FadeIn } from "@/components/motion/fade-in";
import { getClientHomeData } from "@/lib/supabase/client-home";
import { getActiveWorkoutSession } from "@/lib/supabase/client-routine";
import { getClientReport, getPendingClientReports } from "@/lib/supabase/progress-reports";
import { pickAutoOpenReport } from "@/lib/reports/auto-open";
import { todayInParaguay } from "@/lib/utils/today";
import { HomeReportAccess } from "@/components/client/home-report-access";
import { randomMotivationalPhrase } from "@/lib/constants/motivational-phrases";
import { formatFriendlyDate } from "@/lib/utils/format-date";

// Inicio del cliente — rediseño nov-2026 "Vestuario en capas": misma forma
// que el login (AuthHero + AuthCard). Arriba, sobre el degradé radial rojo
// oscuro, el saludo y la rutina de hoy como protagonista; abajo, una
// tarjeta que sube encima (esquinas de 32px) con el reporte pendiente, la
// racha/adherencia y la lista del plan. La zona de arriba y la tarjeta se
// salen del padding del <main> del layout (-mx-4, -mt-5, -mb-5) para llegar
// de borde a borde; eso vive solo acá, el layout no cambia.
export default async function ClientHomePage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
}) {
  const { report: requestedReportId } = await searchParams;
  const [data, activeWorkout, pendingReports, requestedReport] = await Promise.all([
    getClientHomeData(),
    getActiveWorkoutSession(),
    getPendingClientReports(),
    // ?report=<id> llega desde la push del reporte: se abre solo.
    requestedReportId ? getClientReport(requestedReportId) : Promise.resolve(null),
  ]);
  const motivationalPhrase = randomMotivationalPhrase();

  if (!data) return null;

  // Reporte que se abre solo (oct-2026): el más reciente sin abrir, 1 vez
  // por día y 3 por reporte, nunca con un entrenamiento en curso.
  const autoOpenId = requestedReport
    ? null
    : pickAutoOpenReport({
        reports: pendingReports,
        today: todayInParaguay(),
        workoutInProgress: !!activeWorkout,
      });

  // "Días sin evaluación" dejó de ser un número suelto: va en la fila de
  // Mi Cuerpo.
  const daysSinceEval = data.daysSinceLastEvaluation;
  const sinceEvalLabel =
    daysSinceEval == null ? "" : daysSinceEval === 0 ? " · hoy" : ` · hace ${daysSinceEval} día${daysSinceEval === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col">
      {/* Zona de arriba: degradé con el saludo y la rutina de hoy */}
      <section className="hero-vivid relative -mx-4 overflow-hidden -mt-5 px-5 pt-6 pb-14">
        <FadeIn>
          <ClientGreeting name={data.firstName} />
          <p className="mt-1.5 text-base leading-snug text-(--hero-text-soft) italic">&ldquo;{motivationalPhrase}&rdquo;</p>
        </FadeIn>

        {data.hasRoutine && (
          <FadeIn className="mt-6">
            <div data-tour="today-workout" className="relative">
              <NextWorkoutCard
                activeWorkout={activeWorkout}
                trainedToday={data.trainedToday}
                todaySummary={data.todaySummary}
                suggestedDay={data.suggestedDay}
                completedCount={data.completedThisWeek}
                plannedCount={data.plannedThisWeek}
              />
            </div>
          </FadeIn>
        )}
      </section>

      {/* Tarjeta que sube sobre el degradé */}
      <div className="surface-sheet animate-slide-up-in relative z-10 -mx-4 -mt-8 -mb-5 flex flex-col gap-3 rounded-t-[32px] px-4 pt-5 pb-8">
        {(pendingReports.length > 0 || requestedReport) && (
          <HomeReportAccess
            key={requestedReport?.id ?? "home"}
            reports={pendingReports}
            requested={requestedReport}
            autoOpenId={autoOpenId}
            waitForWelcomeBanner={!!data.welcomeBanner}
            waitForTour={!!data.homeTourRoutineId}
          />
        )}

        <HomeStats
          dailyStreak={data.dailyStreak}
          bestDailyStreak={data.bestDailyStreak}
          recentDays={data.recentDays}
          adherencePercent={data.adherencePercent}
        />

        <PlanList>
          <PlanRow
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
          <PlanRow
            href="/client/body?tab=nutricion"
            icon={Salad}
            label="Nutrición"
            detail={
              data.nutritionCard
                ? `Plan de ${data.nutritionCard.monthLabel} disponible`
                : "Tu coach está preparando tu plan"
            }
            hasData={!!data.nutritionCard}
          />
          <PlanRow
            tour="body-card"
            href="/client/body?tab=cuerpo"
            icon={Ruler}
            label="Mi Cuerpo"
            detail={
              data.bodyCard
                ? data.bodyCard.bodyFatPercentage != null
                  ? `${data.bodyCard.bodyFatPercentage}% de grasa${sinceEvalLabel || ` · medido el ${formatFriendlyDate(data.bodyCard.evaluationDate)}`}`
                  : `Última medición el ${formatFriendlyDate(data.bodyCard.evaluationDate)}${sinceEvalLabel}`
                : "Tu primera evaluación está por venir"
            }
            hasData={!!data.bodyCard}
          />
          <PlanRow
            href="/client/body?tab=cuerpo"
            icon={Camera}
            label="Fotos de Progreso"
            detail={
              data.photosCard
                ? `${data.photosCard.count} foto${data.photosCard.count === 1 ? "" : "s"} · última hace ${data.photosCard.daysSinceLast} día${data.photosCard.daysSinceLast === 1 ? "" : "s"}`
                : "Subí tu primera foto de chequeo"
            }
            hasData={!!data.photosCard}
          />
          <PlanRow
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
          <PlanRow
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
        </PlanList>
      </div>

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

      {/* Recorrido de bienvenida, parte Inicio (oct-2026): una vez por
          rutina, después del banner "Empecemos" si este también sale. */}
      {data.homeTourRoutineId && (
        <HomeTour
          routineId={data.homeTourRoutineId}
          waitForWelcomeBanner={!!data.welcomeBanner}
        />
      )}
    </div>
  );
}
