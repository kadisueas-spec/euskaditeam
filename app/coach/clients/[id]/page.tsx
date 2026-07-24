import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/motion/fade-in";
import { FeedbackList } from "@/components/coach/feedback-list";
import { ClientDetailTabs } from "@/components/coach/client-detail-tabs";
import { ClientMetricsTab } from "@/components/coach/client-metrics-tab";
import { RecentLogsList } from "@/components/coach/recent-logs-list";
import { ExtendMesocicloButton } from "@/components/coach/extend-mesociclo-button";
import { getClientDetail } from "@/lib/supabase/clients";
import { getRoutineHistoryForClient } from "@/lib/supabase/routines";
import {
  getClientRoutineExercisesForSelect,
  getFeedbackForClient,
  getRecentSessionsForSelect,
} from "@/lib/supabase/feedback";
import { getMonthlyReviewFormData } from "@/lib/supabase/monthly-review";
import {
  getClientMetrics,
  getExerciseSessionSeries,
  type ClientMetrics,
  type MetricsRange,
} from "@/lib/supabase/metrics";
import {
  getClientBodyEvaluations,
  getEvaluationsForClient,
} from "@/lib/supabase/anthropometrics";
import { getClientWeightLogs } from "@/lib/supabase/weight-logs";
import { getClientSubscription } from "@/lib/supabase/subscriptions";
import { getNutritionPlansForClient } from "@/lib/supabase/nutrition";
import { EvaluationsTab } from "./evaluations-tab";
import { NutritionTab } from "./nutrition-tab";
import { getAccessDisplayStatus, PAYMENT_METHOD_LABEL } from "@/lib/constants/access";
import type { PaymentMethod } from "@/lib/constants/access";
import { formatDate } from "@/lib/utils/format-date";
import { AccessForm } from "./access-form";
import { DeleteClientButton } from "./delete-client-button";
import { FeedbackForm } from "./feedback-form";
import { MonthlyReviewForm } from "./monthly-review-form";

const ACCESS_BADGE: Record<
  ReturnType<typeof getAccessDisplayStatus>,
  { label: string; className: string }
> = {
  active: { label: "Activo", className: "bg-green-500/15 text-green-400" },
  expiring_soon: {
    label: "Por vencer",
    className: "bg-yellow-500/15 text-yellow-400",
  },
  expired: { label: "Vencido", className: "bg-[#e8001c]/15 text-[#ff4d4d]" },
  inactive: { label: "Inactivo", className: "bg-[#e8001c]/15 text-[#ff4d4d]" },
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { id } = await params;
  const { session: defaultSessionId } = await searchParams;
  const client = await getClientDetail(id);

  if (!client) notFound();

  const [
    feedback,
    sessions,
    exercises,
    monthlyReviewData,
    metricsWeek,
    metricsMonth,
    metricsBlock,
    sessionSeries,
    evaluations,
    bodyEvaluations,
    weightLogs,
    nutritionPlans,
    subscription,
    routineHistory,
  ] = await Promise.all([
    getFeedbackForClient(id),
    getRecentSessionsForSelect(id),
    getClientRoutineExercisesForSelect(id),
    getMonthlyReviewFormData(id),
    getClientMetrics(id, "week"),
    getClientMetrics(id, "month"),
    getClientMetrics(id, "block"),
    getExerciseSessionSeries(id),
    getEvaluationsForClient(id),
    getClientBodyEvaluations(id),
    getClientWeightLogs(id),
    getNutritionPlansForClient(id),
    getClientSubscription(id),
    getRoutineHistoryForClient(id),
  ]);

  const metricsByRange: Record<MetricsRange, ClientMetrics> = {
    week: metricsWeek,
    month: metricsMonth,
    block: metricsBlock,
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          {client.fullName ?? client.email}
        </h1>
        <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
        <p className="text-sm text-[#888888]">{client.email}</p>
      </div>

      <ClientDetailTabs
        metricas={
          <ClientMetricsTab
            metricsByRange={metricsByRange}
            sessionSeries={sessionSeries}
          />
        }
        evaluaciones={
          <EvaluationsTab
            clientId={id}
            evaluations={evaluations}
            bodyEvaluations={bodyEvaluations}
            weightLogs={weightLogs}
          />
        }
        nutricion={<NutritionTab clientId={id} plans={nutritionPlans} />}
        resumen={
          <>
      <FadeIn delay={0}>
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardHeader>
            <CardTitle className="text-base text-white">Datos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-[#888888]">
            <p>
              Fecha de nacimiento:{" "}
              {client.birthDate ? formatDate(client.birthDate) : "-"}
            </p>
            <p>Peso: {client.weightKg ? `${client.weightKg} kg` : "-"}</p>
            <p>Altura: {client.heightCm ? `${client.heightCm} cm` : "-"}</p>
            <p>Objetivo: {client.goal ?? "-"}</p>
            <p>Experiencia: {client.trainingExperience ?? "-"}</p>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-white">Acceso</CardTitle>
              {(() => {
                const status = getAccessDisplayStatus(
                  client.subscriptionStatus,
                  client.subscriptionEndDate
                );
                const badge = ACCESS_BADGE[status];
                return (
                  <Badge variant="default" className={badge.className}>
                    {badge.label}
                  </Badge>
                );
              })()}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-[#888888]">
              {client.paymentMethod
                ? `Método actual: ${PAYMENT_METHOD_LABEL[client.paymentMethod as PaymentMethod] ?? client.paymentMethod}`
                : "Todavía no se registró un pago."}
              {client.subscriptionEndDate &&
                ` · Vence: ${formatDate(client.subscriptionEndDate)}`}
            </p>
            <AccessForm
              clientId={id}
              currentPaymentMethod={client.paymentMethod}
              currentEndDate={client.subscriptionEndDate}
              isCurrentlyActive={client.subscriptionStatus === "active"}
              subscription={subscription}
            />
          </CardContent>
        </Card>
      </FadeIn>

      {client.notesCoach && (
        <FadeIn delay={0.1}>
          <Card className="border-[#1e1e1e] bg-[#111111]">
            <CardHeader>
              <CardTitle className="text-base text-white">Notas</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[#888888]">
              {client.notesCoach}
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <FadeIn delay={0.15}>
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardHeader>
            <CardTitle className="text-base text-white">Rutina activa</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!routineHistory.active ? (
              <EmptyState
                icon={ClipboardList}
                title="Este cliente todavía no tiene una rutina."
                description="Es hora de armarle una."
                className="py-4"
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {routineHistory.active.mesocicloNombre && (
                      <p className="text-xs tracking-wide text-[#888888] uppercase">
                        {routineHistory.active.mesocicloNombre}
                      </p>
                    )}
                    <Link
                      href={`/coach/routines/${routineHistory.active.id}`}
                      className="text-sm font-medium text-white hover:underline"
                    >
                      {routineHistory.active.name}
                    </Link>
                    <p className="text-xs text-[#888888]">
                      {routineHistory.active.startsAt
                        ? formatDate(routineHistory.active.startsAt)
                        : "?"}{" "}
                      →{" "}
                      {routineHistory.active.endsAt
                        ? formatDate(routineHistory.active.endsAt)
                        : "Sin fecha de fin"}
                    </p>
                  </div>
                  <Badge variant="default">Activa</Badge>
                </div>
                <ExtendMesocicloButton
                  routineId={routineHistory.active.id}
                  currentEndsAt={routineHistory.active.endsAt}
                />
              </>
            )}

            {routineHistory.archived.length > 0 && (
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 text-sm text-[#888888] select-none hover:text-white">
                  <History className="size-4" />
                  Historial de rutinas ({routineHistory.archived.length})
                </summary>
                <ul className="mt-3 flex flex-col gap-3">
                  {routineHistory.archived.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-[#1e1e1e] p-3 text-sm"
                    >
                      {r.mesocicloNombre && (
                        <p className="text-xs tracking-wide text-[#888888] uppercase">
                          {r.mesocicloNombre}
                        </p>
                      )}
                      <Link
                        href={`/coach/routines/${r.id}`}
                        className="font-medium text-white hover:underline"
                      >
                        {r.name}
                      </Link>
                      <p className="mt-1 text-xs text-[#888888]">
                        {r.startsAt ? formatDate(r.startsAt) : "?"} →{" "}
                        {r.endsAt ? formatDate(r.endsAt) : "?"}
                      </p>
                      <p className="text-xs text-[#888888]">
                        {r.completedSessionsCount}{" "}
                        {r.completedSessionsCount === 1
                          ? "sesión completada"
                          : "sesiones completadas"}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.2}>
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Últimos entrenamientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {client.recentLogs.length === 0 ? (
              <EmptyState
                icon={History}
                title="Todavía no registró ningún entrenamiento."
                className="py-4"
              />
            ) : (
              <RecentLogsList clientId={id} logs={client.recentLogs} />
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.25}>
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Dejar feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FeedbackForm
              clientId={id}
              sessions={sessions}
              exercises={exercises}
              defaultSessionId={defaultSessionId}
            />
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.3}>
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Feedback dejado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FeedbackList items={feedback} />
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.35}>
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Cierre de mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyReviewForm clientId={id} data={monthlyReviewData} />
          </CardContent>
        </Card>
      </FadeIn>

      {client.subscriptionStatus === "inactive" && (
        <FadeIn delay={0.4}>
          <DeleteClientButton clientId={id} />
        </FadeIn>
      )}
          </>
        }
      />
    </div>
  );
}
