import { notFound } from "next/navigation";
import { ClipboardList, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/motion/fade-in";
import { FeedbackList } from "@/components/coach/feedback-list";
import { HydrationProbe } from "@/components/coach/hydration-probe";
import { ClientDetailTabs } from "@/components/coach/client-detail-tabs";
import { ClientMetricsTab } from "@/components/coach/client-metrics-tab";
import { RecentLogsList } from "@/components/coach/recent-logs-list";
import { getClientDetail } from "@/lib/supabase/clients";
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
  ] = await Promise.all([
    getFeedbackForClient(id),
    getRecentSessionsForSelect(id),
    getClientRoutineExercisesForSelect(id),
    getMonthlyReviewFormData(id),
    getClientMetrics(id, "week"),
    getClientMetrics(id, "month"),
    getClientMetrics(id, "block"),
    getExerciseSessionSeries(id),
  ]);

  const metricsByRange: Record<MetricsRange, ClientMetrics> = {
    week: metricsWeek,
    month: metricsMonth,
    block: metricsBlock,
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <HydrationProbe />
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
            <CardTitle className="text-base text-white">Rutinas</CardTitle>
          </CardHeader>
          <CardContent>
            {client.routines.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Este cliente todavía no tiene una rutina."
                description="Es hora de armarle una."
                className="py-4"
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {client.routines.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-white">{r.name}</span>
                    <Badge variant={r.isActive ? "default" : "outline"}>
                      {r.isActive ? "Activa" : "Archivada"}
                    </Badge>
                  </li>
                ))}
              </ul>
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
