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
import { CollapsibleCard } from "@/components/coach/collapsible-card";
import { RoutineQuickActions } from "@/components/coach/routine-quick-actions";
import { getClientDetail } from "@/lib/supabase/clients";
import { getClientsForSelect, getRoutineHistoryForClient } from "@/lib/supabase/routines";
import {
  getClientRoutineExercisesForSelect,
  getFeedbackForClient,
  getRecentSessionsForSelect,
} from "@/lib/supabase/feedback";
import { getMonthlyReviewFormData } from "@/lib/supabase/monthly-review";
import { isMonthEndToday } from "@/lib/supabase/monthly-goals";
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
import { getProgressPhotosForClient } from "@/lib/supabase/progress-photos";
import { EvaluationsTab } from "./evaluations-tab";
import { NutritionTab } from "./nutrition-tab";
import { getAccessDisplayStatus, PAYMENT_METHOD_LABEL } from "@/lib/constants/access";
import type { PaymentMethod } from "@/lib/constants/access";
import { formatDate } from "@/lib/utils/format-date";
import { AccessForm } from "./access-form";
import { DeleteClientButton } from "./delete-client-button";
import { FeedbackForm } from "./feedback-form";
import { MonthlyReviewForm } from "./monthly-review-form";
import { HideWeightToggle } from "./hide-weight-toggle";

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
    progressPhotos,
    allClients,
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
    getProgressPhotosForClient(id),
    getClientsForSelect(),
  ]);

  const metricsByRange: Record<MetricsRange, ClientMetrics> = {
    week: metricsWeek,
    month: metricsMonth,
    block: metricsBlock,
  };

  const accessBadge =
    ACCESS_BADGE[getAccessDisplayStatus(client.subscriptionStatus, client.subscriptionEndDate)];
  const paymentLabel = client.paymentMethod
    ? (PAYMENT_METHOD_LABEL[client.paymentMethod as PaymentMethod] ?? client.paymentMethod)
    : null;
  const accessSummary = [
    accessBadge.label,
    paymentLabel,
    client.subscriptionEndDate ? `vence ${formatDate(client.subscriptionEndDate)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Cierre de mes: el último día del mes, si todavía no está hecho, sube
  // arriba de todo y abierto — mismo criterio que la alerta del dashboard
  // (getMonthEndAlerts). El resto del mes queda colapsado abajo.
  const monthlyReviewDone = !!monthlyReviewData.review?.completedAt;
  const monthlyReviewUrgent = isMonthEndToday() && !monthlyReviewDone;

  const activeRoutine = routineHistory.active;
  const otherClients = allClients.filter((c) => c.id !== id);

  const monthlyReviewCard = (
    <Card className="border-[#1e1e1e] bg-[#111111]">
      <CardHeader>
        <CardTitle className="text-base text-white">Cierre de mes</CardTitle>
      </CardHeader>
      <CardContent>
        <MonthlyReviewForm clientId={id} data={monthlyReviewData} />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          {client.fullName ?? client.email}
        </h1>
        <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
        <p className="text-sm text-[#888888]">{client.email}</p>
        {/* Línea de estado: acceso y rutina sin abrir ninguna sección. */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#888888]">
          <Badge variant="default" className={accessBadge.className}>
            {accessBadge.label}
          </Badge>
          {client.subscriptionEndDate && (
            <span>vence {formatDate(client.subscriptionEndDate)}</span>
          )}
          <span aria-hidden>·</span>
          <span className="truncate">
            {activeRoutine ? `Rutina: ${activeRoutine.name}` : "Sin rutina activa"}
          </span>
        </div>
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
            photos={progressPhotos}
            photosPublicUseAuthorized={client.photosPublicUseAuthorized}
          />
        }
        nutricion={<NutritionTab clientId={id} plans={nutritionPlans} />}
        resumen={
          <>
            {monthlyReviewUrgent && (
              <FadeIn delay={0}>
                <div className="rounded-xl ring-1 ring-[#e8001c]/40">
                  {monthlyReviewCard}
                </div>
              </FadeIn>
            )}

            <FadeIn delay={0.05}>
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

            <FadeIn delay={0.1}>
              <Card className="border-[#1e1e1e] bg-[#111111]">
                <CardHeader>
                  <CardTitle className="text-base text-white">Dejar feedback</CardTitle>
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

            <FadeIn delay={0.15}>
              <Card className="border-[#1e1e1e] bg-[#111111]">
                <CardHeader>
                  <CardTitle className="text-base text-white">Rutina activa</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {!activeRoutine ? (
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
                          {activeRoutine.mesocicloNombre && (
                            <p className="text-xs tracking-wide text-[#888888] uppercase">
                              {activeRoutine.mesocicloNombre}
                            </p>
                          )}
                          <Link
                            href={`/coach/routines/${activeRoutine.id}`}
                            className="text-sm font-medium text-white hover:underline"
                          >
                            {activeRoutine.name}
                          </Link>
                          <p className="text-xs text-[#888888]">
                            {activeRoutine.startsAt ? formatDate(activeRoutine.startsAt) : "?"}{" "}
                            →{" "}
                            {activeRoutine.endsAt
                              ? formatDate(activeRoutine.endsAt)
                              : "Sin fecha de fin"}
                          </p>
                        </div>
                        <Badge variant="default">Activa</Badge>
                      </div>
                      <ExtendMesocicloButton
                        routineId={activeRoutine.id}
                        currentEndsAt={activeRoutine.endsAt}
                      />
                    </>
                  )}

                  <RoutineQuickActions
                    clientId={id}
                    routineId={activeRoutine?.id ?? null}
                    otherClients={otherClients}
                  />

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

            <FadeIn delay={0.2} className="flex flex-col gap-3">
              <CollapsibleCard title="Feedback dejado" summary={`${feedback.length}`}>
                <FeedbackList items={feedback} />
              </CollapsibleCard>

              {!monthlyReviewUrgent && (
                <CollapsibleCard
                  title="Cierre de mes"
                  summary={monthlyReviewDone ? "Completado" : "Sin hacer"}
                >
                  <MonthlyReviewForm clientId={id} data={monthlyReviewData} />
                </CollapsibleCard>
              )}

              <CollapsibleCard title="Datos y notas" summary={client.goal ?? undefined}>
                <div className="flex flex-col gap-2 text-sm text-[#888888]">
                  <p>
                    Fecha de nacimiento:{" "}
                    {client.birthDate ? formatDate(client.birthDate) : "-"}
                  </p>
                  <p>Peso: {client.weightKg ? `${client.weightKg} kg` : "-"}</p>
                  <p>Altura: {client.heightCm ? `${client.heightCm} cm` : "-"}</p>
                  <p>Objetivo: {client.goal ?? "-"}</p>
                  <p>Experiencia: {client.trainingExperience ?? "-"}</p>
                  <HideWeightToggle clientId={id} initial={client.hideWeightInReports} />
                  {client.notesCoach && (
                    <p className="mt-2 border-t border-[#1e1e1e] pt-3 whitespace-pre-line text-[#f5f5f5]">
                      {client.notesCoach}
                    </p>
                  )}
                </div>
              </CollapsibleCard>

              <CollapsibleCard title="Acceso y pagos" summary={accessSummary}>
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-[#888888]">
                    {paymentLabel
                      ? `Método actual: ${paymentLabel}`
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
                  {client.subscriptionStatus === "inactive" && (
                    <div className="mt-2 border-t border-[#1e1e1e] pt-4">
                      <DeleteClientButton clientId={id} />
                    </div>
                  )}
                </div>
              </CollapsibleCard>
            </FadeIn>
          </>
        }
      />
    </div>
  );
}
