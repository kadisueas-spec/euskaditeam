import Link from "next/link";
import { Activity, AlertTriangle, Clock, Flag } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/motion/fade-in";
import { getCoachDashboardData } from "@/lib/supabase/dashboard";
import { getMonthEndAlerts } from "@/lib/supabase/monthly-review";
import { getNoActiveRoutineAlerts } from "@/lib/supabase/routines";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import { formatDate } from "@/lib/utils/format-date";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export default async function CoachDashboardPage() {
  const [
    { activeCount, inactiveCount, expiringSoon, recentLogs, staleClients },
    monthEndAlerts,
    noActiveRoutineAlerts,
    profile,
  ] = await Promise.all([
    getCoachDashboardData(),
    getMonthEndAlerts(),
    getNoActiveRoutineAlerts(),
    getCurrentProfile(),
  ]);
  const firstName = (profile?.full_name?.trim().split(" ")[0] ?? "Coach").toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          Bienvenido, {firstName}
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>

      {(monthEndAlerts.length > 0 || noActiveRoutineAlerts.length > 0) && (
        <div className="flex flex-col gap-2">
          {monthEndAlerts.map((alert) => (
            <Link
              key={`month-${alert.clientId}`}
              href={`/coach/clients/${alert.clientId}`}
              className="flex items-center gap-2 rounded-lg border border-[#e8001c]/40 bg-[#e8001c]/10 p-3 text-sm text-white hover:bg-[#e8001c]/20"
            >
              <Flag className="size-4 shrink-0 text-[#e8001c]" />
              El mes de {alert.clientName} terminó — dejale tu resumen
            </Link>
          ))}
          {noActiveRoutineAlerts.map((alert) => (
            <Link
              key={`no-routine-${alert.clientId}`}
              href={`/coach/clients/${alert.clientId}`}
              className="flex items-center gap-2 rounded-lg border border-[#e8001c]/40 bg-[#e8001c]/10 p-3 text-sm text-white hover:bg-[#e8001c]/20"
            >
              <AlertTriangle className="size-4 shrink-0 text-[#e8001c]" />
              {alert.clientName} no tiene rutina activa
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <FadeIn delay={0}>
          <Card className="bg-[#111111] border-[#1e1e1e] py-5">
            <CardHeader className="gap-2 pb-0">
              <CardDescription>Clientes activos</CardDescription>
              <CardTitle className="font-display text-[64px] leading-none text-[#e8001c]">
                {activeCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </FadeIn>
        <FadeIn delay={0.05}>
          <Card className="bg-[#111111] border-[#1e1e1e] py-5">
            <CardHeader className="gap-2 pb-0">
              <CardDescription>Clientes inactivos</CardDescription>
              <CardTitle className="font-display text-[64px] leading-none text-[#e8001c]">
                {inactiveCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </FadeIn>
        <FadeIn delay={0.1}>
          <Card className="bg-[#111111] border-[#1e1e1e] py-5">
            <CardHeader className="gap-2 pb-0">
              <CardDescription>Suscripciones por vencer</CardDescription>
              <CardTitle className="font-display text-[64px] leading-none text-[#e8001c]">
                {expiringSoon.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </FadeIn>
        <FadeIn delay={0.15}>
          <Card className="bg-[#111111] border-[#1e1e1e] py-5">
            <CardHeader className="gap-2 pb-0">
              <CardDescription>Sin entrenar 5+ días</CardDescription>
              <CardTitle className="font-display text-[64px] leading-none text-[#e8001c]">
                {staleClients.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </FadeIn>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-[#111111] border-[#1e1e1e]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Clock className="size-4 text-[#e8001c]" />
              Suscripciones por vencer en 7 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringSoon.length === 0 ? (
              <p className="text-sm text-[#888888]">No hay vencimientos próximos.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {expiringSoon.map((client) => (
                  <li key={client.id} className="flex items-center justify-between">
                    <Link
                      href={`/coach/clients/${client.id}`}
                      className="text-sm text-white hover:underline"
                    >
                      {client.fullName ?? client.email}
                    </Link>
                    <Badge variant="secondary" className="bg-[#e8001c]/20 text-[#ff4d4d]">
                      {client.subscriptionEndDate
                        ? formatDate(client.subscriptionEndDate)
                        : "-"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#111111] border-[#1e1e1e]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <AlertTriangle className="size-4 text-[#e8001c]" />
              Clientes que no entrenaron en más de 5 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staleClients.length === 0 ? (
              <p className="text-sm text-[#888888]">
                Todos tus clientes activos entrenaron recientemente.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {staleClients.map((client) => (
                  <li key={client.id} className="flex items-center justify-between">
                    <Link
                      href={`/coach/clients/${client.id}`}
                      className="text-sm text-white hover:underline"
                    >
                      {client.fullName ?? client.email}
                    </Link>
                    <span className="text-xs text-[#888888]">
                      {client.lastWorkoutDate
                        ? `Último: ${formatDate(client.lastWorkoutDate)}`
                        : "Nunca entrenó"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#111111] border-[#1e1e1e]">
        <CardHeader>
          <CardTitle className="text-base text-white">
            Últimas sesiones registradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Todavía no hay entrenamientos registrados."
              className="py-4"
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {recentLogs.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-2">
                  <Link
                    href={`/coach/clients/${log.clientId}`}
                    className="flex items-center gap-2.5 text-sm text-white hover:underline"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8001c] text-xs font-semibold text-white">
                      {initials(log.clientName)}
                    </span>
                    {log.clientName}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge variant={log.isCompleted ? "default" : "outline"}>
                      {log.isCompleted ? "Completado" : "En curso"}
                    </Badge>
                    <span className="text-xs text-[#888888]">
                      {formatDate(log.workoutDate)}
                    </span>
                    <Link
                      href={`/coach/clients/${log.clientId}?session=${log.id}`}
                      className="text-xs text-[#e8001c] hover:underline"
                    >
                      Dejar feedback
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
