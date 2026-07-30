import Link from "next/link";
import { ChevronRight, LogOut, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { RestTimerSettings } from "@/components/client/rest-timer-settings";
import { PhotosConsentToggle } from "@/components/client/photos-consent-toggle";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { getMySubscription } from "@/lib/supabase/subscriptions";
import { getUnseenVideoCount } from "@/lib/supabase/videos";
import { formatDate } from "@/lib/utils/format-date";
import { logout } from "../actions";
import { CancelSubscriptionButton } from "./cancel-subscription-button";

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  inactive: "Inactiva",
  past_due: "Vencida",
  canceled: "Cancelada",
  trialing: "Prueba",
};

export default async function ProfilePage() {
  const [profile, client, subscription, unseenVideoCount] = await Promise.all([
    getCurrentProfile(),
    getCurrentClientRecord(),
    getMySubscription(),
    getUnseenVideoCount(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">
          {profile?.full_name ?? "Mi perfil"}
        </h1>
        <p className="text-sm text-[#888888]">{profile?.email}</p>
      </div>

      <Link
        href="/client/videos"
        className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4 active:bg-white/5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e8001c]/15 text-[#e8001c]">
          <PlayCircle className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-white">Aprendé</span>
          <span className="block text-xs text-[#888888]">
            Videos de tu coach sobre conceptos, técnica y más
          </span>
        </span>
        {unseenVideoCount > 0 && (
          <span className="flex min-w-[22px] shrink-0 items-center justify-center rounded-full bg-[#e8001c] px-1.5 py-0.5 text-xs font-bold text-white">
            {unseenVideoCount > 9 ? "9+" : unseenVideoCount}
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-[#888888]" />
      </Link>

      <Card className="border-[#1e1e1e] bg-[#111111]">
        <CardHeader>
          <CardTitle className="text-base text-white">Datos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-[#888888]">
          <p>Peso actual: {client?.weightKg ? `${client.weightKg} kg` : "-"}</p>
          <p>Objetivo: {client?.goal ?? "-"}</p>
        </CardContent>
      </Card>

      <Card className="border-[#1e1e1e] bg-[#111111]">
        <CardHeader>
          <CardTitle className="text-base text-white">Suscripción</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-[#888888]">
          <Badge
            variant={
              client?.subscriptionStatus === "active" ? "default" : "secondary"
            }
            className="w-fit"
          >
            {client
              ? (STATUS_LABEL[client.subscriptionStatus] ??
                client.subscriptionStatus)
              : "-"}
          </Badge>
          <p>
            Vence:{" "}
            {client?.subscriptionEndDate
              ? formatDate(client.subscriptionEndDate)
              : "-"}
          </p>
          {subscription && subscription.status !== "canceled" && (
            <CancelSubscriptionButton />
          )}
        </CardContent>
      </Card>

      <Card className="border-[#1e1e1e] bg-[#111111]">
        <CardHeader>
          <CardTitle className="text-base text-white">Entrenamiento</CardTitle>
        </CardHeader>
        <CardContent>
          <RestTimerSettings
            initialEnabled={client?.restTimerEnabled ?? true}
            initialSound={client?.restTimerSoundEnabled ?? true}
            initialVibration={client?.restTimerVibrationEnabled ?? true}
          />
        </CardContent>
      </Card>

      <Card className="border-[#1e1e1e] bg-[#111111]">
        <CardHeader>
          <CardTitle className="text-base text-white">Privacidad</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotosConsentToggle initialAuthorized={client?.photosPublicUseAuthorized ?? null} />
        </CardContent>
      </Card>

      <Card className="border-[#1e1e1e] bg-[#111111]">
        <CardHeader>
          <CardTitle className="text-base text-white">Seguridad</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <LogoutButton
        action={logout}
        checkPendingSets
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#1e1e1e] text-[#888888] active:bg-white/5 disabled:opacity-60"
      >
        <LogOut className="size-4" />
        Cerrar sesión
      </LogoutButton>
    </div>
  );
}
