import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { getCurrentProfile } from "@/lib/supabase/profiles";
import { getCurrentClientRecord } from "@/lib/supabase/client-profile";
import { formatDate } from "@/lib/utils/format-date";
import { logout } from "../actions";

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  inactive: "Inactiva",
  past_due: "Vencida",
  canceled: "Cancelada",
  trialing: "Prueba",
};

export default async function ProfilePage() {
  const [profile, client] = await Promise.all([
    getCurrentProfile(),
    getCurrentClientRecord(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">
          {profile?.full_name ?? "Mi perfil"}
        </h1>
        <p className="text-sm text-[#888888]">{profile?.email}</p>
      </div>

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

      <form action={logout}>
        <button
          type="submit"
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#1e1e1e] text-[#888888] active:bg-white/5"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
