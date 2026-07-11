import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { getPendingInviteCodes } from "@/lib/supabase/invite-codes";
import { formatDate } from "@/lib/utils/format-date";
import { InviteForm } from "./invite-form";

export default async function InviteClientPage() {
  const pendingCodes = await getPendingInviteCodes();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          Invitar cliente
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>

      <FadeIn delay={0}>
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Generar código nuevo
            </CardTitle>
            <CardDescription>
              Compártelo con el cliente para que se registre en /register.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm />
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="border-[#1e1e1e] bg-[#111111]">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Códigos pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingCodes.length === 0 ? (
              <p className="text-sm text-[#888888]">No hay códigos sin usar.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {pendingCodes.map((c) => (
                  <li
                    key={c.code}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-mono text-white">{c.code}</span>
                    <span className="text-[#888888]">
                      {formatDate(c.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
