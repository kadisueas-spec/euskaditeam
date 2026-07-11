import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FadeIn } from "@/components/motion/fade-in";
import { getClientsList } from "@/lib/supabase/clients";
import { getAccessDisplayStatus } from "@/lib/constants/access";
import { formatDate } from "@/lib/utils/format-date";

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

export default async function ClientsPage() {
  const clients = await getClientsList();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
            Clientes
          </h1>
          <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
        </div>
        <Link
          href="/coach/clients/invite"
          className={buttonVariants({ variant: "default" })}
        >
          + Invitar cliente
        </Link>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Todavía no tienes clientes."
          description="Invita al primero para empezar."
        />
      ) : (
        <FadeIn className="overflow-x-auto rounded-2xl border border-[#1e1e1e]">
          <Table>
            <TableHeader>
              <TableRow className="border-[#1e1e1e] hover:bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead>Último entrenamiento</TableHead>
                <TableHead>Suscripción</TableHead>
                <TableHead>Rutina activa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id} className="border-[#1e1e1e]">
                  <TableCell>
                    <Link
                      href={`/coach/clients/${client.id}`}
                      className="font-medium text-white hover:underline"
                    >
                      {client.fullName ?? client.email}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[#888888]">
                    {client.lastWorkoutDate
                      ? formatDate(client.lastWorkoutDate)
                      : "Nunca"}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-[#888888]">
                    {client.activeRoutineName ?? "Sin rutina"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </FadeIn>
      )}
    </div>
  );
}
