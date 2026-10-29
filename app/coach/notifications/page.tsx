import { redirect } from "next/navigation";
import { getBroadcastAudience } from "@/lib/supabase/broadcast";
import { countClientsWithPush } from "@/lib/push/send-push";
import { BroadcastForm } from "./broadcast-form";

// Novedades (oct-2026): una push a todos los clientes con acceso activo.
export default async function CoachNotificationsPage() {
  const audience = await getBroadcastAudience();
  if (!audience) redirect("/coach/dashboard");
  const withPush = await countClientsWithPush(audience.clientIds);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">Novedades</h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
        <p className="mt-3 max-w-prose text-sm text-[#888888]">
          Una notificación a todos tus clientes con acceso activo. Al tocarla, abre Inicio.
        </p>
      </div>
      <BroadcastForm activeClients={audience.clientIds.length} withPush={withPush} />
    </div>
  );
}
